import { NATIVE_TASK_SCHEMA } from './native-task-schema.js';

export interface TaskCharge {
  usageKey: string;
  amount?: number;
  freeQuantity?: number;
  unit: string;
  currency: 'CNY' | 'USD';
}
export interface TaskQuote {
  plugin: string;
  model: string;
  rejectUnmatched?: true;
  tiers: {
    name: string;
    when?: Record<string, string | boolean>;
    charges: TaskCharge[];
    notApplicable?: Record<string, string>;
  }[];
}
export interface ToolQuote {
  key: string;
  amount?: number;
  unit: string;
  currency: 'CNY' | 'USD';
}
export interface MediaDiagnostic {
  status: 'incomplete' | 'unsupported-shape';
  field: string;
  reason: string;
}
export type TaskResult = { status: 'ready'; expression: string } | MediaDiagnostic;
export type ToolResult = { status: 'ready'; key: string; price: number } | MediaDiagnostic;

interface UsageField {
  type?: string;
  unit?: string;
  enum?: readonly string[];
}
interface TaskPlugin {
  models: readonly string[];
  schema: Record<string, UsageField>;
  profiles: readonly { models: readonly string[]; schema: Record<string, UsageField> }[];
}

export function compileTask(quote: TaskQuote): TaskResult {
  const plugin = (NATIVE_TASK_SCHEMA.plugins as Record<string, TaskPlugin>)[quote.plugin];
  if (!plugin || !plugin.models.includes(quote.model)) {
    return {
      status: 'unsupported-shape',
      field: 'plugin/model',
      reason: 'No declared binding in official rc50 task schema',
    };
  }
  const schema =
    plugin.profiles.find((p) => p.models.includes(quote.model))?.schema ?? plugin.schema;
  if (!quote.tiers.length)
    return { status: 'incomplete', field: 'tiers', reason: 'At least one tier is required' };
  const branches: string[] = [];
  const names = new Set<string>();
  const currencies = new Set<string>();
  for (const [index, tier] of quote.tiers.entries()) {
    if (!tier.name || names.has(tier.name))
      return {
        status: 'incomplete',
        field: 'tiers.name',
        reason: 'Tier names must be nonempty and unique',
      };
    names.add(tier.name);
    const conditions: string[] = [];
    for (const [key, value] of Object.entries(tier.when ?? {})) {
      const field = schema[key];
      if (
        !field ||
        (!(typeof value === 'boolean' && field.type === 'boolean') &&
          !(typeof value === 'string' && field.enum?.includes(value)))
      )
        return {
          status: 'unsupported-shape',
          field: 'tiers.when.' + key,
          reason: 'Condition is not declared in selected rc50 schema',
        };
      conditions.push(`u(${JSON.stringify(key)}) == ${JSON.stringify(value)}`);
    }
    const fallback = index === quote.tiers.length - 1 && !quote.rejectUnmatched;
    if (fallback ? conditions.length !== 0 : conditions.length === 0)
      return {
        status: 'incomplete',
        field: 'tiers.when',
        reason: quote.rejectUnmatched
          ? 'Each tier requires a condition when unmatched usage is rejected'
          : 'Conditional tiers must end with an unconditional fallback',
      };
    if (!tier.charges.length)
      return {
        status: 'incomplete',
        field: 'charges',
        reason: 'At least one explicit charge is required',
      };
    const terms: string[] = [];
    let maximumTotal = 0;
    const seen = new Set<string>();
    for (const charge of tier.charges) {
      const field = `charges.${charge.usageKey}`;
      if (seen.has(charge.usageKey))
        return { status: 'incomplete', field, reason: 'Duplicate usage charge' };
      seen.add(charge.usageKey);
      const usage = schema[charge.usageKey];
      if (!usage || usage.type !== 'number')
        return {
          status: 'unsupported-shape',
          field,
          reason: 'Usage key is not numeric in selected rc50 schema',
        };
      const units: Record<string, string> = {
        token: 'per_million_tokens',
        count: 'per_count',
        second: 'per_second',
        credit: 'per_credit',
      };
      if (charge.unit !== units[usage.unit ?? ''])
        return {
          status: 'unsupported-shape',
          field: field + '.unit',
          reason: 'Price unit does not match native usage unit',
        };
      if (typeof charge.amount !== 'number' || !Number.isFinite(charge.amount) || charge.amount < 0)
        return {
          status: 'incomplete',
          field: field + '.amount',
          reason: 'Explicit finite non-negative amount is required',
        };
      if (charge.currency !== 'USD' && charge.currency !== 'CNY')
        return {
          status: 'incomplete',
          field: field + '.currency',
          reason: 'Original CNY or USD is required',
        };
      if (
        charge.freeQuantity !== undefined &&
        (usage.unit !== 'count' ||
          !Number.isSafeInteger(charge.freeQuantity) ||
          charge.freeQuantity < 0)
      ) {
        return {
          status: 'unsupported-shape',
          field: field + '.freeQuantity',
          reason: 'A free quantity requires a non-negative integer count',
        };
      }
      currencies.add(charge.currency);
      const price = charge.amount * (charge.currency === 'USD' ? 7 : 1);
      if (!Number.isFinite(price))
        return {
          status: 'incomplete',
          field: field + '.amount',
          reason: 'Converted amount is not finite',
        };
      // Official rc50 expr.md host smoke-test ceilings; preserve expression evaluation order.
      const ceilings: Record<string, number> = {
        second: 3600,
        count: 128,
        token: 2147483647,
        credit: 2147483647,
      };
      const product = ceilings[usage.unit!] * price;
      maximumTotal += usage.unit === 'token' ? product / 1000000 : product;
      if (!Number.isFinite(product) || !Number.isFinite(maximumTotal))
        return {
          status: 'incomplete',
          field: field + '.amount',
          reason: 'Rate overflows native usage smoke-test ceilings',
        };
      const observed = `u(${JSON.stringify(charge.usageKey)})`;
      const billable = charge.freeQuantity
        ? `(${observed} > ${charge.freeQuantity} ? ${observed} - ${charge.freeQuantity} : 0)`
        : observed;
      terms.push(`${billable} * ${price}${usage.unit === 'token' ? ' / 1000000' : ''}`);
    }
    for (const [key, field] of Object.entries(schema)) {
      if (
        field.type === 'number' &&
        !seen.has(key) &&
        (typeof tier.notApplicable?.[key] !== 'string' || !tier.notApplicable[key]!.trim())
      )
        return {
          status: 'incomplete',
          field: 'charges.' + key,
          reason:
            'Numeric fee category needs an explicit price, free rate, or not-applicable reason',
        };
    }
    if (currencies.size !== 1)
      return {
        status: 'incomplete',
        field: 'currency',
        reason: 'Mixed currencies in one task quote',
      };
    branches.push(
      `${conditions.length ? conditions.join(' && ') + ' ? ' : ''}tier(${JSON.stringify(tier.name)}, ${terms.join(' + ')})`,
    );
  }
  // New API rejects a negative task price before reserving quota.
  if (quote.rejectUnmatched) branches.push('-1');
  return { status: 'ready', expression: branches.join(' : ') };
}
// Official rc50 setting/operation_setting/tools.go seed names. These have native billing meters.
export const NATIVE_TOOL_NAMES = [
  'web_search',
  'web_search_preview',
  'file_search',
  'google_search',
  'image_generation',
  'google_search_grounded_prompt',
  'search_std',
  'search_pro',
  'search_pro_sogou',
  'search_pro_quark',
  'search_strategy_turbo',
  'search_strategy_max',
  'search_strategy_agent',
  'search_strategy_agent_max',
  'bing_web_search',
  'x_search_posts',
  'x_search_profiles',
  'deepseek_search',
  'deepseek_fetch',
] as const;

