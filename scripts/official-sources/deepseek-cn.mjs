import {
  decode,
  htmlText,
  number,
  only,
  standardTarget,
  tables,
  tariff,
} from './lib/domestic-tables.mjs';

const models = [
  'deepseek-flash',
  'deepseek-v4-flash',
  'deepseek-v4-flash-vision-exp',
  'deepseek-v4-pro',
];
const priceList = 'fixed upstream primary or original CNY sheet';
const targets = models.map((model) => ({
  ...standardTarget(
    'deepseek',
    'https://api.deepseek.com',
    model,
    priceList,
    `upstream:deepseek:${model}:CNY`,
    'domestic-peak-off-peak',
  ),
  referenceOnlyReason:
    'Native weekly schedules cannot express mainland China legal-holiday off-peak pricing',
}));

function rowsAfter(table, label) {
  const match = only(
    table.map((row, i) => ({ row, i })).filter(({ row }) => row.some(({ text }) => text === label)),
    label,
  );
  const cells = match.row.map(({ text }) => text);
  const peak = table[match.i + 1]?.map(({ text }) => text);
  const offPeak = cells.slice(cells.indexOf(label) + 1);
  if (
    offPeak[0] !== '空闲时段' ||
    peak?.[0] !== '高峰时段' ||
    offPeak.length !== 3 ||
    peak.length !== 3
  )
    throw Error('Incomplete DeepSeek ' + label);
  return [offPeak.slice(1), peak.slice(1)].map((row) =>
    row.map((value) => {
      if (!value.endsWith('元')) throw Error('Missing DeepSeek RMB unit');
      return number(value.slice(0, -1));
    }),
  );
}

export const adapter = {
  id: 'deepseek-cn',
  url: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
  targets,
  parse({ body }) {
    const html = decode(body).replace(/<script\b[^]*?<\/script>/gi, '');
    const table = only(
      tables(html).filter(
        ([row]) =>
          row?.map(({ text }) => text).join('/') === '模型/deepseek-flash (1)/deepseek-v4-pro',
      ),
      'DeepSeek domestic token table',
    );
    const text = htmlText(html);
    const scope =
      /北京时间周一至周五（不含中国法定节假日）(\d{1,2}:\d{2}) - (\d{1,2}:\d{2})、(\d{1,2}:\d{2}) - (\d{1,2}:\d{2}) 为高峰时段；其余时段，包括周末及中国法定节假日全天均为空闲时段。/.exec(
        text,
      );
    if (
      !scope ||
      !text.includes(
        '旧模型名 deepseek-v4-flash 、 deepseek-v4-flash-vision-exp 仍可调用，但对应模型已下线，请求将由 DeepSeek-V4.1-Flash-1017 模型提供服务，并按 Flash 价格计费。',
      )
    ) {
      throw Error('Missing DeepSeek calendar or exact model migration evidence');
    }
    const [hit, input, output] = [
      '百万tokens输入 （缓存命中）',
      '百万tokens输入 （缓存未命中）',
      '百万tokens输出',
    ].map((label) => rowsAfter(table, label));
    const hours = [1, 3].map(
      (i) => scope[i].padStart(5, '0') + '-' + scope[i + 1].padStart(5, '0'),
    );
    return new Map(
      targets.map((target) => {
        const column = target.modelId === 'deepseek-v4-pro' ? 1 : 0;
        const amounts = (i) => ({
          input: input[i][column],
          output: output[i][column],
          cache_read: hit[i][column],
        });
        const result = tariff(
          target,
          {
            ...amounts(0),
            schedule: {
              timezone: 'Asia/Shanghai',
              fallback: 'off_peak',
              windows: [{ name: 'peak', weekdays: [1, 2, 3, 4, 5], hours, ...amounts(1) }],
            },
          },
          {
            chineseLegalHolidays: 'off_peak',
            ...(column === 0 &&
              target.modelId !== 'deepseek-flash' && {
                billedAsModel: 'deepseek-flash',
                servingModel: 'DeepSeek-V4.1-Flash-1017',
              }),
          },
        );
        result.required = Object.keys(amounts(0)).flatMap((key) => [
          key,
          'schedule.windows.0.' + key,
        ]);
        return [target.quoteId, result];
      }),
    );
  },
};
