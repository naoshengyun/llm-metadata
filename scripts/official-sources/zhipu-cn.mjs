import {
  decode,
  number,
  only,
  standardTarget,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

const provider = 'zhipuai';
const endpoint = 'https://open.bigmodel.cn/api/paas/v4';
const standard = 'BigModel China standard API pay-as-you-go';
const displayModels = new Set(['glm-5.3', 'glm-5.3-flash', 'glm-5.3-flashx']);
const bandedModels = new Set(['glm-5.1', 'glm-5', 'glm-5v-turbo', 'glm-4.6v', 'glm-4.5v']);
const models = [
  ...displayModels,
  ...bandedModels,
  'glm-5.2',
  'glm-4.7-flashx',
  'glm-4.7-flash',
  'glm-4.6v-flash',
];
const targets = models.map((model) =>
  standardTarget(provider, endpoint, model, standard, 'cn-zhipu-' + model + '-standard', model),
);
const crossModels = new Set(['glm-4.7', 'glm-4.5-air']);
const crossTargets = [...crossModels].map((model) =>
  standardTarget(provider, endpoint, model, standard, 'cn-zhipu-' + model + '-standard', model),
);

const cacheTerms = {
  cacheStorage: 'limited-time-free',
  cacheStorageUnit: 'per_million_token_hours',
};

function rates(row) {
  if (![6, 7].includes(row.length)) throw Error('Incomplete BigModel tariff row');
  const [, context, input, output, storage, hit, modalities] = row.map(({ text }) => text);
  if (storage !== '限时免费') throw Error('Unrecognized BigModel cache-storage condition');
  const cells = [input, output, hit];
  const free = cells.every((field) => field === '免费');
  const [inputRate, outputRate, hitRate] = cells.map((field) => (free ? 0 : number(field)));
  return {
    context,
    modalities,
    free,
    amounts: { input: inputRate, output: outputRate, cache_read: hitRate },
  };
}

function parseModel(target, rows) {
  const { modelId } = target;
  if (bandedModels.has(modelId)) {
    if (rows.length !== 2) throw Error('Missing both BigModel input bands');
    const [base, high] = rows.map(rates);
    const limit = /^输入长度 \[0, (\d+)K\)$/.exec(base.context);
    const wider = /^输入长度 (?:≥(\d+)K|\[(\d+)K, (\d+)K\))$/.exec(high.context);
    if (
      !limit ||
      !wider ||
      limit[1] !== (wider[1] ?? wider[2]) ||
      (wider[3] && Number(wider[3]) <= Number(limit[1]))
    ) {
      throw Error('Unexpected BigModel input thresholds');
    }
    // The model expression starts the next band after its cutoff. BigModel defines a half-open range.
    const cutoff = Number(limit[1]) * 1000 - 1;
    const result = tariff(
      target,
      { ...base.amounts, tiers: [{ tier: { size: cutoff }, ...high.amounts }] },
      { ...cacheTerms, inputBands: [base.context, high.context] },
    );
    result.required = Object.keys(base.amounts).concat(
      Object.keys(high.amounts).map((key) => 'tiers.0.' + key),
    );
    return result;
  }
  const { context, modalities, amounts, free } = rates(only(rows, modelId));
  if (
    (!/^\d+[KM]$/.test(context) && !(free && context === '—')) ||
    displayModels.has(modelId) !== Boolean(modalities)
  )
    throw Error('Unrecognized BigModel context or modalities');
  return tariff(target, amounts, {
    ...cacheTerms,
    context,
    ...(modalities && { inputModalities: modalities.split('、') }),
    ...(free && { tokenTariff: 'official-free' }),
  });
}

function parseCrossTariff(target, rows) {
  if (rows.length !== 3) throw Error('Incomplete BigModel input/output cross-condition bands');
  const [low, regular, wide] = rows.map(rates);
  const below = /^输入 \[0, (\d+)K\)，输出 \[0, (\d+(?:\.\d+)?)K\)$/.exec(low.context);
  const above = /^输入 \[0, (\d+)K\)，输出 ≥(\d+(?:\.\d+)?)K$/.exec(regular.context);
  const high = /^输入 \[(\d+)K, (\d+)K\)$/.exec(wide.context);
  if (
    !below ||
    !above ||
    !high ||
    below[1] !== above[1] ||
    below[1] !== high[1] ||
    below[2] !== above[2] ||
    Number(high[2]) <= Number(high[1])
  ) {
    throw Error('Unrecognized BigModel input/output cross-condition bands');
  }
  const maxInput = Number(below[1]) * 1000 - 1;
  const maxOutput = Number(below[2]) * 1000 - 1;
  const result = tariff(
    target,
    {
      ...regular.amounts,
      short_output: { maxInput, maxOutput, ...low.amounts },
      tiers: [{ tier: { size: maxInput }, ...wide.amounts }],
    },
    { ...cacheTerms, inputOutputBands: [low.context, regular.context, wide.context] },
  );
  result.required = Object.keys(regular.amounts).flatMap((key) => [
    key,
    'short_output.' + key,
    'tiers.0.' + key,
  ]);
  return result;
}

export const adapter = {
  id: 'zhipu-cn',
  url: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
  targets: [...targets, ...crossTargets],
  parse({ body }) {
    const html = decode(body).replace(/<script\b[^]*?<\/script>/gi, '');
    const headers = [
      '模型名称',
      '上下文',
      '输入单价（元/百万 Tokens）',
      '输出单价（元/百万 Tokens）',
      '缓存存储（元/百万 Tokens/小时）',
      '缓存命中（元/百万 Tokens）',
    ];
    const all = tables(html);
    const main = only(withHeader(all, [...headers, '输入模态']), 'BigModel primary text tariff');
    const legacy = withHeader(all, headers).flat();
    return new Map(
      [...targets, ...crossTargets].map((target) => {
        const rows = (displayModels.has(target.modelId) ? main : legacy).filter(
          ([model]) => model?.text.toLowerCase() === target.modelId,
        );
        try {
          return [
            target.quoteId,
            crossModels.has(target.modelId)
              ? parseCrossTariff(target, rows)
              : parseModel(target, rows),
          ];
        } catch (error) {
          return [target.quoteId, { error: error.message }];
        }
      }),
    );
  },
};
