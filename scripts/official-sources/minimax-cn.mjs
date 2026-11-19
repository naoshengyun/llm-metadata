import {
  decode,
  number,
  only,
  standardTarget,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

const provider = 'minimax-cn';
const endpoint = 'https://api.minimax.cn/anthropic/v1';
const models = ['MiniMax-M3', 'MiniMax-M3.1-Flash'].map((model) =>
  standardTarget(
    provider,
    endpoint,
    model,
    'MiniMax China standard original online tariff',
    'cn-minimax-' + model + '-standard',
    'text',
  ),
);
const images = ['image-01', 'image-01-live'].map((model) =>
  standardTarget(
    provider,
    endpoint,
    model,
    'fixed upstream primary or original CNY sheet',
    'upstream:minimax-cn:' + model + ':CNY',
    'image',
  ),
);

const h3 = standardTarget(
  provider,
  'https://api.minimax.cn/v2/video_generation',
  'MiniMax-H3',
  'MiniMax China H3 video pay-as-you-go',
  'cn-minimax-MiniMax-H3-video',
);
const h3Max = {
  ...standardTarget(
    provider,
    h3.endpoint,
    'MiniMax-H3-Max',
    'fixed upstream primary or original CNY sheet',
    'upstream:minimax-cn:MiniMax-H3-Max:CNY',
  ),
  baselineIdentity: { endpoint },
  referenceOnlyReason: 'The pinned Hailuo task schema has no MiniMax-H3-Max model binding',
};
const speech = [
  'speech-02-hd',
  'speech-02-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-2.8-hd',
  'speech-2.8-turbo',
].map((model) => ({
  ...standardTarget(
    provider,
    endpoint,
    model,
    'fixed upstream primary or original CNY sheet',
    `upstream:minimax-cn:${model}:CNY`,
  ),
  referenceOnlyReason: 'Native expressions for this model have no billed input character usage',
}));

function videoTariff(markdown, api, target) {
  if (
    !api.includes('- url: https://api.minimax.cn') ||
    !api.includes('POST /v2/video_generation') ||
    !api.includes('`' + target.modelId + '`')
  )
    throw Error('MiniMax China video endpoint or exact models missing');
  const standard = target.modelId === 'MiniMax-H3';
  const section = (
    standard ? /^### H3 系列旗舰模型\s*$([^]*?)^### /m : /^### H3 系列扩展模型\s*$([^]*?)^### /m
  ).exec(markdown)?.[1];
  const quota = /每次任务前 \*\*(\d+) 张\*\*/.exec(section ?? '');
  if (
    !section ||
    !quota ||
    !section.includes('音频输入免费') ||
    !/按(?:输入)?时长及(?:所选模型的)?输出分辨率计费/.test(section)
  ) {
    throw Error('Incomplete MiniMax H3 video conditions');
  }
  const table = only(
    withHeader(tables(section.replace(/\\\s*\n\s*/g, ' ')), [
      '模型',
      '输出分辨率',
      '输出视频 每秒',
      '输入视频 每秒',
      '输入图片 每张 超出免费额度后',
    ]),
    target.modelId + ' video tariff',
  );
  const start = only(
    table
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row[0]?.text.startsWith('**' + target.modelId + '** ')),
    target.modelId,
  ).index;
  if (!/rowspan="2"/i.test(table[start][0].attrs) || !table[start + 1]) {
    throw Error('Incomplete MiniMax H3 video resolution bands');
  }
  const expected = standard ? ['2K', '768P'] : ['768P', '480P'];
  const bands = [table[start].slice(1), table[start + 1]];
  const sourcePrice = bands.map((row, index) => {
    const [name, output, video, image] = row.map(({ text }) => text);
    if (row.length !== 4 || name !== expected[index])
      throw Error('Unexpected MiniMax video resolution');
    return {
      name,
      ...(index === 0 && { when: { resolution: name } }),
      charges: [
        { usageKey: 'seconds', amount: number(output, '¥'), unit: 'per_second', currency: 'CNY' },
        {
          usageKey: 'input_video_seconds',
          amount: number(video, '¥'),
          unit: 'per_second',
          currency: 'CNY',
        },
        {
          usageKey: 'input_images',
          amount: number(image, '¥'),
          unit: 'per_count',
          currency: 'CNY',
          freeQuantity: number(quota[1]),
        },
      ],
    };
  });
  return {
    ...tariff(
      target,
      {},
      { inputVideoBilledAtOutputResolution: true, audioInputFree: true },
      'per-charge',
    ),
    required: standard
      ? []
      : sourcePrice.flatMap(({ charges }, i) => charges.map((_, j) => `${i}.charges.${j}.amount`)),
    sourcePrice,
    ...(standard && { task: { plugin: 'hailuo', model: target.modelId } }),
  };
}

function speechTariff(markdown, target) {
  const section = /^## 语音\s*$([^]*?)^## MCP\s*$/m.exec(markdown)?.[1];
  if (!section?.includes('计费单位为字符数，以 10,000 个字符（输入）为单位。1 个汉字算 2 个字符')) {
    throw Error('Missing MiniMax character meter');
  }
  const row = (label) =>
    only(
      section
        .split('\n')
        .filter(
          (line) =>
            line.includes('| ' + label + ' |') &&
            cells(line)[1]?.split(' / ').includes(target.modelId),
        ),
      label,
    );
  const synchronous = number(cells(row('同步语音合成 T2A')).at(-1));
  const asynchronous = number(cells(row('异步长文本语音合成 T2A Async')).at(-1));
  if (synchronous !== asynchronous)
    throw Error('Different MiniMax synchronous and asynchronous rates');
  return tariff(
    target,
    { amount: synchronous },
    {
      inputCharacters: true,
      hanCharacterWeight: 2,
      otherCharacterWeight: 1,
      services: ['T2A', 'T2A Async'],
    },
    'per_10000_input_characters',
  );
}

