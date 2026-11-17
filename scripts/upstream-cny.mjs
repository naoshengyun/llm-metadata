/** Pure adapter. Upstream metadata stays intact; selected CNY prices have separate provenance. */
import { createHash } from 'node:crypto';
import { buildBillingExpr } from '../.cache/cny-build/billing/expr.js';
import { COST_FAMILIES } from '../.cache/cny-build/billing/cost-families.js';
export const domesticProviders = new Set([
  'alibaba-cn',
  'bailing',
  'deepseek',
  'longcat',
  'minimax-cn',
  'moonshotai-cn',
  'sensenova',
  'stepfun',
  'tencent-tokenhub',
  'volcengine',
  'xiaomi',
  'zhipuai',
]);
export const regionalPairs = {
  alibaba: 'alibaba-cn',
  moonshotai: 'moonshotai-cn',
  zai: 'zhipuai',
  minimax: 'minimax-cn',
  'stepfun-ai': 'stepfun',
};
const money = new Set([
  ...COST_FAMILIES,
  'per_image',
  'per_second_2k',
  'per_second_768p',
  'per_second_480p',
  'per_10k_chars',
]);
const structure = new Set(['tiers', 'context_over_200k', 'schedule', 'windows']);
const nonPriceFields = new Set([
  'tier',
  'size',
  'type',
  'timezone',
  'fallback',
  'name',
  'weekdays',
  'hours',
]);
export function convertSheet(value, factor) {
  if (Array.isArray(value)) return value.map((v) => convertSheet(v, factor));
  const out = structuredClone(value);
  for (const [k, v] of Object.entries(out)) {
    if (money.has(k) && typeof v === 'number')
      out[k] = factor === 1 ? v : Number((v * factor).toPrecision(15));
    else if (structure.has(k) && v && typeof v === 'object') out[k] = convertSheet(v, factor);
  }
  return out;
}
function invalidSheet(value, path = '') {
  for (const [k, v] of Object.entries(value)) {
    if (money.has(k) && (typeof v !== 'number' || !Number.isFinite(v) || v < 0))
      return `invalid-price:${path + k}`;
    if (structure.has(k) && v && typeof v === 'object') {
      for (const [i, child] of Array.isArray(v) ? v.map((x, i) => [i, x]) : [[null, v]]) {
        const e = invalidSheet(child, `${path + k}.${i ?? ''}.`);
        if (e) return e;
      }
    }
  }
}
function unsupported(sheet) {
  for (const [k, v] of Object.entries(sheet)) {
    if (k.startsWith('per_') && k !== 'per_image') return `unsupported-unit:${k}`;
    if (!money.has(k) && !structure.has(k) && !nonPriceFields.has(k))
      return `unknown-price-field:${k}`;
    if (structure.has(k) && v && typeof v === 'object') {
      const list = Array.isArray(v) ? v : [v];
      for (const x of list) {
        const why = unsupported(x);
        if (why) return why;
      }
    }
  }
}
export function adaptPrice(provider, model) {
  const cost = model.cost;
  if (provider.subscription)
    return { status: 'subscription', reason: 'subscription-not-token-tariff' };
  if (!cost) return { status: 'missing', reason: 'missing-cost' };
  let sheet, sourceCurrency, factor;
  if (cost.currency === 'CNY') {
    sheet = cost;
    sourceCurrency = 'CNY';
    factor = 1;
  } else if (cost.currency_options?.CNY) {
    sheet = cost.currency_options.CNY;
    sourceCurrency = 'CNY';
    factor = 1;
  } else if (domesticProviders.has(provider.id) || provider.currency === 'CNY')
    return { status: 'missing', reason: 'missing-original-CNY' };
  else if ((cost.currency ?? 'USD') === 'USD') {
    sheet = cost;
    sourceCurrency = 'USD';
    factor = 7;
  } else return { status: 'missing', reason: `unsupported-source-currency:${cost.currency}` };
  const { currency_options, currency, ...original } = sheet;
  const invalid = invalidSheet(original);
  if (invalid) return { status: 'unsupported', reason: invalid, sourceCurrency };
  const cny = { ...convertSheet(original, factor), currency: 'CNY' };
  const why = unsupported(original);
  if (why) return { status: 'unsupported', reason: why, sourceCurrency, cost: cny };
  if (typeof cny.input === 'number' && typeof cny.output !== 'number')
    return { status: 'unsupported', reason: 'missing-output-price', sourceCurrency, cost: cny };
  const built = buildBillingExpr(cny, provider.billing ?? {});
  if (!built.expr || built.warnings.length)
    return {
      status: 'unsupported',
      reason: built.warnings.join('; ') || 'not-expressible',
      sourceCurrency,
      cost: cny,
    };
  return { status: 'eligible', sourceCurrency, cost: cny, expr: built.expr, unit: built.unit };
}
export function adaptCatalog(source) {
  const providers = structuredClone(source),
    records = [];
  for (const p of Object.values(providers))
    for (const [id, m] of Object.entries(p.models)) {
      const price = adaptPrice(p, m);
      records.push({ providerId: p.id, modelId: id, ...price });
      m.sourceCost = m.cost;
      m.cost = price.cost
        ? {
            ...price.cost,
            ...(price.expr ? { publication_expr: price.expr, publication_unit: price.unit } : {}),
          }
        : { currency: 'CNY' };
      m.cnyPrice = price;
    }
  const selected = {},
    exclusions = [];
  const groups = Map.groupBy(records, (r) => r.modelId);
  for (const [id, group] of groups) {
    const nonSubscription = group.filter((r) => r.status !== 'subscription');
    const domestic = nonSubscription.filter(
      (r) => domesticProviders.has(r.providerId) || source[r.providerId].currency === 'CNY',
    );
    const pool = domestic.length ? domestic : nonSubscription;
    // Published mapping is explicit and recorded; original priority is never consulted.
    pool.sort((a, b) => a.providerId.localeCompare(b.providerId));
    const eligible = pool.filter((r) => r.status === 'eligible');
    const ambiguous = new Set(eligible.map((r) => r.expr)).size > 1;
    const winner = ambiguous ? undefined : eligible[0];
    if (winner)
      selected[id] = {
        providerId: winner.providerId,
        billing_mode: 'tiered_expr',
        billing_expr: winner.expr,
      };
    for (const row of group)
      if (row !== winner)
        exclusions.push({
          providerId: row.providerId,
          modelId: id,
          status: row.status,
          reason:
            row.status === 'eligible'
              ? ambiguous && pool.includes(row)
                ? 'ambiguous-regional-prices'
                : `regional-duplicate:${winner?.providerId ?? 'domestic-price-unavailable'}`
              : row.reason,
        });
  }
  const config = { success: true, message: '', data: { billing_mode: {}, billing_expr: {} } };
  for (const [id, r] of Object.entries(selected).sort(([a], [b]) => a.localeCompare(b))) {
    config.data.billing_mode[id] = r.billing_mode;
    config.data.billing_expr[id] = r.billing_expr;
  }
  for (const p of Object.values(providers))
    for (const [id, m] of Object.entries(p.models)) {
      if (selected[id]?.providerId !== p.id && m.cost) {
        delete m.cost.publication_expr;
        delete m.cost.publication_unit;
      }
      m.cnyPrice.exported = selected[id]?.providerId === p.id;
      if (m.cnyPrice.status === 'eligible' && !m.cnyPrice.exported)
        m.cnyPrice.exportReason = 'regional-information-only';
    }
  return {
    providers,
    records,
    selected,
    exclusions,
    config,
    stats: {
      providers: Object.keys(source).length,
      models: records.length,
      apiModels: Object.keys(selected).length,
      statuses: Object.fromEntries(
        ['eligible', 'missing', 'unsupported', 'subscription'].map((s) => [
          s,
          records.filter((r) => r.status === s).length,
        ]),
      ),
    },
  };
}
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
