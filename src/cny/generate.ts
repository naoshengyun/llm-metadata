import { createHash } from 'node:crypto';
import { compileTask, compileTool, type TaskQuote, type ToolQuote } from './media.js';
import type { ModelCost } from '../billing/cost.js';
import { NewApiBuilder } from '../services/newapi-builder.js';
import type { NormalizedData } from '../types/index.js';

export interface OfficialQuote {
  id: string;
  provider: string;
  model: string;
  priceList: string;
  origin: 'domestic' | 'foreign';
  currency: 'CNY' | 'USD';
  source: { url: string; checkedAt: string };
  /** Paths of every applicable charge, including explicitly free charges. */
  required: string[];
  cost: ModelCost;
  description?: string;
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
const PRICE_KEYS = new Set([
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
    return Number((value * factor).toPrecision(15));
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
    } else if (key === 'size') {
      if (typeof item !== 'number' || !Number.isSafeInteger(item) || item <= 0) errors.push(p);
    } else if (key === 'currency' || key === 'currency_options') errors.push(p);
    else if (['tiers', 'tier', 'context_over_200k', 'schedule', 'windows'].includes(key)) {
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
      !record.source?.url?.startsWith('https://') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.source?.checkedAt ?? '')
    ) {
      diagnostic.status = 'missing-source';
      diagnostic.fields.push('source.url/source.checkedAt');
    }
    const fields = inspectCost(record.cost);
    if (record.kind && !['model', 'task', 'tool'].includes(record.kind)) fields.push('kind');
    if (record.kind === 'task' && !record.task) fields.push('task');
    if (record.kind === 'tool' && !record.tools?.length) fields.push('tools');
    const thresholds = new Set<number>();
    for (const tier of record.cost?.tiers ?? []) {
      const threshold = tier.tier?.size;
      if (
        typeof threshold !== 'number' ||
        !Number.isSafeInteger(threshold) ||
        threshold <= 0 ||
        thresholds.has(threshold)
      )
        fields.push('tiers.threshold');
      if (threshold !== undefined) thresholds.add(threshold);
    }
    if (inspectCost(convert(record.cost, CNY_POLICY[record.currency])).length)
      fields.push('converted price overflow');
    if (
      !record.provider ||
      !record.model ||
      !record.priceList ||
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
    for (const path of record.required ?? []) {
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
  for (const [name, id] of Object.entries(input.selection)) {
    const entry = catalog.find((x) => x.original.id === id);
    if (!entry) {
      diagnostics.push({ id, status: 'missing-source', fields: ['selection'] });
      continue;
    }
    if (!entry.cnyCost) continue;
    if (entry.original.task || entry.original.tools?.length) {
      const expectedCurrency = entry.original.currency;
      const task = entry.original.task;
      if (task) {
        if (task.tiers.some((t) => t.charges.some((c) => c.currency !== expectedCurrency))) {
          entry.diagnostic.status = 'incomplete';
          entry.diagnostic.fields.push('task.currency');
          continue;
        }
        const result = compileTask(task);
        if (result.status !== 'ready') {
          entry.diagnostic.status = result.status;
          entry.diagnostic.fields.push(result.field + ': ' + result.reason);
          continue;
        }
        plugins[name] = { [task.plugin]: result.expression };
      }
      for (const tool of entry.original.tools ?? []) {
        if (tool.currency !== expectedCurrency) {
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
        if (Object.hasOwn(tools, result.key) && tools[result.key] !== result.price)
          throw new Error(`conflicting tool price: ${result.key}`);
        tools[result.key] = result.price;
      }
    }
    if (entry.original.kind === 'task' || entry.original.kind === 'tool') continue;
    const config = builder.buildPriceConfig({
      providers: {
        selected: { id: 'selected', models: { [name]: { id: name, cost: entry.cnyCost } } },
      },
    });
    const expr = config.config.data.billing_expr[name];
    if (!expr || config.warnings.length) {
      entry.diagnostic.status = 'unsupported-shape';
      entry.diagnostic.fields.push(...config.warnings, ...(!expr ? ['no expressible price'] : []));
      continue;
    }
    models[name] = { billing_mode: 'tiered_expr', billing_expr: expr };
  }
  return {
    catalog,
    models,
    plugins,
    tools,
    diagnostics,
    policy: CNY_POLICY,
    selection: structuredClone(input.selection),
  };
}
