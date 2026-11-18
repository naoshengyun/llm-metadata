import {
  exactRow,
  markdown,
  requireText,
  section,
  table,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const models = [
  'gpt-6.1-terra',
  'gpt-6.1-sol',
  'gpt-6-astra',
  'gpt-6-sol',
  'gpt-6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
];
const images = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2'];
const charges = ['input', 'output', 'cache_read', 'cache_write', 'cache_write_12h'];
const columns = [
  'Model',
  ...['Short', 'Long'].flatMap((context) =>
    ['input', 'output', 'cached input', '30m write', '12h write'].map(
      (fee) => context + ' context ' + fee,
    ),
  ),
];
const imageColumns = ['Model', 'Modality', 'Input', 'Output', 'Cached input'];
const imageHeading = '\nImages\n';
const imageCacheScope =
  'Cached input rates for GPT Image 2 and GPT-Image-2.5 only apply to images generated with the Responses API.';
const textConditions = {
  cacheWriteTtlSeconds: { cache_write: 1800, cache_write_12h: 43200 },
  longCacheWriteEndpoint: 'Responses API',
  cacheWritesReplaceUncachedInput: true,
  reasoningBilledAsOutput: true,
};
const imageConditions = {
  pricedRoutes: ['/v1/images/generations', '/v1/images/edits'],
  cachedRatesApply: false,
  outputModality: 'raster',
  tokensPerPartialImage: 100,
};

function target(modelId, image) {
  return {
    quoteId: 'us-openai-' + modelId + (image ? '-direct-images-standard' : '-standard'),
    providerId: 'openai',
    endpoint: image ? 'https://api.openai.com/v1/images' : 'https://api.openai.com/v1',
    modelId,
    priceList: image
      ? 'OpenAI direct Images API / Standard / raster'
      : 'OpenAI API / Standard / global',
    currency: 'USD',
    baselineIdentity: { endpoint: null },
    group: image ? 'direct-images' : 'flagship-standard',
    baselineConditions: image
      ? imageConditions
      : {
          ...textConditions,
          ...(modelId === 'gpt-5.6-sol' && { advertisedPromotionThrough: 'November 30, 2026' }),
        },
  };
}

export const adapter = {
  id: 'openai-standard',
  url: 'https://developers.openai.com/api/docs/pricing.md',
  supplemental: [
    { id: 'cache', url: 'https://developers.openai.com/api/docs/guides/prompt-caching.md' },
    { id: 'images', url: 'https://developers.openai.com/api/docs/guides/image-generation.md' },
  ],
  targets: [
    ...models.map((modelId) => target(modelId, false)),
    ...images.map((modelId) => target(modelId, true)),
  ],
  parse,
};

function flagship(text, cacheGuide) {
  requireText(cacheGuide, 'or `"12h"` in the Responses API');
  requireText(cacheGuide, 'These counts do not overlap and sum to `cache_write_tokens`.');
  requireText(cacheGuide, 'counts billed reads and excludes tokens charged as writes');
  requireText(text, 'Prices per 1M tokens.');
  const context = [
    ...text.matchAll(
      /^Short context: ≤([1-9]\d*)K input tokens\. Long context: >\1K input tokens\.$/gm,
    ),
  ];
  if (context.length !== 1) throw Error('Missing or inconsistent OpenAI context threshold');
  const size = Number(context[0][1]) * 1000;
  const rows = table(section(text, '### Standard pricing data'), columns);
  return (modelId) => {
    const row = exactRow(rows, ([name]) => name === modelId, modelId, columns.length);
    const [low, high] = [row.slice(1, 6), row.slice(6)].map((prices) =>
      Object.fromEntries(charges.map((key, index) => [key, usd(prices[index])])),
    );
    const conditions = { ...textConditions };
    if (modelId === 'gpt-5.6-sol') {
      const date =
        /^GPT-5\.6 Sol’s promotional pricing is available until ([A-Za-z]+ \d{1,2}, \d{4})\.$/;
      const notice = text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => date.exec(sentence))
        .filter(Boolean);
      if (notice.length !== 1) throw Error('Missing or ambiguous GPT-5.6 Sol promotional scope');
      conditions.advertisedPromotionThrough = notice[0][1];
    }
    return {
      conditions,
      sourcePrice: { ...low, tiers: [{ tier: { type: 'input', size }, ...high }] },
      required: [...charges, ...charges.map((key) => 'tiers.0.' + key)],
    };
  };
}

function directImages(text, imageGuide) {
  requireText(imageGuide, "It doesn't apply to direct Images API requests");
  requireText(imageGuide, 'https://api.openai.com/v1/images/generations');
  requireText(imageGuide, 'https://api.openai.com/v1/images/edits');
  const partial =
    /each partial image will incur an additional ([1-9]\d*) image output tokens\./.exec(imageGuide);
  if (!partial) throw Error('Missing OpenAI partial image charging condition');
  const blocks = text.split(imageHeading);
  if (blocks.length !== 2) throw Error('Missing or ambiguous OpenAI Images pricing section');
  const match =
    /^\s*Speed\s+Standard\s+### Grouped Pricing Table data\s*\n([\s\S]+?)\n\s*Batch\b/.exec(
      blocks[1],
    );
  if (!match) throw Error('Missing OpenAI Standard Images price table');
  requireText(match[1], imageCacheScope);
  const rows = table(match[1], imageColumns);
  return (modelId) => {
    const row = (modality) =>
      exactRow(
        rows,
        ([id, kind]) => id === modelId && kind === modality,
        modelId + ' ' + modality,
        imageColumns.length,
      );
    const [, , input, textOutput] = row('Text');
    const [, , imageInput, output] = row('Image');
    if (textOutput !== '-') throw Error('Unexpected output modality for ' + modelId);
    return {
      sourcePrice: { input: usd(input), input_image: usd(imageInput), output: usd(output) },
      required: ['input', 'input_image', 'output'],
      conditions: { ...imageConditions, tokensPerPartialImage: Number(partial[1]) },
    };
  };
}

function parse({ body, supplemental }) {
  const text = markdown(body);
  const results = new Map();
  for (const [group, read, id] of [
    ['flagship-standard', flagship, 'cache'],
    ['direct-images', directImages, 'images'],
  ]) {
    const targets = adapter.targets.filter((item) => item.group === group);
    try {
      const row = read(text, markdown(supplemental.get(id).body));
      for (const { quoteId, providerId, endpoint, modelId, priceList, currency } of targets) {
        try {
          results.set(quoteId, {
            identity: { providerId, endpoint, modelId, priceList, currency },
            sourceUnit: 'per_million_tokens',
            ...row(modelId),
          });
        } catch (error) {
          results.set(quoteId, { error: error.message });
        }
      }
    } catch (error) {
      for (const { quoteId } of targets) results.set(quoteId, { error: error.message });
    }
  }
  return results;
}
