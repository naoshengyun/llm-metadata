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
    providerId: 'alibaba-cn',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    pricePrefix: 'cn-beijing-online-original',
    headers: ['计费项', '价格（元）', '单位'],
    labels: ['输入', '输出', '输入（缓存命中）', '显式缓存创建', '显式缓存命中'],
    unit: '每百万tokens',
  },
  USD: {
    region: 'Singapore',
    tab: 'Singapore',
    heading: 'Pricing',
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
    unit: 'Per 1M tokens',
  },
};

function cardRates(body, model, currency, { tab, heading, headers, labels, unit }) {
  const lines = decode(body).split(/\r?\n/);
  if (lines.find((line) => line.startsWith('# ')) !== '# ' + model)
    throw Error('Expected exact Qwen model card: ' + model);
  const start = lines.findIndex((line) => line.startsWith('## ' + heading + ' '));
  if (start < 0) throw Error('Qwen model price section missing');
  const section = lines
    .slice(start + 1)
    .join('\n')
    .split(/^## /m)[0];
  const tabs = [...section.matchAll(/<Tab title="([^"]+)">([^]*?)<\/Tab>/g)];
  const bodyForRegion = only(
    tabs.filter(([, name]) => name === tab),
    'Qwen region ' + tab,
  )[2];
  const scope = bodyForRegion.replace(/<table\b[^>]*>[^]*?<\/table>/gi, '').trim();
  if (scope !== (currency === 'USD' ? 'Scope: International' : ''))
    throw Error('Unexpected Qwen pricing scope or effective conditions');
  const [, ...rows] = only(withHeader(tables(bodyForRegion), headers), 'Qwen original price table');
  return labels.map((label) => {
    const row = only(
      rows.filter(([name]) => name?.text === label),
      'Qwen charge ' + label,
    );
    if (row.length !== 3 || row[2].text !== unit)
      throw Error('Unexpected Qwen billing unit for ' + label);
    return number(row[1].text);
  });
}

function cacheConditions(body) {
  const text = htmlText(decode(body));
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
