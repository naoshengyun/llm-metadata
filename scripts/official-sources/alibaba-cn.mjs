import {
  decode,
  htmlText,
  number,
  only,
  standardTarget,
  tables,
  tariff,
} from './lib/domestic-tables.mjs';

const serviceModes = {
  'qwen3.7-max': ['implicit', 'explicit'],
  'qwen3.7-plus': ['implicit', 'explicit'],
  'qwen3.7-flash': ['implicit', 'explicit'],
  'qwen3.8-omni-flash': ['implicit'],
  'qwen-doc-turbo': ['implicit', 'explicit'],
  'qwen-flash': ['implicit', 'explicit'],
  'qwen-max': ['implicit'],
  'qwen-plus': ['implicit', 'explicit'],
  'qwen3-coder-flash': ['implicit', 'explicit'],
  'qwen3-vl-plus': ['implicit', 'explicit'],
  'qwen3.5-flash': ['explicit'],
  'qwen3.5-plus': ['explicit'],
  'qwen3.6-flash': ['explicit'],
  'qwen3.6-plus': ['explicit'],
  'qwen-deep-research': ['token'],
  'qwen-long': ['token'],
  'qwen-mt-plus': ['token'],
  'qwen-vl-ocr': ['token'],
  'qwen3.5-397b-a17b': ['token'],
  'siliconflow/deepseek-r1-0528': ['token'],
  'siliconflow/deepseek-v3-0324': ['token'],
  'siliconflow/deepseek-v3.1-terminus': ['token'],
  'siliconflow/deepseek-v3.2': ['token'],
  'tongyi-intent-detect-v3': ['token'],
};
const targets = Object.entries(serviceModes).flatMap(([model, modes]) =>
  modes.map((mode) => {
    const priceList = 'cn-beijing-online-original-' + mode;
    return standardTarget(
      'alibaba-cn',
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model,
      priceList,
      'dashscope--' + model.replaceAll('/', '-') + '--' + priceList,
      model,
    );
  }),
);

const referenceTargets = [
  {
    modelId: 'qwen3-omni-flash',
    baselineCurrency: 'USD',
    reason:
      'Native expression input usage does not distinguish video from other modalities or bill the provider multimodal output condition',
  },
  {
    modelId: 'qwen3-asr-flash',
    baselineCurrency: null,
    reason: 'Native model price has no billed audio-second usage for this ASR endpoint',
  },
].map(({ modelId, baselineCurrency, reason }) => ({
  ...standardTarget(
    'alibaba-cn',
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelId,
    'fixed upstream primary or original CNY sheet',
    'upstream:alibaba-cn:' + modelId + ':' + (baselineCurrency ?? 'unknown'),
  ),
  baselineIdentity: { currency: baselineCurrency },
  referenceOnlyReason: reason,
}));

function exactBeijingRow(tables, target) {
  return only(
    tables.flatMap(([header, ...rows]) =>
      rows
        .filter(([model]) => model?.text === target.modelId)
        .map((row) => ({
          labels: header.map(({ text }) => text),
          row: row.map(({ text }) => text),
          subheader: rows[0].map(({ text }) => text),
        })),
    ),
    target.modelId + ' Beijing model row',
  );
}

