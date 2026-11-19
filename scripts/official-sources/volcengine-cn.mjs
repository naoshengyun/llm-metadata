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
  'doubao-seed-character-260628': 'doubao-seed-character',
  'doubao-seed-evolving': 'doubao-seed-evolving',
  'doubao-seed-2-0-lite-260428': 'doubao-seed-2.0-lite',
  'doubao-seed-2-0-mini-260428': 'doubao-seed-2.0-mini',
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
  'doubao-seedream-5-0-260128': ['doubao-seedream-5-0-lite', false],

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

const textTargets = targets(textModels, implicitList).map((target) => {
  if (!/2-0-(?:lite|mini)/.test(target.modelId)) {
    return /evolving|character/.test(target.modelId)
      ? { ...target, group: target.modelId }
      : target;
  }
  return {
    ...target,
    quoteId: 'upstream:volcengine:' + target.modelId + ':CNY',
    priceList: 'fixed upstream primary or original CNY sheet',
    group: target.modelId,
    referenceOnlyReason:
      'Native audio usage has no separate audio-cache read meter for the official tariff',
  };
});
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
      (target.referenceOnlyReason
        ? audio === '-' || audioHit === '-'
        : audio !== '-' || audioHit !== '-')
    )
      throw Error('Unexpected Ark threshold or input modality for ' + family);
    const lower = last;
    last = Number(range[3]) * 1000;
    return {
      lower,
      upper: last,
      storage: number(storage),
      charges: {
        input: number(input),
        output: number(output),
        cache_read: number(hit),
        ...(target.referenceOnlyReason && {
          audio: { input: number(audio), cache_read: number(audioHit) },
        }),
      },
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
  const chargePaths = [
    'input',
    'output',
    'cache_read',
    ...(target.referenceOnlyReason ? ['audio.input', 'audio.cache_read'] : []),
  ];
  result.required = chargePaths.concat(
    bands.slice(1).flatMap((_, i) => chargePaths.map((key) => `tiers.${i}.${key}`)),
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
    ...tariff(
      target,
      {},
      {
        inputImages: 'free',
        outputUnit: 'per_image',
        ...(target.modelId === 'doubao-seedream-5-0-260128' && { publicPriceName: family }),
      },
      'per-charge',
    ),
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

function markdownTables(markdown) {
  return [...markdown.matchAll(/^(?:\|[^\r\n]*(?:\r?\n|$))+/gm)].map(([table]) =>
    table
      .trimEnd()
      .split(/\r?\n/)
      .filter((line) => !/^\|(?:[ :\-]+\|)+$/.test(line))
      .map((row) =>
        row
          .split('|')
          .slice(1, -1)
          .map((content) => ({
            text: htmlText(content.replaceAll('\\-', '-').replace(/^\s*>\s*/, '')).replace(
              '> P',
              'P',
            ),
          })),
      ),
  );
}

export const adapter = {
  id: 'volcengine-cn',
  url: 'https://docs.volcengine.com/docs/zh/ark/model-pricing.md',
  supplemental: [
    { id: 'model-list', url: 'https://docs.volcengine.com/docs/ark/model-list?lang=zh' },
  ],
  targets: [...textTargets, ...imageTargets, ...videoTargets],
  parse({ body, supplemental }) {
    const html = decode(body);
    const modelList = htmlText(
      decode(supplemental.get('model-list').body).replace(/<script\b[^]*?<\/script>/g, ''),
    );
    const exactModelIds = new Set(modelList.match(/doubao-[a-z0-9-]+/g));
    const imageAlias = modelList.includes(
      'doubao-seedream-5-0-260128 （同时支持：doubao-seedream-5-0-lite-260128）',
    );
    const rendered = tables(html);
    const all = rendered.length ? rendered : markdownTables(html);
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
      text: htmlText(html.replace(/<script\b[^]*?<\/script>/g, ''))
        .replaceAll('**', ' ')
        .replace(/\s+/g, ' '),
    };
    const candidates = [
      ...textTargets.map((target) => [target, textTable, textTariff]),
      ...imageTargets.map((target) => [target, imageTable, imageTariff]),
      ...videoTargets.map((target) => [target, video, videoTariff]),
    ];
    return new Map(
      candidates.map(([target, table, parse]) => {
        try {
          if (
            [
              'doubao-seed-character-260628',
              'doubao-seed-evolving',
              'doubao-seed-2-0-lite-260428',
              'doubao-seed-2-0-mini-260428',
            ].includes(target.modelId) &&
            !exactModelIds.has(target.modelId)
          )
            throw Error('Missing Ark exact model ID in model list');
          if (target.modelId === 'doubao-seedream-5-0-260128' && !imageAlias)
            throw Error('Missing Ark explicit Seedream Lite alias relationship');
          return [target.quoteId, parse(table, target)];
        } catch (error) {
          return [target.quoteId, { error: error.message }];
        }
      }),
    );
  },
};
