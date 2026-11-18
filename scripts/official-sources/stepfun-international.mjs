import {
  exactRow,
  markdown,
  requireText,
  section,
  table,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const providerId = 'stepfun-ai';
const endpoint = 'https://api.stepfun.ai/v1';
const priceList = 'Stepfun International API / pay-as-you-go';
const currency = 'USD';
const models = ['step-5-preview', 'step-3.7-flash', 'step-3.5-flash', 'step-3.5-flash-2603'];
const columns = ['Model', 'Billing unit', 'Input (cache miss)', 'Input (cache hit)', 'Output'];
const required = ['input', 'cache_read', 'output'];
const conditions = { cacheWritesIncludedInInput: true, cacheEviction: 'LRU' };

export const adapter = {
  id: 'stepfun-international',
  url: 'https://platform.stepfun.ai/docs/en/guides/pricing/details.md',
  supplemental: [
    { id: 'cache', url: 'https://platform.stepfun.ai/docs/en/guides/developer/prompt-cache.md' },
  ],
  targets: models.map((modelId) => ({
    quoteId: 'upstream:stepfun-ai:' + modelId + ':USD',
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

function parse({ body, supplemental }) {
  const cache = markdown(supplemental.get('cache').body);
  requireText(
    cache,
    'Uncached input tokens, including the first write to the cache, use the cache-miss input rate;',
  );
  requireText(cache, 'Eviction uses LRU:');
  requireText(cache, 'with rates expressed in USD per 1M tokens.');
  const pricing = markdown(body);
  const rows = [
    '### Pricing for Multimodal Reasoning Models',
    '### Pricing for Reasoning Models',
  ].flatMap((heading) => table(section(pricing, heading), columns));
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const [, unit, ...rates] = exactRow(
          rows,
          ([name]) => name === '`' + modelId + '`',
          modelId,
          5,
        );
        if (unit !== '1M tokens')
          throw Error('Unexpected StepFun International unit for ' + modelId);
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'usd-stepfun-' + modelId + '-international',
            sourcePrice: Object.fromEntries(
              required.map((key, index) => [key, usd(rates[index], /^\\\$(\d+(?:\.\d+)?)$/)]),
            ),
            required,
            conditions,
            sourceUnit: 'per_million_tokens',
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
