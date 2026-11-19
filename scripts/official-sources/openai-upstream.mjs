import {
  exactRow,
  markdown,
  requireText,
  section,
  table,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const providerId = 'openai';
const endpoint = 'https://api.openai.com/v1';
const priceList = 'OpenAI API / Standard / global';
const currency = 'USD';
const models = [
  'chatgpt-image-latest',
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5-pro',
  'gpt-5.1',
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-5.4-pro',
  'gpt-5.5',
  'gpt-5.5-pro',
  'gpt-5.6',
  'gpt-6.2-astra',
  'gpt-6.2-sol',
  'gpt-daybreak-blue-latest',
  'gpt-daybreak-red-latest',
  'gpt-image-1.5',
  'gpt-realtime-2.1',
  'o1',
  'o1-pro',
  'o3',
  'o3-mini',
  'o3-pro',
  'o4-mini',
  'text-embedding-3-large',
  'text-embedding-3-small',
  'text-embedding-ada-002',
];
const docs = [
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-5.6',
  'o1',
  'o1-pro',
  'o3-mini',
  'o4-mini',
  'gpt-image-1.5',
  'chatgpt-image-latest',
];
const historicalModels = new Set([
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4.1-nano',
  'o1',
  'o1-pro',
  'o3-mini',
  'o4-mini',
]);
const supportId = (id) => id.replaceAll('.', '-');
const modelDocUrl = (name) => 'https://developers.openai.com/api/docs/models/' + name + '.md';
const textCharges = ['input', 'output', 'cache_read'];
const chargeKeys = [...textCharges, 'cache_write', 'cache_write_12h'];
const longHeaders = [
  'Model',
  ...['Short', 'Long'].flatMap((context) =>
    ['input', 'output', 'cached input', '30m write', '12h write'].map(
      (fee) => context + ' context ' + fee,
    ),
  ),
];
const shortHeaders = ['Model', 'Input', 'Output', 'Cached input'];
const specializedHeaders = [
  'Category',
  'Model',
  'Input',
  'Output',
  'Cached input',
  '30m write',
  '12h write',
];
const mediaKeys = {
  Input: 'input_image',
  Output: 'output_image',
  'Cached input': 'cache_read_image',
};

const reviewedStandardModels = new Set(['gpt-5.6', 'gpt-6.2-astra', 'gpt-6.2-sol']);

export const adapter = {
  id: 'openai-upstream',
  url: 'https://developers.openai.com/api/docs/pricing.md',
  supplemental: docs.map((id) => ({
    id: supportId(id),
    url: modelDocUrl(id),
    ...(id === 'gpt-5.6' && { allowedFinalUrls: [modelDocUrl('gpt-5.6-sol')] }),
  })),
  targets: models.map((modelId) => ({
    quoteId: reviewedStandardModels.has(modelId)
      ? 'us-openai-' + modelId + '-global-standard'
      : 'upstream:openai:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    ...(!reviewedStandardModels.has(modelId) && {
      baselineIdentity: {
        endpoint: null,
        priceList: 'fixed upstream primary or original CNY sheet',
      },
    }),
    ...(historicalModels.has(modelId) && {
      referenceOnlyReason: 'OpenAI shut down this exact API model; these are historical rates',
    }),
    ...(modelId === 'gpt-realtime-2.1' && {
      referenceOnlyReason: 'Native realtime pricing has no dedicated cached audio charge',
    }),
  })),
  parse,
};

function rateCells(cells, charges) {
  return Object.fromEntries(
    charges.flatMap((key, index) => (cells[index] === '-' ? [] : [[key, usd(cells[index])]])),
  );
}

function modelPage(page, modelId) {
  if (modelId.startsWith('gpt-4o-2024-')) {
    const event = new RegExp('^- `' + modelId + '` — (.+)$', 'm').exec(page);
    if (event)
      throw Error(
        'OpenAI lists this exact snapshot as ' +
          event[1] +
          '; no independent current Standard price',
      );
  }
  requireText(page, 'Model ID: `' + modelId + '`');
  const historical = historicalModels.has(modelId);
  if (historical !== /^Status: Shut down$/m.test(page))
    throw Error('OpenAI model lifecycle differs from the registered tariff: ' + modelId);
  const textKeys = { Input: 'input', Output: 'output', 'Cached input': 'cache_read' };
  const prices = {};
  for (const [heading, keys] of [
    ['### Text tokens', textKeys],
    ['### Image tokens', mediaKeys],
  ]) {
    if (heading === '### Image tokens' && !page.includes(heading)) continue;
    for (const [name, value, unit] of table(section(page, heading), ['Metric', 'Price', 'Unit'])) {
      const key = keys[name];
      if (unit !== '1M tokens' || !key || Object.hasOwn(prices, key))
        throw Error('Invalid OpenAI model token fee or unit');
      prices[key] = usd(value);
    }
  }
  return prices;
}

