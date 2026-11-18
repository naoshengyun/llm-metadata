import { groupBy } from '../group-by.mjs';
import { markdown, requireText } from '../official-source-helpers/markdown-table.mjs';

const models = [
  'morph-dsv41flash',
  'morph-dsv41flash-1017',
  'morph-dsv4flash',
  'morph-glm52-744b',
  'morph-glm53-744b',
  'morph-glm53flash',
  'morph-kimik3',
  'morph-kimik3-fast',
  'morph-kimik31',
  'morph-v3-fast',
  'morph-v3-large',
];
const providerId = 'morph';
const endpoint = 'https://api.morphllm.com/v1';
const priceList = 'Morph API / direct base list';
const currency = 'USD';
const inputKeys = { prompt: 'input', cached_prompt: 'cache_read' };
const outputKeys = { completion: 'output' };
const additionalWriteCharge = { cacheWriteSurchargeUsdPerMillionTokens: 0 };

export const adapter = {
  id: 'morph-list',
  url: 'https://www.morphllm.com/api/models/json?prices=list',
  supplemental: [{ id: 'api-docs', url: 'https://docs.morphllm.com/llms.txt' }],
  targets: models.map((modelId) => ({
    quoteId: 'upstream:morph:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
    baselineConditions: modelId.startsWith('morph-v3-') ? {} : additionalWriteCharge,
  })),
  parse,
};

// Scale the source decimal before conversion to Number to preserve machine precision.
function perMillion(charge) {
  if (
    charge?.unit !== 'token' ||
    typeof charge.cost_usd !== 'string' ||
    !/^\d+(?:\.\d+)?$/.test(charge.cost_usd)
  ) {
    throw Error('Expected an explicit USD decimal per token');
  }
  const [major, fraction = ''] = charge.cost_usd.split('.');
  return Number(major + fraction + 'e' + (6 - fraction.length));
}

function rates(modalities, keys, conditions) {
  if (!Array.isArray(modalities)) throw Error('Missing Morph modalities');
  const text = modalities.filter((modality) => modality.type === 'text');
  if (text.length !== 1 || !Array.isArray(text[0].pricing)) {
    throw Error('Expected one text modality with listed rates');
  }
  if (
    modalities.some(
      (modality) =>
        modality.type !== 'text' &&
        (keys !== inputKeys ||
          !['image', 'video'].includes(modality.type) ||
          (modality.pricing !== undefined && modality.pricing !== null)),
    )
  )
    throw Error('Unexpected Morph non-text pricing');
  const prices = {};
  for (const charge of text[0].pricing) {
    const amount = perMillion(charge);
    if (charge.type === 'cache_write' && keys === inputKeys) {
      if (charge.implicit !== true || amount !== 0 || Object.keys(conditions).length) {
        throw Error('Unknown Morph cache-write pricing semantics');
      }
      // It is a surcharge. Ordinary input remains billed at the prompt price.
      Object.assign(conditions, additionalWriteCharge);
    } else {
      const key = Object.hasOwn(keys, charge.type) && keys[charge.type];
      if (!key || Object.hasOwn(prices, key))
        throw Error('Unexpected or duplicate Morph charge: ' + charge.type);
      prices[key] = amount;
    }
  }
  return prices;
}

function parse({ body, supplemental }) {
  const docs = markdown(supplemental.get('api-docs').body);
  requireText(docs, 'models, limits and these list prices, fetch ' + adapter.url);
  requireText(docs, 'Without `?prices=list`, the same URL serves the OpenRouter provider feed');
  const response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  if (!Array.isArray(response.data) || !response.data.length)
    throw Error('Missing Morph model list');
  const byModel = groupBy(response.data, (row) => row?.id);
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const rows = byModel.get(modelId) ?? [];
        if (rows.length !== 1)
          throw Error('Exact Morph list model missing or ambiguous: ' + modelId);
        const [row] = rows;
        if (row.schema_version !== '2.4') throw Error('Unsupported Morph model list schema');
        const conditions = {};
        const sourcePrice = {
          ...rates(row.input_modalities, inputKeys, conditions),
          ...rates(row.output_modalities, outputKeys, conditions),
        };
        const required = modelId.startsWith('morph-v3-')
          ? ['input', 'output']
          : ['input', 'output', 'cache_read'];
        if (
          !required.every((key) => Object.hasOwn(sourcePrice, key)) ||
          (required.includes('cache_read') && !Object.keys(conditions).length)
        ) {
          throw Error('Missing applicable Morph list charge');
        }
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'us-morph-' + modelId + '-standard',
            sourcePrice,
            sourceUnit: 'per_million_tokens',
            required: Object.keys(sourcePrice),
            conditions,
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
