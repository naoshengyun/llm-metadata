import { tables } from '../official-source-helpers/html-table.mjs';
import { markdown, requireText, usd } from '../official-source-helpers/markdown-table.mjs';

const ids = [
  'grok-4.20-0309-non-reasoning',
  'grok-4.20-0309-reasoning',
  'grok-4.20-multi-agent-0309',
  'grok-4.3',
  'grok-4.5',
  'grok-4.6',
  'grok-4.7',
  'grok-4.7-build-fast',
  'grok-build-0.1',
];
const providerId = 'xai';
const endpoint = 'https://api.x.ai/v1';
const priceList = 'xAI API / global text standard';
const currency = 'USD';
const conditions = { cacheMode: 'automatic', tierAppliesTo: 'entire-request' };
const charges = ['input', 'cache_read', 'output'];

export const adapter = {
  id: 'xai-text',
  url: 'https://docs.x.ai/developers/pricing',
  supplemental: [
    { id: 'cache', url: 'https://docs.x.ai/developers/advanced-api-usage/prompt-caching.md' },
  ],
  targets: ids.map((modelId) => {
    const legacy = modelId === 'grok-4.7-build-fast';
    return {
      quoteId: legacy ? 'upstream:xai:' + modelId + ':USD' : recordId(modelId),
      providerId,
      endpoint,
      modelId,
      priceList,
      currency,
      group: modelId,
      ...(legacy && {
        baselineIdentity: {
          endpoint: null,
          priceList: 'fixed upstream primary or original CNY sheet',
        },
        baselineConditions: conditions,
      }),
    };
  }),
  parse,
};

function recordId(modelId) {
  return 'us-xai-' + modelId + '-global-standard';
}

function tokenPrices(html, rows, modelId) {
  const link = new RegExp(
    '<a\\b[^>]*href="/developers/models/' +
      modelId.replaceAll('.', '\\.') +
      '"[^>]*>' +
      modelId.replaceAll('.', '\\.') +
      '</a>',
  );
  const exact = rows.filter((row) => link.test(row[0]?.html));
  if (exact.length !== 1) throw Error('Exact xAI text price row missing or ambiguous: ' + modelId);
  const [row] = exact;
  const threshold = /Long context (≥|>|&ge;|&gt;) ([1-9]\d*)k tokens$/.exec(row[0].text);
  if (!threshold || row.length !== 8)
    throw Error('Incomplete xAI long context pricing: ' + modelId);
  requireText(
    html,
    'Models with long context pricing bill the long context rates for all tokens in a request',
  );
  const [ordinary, long] = [row.slice(2, 5), row.slice(5)].map((rates) =>
    Object.fromEntries(charges.map((key, index) => [key, usd(rates[index].text)])),
  );
  const size = Number(threshold[2]) * 1000;
  const inclusive = threshold[1] === '≥' || threshold[1] === '&ge;';
  const tier = { size, type: 'context', ...(inclusive && { comparison: 'gte' }) };
  const legacyContext = modelId !== 'grok-4.7-build-fast';
  return {
    sourcePrice: {
      ...ordinary,
      ...(legacyContext && { context_over_200k: long }),
      tiers: [{ tier, ...long }],
    },
    required: [
      ...charges,
      ...(legacyContext ? charges.map((key) => 'context_over_200k.' + key) : []),
      ...charges.map((key) => 'tiers.0.' + key),
    ],
  };
}

function parse({ body, supplemental }) {
  const html = markdown(body);
  const cache = markdown(supplemental.get('cache').body);
  requireText(cache, 'The xAI API performs prompt caching **automatically**.');
  requireText(html, 'All prices are in USD.');
  requireText(html, 'Prices per 1M tokens');
  const sameHeader = (cells, match) => cells?.map((cell) => cell.text).join('|') === match;
  const matching = tables(html).filter(
    ([header, subheader]) =>
      sameHeader(header, 'Model|Context|Short context|Long context') &&
      sameHeader(subheader, 'Input|Cached|Output|Input|Cached|Output'),
  );
  if (matching.length !== 1) throw Error('Missing or ambiguous xAI standard text table');
  const rows = matching[0].slice(2);
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: recordId(modelId),
            ...tokenPrices(html, rows, modelId),
            sourceUnit: 'per_million_tokens',
            conditions,
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
