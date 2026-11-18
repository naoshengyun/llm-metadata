import {
  decode,
  htmlText,
  number,
  only,
  standardTarget,
  tables,
  tariff,
} from './lib/domestic-tables.mjs';

const models = ['qwen3.7-max', 'qwen3.7-plus', 'qwen3.7-flash'];
const targets = models.flatMap((model) =>
  ['implicit', 'explicit'].map((mode) => {
    const priceList = 'cn-beijing-online-original-' + mode;
    return standardTarget(
      'alibaba-cn',
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model,
      priceList,
      'dashscope--' + model + '--' + priceList,
      model,
    );
  }),
);

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
  return {
    implicitHit: number(implicit[2]),
    implicitExceptions: implicit[1].split('、'),
    explicitWrite: number(explicit[1]),
    explicitHit: number(explicit[2]),
    explicitExceptions: explicitExceptions[1],
    ttl: number(lifetime[1]) * 60,
    minimum: number(minimum[1]),
  };
}

function modelBands(all, model) {
  const plus = model === 'qwen3.7-plus';
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
  const start = only(
    table.map((row, i) => ({ row, i })).filter(({ row }) => row[0]?.text.split(' ')[0] === model),
    model,
  ).i;
  const first = table[start];
  const bands = Number(/\browspan="(\d+)"/.exec(first[0].attrs)?.[1] ?? 1);
  if (
    !first[0].text.includes('上下文缓存 享有折扣') ||
    (plus
      ? table[1]?.map(({ text }) => text).join('/') !== '非思考模式/思考模式（思维链+回答）'
      : first[1]?.text !== '非思考和思考模式')
  ) {
    throw Error('Unexpected Bailian cache or reasoning conditions: ' + model);
  }
  let upper = 0;
  return table.slice(start, start + bands).map((cells, i) => {
    const row = cells.slice(i === 0 ? (plus ? 1 : 2) : 0, i === 0 ? -1 : undefined);
    const [range, input, output, reasoningOutput] = row.map(({ text }) => text);
    if (row.length !== (plus ? 4 : 3) || (plus && cny(reasoningOutput) !== cny(output))) {
      throw Error('Incomplete or differently charged Bailian reasoning mode: ' + model);
    }
    const bounds = /^(0|\d+K)<Token≤(\d+)([KM])$/.exec(range);
    if (!bounds) throw Error('Missing Bailian token threshold: ' + model);
    const lower = parseInt(bounds[1], 10) * 1000;
    if (lower !== upper) throw Error('Discontinuous Bailian token tiers: ' + model);
    upper = Number(bounds[2]) * (bounds[3] === 'M' ? 1_000_000 : 1000);
    if (upper <= lower) throw Error('Invalid Bailian token tier range: ' + model);
    return { lower, upper, input: cny(input), output: cny(output) };
  });
}

export const adapter = {
  id: 'alibaba-cn',
  url: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  supplemental: [{ id: 'cache', url: 'https://help.aliyun.com/zh/model-studio/context-cache' }],
  targets,
  parse({ body, supplemental }) {
    const html = decode(body).replace(/<script\b[^]*?<\/script>/gi, '');
    const regionText = htmlText(html);
    if (!regionText.includes('华北 2（北京）') || !regionText.includes('中国内地')) {
      throw Error('Missing Bailian Beijing domestic pricing region');
    }
    const all = tables(html);
    const terms = cacheTerms(supplemental.get('cache').body);
    return new Map(
      targets.map((target) => {
        const explicit = target.priceList.endsWith('-explicit');
        const { modelId } = target;
        if (
          explicit
            ? terms.explicitExceptions.includes(modelId)
            : terms.implicitExceptions.includes(modelId)
        ) {
          return [target.quoteId, { error: 'Bailian cache terms no longer apply to ' + modelId }];
        }
        try {
          const bands = modelBands(all, modelId);
          const charges = bands.map(({ input, output }) => ({
            input,
            output,
            cache_read: cachedRate(input, explicit ? terms.explicitHit : terms.implicitHit),
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
              inputBands: bands.map(({ lower, upper }) => ({ lower, upper })),
              reasoningBilledAsOutput: true,
              cacheMode: explicit ? 'explicit' : 'implicit',
              cacheMinimumInputTokens: terms.minimum,
              ...(explicit
                ? { cacheWriteTtlSeconds: terms.ttl, cacheHitRenewsTtl: true }
                : { cacheTtl: 'no fixed TTL', cacheWriteIncludedInInput: true }),
            },
          );
          result.required = Object.keys(charges[0]).concat(
            charges
              .slice(1)
              .flatMap((entry, i) => Object.keys(entry).map((key) => `tiers.${i}.${key}`)),
          );
          return [target.quoteId, result];
        } catch (error) {
          return [target.quoteId, { error: error.message }];
        }
      }),
    );
  },
};