const cells = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
const header =
  '| **模型** | **输入价格**  元/百万 tokens | **输出价格**  元/百万 tokens | **缓存读取**  元/百万 tokens |';

function charges(row, parse) {
  const parts = cells(row);
  if (parts.length !== 4) throw Error('Incomplete MiniMax price row');
  return { input: parse(parts[1]), output: parse(parts[2]), cache_read: parse(parts[3]) };
}

function currentPrice(value) {
  return number(value.replace(/^~~[^~]+~~\s+/, ''));
}

const promotionNote =
  /^(?:(?:永久|限时)?(?:[一二三四五六七八九]|\d(?:\.\d+)?)折|(?:限时)?优惠(?:至 ?\d{4}-\d{2}-\d{2})?)$/;

function standardM3Tariff(standard, conditions) {
  const bands = standard.split('\n').filter((line) => line.startsWith('> | **MiniMax-M3** '));
  const lower = /^\*\*MiniMax-M3\*\* ≤ (\d+)k 输入 tokens(?: (.+))?$/;
  const upper = /^\*\*MiniMax-M3\*\* > (\d+)k 输入 tokens(?:\\\*)?(?: (.+))?$/;
  const low = only(
    bands.filter((row) => lower.test(cells(row)[0])),
    'MiniMax M3 lower band',
  );
  const high = only(
    bands.filter((row) => upper.test(cells(row)[0])),
    'MiniMax M3 upper band',
  );
  const [, lowerLimit, lowerNote] = lower.exec(cells(low)[0]);
  const [, upperLimit, upperNote] = upper.exec(cells(high)[0]);
  if (lowerLimit !== upperLimit) throw Error('Discontinuous MiniMax M3 input bands');
  for (const note of [lowerNote, upperNote]) {
    if (note && !promotionNote.test(note))
      throw Error('Unsupported MiniMax M3 Standard pricing condition: ' + note);
  }
  const limit = number(lowerLimit) * 1000;
  const lowPrice = charges(low, currentPrice);
  const highPrice = charges(high, currentPrice);
  const m3 = tariff(
    models[0],
    { ...lowPrice, tiers: [{ tier: { size: limit }, ...highPrice }] },
    { ...conditions, inputThreshold: limit, serviceTier: 'standard' },
  );
  m3.required = Object.keys(lowPrice).concat(Object.keys(highPrice).map((key) => 'tiers.0.' + key));
  return m3;
}

export const adapter = {
  id: 'minimax-cn',
  url: 'https://platform.minimax.cn/docs/pricing/overview.md',
  supplemental: [
    { id: 'cache', url: 'https://platform.minimax.cn/docs/api-reference/text-prompt-caching.md' },
    {
      id: 'video',
      url: 'https://platform.minimax.cn/docs/api-reference/video-generation-v2-create.md',
    },
  ],
  targets: [...models, ...images, h3, h3Max, ...speech],
  parse({ body, supplemental }) {
    const markdown = decode(body);
    const text = /^## 语言模型\s*$([^]*?)^## 视频\s*$/m.exec(markdown)?.[1];
    const standard = /^> \[tab\] 标准\s*$([^]*?)^> \[tab\] 优先/m.exec(text ?? '')?.[1];
    const cache = decode(supplemental.get('cache').body);
    const minimum = /缓存适用于包含 (\d+) 个及以上的输入 token 数量/.exec(cache);
    if (
      !text?.includes(header) ||
      !standard?.includes(header) ||
      !minimum ||
      !cache.includes('支持模型：MiniMax-M3.1-Flash、MiniMax-M3。') ||
      !cache.includes('单次请求费用（元）= ( 新增输入 Token 数 × 输入单价') ||
      !cache.includes('新增输入 Token 数 = 总输入 Token 数 − 缓存命中 Token 数')
    ) {
      throw Error('Missing MiniMax standard CNY or applicable cache conditions');
    }
    const conditions = { cacheMinimumInputTokens: number(minimum[1]), cachePrefixMatch: true };
    if (!cache.includes('缓存采用前缀匹配的方式'))
      throw Error('Missing MiniMax cache-prefix condition');
    const flash = only(
      text.split('\n').filter((line) => line.startsWith('| **MiniMax-M3.1-Flash** |')),
      'MiniMax M3.1 Flash',
    );
    let m3;
    try {
      m3 = standardM3Tariff(standard, conditions);
    } catch (error) {
      m3 = { error: error.message };
    }
    const imageSection = /^## 图片\s*$([^]*?)^## 语音\s*$/m.exec(markdown)?.[1];
    const imageRow = imageSection
      ?.split('\n')
      .find((line) => line.includes('| image-01 image-01-live |'));
    if (!imageRow || !/单价\*\*\s+元\/张|单价\s+元\/张/.test(imageSection)) {
      throw Error('Missing MiniMax image-01 family per-image price');
    }
    const image = number(cells(imageRow)[2]);
    const videoApi = decode(supplemental.get('video').body);
    const references = [h3, h3Max, ...speech].map((target) => {
      try {
        return [
          target.quoteId,
          speech.includes(target)
            ? speechTariff(markdown, target)
            : videoTariff(markdown, videoApi, target),
        ];
      } catch (error) {
        return [target.quoteId, { error: error.message }];
      }
    });
    return new Map([
      ...references,
      [models[0].quoteId, m3],
      [
        models[1].quoteId,
        tariff(
          models[1],
          charges(flash, (cell) => number(cell)),
          conditions,
        ),
      ],
      ...images.map((target) => [
        target.quoteId,
        tariff(target, { per_image: image }, {}, 'per_image'),
      ]),
    ]);
  },
};
