import { textContent } from '../official-source-helpers/html-table.mjs';
import { markdown, requireText, usd } from '../official-source-helpers/markdown-table.mjs';

const providerId = 'cohere';
const endpoint = 'https://api.cohere.com/v2/chat';
const priceList = 'Cohere API / production pay-as-you-go';
const currency = 'USD';
const models = {
  'command-a': 'command-a-03-2025',
  'command-r': 'command-r-08-2024',
  'command-r-plus': 'command-r-plus-08-2024',
  'command-r7b': 'command-r7b-12-2024',
  'aya-expanse': 'c4ai-aya-expanse-32b',
};
const conditions = { inputOutputMeter: 'billed_units', apiKeyTier: 'production' };

export const adapter = {
  id: 'cohere-api',
  url: 'https://cohere.com/pricing',
  supplemental: Object.keys(models).map((id) => ({
    id,
    url: 'https://docs.cohere.com/docs/' + id,
  })),
  targets: Object.entries(models).map(([group, modelId]) => ({
    quoteId: 'upstream:cohere:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group,
    baselineIdentity: { endpoint: null, priceList: 'fixed upstream primary or original CNY sheet' },
    baselineConditions: conditions,
  })),
  parse,
};

function commandPrices(page, modelId) {
  const ids = [...page.matchAll(/<strong>Model ID<\/strong><div\b[^>]*>([^<]+)<\/div>/g)];
  if (ids.length !== 1 || ids[0][1] !== modelId)
    throw Error('Exact Cohere Model ID is missing: ' + modelId);
  const cards = [
    ...page.matchAll(
      />Pricing<\/div><\/div><div\b[^>]*>([\s\S]+?)<\/div><\/div><div class="fern-card"/g,
    ),
  ];
  if (cards.length !== 1) throw Error('Missing or ambiguous Cohere model pricing card');
  const fields = [
    ...cards[0][1].matchAll(/<div\b[^>]*>(Input|Output)<\/div><p\b[^>]*>([\s\S]*?)<\/p>/g),
  ];
  if (fields.map(([, label]) => label).join('|') !== 'Input|Output') {
    throw Error('Missing or changed Cohere input and output charges');
  }
  return Object.fromEntries(
    fields.map(([, label, amount]) => [
      label.toLowerCase(),
      usd(textContent(amount), /^\$(\d+(?:\.\d+)?) \/ 1M tokens$/),
    ]),
  );
}

function ayaPrices(pricing, page, modelId) {
  requireText(page, '<td><code>' + modelId + '</code></td>');
  const rates = [
    ...pricing.matchAll(
      /Aya Expanse models \(8B and 32B\) on the API are charged at \$(\d+(?:\.\d+)?)\/1M tokens for input and \$(\d+(?:\.\d+)?)\/1M tokens for output\./g,
    ),
  ];
  if (rates.length !== 2 || rates[0][0] !== rates[1][0])
    throw Error('Missing or inconsistent Cohere Aya Expanse FAQ tariff');
  return { input: Number(rates[0][1]), output: Number(rates[0][2]) };
}

function parse({ body, supplemental }) {
  const pricing = markdown(body);
  requireText(pricing, 'All prices in USD.');
  requireText(
    pricing,
    'API calls made from a Production key will be billed on a pay-as-you-go basis.',
  );
  return new Map(
    adapter.targets.map(({ quoteId, group, modelId }) => {
      try {
        const page = markdown(supplemental.get(group).body);
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'us-cohere-' + modelId + '-standard',
            sourcePrice:
              group === 'aya-expanse'
                ? ayaPrices(pricing, page, modelId)
                : commandPrices(page, modelId),
            sourceUnit: 'per_million_tokens',
            required: ['input', 'output'],
            conditions,
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
