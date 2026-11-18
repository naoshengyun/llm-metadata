import { createHash } from 'node:crypto';
import { compileTask, compileTool, type TaskQuote, type ToolQuote } from './media.js';
import type { ModelCost, ThinkingToggle } from '../billing/cost.js';
import { NewApiBuilder } from '../services/newapi-builder.js';
import type { Model, NormalizedData } from '../types/index.js';

export interface OfficialQuote {
  id: string;
  provider: string;
  model: string;
  priceList: string;
  endpoint?: string;
  origin: 'domestic' | 'foreign';
  currency: 'CNY' | 'USD';
  source: { url: string; checkedAt: string };
  /** Paths of every applicable charge, including explicitly free charges. */
  required: string[];
  cost: ModelCost;
  /** Explicitly pin a model in the upstream snapshot; disappearance blocks this new quote. */
  upstreamKey?: { provider: string; model: string };
  description?: string;
  thinkingToggle?: ThinkingToggle;
  kind?: 'model' | 'task' | 'tool';
  task?: TaskQuote;
  tools?: ToolQuote[];
}
export interface Diagnostic {
  id: string;
  status: 'ready' | 'missing-source' | 'incomplete' | 'unsupported-shape';
  fields: string[];
}
export interface CnyInput {
  upstream: NormalizedData | Record<string, never>;
  records: OfficialQuote[];
  /** Native billing name -> exact official price-list record. No priority fallback. */
  selection: Record<string, string>;
}
export const CNY_POLICY = Object.freeze({
  USD: 7,
  CNY: 1,
  USDExchangeRate: 1,
  QuotaPerUnit: 500000,
});
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
export function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export const PRICE_KEYS: ReadonlySet<string> = new Set([
  'input',
  'output',
  'cache_read',
  'cache_write',
  'cache_write_1h',
  'cache_write_12h',
  'reasoning',
  'input_audio',
  'output_audio',
  'input_image',
  'output_image',
  'cache_read_image',
  'per_image',
]);
function convert(value: unknown, factor: number, key = ''): unknown {
  if (typeof value === 'number' && PRICE_KEYS.has(key))
    return factor === 1 ? value : Number((value * factor).toPrecision(15));
  if (Array.isArray(value)) return value.map((v) => convert(v, factor));
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v, factor, k)]));
  return value;
}
function inspectCost(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') return [path || 'cost'];
  const errors: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    const p = path ? `${path}.${key}` : key;
    if (PRICE_KEYS.has(key)) {
      if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) errors.push(p);
    } else if (['size', 'maxInput', 'maxOutput'].includes(key)) {
      if (typeof item !== 'number' || !Number.isSafeInteger(item) || item <= 0) errors.push(p);
    } else if (key === 'comparison') {
      if (item !== 'gte') errors.push(p);
    } else if (key === 'tiers') {
      if (!Array.isArray(item)) {
        errors.push(p);
        continue;
      }
      const thresholds = new Set<number>();
      for (const [index, tier] of item.entries()) {
        const size = tier?.tier?.size;
        const threshold =
          typeof size === 'number' && tier?.tier?.comparison === 'gte' ? size - 1 : size;
        if (
          typeof threshold !== 'number' ||
          !Number.isSafeInteger(threshold) ||
          threshold <= 0 ||
          thresholds.has(threshold)
        )
          errors.push(`${p}.${index}.threshold`);
        if (typeof threshold === 'number') thresholds.add(threshold);
        errors.push(...inspectCost(tier, `${p}.${index}`));
      }
    } else if (key === 'currency' || key === 'currency_options') errors.push(p);
    else if (
      ['tiers', 'tier', 'context_over_200k', 'schedule', 'windows', 'short_output'].includes(key)
    ) {
      if (Array.isArray(item)) item.forEach((v, i) => errors.push(...inspectCost(v, `${p}.${i}`)));
      else errors.push(...inspectCost(item, p));
    } else if (!['size', 'type', 'name', 'weekdays', 'hours', 'timezone', 'fallback'].includes(key))
      errors.push(p);
  }
  return errors;
}
export function generateCny(input: CnyInput) {
  const catalog: {
    original: OfficialQuote;
    cnyCost?: ModelCost;
    snapshotModel?: Model;
    sourceHash: string;
    diagnostic: Diagnostic;
  }[] = [];
  const ids = new Set<string>();
  for (const record of input.records) {
    if (!record.id || ids.has(record.id))
      throw new Error(`duplicate/empty official record id: ${record.id}`);
    ids.add(record.id);
    const original = structuredClone(record);
    const diagnostic: Diagnostic = { id: record.id, status: 'ready', fields: [] };
    if (
      typeof record.source?.url !== 'string' ||
      !record.source.url.startsWith('https://') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.source?.checkedAt ?? '')
    ) {
      diagnostic.status = 'missing-source';
      diagnostic.fields.push('source.url/source.checkedAt');
    }
    const upstream =
      input.upstream.providers?.[record.upstreamKey?.provider ?? record.provider]?.models?.[
        record.upstreamKey?.model ?? record.model
      ];
    const fields = inspectCost(record.cost);
    if (record.upstreamKey && !upstream) fields.push('upstream model deleted/missing');
    if (
      record.task &&
      (!Array.isArray(record.task.tiers) ||
        record.task.tiers.some(
          (t) =>
            !t ||
            !Array.isArray(t.charges) ||
            t.charges.some((c) => !c || typeof c.usageKey !== 'string'),
        ))
    )
      fields.push('task.tiers.charges');
    if (
      record.tools &&
      (!Array.isArray(record.tools) || record.tools.some((t) => !t || typeof t.key !== 'string'))
    )
      fields.push('tools');
    if (record.cost?.tiers && !Array.isArray(record.cost.tiers)) fields.push('cost.tiers');
    if (record.kind && !['model', 'task', 'tool'].includes(record.kind)) fields.push('kind');
    if (record.kind === 'task' && !record.task) fields.push('task');
    if (record.kind === 'tool' && !record.tools?.length) fields.push('tools');
    if (inspectCost(convert(record.cost, CNY_POLICY[record.currency])).length)
      fields.push('converted price overflow');
    if (
      !record.provider ||
      !record.model ||
      !record.priceList ||
      (record.endpoint !== undefined &&
        !/^https:\/\/[^/@\s]+(?:\/[^\s]*)?$/.test(record.endpoint)) ||
      !['domestic', 'foreign'].includes(record.origin)
    )
      fields.push('official identity');
    if (record.currency !== (record.origin === 'domestic' ? 'CNY' : 'USD'))
      fields.push('original currency');
    if (
      !Array.isArray(record.required) ||
      ((!record.kind || record.kind === 'model') && !record.required.length)
    )
      fields.push('required');
    for (const path of Array.isArray(record.required) ? record.required : []) {
      if (typeof path !== 'string') {
        fields.push('required path');
        continue;
      }
      const v = path
        .split('.')
        .reduce<unknown>(
          (v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined),
          record.cost,
        );
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fields.push(path);
    }
    if (fields.length) {
      diagnostic.status = 'incomplete';
      diagnostic.fields.push(...fields);
    }
    const entry = { original, sourceHash: hash(original), diagnostic };
    catalog.push(
      diagnostic.status === 'ready'
        ? {
            ...entry,
            cnyCost: {
              ...(convert(record.cost, CNY_POLICY[record.currency]) as ModelCost),
              currency: 'CNY',
            },
          }
        : entry,
    );
  }
  for (const entry of catalog) {
    const quote = entry.original;
    const upstream =
      input.upstream.providers?.[quote.upstreamKey?.provider ?? quote.provider]?.models?.[
        quote.upstreamKey?.model ?? quote.model
      ];
    if (entry.cnyCost)
      entry.snapshotModel = {
        ...structuredClone(upstream ?? {}),
        id: quote.model,
        cost: entry.cnyCost,
      };
  }
  const models: Record<string, { billing_mode: 'tiered_expr'; billing_expr: string }> = {};
  const plugins: Record<string, Record<string, string>> = {};
  const tools: Record<string, number> = {};
  const diagnostics = catalog.map((x) => x.diagnostic);
  const builder = new NewApiBuilder(
    {
      quotaDisplayType: 'CNY',
      usdExchangeRate: 1,
      usdSettlementRate: 0,
      customCurrencySymbol: '¥',
      customCurrencyExchangeRate: 1,
      preferredListCurrency: 'CNY',
    },
    {},
  );
  const compiled = new Map<
    string,
    {
      model?: { billing_mode: 'tiered_expr'; billing_expr: string };
      plugins: Record<string, string>;
      tools: Record<string, number>;
    }
  >();
  // Validate every official list before selecting native billing names. No aggregation or
  // native-provider filter may erase a rejected or alternate official price list.
  for (const entry of catalog) {
    if (!entry.cnyCost) continue;
    const quote = entry.original;
    const candidate: {
      model?: { billing_mode: 'tiered_expr'; billing_expr: string };
      plugins: Record<string, string>;
      tools: Record<string, number>;
    } = { plugins: {}, tools: {} };
    if (quote.task) {
      if (quote.task.model !== quote.model) {
        entry.diagnostic.status = 'incomplete';
        entry.diagnostic.fields.push('task.model must match official model');
        continue;
      }
      if (quote.task.tiers.some((t) => t.charges.some((c) => c.currency !== quote.currency))) {
        entry.diagnostic.status = 'incomplete';
        entry.diagnostic.fields.push('task.currency');
        continue;
      }
      const result = compileTask(quote.task);
      if (result.status !== 'ready') {
        entry.diagnostic.status = result.status;
        entry.diagnostic.fields.push(result.field + ': ' + result.reason);
        continue;
      }
      candidate.plugins[quote.task.plugin] = result.expression;
    }
    for (const tool of quote.tools ?? []) {
      if (tool.currency !== quote.currency) {
        entry.diagnostic.status = 'incomplete';
        entry.diagnostic.fields.push('tools.currency');
        continue;
      }
      const result = compileTool(tool);
      if (result.status !== 'ready') {
        entry.diagnostic.status = result.status;
        entry.diagnostic.fields.push(result.field + ': ' + result.reason);
        continue;
      }
      if (
        Object.hasOwn(candidate.tools, result.key) &&
        candidate.tools[result.key] !== result.price
      ) {
        entry.diagnostic.status = 'incomplete';
        entry.diagnostic.fields.push(`conflicting tool price: ${result.key}`);
        continue;
      }
      candidate.tools[result.key] = result.price;
    }
    if (!quote.kind || quote.kind === 'model') {
      if (
        entry.cnyCost.per_image !== undefined &&
        Object.entries(entry.cnyCost).some(
          ([key, value]) => !['per_image', 'currency'].includes(key) && value !== undefined,
        )
      ) {
        entry.diagnostic.status = 'unsupported-shape';
        entry.diagnostic.fields.push(
          'per_image: combined fixed-image and Token/tier/schedule charges are not supported by this adapter',
        );
        continue;
      }
      const result = builder.buildPriceConfig({
        providers: {
          selected: {
            id: 'selected',
            ...(quote.thinkingToggle && { billing: { thinkingToggle: quote.thinkingToggle } }),
            models: { official: { ...entry.snapshotModel, id: 'official', cost: entry.cnyCost } },
          },
        },
      });
      const expr = result.config.data.billing_expr.official;
      if (!expr || result.warnings.length) {
        entry.diagnostic.status = 'unsupported-shape';
        entry.diagnostic.fields.push(
          ...result.warnings,
          ...(!expr ? ['no expressible price'] : []),
        );
        continue;
      }
      candidate.model = { billing_mode: 'tiered_expr', billing_expr: expr };
    }
    if (entry.diagnostic.status === 'ready') compiled.set(quote.id, candidate);
  }
  for (const [name, id] of Object.entries(input.selection)) {
    if (!ids.has(id)) diagnostics.push({ id, status: 'missing-source', fields: ['selection'] });
    const candidate = compiled.get(id);
    if (!candidate) continue;
    const quote = catalog.find((entry) => entry.original.id === id)!.original;
    if (quote.task && name !== quote.task.model) {
      diagnostics.push({
        id: `${id}@${name}`,
        status: 'unsupported-shape',
        fields: ['native plugin variant model must match declared plugin model'],
      });
      continue;
    }
    if (candidate.model) models[name] = candidate.model;
    if (Object.keys(candidate.plugins).length) plugins[name] = { ...candidate.plugins };
    for (const [key, price] of Object.entries(candidate.tools)) {
      if (Object.hasOwn(tools, key) && tools[key] !== price)
        throw new Error(`conflicting tool price: ${key}`);
      tools[key] = price;
    }
  }
  const selected = new Set(Object.values(input.selection));
  const exclusions = [
    ...diagnostics.filter((d) => d.status !== 'ready'),
    ...catalog
      .filter((entry) => !selected.has(entry.original.id))
      .map((entry) => ({
        id: entry.original.id,
        status: 'not-selected',
        fields: ['explicit official selection required'],
      })),
  ];
  return {
    catalog,
    models,
    plugins,
    tools,
    diagnostics,
    exclusions,
    policy: CNY_POLICY,
    selection: structuredClone(input.selection),
  };
}
