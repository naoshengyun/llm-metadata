import {
  decode,
  htmlText,
  number,
  only,
  standardTarget,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

const endpoint = 'https://ark.cn-beijing.volces.com/api/v3';
const implicitList = 'cn-beijing-online-regular-implicit-original';
const taskList = 'cn-beijing-task-online-original';
const textModels = {
  'doubao-seed-2-0-code-preview-260215': 'doubao-seed-2.0-code',
  'doubao-seed-2-0-pro-260215': 'doubao-seed-2.0-pro',
  'doubao-seed-2-1-pro-260628': 'doubao-seed-2.1-pro',
  'doubao-seed-2-1-turbo-260628': 'doubao-seed-2.1-turbo',
};
const videoModels = {
  'doubao-seedance-1-0-pro-250528': 'Seedance 1.0 pro',
  'doubao-seedance-2-0-260128': 'Seedance 2.0',
  'doubao-seedance-2-0-fast-260128': 'Seedance 2.0 fast',
  'doubao-seedance-2-0-mini-260615': 'Seedance 2.0 mini',
};
const imageModels = {
  'doubao-seedream-5-0-flash-260915': ['doubao-seedream-5-0-flash', true],
  'doubao-seedream-5-0-lite-260128': ['doubao-seedream-5-0-lite', false],
  'doubao-seedream-4-5-251128': ['doubao-seedream-4-5', false],
  'doubao-seedream-4-0-250828': ['doubao-seedream-4-0', true],
};

function targets(models, priceList) {
  return Object.keys(models).map((model) =>
    standardTarget(
      'volcengine',
      endpoint,
      model,
      priceList,
      'volcengine--' + model + '--' + priceList,
      priceList,
    ),
  );
}

const textTargets = targets(textModels, implicitList);
const imageTargets = targets(imageModels, taskList).map((target) => ({
  ...target,
  group: 'images',
}));
const videoTargets = targets(videoModels, taskList).map((target) => ({
  ...target,
  group: target.modelId.startsWith('doubao-seedance-1') ? 'video-1' : 'video-2',
}));

function textTariff(table, target) {
  const family = textModels[target.modelId];
  const first = only(
    table.map((row, i) => ({ row, i })).filter(({ row }) => row[0]?.text === family),
    family,
  ).i;
  let end = first + 1;
  while (table[end]?.[0]?.text === '') end++;
  let last = 0;
  const bands = table.slice(first, end).map((row, i) => {
    if (row.length !== 8) throw Error('Incomplete Ark charge row for ' + family);
    const [, limit, input, audio, storage, hit, audioHit, output] = row.map(({ text }) => text);
    const range = /^输入长度 ([[(])(\d+), (\d+)\]$/.exec(limit);
    if (
      !range ||
      range[1] !== (i === 0 ? '[' : '(') ||
      Number(range[2]) * 1000 !== last ||
      Number(range[3]) * 1000 <= last ||
      audio !== '-' ||
      audioHit !== '-'
    )
      throw Error('Unexpected Ark threshold or input modality for ' + family);
    const lower = last;
    last = Number(range[3]) * 1000;
    return {
      lower,
      upper: last,
      storage: number(storage),
      charges: { input: number(input), output: number(output), cache_read: number(hit) },
    };
  });
  const charges = bands[0].charges;
  const result = tariff(
    target,
    {
      ...charges,
      ...(bands.length > 1 && {
        tiers: bands.slice(1).map(({ lower, charges }) => ({
          tier: { size: lower },
          ...charges,
        })),
      }),
    },
    {
      inputBands: bands.map(({ lower, upper }) => ({ lower, upper })),
      cacheMode: 'implicit',
      separateExplicitCacheStorage: {
        unit: 'per_million_token_hours',
        rates: bands.map(({ storage }) => storage),
      },
    },
  );
  result.required = Object.keys(charges).concat(
    bands
      .slice(1)
      .flatMap(({ charges }, i) => Object.keys(charges).map((key) => `tiers.${i}.${key}`)),
  );
  return result;
}

function imageTariff(table, target) {
  const [family, smallImages] = imageModels[target.modelId];
  const row = only(
    table.filter(([name]) => name?.text === family),
    family,
  );
  if (row.length !== 3 || row[1].text !== '免费')
    throw Error('Unexpected Ark image input fee for ' + family);
  const amount = number(row[2].text);
  const usage = [
    ...(smallImages ? [['images_up_to_1_5k', amount]] : []),
    ['images_above_1_5k', amount],
    ['input_images', 0],
  ];
  return {
    ...tariff(target, {}, { inputImages: 'free', outputUnit: 'per_image' }, 'per-charge'),
    sourcePrice: [
      {
        name: 'all-supported-images',
        charges: usage.map(([usageKey, amount]) => ({
          usageKey,
          amount,
          unit: 'per_count',
          currency: 'CNY',
        })),
      },
    ],
  };
}

function videoTariff({ current, legacy, text }, target) {
  const family = videoModels[target.modelId];
  if (!text.includes('usage. completion_tokens 字段为准'))
    throw Error('Missing Ark billable token usage declaration');
  const charge = (amount) => ({
    usageKey: 'tokens',
    amount: number(amount),
    unit: 'per_million_tokens',
    currency: 'CNY',
  });
  const result = tariff(target, {}, { billingUsage: 'usage.completion_tokens' }, 'per-charge');
  if (family === 'Seedance 1.0 pro') {
    const row = only(
      legacy.filter(([model]) => model?.text === family),
      family,
    );
    if (row.length !== 3) throw Error('Incomplete Seedance 1.0 online row');
    return { ...result, sourcePrice: [{ name: 'online', charges: [charge(row[1].text)] }] };
  }
  if (
    !text.includes(
      '对于 Seedance 2.0 系列、Seedance 2.5 系列模型，当输入包含视频时，存在最低 token 用量限制',
    )
  ) {
    throw Error('Missing Ark minimum video-input token condition');
  }
  if (current[1]?.map(({ text }) => text).join('/') !== '//输入不含视频/输入包含视频') {
    throw Error('Missing Ark video input column conditions');
  }
  const start = only(
    current.map((row, index) => ({ row, index })).filter(({ row }) => row[0]?.text === family),
    family,
  ).index;
  let end = start + 1;
  while (current[end]?.[0]?.text === '') end++;
  const rows = current.slice(start, end);
  const expected = family === 'Seedance 2.0' ? ['480p、720p', '1080p', '4K'] : ['480p、720p'];
  if (
    rows.length !== expected.length ||
    rows.some((row, index) => row.length !== 4 || row[1].text !== expected[index])
  ) {
    throw Error('Incomplete or changed video resolution bands: ' + family);
  }
  const sourcePrice = rows.reverse().flatMap((row) => {
    const resolution = row[1].text.toLowerCase();
    const fallback = resolution === '480p、720p';
    const label = fallback ? '480p-720p' : resolution;
    return [
      {
        name: label + '-video',
        charges: [charge(row[3].text)],
        when: { ...(fallback ? {} : { resolution }), video_input: 'video' },
      },
      {
        name: label + (fallback ? '-none-default' : '-none'),
        charges: [charge(row[2].text)],
        ...(!fallback && { when: { resolution, video_input: 'none' } }),
      },
    ];
  });
  return {
    ...result,
    sourcePrice,
    conditions: { ...result.conditions, videoInputTokenMinimum: true },
  };
}

export const adapter = {
  id: 'volcengine-cn',
  url: 'https://docs.volcengine.com/docs/ark/model-pricing?lang=zh',
  targets: [...textTargets, ...imageTargets, ...videoTargets],
  parse({ body }) {
    const html = decode(body);
    const all = tables(html);
    const textTable = only(
      withHeader(all, [
        '模型名称',
        '条件 输入长度：K token',
        '输入(非音频) 元/M token',
        '输入(音频) 元/M token',
        '缓存存储 元/M token/小时',
        '缓存命中(非音频) 元/M token',
        '缓存命中(音频) 元/M token',
        '输出 元/M token',
      ]).filter((table) => table.length > 1),
      'Ark regular online token table',
    );
    const imageTable = only(
      withHeader(all, [
        '模型名称',
        '输入图单价（元/张）',
        '输出图单价（元/张） P 为单张输出图的总像素',
      ]).filter((table) => table.length > 1),
      'Ark online image table',
    );
    const video = {
      current: only(
        withHeader(all, ['模型', '输出视频分辨率', '在线推理单价（元/M token）', '']).filter(
          (table) => table.length > 2,
        ),
        'Ark current video token table',
      ),
      legacy: only(
        withHeader(all, ['模型', '在线推理（元/M token）', '离线推理（元/M token）']).filter(
          (table) => table.length > 1,
        ),
        'Ark legacy video token table',
      ),
      text: htmlText(html.replace(/<script\b[^]*?<\/script>/g, '')),
    };
    const candidates = [
      ...textTargets.map((target) => [target, textTable, textTariff]),
      ...imageTargets.map((target) => [target, imageTable, imageTariff]),
      ...videoTargets.map((target) => [target, video, videoTariff]),
    ];
    return new Map(
      candidates.map(([target, table, parse]) => {
        try {
          return [target.quoteId, parse(table, target)];
        } catch (error) {
          return [target.quoteId, { error: error.message }];
        }
      }),
    );
  },
};
