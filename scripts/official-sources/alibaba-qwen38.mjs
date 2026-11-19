import {
  decode,
  htmlText,
  number,
  only,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

const models = ['qwen3.8-flash', 'qwen3.8-max'];
const cardHosts = {
  CNY: 'https://docs.bailian.console.aliyun.com/zh/model-studio/',
  USD: 'https://docs.modelstudio.console.alibabacloud.com/en/model-studio/',
};
const cacheUrl = cardHosts.CNY + 'context-cache.md';
const regions = {
  CNY: {
    region: 'China mainland, Beijing',
    tab: '华北2（北京）',
    heading: '模型价格',
    preface:
      '本文仅展示模型调用原价，不包含限时优惠等活动信息，请前往' +
      '[百炼控制台](https://bailian.console.aliyun.com/cn-beijing/model/market)查看活动优惠。',
    providerId: 'alibaba-cn',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    pricePrefix: 'cn-beijing-online-original',
    headers: ['计费项', '价格（元）', '单位'],
    labels: ['输入', '输出', '输入（缓存命中）', '显式缓存创建', '显式缓存命中'],
    excludedLabels: [
      '输入（Batch File）',
      '输出（Batch File）',
      '输入（Batch Chat)',
      '输出（Batch Chat)',
    ],
    unit: '每百万tokens',
  },
  USD: {
    region: 'Singapore',
    tab: 'Singapore',
    heading: 'Pricing',
    preface:
      'This page only shows the original pricing for model API calls, excluding any limited-time promotions. ' +
      'Visit [Model Studio Console](https://modelstudio.console.alibabacloud.com/ap-southeast-1/model/market) for promotional offers.',
    providerId: 'alibaba',
    endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    pricePrefix: 'sg-international-online-original',
    headers: ['Billing Item', 'Price (USD)', 'Unit'],
    labels: [
      'Input',
      'Output',
      'Input(Implicit Cache)',
      'Explicit Cache Creation',
      'Explicit Cache Read',
    ],
    excludedLabels: [],
    unit: 'Per 1M tokens',
  },
};

function cardRates(
  body,
  model,
  currency,
  { tab, heading, preface, headers, labels, excludedLabels, unit },
) {
  const lines = decode(body).split(/\r?\n/);
  if (lines.find((line) => line.startsWith('# ')) !== '# ' + model)
    throw Error('Expected exact Qwen model card: ' + model);
  const start = lines.findIndex(
    (line) => line.replace(/ <span id="[\w-]+" \/>$/, '') === '## ' + heading,
  );
  if (start < 0) throw Error('Qwen model price section missing');
  const section = lines
    .slice(start + 1)
    .join('\n')
    .split(/^## /m)[0];
  const wrapper = /^([^]*?)<Tabs>([^]*?)<\/Tabs>\s*$/.exec(section);
  if (!wrapper || wrapper[1].trim() !== preface)
    throw Error('Unexpected Qwen price preface or effective conditions');
  const tabPattern = /<Tab title="([^"]+)">([^]*?)<\/Tab>/g;
  if (wrapper[2].replace(tabPattern, '').trim())
    throw Error('Unexpected text between Qwen regional price tabs');
  const tabs = [...wrapper[2].matchAll(tabPattern)];
  const bodyForRegion = only(
    tabs.filter(([, name]) => name === tab),
    'Qwen region ' + tab,
  )[2];
  const scope = bodyForRegion.replace(/<table\b[^>]*>[^]*?<\/table>/gi, '').trim();
  if (scope !== (currency === 'USD' ? 'Scope: International' : ''))
    throw Error('Unexpected Qwen pricing scope or effective conditions');
  const table = only(tables(bodyForRegion), 'Qwen regional price table');
  const [, ...rows] = only(withHeader([table], headers), 'Qwen original price table');
  const onlineRows = rows.filter(([name]) => !excludedLabels.includes(name?.text));
  if (onlineRows.some(([name]) => !labels.includes(name?.text)))
    throw Error('Unexpected Qwen online charge');
  return labels.map((label) => {
    const row = only(
      onlineRows.filter(([name]) => name?.text === label),
      'Qwen charge ' + label,
    );
    if (row.length !== 3 || row[2].text !== unit)
      throw Error('Unexpected Qwen billing unit for ' + label);
    return number(row[1].text);
  });
}

function cacheConditions(body) {
  const document = decode(body);
  const [, ...cacheRows] = only(
    withHeader(tables(document), ['项目', '显式缓存', '隐式缓存']),
    'Qwen cache policy comparison table',
  );
  const creation = only(
    cacheRows.filter(([name]) => name?.text === '用于创建缓存Token计费'),
    'Qwen cache creation policy',
  );
  if (creation.length !== 3 || creation[2].text !== '输入 Token 单价的100%')
    throw Error('Qwen implicit cache creation must be included in the input rate');
  const text = htmlText(document);
  const ttl = /有效期为 (\d+) 分钟，且每次命中后会重新计时 (\d+) 分钟/.exec(text);
  const minimum = /最小可缓存提示词长度为\s*(\d+)\s*Token。/.exec(text);
  if (
    !ttl ||
    ttl[1] !== ttl[2] ||
    !minimum ||
    !text.includes('显式缓存、隐式缓存两者互斥，单个请求只能应用其中一种模式') ||
    !text.includes('由系统自动管理，无固定有效期')
  )
    throw Error('Qwen cache policy conditions missing or ambiguous');
  return { minimum: number(minimum[1]), ttlSeconds: number(ttl[1]) * 60 };
}

export const adapter = Object.entries(regions).flatMap(([currency, region]) =>
  models.map((modelId) => {
    const targets = ['implicit', 'explicit'].map((mode) => {
      const priceList = region.pricePrefix + '-' + mode;
      return {
        quoteId: 'dashscope--' + modelId + '--' + priceList,
        providerId: region.providerId,
        endpoint: region.endpoint,
        modelId,
        priceList,
        currency,
        group: modelId,
      };
    });
    return {
      id: 'bailian-' + currency.toLowerCase() + '-' + modelId.replaceAll('.', '-'),
      url: cardHosts[currency] + modelId.replaceAll('.', '-') + '.md',
      supplemental: [{ id: 'cache', url: cacheUrl }],
      targets,
      parse({ body, supplemental }) {
        const [input, output, implicitHit, explicitWrite, explicitHit] = cardRates(
          body,
          modelId,
          currency,
          region,
        );
        const { minimum, ttlSeconds } = cacheConditions(supplemental.get('cache').body);
        return new Map(
          targets.map((target) => {
            const explicit = target.priceList.endsWith('-explicit');
            return [
              target.quoteId,
              tariff(
                target,
                {
                  input,
                  output,
                  cache_read: explicit ? explicitHit : implicitHit,
                  ...(explicit && { cache_write: explicitWrite }),
                },
                {
                  region: region.region,
                  ...(currency === 'USD' && { deployment: 'International' }),
                  cacheMode: explicit ? 'explicit' : 'implicit',
                  cacheMinimumInputTokens: minimum,
                  ...(explicit
                    ? { cacheWriteTtlSeconds: ttlSeconds, cacheHitRenewsTtl: true }
                    : { cacheTtl: 'no fixed TTL', cacheWriteIncludedInInput: true }),
                },
              ),
            ];
          }),
        );
      },
    };
  }),
);
