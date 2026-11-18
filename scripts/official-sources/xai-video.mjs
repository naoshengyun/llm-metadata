import { tables, textContent } from '../official-source-helpers/html-table.mjs';
import { markdown, requireText, usd } from '../official-source-helpers/markdown-table.mjs';

const providerId = 'xai';
const endpoint = 'https://api.x.ai/v1/videos/generations';
const priceList = 'xAI API / global video generation';
const currency = 'USD';
const models = {
  'grok-imagine-video': { resolutions: ['720p', '480p'], input: 'Text, Image, Video → Video' },
  'grok-imagine-video-1.5': {
    resolutions: ['1080p', '720p', '480p'],
    input: 'Text, Image, Audio → Video',
  },
  'grok-imagine-video-1.5-lite': {
    resolutions: ['1080p', '720p', '480p'],
    input: 'Text, Image → Video',
  },
};
function conditionsFor(modelId) {
  return {
    outputVideoUnit: 'generated-second',
    inputImageUnit: 'image',
    ...(modelId === 'grok-imagine-video' && { inputVideoUnit: 'input-second' }),
  };
}

export const adapter = {
  id: 'xai-video',
  url: 'https://docs.x.ai/developers/pricing',
  targets: Object.keys(models).map((modelId) => ({
    quoteId: 'us-xai-' + modelId + '-standard',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: 'global-video',
    baselineIdentity: { endpoint: null },
    baselineConditions: conditionsFor(modelId),
  })),
  parse,
};

function taskRates(rows, modelId) {
  const { resolutions, input } = models[modelId];
  const modelLink =
    '<a class="hover:underline" href="/developers/models/' + modelId + '">' + modelId + '</a>';
  const indexes = rows.flatMap((row, index) => (row[0]?.html.includes(modelLink) ? [index] : []));
  if (indexes.length !== 1)
    throw Error('Exact xAI video price row missing or ambiguous: ' + modelId);
  const start = indexes[0];
  const [model, media, ...firstResolution] = rows[start];
  if (
    model.text !== modelId + input ||
    model.rowSpan !== resolutions.length ||
    media?.rowSpan !== resolutions.length
  ) {
    throw Error('Unexpected xAI model modality or price rows for ' + modelId);
  }
  const mediaRates = [...media.html.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map(([, html]) =>
    textContent(html),
  );
  const video = modelId === 'grok-imagine-video';
  const image = mediaRates.filter((rate) => rate.endsWith(' / img'));
  const seconds = mediaRates.filter((rate) => rate.endsWith(' / sec'));
  if (
    image.length !== 1 ||
    seconds.length !== Number(video) ||
    mediaRates.length !== image.length + seconds.length
  ) {
    throw Error('Missing or incompatible xAI media input charges: ' + modelId);
  }
  const imageRate = usd(image[0], /^\$(\d+(?:\.\d+)?) \/ img$/);
  const videoRate = video ? usd(seconds[0], /^\$(\d+(?:\.\d+)?) \/ sec$/) : null;
  const resolutionRows = [firstResolution, ...rows.slice(start + 1, start + resolutions.length)];
  return resolutions.map((name, index) => {
    const matches = resolutionRows.filter((row) => row.length === 2 && row[0].text === name);
    if (matches.length !== 1) throw Error('Missing or duplicated xAI video resolution: ' + name);
    const output = usd(matches[0][1].text, /^\$(\d+(?:\.\d+)?) \/ sec$/);
    return {
      name,
      ...(index < resolutions.length - 1 && { when: { resolution: name } }),
      charges: [
        { usageKey: 'seconds', amount: output, unit: 'per_second', currency },
        { usageKey: 'input_images', amount: imageRate, unit: 'per_count', currency },
        ...(video
          ? [{ usageKey: 'input_video_seconds', amount: videoRate, unit: 'per_second', currency }]
          : []),
      ],
    };
  });
}

function parse({ body }) {
  const html = markdown(body);
  requireText(html, 'All prices are in USD.');
  const tariff = tables(html).filter(
    ([header]) =>
      header.map((cell) => cell.text).join('|') === 'Model|Media Input|Resolution|Output',
  );
  if (tariff.length !== 1) throw Error('Missing or ambiguous xAI video pricing table');
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            sourcePrice: taskRates(tariff[0], modelId),
            sourceUnit: 'per-charge',
            required: [],
            conditions: conditionsFor(modelId),
            task: { plugin: 'xai', model: modelId },
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
