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
const retiredIds = new Set(['solar-pro2', 'solar-pro3']);
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
    ...(retiredIds.has(modelId) && {
      referenceOnlyReason:
        'Upstage ended service for this Solar alias; the displayed rates are historical',
    }),
  })),
  parse,
};

function parse({ body, supplemental, evidence }) {
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
        if (retiredIds.has(modelId)) {
          const cardLink =
            'utm_content=' +
            modelId +
            '" class="model-card-title-wrapper w-inline-block"><div class="api-title-flex">';
          if (!blocks[0].endsWith(cardLink))
            throw Error('Exact Upstage alias absent from model card link: ' + modelId);
          // A date without a local time is certainly past only after the entire day in Korea.
          const localDate = new Date(Date.parse(evidence.obtainedAt) + 9 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          if (!retired || localDate <= retired[1])
            throw Error('Past end of service is unverified for exact Upstage alias: ' + modelId);
        } else {
          if (retired) throw Error('Upstage lists end of service for ' + modelId);
          const docs = markdown(supplemental.get(modelId).body);
          requireText(docs, 'Alias: <!-- -->' + modelId + '</div>');
        }
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
            conditions: retired
              ? { historical: true, endOfServiceDate: retired[1], timeZone: 'Asia/Seoul' }
              : {},
            sourceUnit: 'per_million_tokens',
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