export function compileTool(quote: ToolQuote): ToolResult {
  const [name, prefix, extra] = quote.key.split(':');
  const validPrefix = prefix === undefined || /^[^:*\s]+\*$/.test(prefix);
  if (
    !(NATIVE_TOOL_NAMES as readonly string[]).includes(name) ||
    !validPrefix ||
    extra !== undefined
  ) {
    return {
      status: 'unsupported-shape',
      field: 'key',
      reason: 'No native rc50 tool meter or invalid model-prefix key',
    };
  }
  if (quote.unit !== 'per_call' && quote.unit !== 'per_thousand_calls')
    return {
      status: 'unsupported-shape',
      field: 'unit',
      reason: 'Native tool prices require a call-count unit',
    };
  if (typeof quote.amount !== 'number' || !Number.isFinite(quote.amount) || quote.amount < 0)
    return {
      status: 'incomplete',
      field: 'amount',
      reason: 'Explicit finite non-negative amount is required',
    };
  if (quote.currency !== 'USD' && quote.currency !== 'CNY')
    return { status: 'incomplete', field: 'currency', reason: 'Original CNY or USD is required' };
  const price =
    quote.amount * (quote.currency === 'USD' ? 7 : 1) * (quote.unit === 'per_call' ? 1000 : 1);
  if (!Number.isFinite(price))
    return { status: 'incomplete', field: 'amount', reason: 'Converted amount is not finite' };
  return { status: 'ready', key: quote.key, price };
}
