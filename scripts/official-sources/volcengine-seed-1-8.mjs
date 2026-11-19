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

const modelId = 'doubao-seed-1-8-251228';
const quoteId = 'upstream:volcengine:' + modelId + ':CNY';
const target = {
  ...standardTarget(
    'volcengine',
    'https://ark.cn-beijing.volces.com/api/v3',
    modelId,
    'fixed upstream primary or original CNY sheet',
    quoteId,
  ),
  referenceOnlyReason: 'Native model sync has no hourly cache storage charge for this Ark tariff',
};
const headers = [
  '条件 千 token',
  '输入 元/百万 token',
  '输入命中缓存 元/百万 token',
  '输出单价 元/百万 token',
  '缓存存储 元/百万 token*小时',
  '输入单价[批量] 元/百万 token',
  '输入命中缓存[批量] 元/百万 token',
  '输出单价[批量] 元/百万 token',
];
const bands = [
  [
    '输入长度 [0, 32] 且输出长度 [0, 0.2]',
    {
      inputTokens: { minimum: 0, maximum: 32_000 },
      outputTokens: { minimum: 0, maximum: 200 },
    },
  ],
  [
    '输入长度 [0, 32] 且输出长度 (0.2,+∞)',
    {
      inputTokens: { minimum: 0, maximum: 32_000 },
      outputTokens: { above: 200 },
    },
  ],
  ['输入长度 (32, 128]', { inputTokens: { above: 32_000, maximum: 128_000 } }],
  ['输入长度 (128, 256]', { inputTokens: { above: 128_000, maximum: 256_000 } }],
];

export const adapter = {
  id: 'volcengine-seed-1-8',
  url: 'https://docs.volcengine.com/docs/ark/bytedance-seed-1-8?lang=zh',
  targets: [target],
  parse({ body }) {
    const html = decode(body).replace(/<script\b[^]*?<\/script>/gi, '');
    if (!/Model ID：doubao-seed-1-8-251228(?=\s|$)/.test(htmlText(html))) {
      throw Error('Exact Ark Seed 1.8 model ID missing');
    }
    const [, ...rows] = only(
      withHeader(tables(html), headers).filter((table) => table.length > 1),
      'Ark Seed 1.8 online and Batch rate table',
    );
    if (rows.length !== bands.length) throw Error('Incomplete Ark Seed 1.8 charging bands');
    const charges = rows.map((row, index) => {
      if (row.length !== headers.length || row[0].text !== bands[index][0]) {
        throw Error('Unexpected Ark Seed 1.8 charging band: ' + row[0]?.text);
      }
      return row.slice(1).map(({ text }) => number(text));
    });
    const price = ([input, cache_read, output]) => ({ input, cache_read, output });
    const result = tariff(
      target,
      {
        online: charges.map(price),
        cacheStorage: charges.map((row) => ({
          amount: row[3],
          unit: 'per_million_token_hours',
        })),
      },
      {
        bands: bands.map(([, boundaries]) => boundaries),
        batchReference: charges.map((row) => price(row.slice(4))),
      },
    );
    result.required = charges.flatMap((_, index) => [
      ...['input', 'cache_read', 'output'].map((key) => `online.${index}.${key}`),
      `cacheStorage.${index}.amount`,
    ]);
    return new Map([[quoteId, result]]);
  },
};
