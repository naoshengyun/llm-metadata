import { markdown, usd } from '../official-source-helpers/markdown-table.mjs';

const providerId = 'mistral';
const endpoint = 'https://api.mistral.ai/v1';
const currency = 'USD';
const priceList = 'Mistral API / published model-card rates';
const cards = [
  ['devstral-2-25-12', 'devstral-2512', 'devstral-latest', 'devstral-medium-latest'],
  ['devstral-small-2-25-12', 'labs-devstral-small-2512'],
  ['zai-glm-5-2', 'zai-glm-5-2', 'glm-5-2'],
  ['magistral-medium-1-2-25-09', 'magistral-medium-latest'],
  ['mistral-large-3-25-12', 'mistral-large-2512'],
  ['mistral-medium-3-5-26-04', 'mistral-medium-latest'],
  ['mistral-medium-3-25-05', 'mistral-medium-2505'],
  ['mistral-medium-3-1-25-08', 'mistral-medium-2508'],
  ['mistral-small-3-2-25-06', 'mistral-small-2506'],
  ['mistral-nemo-12b-24-07', 'open-mistral-nemo'],
];

export const adapter = cards.map(([card, ...ids]) => {
  const targets = ids.map((modelId) => ({
    quoteId: 'upstream:mistral:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { endpoint: null, priceList: 'fixed upstream primary or original CNY sheet' },
    referenceOnlyReason:
      'Mistral legacy model-card price; no complete current Standard tariff for the exact request ID',
  }));
  return {
    id: 'mistral-legacy-' + card,
    url: 'https://docs.mistral.ai/models/' + card + '.md',
    targets,
    parse({ body, evidence }) {
      const document = markdown(body);
      return new Map(
        targets.map(({ quoteId, modelId }) => {
          try {
            const names = /^- API names: (.+)$/m.exec(document)?.[1].split(', ') ?? [];
            if (!names.includes('`' + modelId + '`'))
              throw Error('Exact Mistral API ID absent from legacy model card: ' + modelId);
            const retirement = /^- Retirement date: (\d{4}-\d{2}-\d{2})$/m.exec(document)?.[1];
            if (
              !retirement ||
              !Number.isFinite(Date.parse(retirement)) ||
              !/^- Status: (?:Deprecated|Retired)$/m.test(document)
            ) {
              throw Error('Exact Mistral legacy model lifecycle missing: ' + modelId);
            }
            const tariff =
              /^- Pricing: Input (\$\d+(?:\.\d+)?) \/M Tokens; (?:Cached input (\$\d+(?:\.\d+)?) \/M Tokens; )?Output (\$\d+(?:\.\d+)?) \/M Tokens$/m.exec(
                document,
              );
            if (!tariff)
              throw Error('Mistral model card has no exact USD input/output tariff: ' + modelId);
            const [, input, cacheRead, output] = tariff;
            const sourcePrice = {
              input: usd(input),
              ...(cacheRead && { cache_read: usd(cacheRead) }),
              output: usd(output),
            };
            return [
              quoteId,
              {
                identity: { providerId, endpoint, modelId, priceList, currency },
                sourcePrice,
                sourceUnit: 'per_million_tokens',
                required: Object.keys(sourcePrice),
                conditions: {
                  modelCardPrimaryId: names[0].slice(1, -1),
                  retirementDate: retirement,
                  historical: retirement < evidence.obtainedAt.slice(0, 10),
                  cacheReadRatePublished: !!cacheRead,
                },
              },
            ];
          } catch (error) {
            return [quoteId, { error: error.message }];
          }
        }),
      );
    },
  };
});