function mediaTariff(all, target, omniGuide) {
  const { labels, row, subheader } = exactBeijingRow(all, target);
  if (target.modelId === 'qwen3-asr-flash') {
    if (
      row.length !== 4 ||
      labels[1] !== '输入单价' ||
      labels[2] !== '输出单价' ||
      !row[1].endsWith(' 元/秒') ||
      row[2] !== '不计费'
    )
      throw Error('Missing exact Bailian ASR second tariff');
    return tariff(
      target,
      { amount: number(row[1].split(' ')[0]) },
      { inputAudioDuration: true, outputFree: true },
      'per_audio_second',
    );
  }
  if (!omniGuide.includes('本页各型号根据不同模态（音频、图像、视频）的 Token 数计费')) {
    throw Error('Missing Bailian Omni modality unit');
  }
  if (target.modelId === 'qwen3.8-omni-flash') {
    if (
      row.length !== 5 ||
      labels[1] !== '服务部署范围' ||
      row[1] !== '中国内地' ||
      labels[2] !== '输入单价（每百万 Token）' ||
      labels[3] !== '缓存命中输入单价（每百万 Token）' ||
      labels[4] !== '输出单价（每百万 Token）' ||
      !omniGuide.includes('Qwen3.8-Omni-Flash 支持自动生效的 隐式缓存') ||
      !omniGuide.includes('文本输出（Qwen3.8-Omni-Flash）')
    ) {
      throw Error('Missing Bailian unified Omni scope, output or cached input unit');
    }
    return tariff(
      target,
      { input: cny(row[2]), cache_read: cny(row[3]), output: cny(row[4]) },
      {
        region: 'China mainland, Beijing',
        cacheMode: 'implicit',
        inputModalities: ['text', 'audio', 'image', 'video'],
        outputModalities: ['text'],
      },
    );
  }
  if (
    row.length !== 9 ||
    labels[1] !== '模式' ||
    labels[2] !== '输入单价（每百万 Token）' ||
    labels[3] !== '输出单价（每百万 Token）' ||
    row[1] !== '非思考和思考模式' ||
    subheader.join('/') !==
      '文本/音频/图片/视频/文本 仅纯文本输入/文本 多模态输入/文本+音频 仅音频计费'
  ) {
    throw Error('Missing Bailian mixed Omni conditions');
  }
  const [, , input, audio, vision, text, multimediaText, outputAudio] = row;
  const result = tariff(
    target,
    {
      input: cny(input),
      input_audio: cny(audio),
      input_image: cny(vision),
      output: cny(text),
      multimodal: { output: cny(multimediaText), output_audio: cny(outputAudio) },
    },
    {
      region: 'China mainland, Beijing',
      mixedTextChargeDependsOnInput: true,
      imageAndVideoSameRate: true,
      audioOutputBilledInsteadOfText: true,
    },
  );
  result.required = [
    'input',
    'input_audio',
    'input_image',
    'output',
    'multimodal.output',
    'multimodal.output_audio',
  ];
  return result;
}

function cny(cell) {
  const match = /^(?:原价 )?(\d+(?:\.\d+)?) 元(?: （限时 \d+(?:\.\d+)? 折）)?$/.exec(cell);
  if (!match) throw Error('Unrecognized Bailian RMB amount: ' + cell);
  return number(match[1]);
}

function cachedRate(input, percent) {
  // Multiply decimal table prices without introducing binary rounding into the evidence.
  const scale = 10 ** (String(input).split('.')[1]?.length ?? 0);
  return (Math.round(input * scale) * percent) / (scale * 100);
}

function cacheTerms(body) {
  const html = decode(body).replace(/<script\b[^]*?<\/script>/gi, '');
  const cacheText = htmlText(html);
  const implicit =
    /阿里云百炼部署的模型（([^）]+) 除外）： cached_token 单价为 input_token 单价的 (\d+(?:\.\d+)?)%/.exec(
      cacheText,
    );
  const explicit =
    /新创建的缓存内容按标准输入单价的 (\d+(?:\.\d+)?)% 计费。[^]*?命中缓存 ：按标准输入单价的 (\d+(?:\.\d+)?)% 计费。/.exec(
      cacheText,
    );
  const explicitExceptions =
    /例外 ：以下模型的显式缓存单价不适用上述通用比例，具体价格请参见百炼控制台。([^]*?)可缓存内容/.exec(
      cacheText,
    );
  const lifetime = /显式缓存 ：有效期为 (\d+) 分钟，且每次命中后会重新计时 (\d+) 分钟/.exec(
    cacheText,
  );
  const minimum = /最小可缓存提示词长度为 (\d+) Token/.exec(cacheText);
  if (
    !implicit ||
    !explicit ||
    !explicitExceptions ||
    !lifetime ||
    !minimum ||
    lifetime[1] !== lifetime[2] ||
    !cacheText.includes('显式缓存、隐式缓存两者互斥，单个请求只能应用其中一种模式') ||
    !cacheText.includes('隐式缓存 ：由系统自动管理，无固定有效期')
  ) {
    throw Error('Incomplete Bailian cache rates or TTL conditions');
  }
  const domesticExplicit = /支持的模型 华北 2（北京） ([^]*?) 美国（弗吉尼亚）/.exec(
    cacheText,
  )?.[1];
  const domesticImplicit = /隐式缓存 支持的模型 华北 2（北京） ([^]*?) 新加坡/.exec(cacheText)?.[1];
  if (!domesticExplicit || !domesticImplicit) throw Error('Missing Beijing cache model sets');
  const listed = (content) => new Set(content.match(/[a-zA-Z0-9][a-zA-Z0-9./-]+/g));
  return {
    domesticExplicit: listed(domesticExplicit),
    domesticImplicit: listed(domesticImplicit),
    implicitHit: number(implicit[2]),
    implicitExceptions: implicit[1].split('、'),
    explicitWrite: number(explicit[1]),
    explicitHit: number(explicit[2]),
    explicitExceptions: explicitExceptions[1],
    ttl: number(lifetime[1]) * 60,
    minimum: number(minimum[1]),
  };
}

