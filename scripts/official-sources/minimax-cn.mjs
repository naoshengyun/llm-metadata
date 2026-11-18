import { decode, number, only, standardTarget, tariff } from './lib/domestic-tables.mjs';

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

function original(value) {
  const match = /^~~(\d+(?:\.\d+)?)~~ \d+(?:\.\d+)?$/.exec(value);
  if (!match) throw Error('Missing MiniMax standard base amount and separate discount');
  return number(match[1]);
}

export const adapter = {
  id: 'minimax-cn',
  url: 'https://platform.minimax.cn/docs/pricing/overview.md',
  supplemental: [
    { id: 'cache', url: 'https://platform.minimax.cn/docs/api-reference/text-prompt-caching.md' },
  ],
  targets: [...models, ...images],
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
    const bands = standard.split('\n').filter((line) => line.startsWith('> | **MiniMax-M3** '));
    const low = only(
      bands.filter((row) => /^> \| \*\*MiniMax-M3\*\* ≤ \d+k 输入 tokens 永久五折 \|/.test(row)),
      'MiniMax M3 lower band',
    );
    const high = only(
      bands.filter((row) =>
        /^> \| \*\*MiniMax-M3\*\* > \d+k 输入 tokens\\\* 永久五折 \|/.test(row),
      ),
      'MiniMax M3 upper band',
    );
    const limit = Number(/≤ (\d+)k/.exec(low)[1]);
    if (limit !== Number(/> (\d+)k/.exec(high)[1]))
      throw Error('Discontinuous MiniMax M3 input bands');
    const lowPrice = charges(low, original);
    const highPrice = charges(high, original);
    const m3 = tariff(
      models[0],
      {
        ...lowPrice,
        tiers: [{ tier: { size: limit * 1000 }, ...highPrice }],
      },
      { ...conditions, inputThreshold: limit * 1000, serviceTier: 'standard' },
    );
    m3.required = Object.keys(lowPrice).concat(
      Object.keys(highPrice).map((key) => 'tiers.0.' + key),
    );
    const imageSection = /^## 图片\s*$([^]*?)^## 语音\s*$/m.exec(markdown)?.[1];
    const imageRow = imageSection
      ?.split('\n')
      .find((line) => line.includes('| image-01 image-01-live |'));
    if (!imageRow || !/单价\*\*\s+元\/张|单价\s+元\/张/.test(imageSection)) {
      throw Error('Missing MiniMax image-01 family per-image price');
    }
    const image = number(cells(imageRow)[2]);
    return new Map([
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
