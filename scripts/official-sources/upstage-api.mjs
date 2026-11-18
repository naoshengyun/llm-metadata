import { markdown, requireText } from '../official-source-helpers/markdown-table.mjs';

const providerId = 'upstage';
const endpoint = 'https://api.upstage.ai/v1/solar';
const priceList = 'Upstage Solar API / pay-as-you-go';
const currency = 'USD';
const models = {
  'solar-pro4': 'Solar Pro 4',
  'solar-mini4': 'Solar Mini 4',
  'solar-pro3': 'Solar Pro 3',
  'solar-pro2': 'Solar Pro 2',
};
const feeKeys = { input: 'input', cached: 'cache_read', output: 'output' };

export const adapter = {
  id: 'upstage-api',
  url: 'https://www.upstage.ai/pricing/api',
  supplemental: [
    { id: 'solar-pro4', url: 'https://console.upstage.ai/docs/models/solar-pro-4' },
    { id: 'solar-mini4', url: 'https://console.upstage.ai/docs/models/solar-mini-4' },
  ],
  targets: Object.keys(models).map((modelId) => ({
    quoteId: 'upstream:upstage:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
  })),
  parse,
};

function parse({ body, supplemental }) {
  const html = markdown(body);
  requireText(html, '__WEBFLOW_CURRENCY_SETTINGS = {"currencyCode":"USD"');
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const title = '<h4>' + models[modelId] + '</h4>';
        const blocks = html.split(title);
        if (blocks.length !== 2)
          throw Error('Exact Upstage model card absent or ambiguous: ' + modelId);
        const card = blocks[1].split(/<h4\b/, 1)[0];
        const retired = /End of service on (\d{4}-\d{2}-\d{2}) \(KST\)/.exec(card);
        if (retired)
          throw Error(
            'Upstage service retired on ' + retired[1] + '; historical rate is still displayed',
          );
        const docs = markdown(supplemental.get(modelId).body);
        requireText(docs, 'Alias: <!-- -->' + modelId + '</div>');
        const fees = [
          ...card.matchAll(
            /<div data-rate="(input|cached|output)">(\d+(?:\.\d+)?)<\/div><div data-rate-unit=""[^>]*>1M tokens<\/div>/g,
          ),
        ];
        if (fees.map((fee) => fee[1]).join('|') !== 'input|cached|output')
          throw Error('Missing complete Upstage token rates: ' + modelId);
        const sourcePrice = Object.fromEntries(
          fees.map(([, key, value]) => [feeKeys[key], Number(value)]),
        );
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'us-upstage-' + modelId + '-standard',
            sourcePrice,
            required: Object.keys(sourcePrice),
            conditions: {},
            sourceUnit: 'per_million_tokens',
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