function beijingTables(html) {
  const blocks = [
    ...html.matchAll(
      /<section id="华北2-北京(?:-\d+)?" class="section"><h4[^>]*>([^]*?)<\/h4>([^]*?)<\/section>/g,
    ),
  ];
  const tablesByRegion = blocks
    .filter(([, heading]) => htmlText(heading) === '华北 2（北京）')
    .flatMap(([, , block]) => tables(block));
  if (!tablesByRegion.length) throw Error('Missing Bailian Beijing regions');
  return tablesByRegion;
}

function modelBands(all, model) {
  const table = only(
    all.filter(
      (rows) =>
        rows[0]?.[0]?.text === '模型 ID（Model ID）' &&
        !rows[0].some(({ text }) => text === '服务部署范围') &&
        rows[0].some(({ text }) => text.startsWith('免费额度')) &&
        rows.some(([name]) => name?.text.split(' ')[0] === model),
    ),
    model + ' Beijing regional table',
  );
  const headers = table[0].map(({ text }) => text);
  const start = only(
    table.map((row, i) => ({ row, i })).filter(({ row }) => row[0]?.text.split(' ')[0] === model),
    model,
  ).i;
  const first = table[start];
  const count = Number(/\browspan="(\d+)"/i.exec(first[0].attrs)?.[1] ?? 1);
  const hasMode = headers[1] === '模式';
  const amountIndex = headers.indexOf('输入单价（每百万 Token）');
  const rangeColumn = /^单次请求的输入 Token (?:数|范围)$/.test(headers[amountIndex - 1] ?? '');
  const reasoningColumns =
    table[1]?.map(({ text }) => text).join('/') === '非思考模式/思考模式（思维链+回答）';
  if (
    amountIndex !== 1 + Number(hasMode) + Number(rangeColumn) ||
    !headers[amountIndex + 1]?.startsWith('输出单价（每百万 Token）') ||
    (hasMode && !['非思考和思考模式', '仅非思考模式', '仅思考模式'].includes(first[1]?.text)) ||
    (!rangeColumn && count !== 1)
  ) {
    throw Error('Unsupported or incomplete Bailian mode/modality columns: ' + model);
  }
  let upper = 0;
  const bands = table.slice(start, start + count).map((cells, i) => {
    const row = cells.slice(i === 0 ? 1 + Number(hasMode) : 0, i === 0 ? -1 : undefined);
    const [input, output, reasoning] = (rangeColumn ? row.slice(1) : row).map(({ text }) => text);
    if (
      row.length !== 2 + Number(reasoningColumns) + Number(rangeColumn) ||
      (reasoningColumns && cny(reasoning) !== cny(output) && model !== 'qwen-plus')
    ) {
      throw Error('Incomplete or differently charged Bailian reasoning mode: ' + model);
    }
    const range = rangeColumn ? row[0]?.text : null;
    const price = {
      input: cny(input),
      output: cny(output),
      ...(reasoningColumns && cny(reasoning) !== cny(output) && { reasoning: cny(reasoning) }),
    };
    if (!range || (range === '无阶梯计价' && count === 1)) return { ...price, lower: 0 };
    const bounds = /^(0|\d+K)<Token≤(\d+)([KM])$/.exec(range);
    if (!bounds) throw Error('Missing Bailian token threshold: ' + model);
    const lower = parseInt(bounds[1], 10) * 1000;
    if (lower !== upper) throw Error('Discontinuous Bailian token tiers: ' + model);
    upper = Number(bounds[2]) * (bounds[3] === 'M' ? 1_000_000 : 1000);
    if (upper <= lower) throw Error('Invalid Bailian token tier range: ' + model);
    return { ...price, lower, upper };
  });
  if (bands.length !== count) throw Error('Missing Bailian continuation row: ' + model);
  return { bands, declaredCache: /上下文缓存|Session Cache/.test(first[0].text) };
}

