import { tables } from '../official-source-helpers/html-table.mjs';
import {
  exactRow,
  markdown,
  requireText,
  section,
  table,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const providerId = 'minimax';
const endpoint = 'https://api.minimax.io/anthropic/v1';
const videoEndpoint = 'https://api.minimax.io/v2/video_generation';
const priceList = 'MiniMax International API / Standard';
const videoPriceList = 'MiniMax International Video API / pay-as-you-go';
const currency = 'USD';
const charges = ['input', 'output', 'cache_read'];
const columns = [
  '**Model**',
  '**Input** \\$ / M tokens',
  '**Output** \\$ / M tokens',
  '**Prompt caching Read** \\$ / M tokens',
];
const videoColumns =
  'Model|Output Resolution|Output Video per second|Input Video per second|Input Image per image beyond free quota';
const h3 = 'MiniMax-H3';
const taskId = 'us-minimax-minimax-h3-global-video';
const conditions = { inputVideoBilledAtOutputResolution: true, audioInputFree: true };
const textIds = [
  'MiniMax-M2',
  'MiniMax-M2.1',
  'MiniMax-M2.1-highspeed',
  'MiniMax-M2.5',
  'MiniMax-M2.5-highspeed',
  'MiniMax-M2.7',
  'MiniMax-M2.7-highspeed',
  'MiniMax-M3',
  'MiniMax-M3.1-Flash',
];
const audioIds = [
  'speech-02-hd',
  'speech-02-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-2.8-hd',
  'speech-2.8-turbo',
];
const legacyList = 'fixed upstream primary or original CNY sheet';
const usdAmount = (cell) => usd(cell, /^\\\$(\d+(?:\.\d+)?)$/);

export const adapter = {
  id: 'minimax-international',
  url: 'https://platform.minimax.io/docs/pricing/overview.md',
  supplemental: [
    {
      id: 'video-api',
      url: 'https://platform.minimax.io/docs/api-reference/video-generation-v2-create.md',
    },
  ],
  targets: [
    ...[...textIds, ...audioIds, 'image-01', h3, 'MiniMax-H3-Max'].map((modelId) => ({
      quoteId: 'upstream:minimax:' + modelId + ':USD',
      providerId,
      endpoint,
      modelId,
      priceList,
      currency,
      group: modelId,
      baselineIdentity: { priceList: legacyList },
    })),
    {
      quoteId: taskId,
      providerId,
      endpoint: videoEndpoint,
      modelId: h3,
      priceList: videoPriceList,
      currency,
      group: 'h3-video',
      baselineConditions: conditions,
    },
  ],
  parse,
};

function textPrice(text, modelId) {
  const llm = text.match(/^## LLM\n([\s\S]*?)^## Video$/m)?.[1];
  if (!llm) throw Error('Missing MiniMax international text pricing section');
  const [general, tabs] = llm.split('> [tab] Standard\n');
  if (!tabs) throw Error('Missing MiniMax International Standard tariff');
  if (modelId === 'MiniMax-M3.1-Flash') {
    const [, ...values] = exactRow(
      table(general, columns),
      ([name]) => name === '**' + modelId + '**',
      modelId,
      4,
    );
    return {
      sourcePrice: Object.fromEntries(charges.map((key, index) => [key, usdAmount(values[index])])),
      required: charges,
      conditions: {},
    };
  }
  if (modelId !== 'MiniMax-M3')
    throw Error('Exact MiniMax International LLM price absent: ' + modelId);
  const standard = tabs.split('> [tab] Priority')[0].replace(/^> ?/gm, '');
  const rows = table(standard, columns);
  const threshold = /^\*\*MiniMax-M3\*\* ≤ (\d+)k input tokens(?: .+)?$/;
  const low = exactRow(rows, ([cell]) => threshold.test(cell), modelId + ' ordinary', 4);
  const sizeText = threshold.exec(low[0])[1];
  const high = exactRow(
    rows,
    ([cell]) =>
      /^\*\*MiniMax-M3\*\* > (\d+)k input tokens(?:\\\*)?(?: .+)?$/.exec(cell)?.[1] === sizeText,
    modelId + ' long context',
    4,
  );
  const [base, long] = [low, high].map((row) =>
    Object.fromEntries(
      charges.map((key, index) => [key, usdAmount(row[index + 1].replace(/^~~[^~]+~~\s+/, ''))]),
    ),
  );
  return {
    sourcePrice: {
      ...base,
      context_over_200k: long,
      tiers: [{ tier: { size: Number(sizeText) * 1000, type: 'context' }, ...long }],
    },
    required: [
      ...charges,
      ...charges.flatMap((key) => ['tiers.0.' + key, 'context_over_200k.' + key]),
    ],
    conditions: {},
  };
}

function videoPrice(text, api) {
  requireText(api, '- url: https://api.minimax.io');
  requireText(api, 'POST /v2/video_generation');
  requireText(api, 'Currently supported models: `MiniMax-H3`,');
  const flagship = section(text, '### H3 Series Flagship Models');
  requireText(flagship, 'Billed by input duration at the output resolution of the selected model.');
  requireText(flagship, 'all task types share the same unit price. Audio input is free.');
  const free =
    /The first \*\*(\d+) images\*\* per task are free; additional images are billed per image\./.exec(
      flagship,
    );
  if (!free) throw Error('Missing MiniMax H3 input image allowance');
  const found = tables(flagship.replaceAll(/\\\s*\n\s*/g, ' ')).filter(
    ([header]) => header.map((cell) => cell.text).join('|') === videoColumns,
  );
  if (found.length !== 1) throw Error('Missing or ambiguous MiniMax H3 flagship tariff');
  const rows = found[0];
  const first = rows.findIndex((row) => row[0].text.startsWith('**MiniMax-H3** '));
  if (first < 1 || rows[first][0].rowSpan !== 2 || !rows[first + 1])
    throw Error('Missing or incomplete exact MiniMax H3 video rate');
  const resolutions = [rows[first].slice(1), rows[first + 1]];
  return ['2K', '768P'].map((name, index) => {
    const [, output, video, image] = exactRow(
      resolutions,
      ([label]) => label.text === name,
      name,
      4,
    );
    return {
      name,
      ...(index === 0 && { when: { resolution: name } }),
      charges: [
        { usageKey: 'seconds', amount: usdAmount(output.text), unit: 'per_second', currency },
        {
          usageKey: 'input_video_seconds',
          amount: usdAmount(video.text),
          unit: 'per_second',
          currency,
        },
        {
          usageKey: 'input_images',
          amount: usdAmount(image.text),
          unit: 'per_count',
          currency,
          freeQuantity: Number(free[1]),
        },
      ],
    };
  });
}

function parse({ body, supplemental }) {
  const text = markdown(body);
  requireText(text, 'All prices are in USD.');
  const api = markdown(supplemental.get('video-api').body);
  return new Map(
    adapter.targets.map((target) => {
      const { quoteId, providerId, endpoint, modelId, priceList, currency } = target;
      const identity = { providerId, endpoint, modelId, priceList, currency };
      try {
        if (quoteId === taskId) {
          return [
            quoteId,
            {
              identity,
              required: [],
              conditions,
              sourceUnit: 'per-charge',
              sourcePrice: videoPrice(text, api),
              task: { plugin: 'hailuo', model: h3 },
            },
          ];
        }
        if (modelId === h3)
          throw Error(
            'Legacy vendor text endpoint and incomplete video amounts; see exact ' + taskId,
          );
        if (modelId === 'MiniMax-H3-Max')
          throw Error(
            'MiniMax H3 Max has first-party video rates but no native rc50 plugin binding',
          );
        if (audioIds.includes(modelId))
          throw Error(
            'MiniMax speech prices are character-based; no native expression can represent this quote',
          );
        if (modelId === 'image-01')
          throw Error(
            'MiniMax image-01 price is published per image, but the fixed quote has the LLM endpoint',
          );
        return [
          quoteId,
          {
            identity,
            recordId: 'us-minimax-' + modelId.toLowerCase() + '-standard',
            sourceUnit: 'per_million_tokens',
            ...textPrice(text, modelId),
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
