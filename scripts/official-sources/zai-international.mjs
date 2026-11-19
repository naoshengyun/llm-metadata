import {
  exactRow,
  markdown,
  requireText,
  section,
  table,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const providerId = 'zai';
const endpoint = 'https://api.z.ai/api/paas/v4';
const priceList = 'Z.AI international API';
const currency = 'USD';
const models = [
  'glm-4.5',
  'glm-4.5-air',
  'glm-4.5-flash',
  'glm-4.5v',
  'glm-4.6',
  'glm-4.6v',
  'glm-4.6v-flash',
  'glm-4.7',
  'glm-4.7-flash',
  'glm-4.7-flashx',
  'glm-5',
  'glm-5-turbo',
  'glm-5.1',
  'glm-5.2',
  'glm-5.3',
  'glm-5.3-flash',
  'glm-5.3-flashx',
  'glm-5v-turbo',
];
const columns = ['Model', 'Input', 'Cached Input', 'Cached Input Storage', 'Output'];
const required = ['input', 'cache_read', 'cache_write', 'output'];
const conditions = { listedFeeClass: 'free', cachedInputStorage: 'listed-free' };

export const adapter = {
  id: 'zai-international',
  url: 'https://docs.z.ai/guides/overview/pricing.md',
  targets: models.map((modelId) => ({
    quoteId: 'upstream:zai:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
    baselineConditions: conditions,
  })),
  parse,
};

function readRates(body) {
  const text = markdown(body);
  requireText(text, 'All prices are in USD.');
  const [current, other, ...extra] = text.split('> [accordion] Other Pricing\n');
  if (!other || extra.length) throw Error('Missing or ambiguous Z.AI Other Pricing section');
  const archived = other.replace(/^> ?/gm, '');
  return [
    [current, '### Latest Models'],
    [current, '### Text Models'],
    [archived, '### Text Models'],
    [archived, '### Vision Models'],
  ].flatMap(([block, heading]) => {
    const prices = section(block, heading);
    requireText(prices, 'Prices per 1M tokens.');
    return table(prices, columns);
  });
}

function parse({ body }) {
  const rows = readRates(body);
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const [, input, read, storage, output] = exactRow(
          rows,
          ([name]) => name.toLowerCase() === modelId,
          modelId,
          columns.length,
        );
        if ([input, read, storage, output].every((value) => value === 'Free')) {
          return [
            quoteId,
            {
              identity: { providerId, endpoint, modelId, priceList, currency },
              recordId: 'us-zai-' + modelId + '-international',
              sourcePrice: { input: 0, cache_read: 0, cache_write: 0, output: 0 },
              sourceUnit: 'per_million_tokens',
              required,
              conditions,
            },
          ];
        }
        const amounts = [input, read, output].map((cell) => usd(cell, /^\\\$(\d+(?:\.\d+)?)$/));
        if (storage === 'Limited-time Free') {
          throw Error(
            'Z.AI publishes USD ' +
              amounts.join('/') +
              ' input/cached input/output per 1M and limited-time free storage; no applicable cache-write rate',
          );
        }
        throw Error('No verified Z.AI cache-write or storage terms for ' + modelId);
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