export const adapter = {
  id: 'alibaba-cn',
  url: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  supplemental: [
    { id: 'cache', url: 'https://help.aliyun.com/zh/model-studio/context-cache' },
    { id: 'thinking', url: 'https://help.aliyun.com/zh/model-studio/deep-thinking' },
    { id: 'omni', url: 'https://help.aliyun.com/zh/model-studio/qwen-omni' },
  ],
  targets: [...targets, ...referenceTargets],
  parse({ body, supplemental }) {
    const html = decode(body).replace(/<script\b[^]*?<\/script>/gi, '');
    const regionText = htmlText(html);
    if (!regionText.includes('华北 2（北京）') || !regionText.includes('中国内地')) {
      throw Error('Missing Bailian Beijing domestic pricing region');
    }
    const all = beijingTables(html);
    const omniGuide = htmlText(
      decode(supplemental.get('omni').body).replace(/<script\b[^]*?<\/script>/gi, ''),
    );
    const terms = cacheTerms(supplemental.get('cache').body);
    const thinking = htmlText(
      decode(supplemental.get('thinking').body).replace(/<script\b[^]*?<\/script>/gi, ''),
    );
    const toggle =
      /千问 Plus 系列 （混合思考模式，默认不开启思考模式）：qwen-plus、/.test(thinking) &&
      thinking.includes(
        'enable_thinking ，取值如下： 设为 true ：模型先思考再回复； 设为 false ：模型直接回复',
      );

    return new Map(
      [...targets, ...referenceTargets].map((target) => {
        if (target.referenceOnlyReason || target.modelId === 'qwen3.8-omni-flash') {
          try {
            return [target.quoteId, mediaTariff(all, target, omniGuide)];
          } catch (error) {
            return [target.quoteId, { error: error.message }];
          }
        }
        const explicit = target.priceList.endsWith('-explicit');
        const cached = !target.priceList.endsWith('-token');
        const { modelId } = target;
        if (
          explicit
            ? terms.explicitExceptions.includes(modelId)
            : terms.implicitExceptions.includes(modelId)
        ) {
          return [target.quoteId, { error: 'Bailian cache terms no longer apply to ' + modelId }];
        }
        try {
          const { bands, declaredCache } = modelBands(all, modelId);
          const supportsCache = explicit
            ? terms.domesticExplicit.has(modelId)
            : terms.domesticImplicit.has(modelId);
          if (
            cached
              ? !supportsCache
              : declaredCache || supportsCache || terms.domesticExplicit.has(modelId)
          ) {
            throw Error('Bailian cache support no longer matches selected scope: ' + modelId);
          }
          const thinkingToggle = bands.some(({ reasoning }) => reasoning !== undefined);
          if (thinkingToggle && !toggle)
            throw Error('Missing Qwen Plus reasoning parameter and default');
          const charges = bands.map(({ input, output, reasoning }) => ({
            ...(reasoning !== undefined && { reasoning }),
            input,
            output,
            ...(cached && {
              cache_read: cachedRate(input, explicit ? terms.explicitHit : terms.implicitHit),
            }),
            ...(explicit && { cache_write: cachedRate(input, terms.explicitWrite) }),
          }));
          const result = tariff(
            target,
            {
              ...charges[0],
              ...(bands.length > 1 && {
                tiers: bands.slice(1).map(({ lower }, i) => ({
                  tier: { size: lower },
                  ...charges[i + 1],
                })),
              }),
            },
            {
              region: 'China mainland, Beijing',
              ...(bands[0].upper && {
                inputBands: bands.map(({ lower, upper }) => ({ lower, upper })),
              }),
              reasoningBilledAsOutput: true,
              ...(thinkingToggle && {
                thinkingToggle: { param: 'enable_thinking', value: true, default: false },
              }),
              ...(cached && {
                cacheMode: explicit ? 'explicit' : 'implicit',
                cacheMinimumInputTokens: terms.minimum,
              }),
              ...(explicit
                ? { cacheWriteTtlSeconds: terms.ttl, cacheHitRenewsTtl: true }
                : cached
                  ? { cacheTtl: 'no fixed TTL', cacheWriteIncludedInInput: true }
                  : {}),
            },
          );
          result.required = Object.keys(charges[0]).concat(
            charges
              .slice(1)
              .flatMap((entry, i) => Object.keys(entry).map((key) => `tiers.${i}.${key}`)),
          );
          if (thinkingToggle) result.thinkingToggle = { param: 'enable_thinking', value: true };
          return [target.quoteId, result];
        } catch (error) {
          return [target.quoteId, { error: error.message }];
        }
      }),
    );
  },
};