function realtimeRates(text, modelId) {
  const headers = ['Model', 'Modality', 'Input', 'Output', 'Cached input'];
  const marker = '\n| ' + headers.join(' | ') + ' |\n';
  const candidates = text
    .split(marker)
    .slice(1)
    .map((block) => block.split(/\n\s*\n/, 1)[0]);
  const grouped = candidates.filter((block) => block.includes('| ' + modelId + ' |'));
  if (grouped.length !== 1) throw Error('Missing or ambiguous OpenAI Realtime pricing table');
  const rows = table(marker + grouped[0], headers);
  const price = {};
  for (const [modality, keys] of [
    ['Audio', ['input_audio', 'output_audio', 'cachedAudio']],
    ['Text', textCharges],
    ['Image', ['input_image', 'output_image', 'cache_read_image']],
  ]) {
    const row = exactRow(
      rows,
      ([name, type]) => name === modelId && type === modality,
      modelId + ' ' + modality,
      headers.length,
    );
    const [, , input, output, cached] = row;
    if (modality === 'Image' && output !== '-')
      throw Error('Unexpected OpenAI Realtime image output tariff');
    Object.assign(price, rateCells([input, output, cached], keys));
  }
  const { cachedAudio, ...sourcePrice } = price;
  if (Object.keys(sourcePrice).length !== 7 || cachedAudio === undefined)
    throw Error('Incomplete OpenAI Realtime modality tariff');
  return {
    sourcePrice,
    conditions: { audioCacheRead: { amount: cachedAudio, currency, unit: 'per_million_tokens' } },
  };
}

function currentRates(text, supplemental, modelId, current) {
  if (historicalModels.has(modelId))
    return modelPage(markdown(supplemental.get(supportId(modelId)).body), modelId);
  if (modelId === 'gpt-5.6') {
    const alias = markdown(supplemental.get(supportId('gpt-5.6')).body);
    requireText(alias, 'The `gpt-5.6` alias routes requests to GPT-5.6 Sol.');
  }
  const [long, short] = current.split(/\n(?=\| Model \| Input \| Output \| Cached input \|)/);
  const name = modelId === 'gpt-5.6' ? 'gpt-5.6-sol' : modelId;
  const longRow = table(long, longHeaders).filter(
    ([id]) => id === name || id === name + ' (<272K context length)',
  );
  if (longRow.length) {
    const row = exactRow(longRow, () => true, name, longHeaders.length);
    const threshold =
      /^Short context: ≤(\d+)K input tokens\. Long context: >\1K input tokens\.$/m.exec(text);
    if (!threshold) throw Error('Missing OpenAI short and long context conditions');
    const base = rateCells(row.slice(1, 6), chargeKeys);
    const high = rateCells(row.slice(6), chargeKeys);
    const legacy = Object.fromEntries(
      Object.entries(high).filter(([key]) => key !== 'cache_write_12h'),
    );
    return {
      ...base,
      context_over_200k: legacy,
      tiers: [{ tier: { size: Number(threshold[1]) * 1000, type: 'context' }, ...high }],
    };
  }
  const shortRow = table(short, shortHeaders).filter(([id]) => id === name);
  if (shortRow.length)
    return rateCells(
      exactRow(shortRow, () => true, name, shortHeaders.length).slice(1),
      textCharges,
    );
  if (name.startsWith('text-embedding-') || name === 'gpt-5.3-codex') {
    const marker = '\n| ' + specializedHeaders.join(' | ') + ' |\n';
    const blocks = text.split(marker);
    if (blocks.length !== 2) throw Error('Missing or ambiguous OpenAI Standard specialized table');
    const rows = table(marker + blocks[1].split(/\n\s*\n/, 1)[0], specializedHeaders);
    const [, , ...values] = exactRow(
      rows,
      ([category, id]) => id === name && (category === 'Embedding' || category === 'Codex'),
      name,
      7,
    );
    const prices = rateCells(values, chargeKeys);
    if (name.startsWith('text-embedding-')) prices.output = 0;
    return prices;
  }
  const document = supplemental.get(supportId(name.startsWith('gpt-4o-2024-') ? 'gpt-4o' : name));
  if (document) return modelPage(markdown(document.body), modelId);
  throw Error('Exact price row absent from OpenAI Standard public list: ' + modelId);
}

function parse({ body, supplemental }) {
  const text = markdown(body);
  requireText(text, 'Prices per 1M tokens.');
  const standard = section(text, '### Standard pricing data');
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const { sourcePrice, conditions } =
          modelId === 'gpt-realtime-2.1'
            ? realtimeRates(text, modelId)
            : {
                sourcePrice: currentRates(text, supplemental, modelId, standard),
                conditions: historicalModels.has(modelId)
                  ? { historical: true, status: 'shut-down' }
                  : {},
              };
        if (
          historicalModels.has(modelId) &&
          (!Object.hasOwn(sourcePrice, 'input') || !Object.hasOwn(sourcePrice, 'output'))
        )
          throw Error('Incomplete OpenAI historical text tariff: ' + modelId);
        const required = Object.keys(sourcePrice).filter(
          (key) => !['tiers', 'context_over_200k'].includes(key),
        );
        if (sourcePrice.tiers) {
          required.push(
            ...Object.keys(sourcePrice.context_over_200k).map((key) => 'context_over_200k.' + key),
          );
          required.push(
            ...Object.keys(sourcePrice.tiers[0])
              .filter((key) => key !== 'tier')
              .map((key) => 'tiers.0.' + key),
          );
        }
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'us-openai-' + modelId + '-global-standard',
            sourcePrice,
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
