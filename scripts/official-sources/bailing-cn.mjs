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

const targets = ['Ling-3.0-flash', 'Ling-3.0-flash-VL', 'Ling-3.1-flash'].map((model) =>
  standardTarget(
    'bailing',
    'https://api.ant-ling.com/v1',
    model,
    'Bailing first-party RMB base tariff',
    'cn-bailing-' + model + '-standard',
    'first-party',
  ),
);

function currentPrice({ content, text }) {
  const matches = [...content.matchAll(/<del\b[^>]*>([^]*?)<\/del>/gi)];
  if (matches.length === 0) return number(text, '¥');
  const [crossedOutPrice] = only(matches, 'Bailing crossed-out price markup');
  return number(htmlText(content.replace(crossedOutPrice, '')), '¥');
}

export const adapter = {
  id: 'bailing-cn',
  url: 'https://developer.ant-ling.com/zh-CN/docs/models/price/',
  targets,
  parse({ body }) {
    const html = decode(body);
    if (!html.includes('以下价格均以人民币（RMB）计价。'))
      throw Error('Missing first-party RMB scope');
    const table = only(
      withHeader(tables(html), [
        '模型',
        '定位',
        '输入价格',
        '单位',
        '输出价格',
        '单位',
        '缓存读取',
        '单位',
      ]),
      'Bailing first-party tariff',
    );
    return new Map(
      targets.map((target) => {
        const row = only(
          table.filter(([model]) => model?.text === target.modelId),
          target.modelId,
        );
        if (row.length !== 8 || [3, 5, 7].some((index) => row[index].text !== '百万 token')) {
          throw Error('Incomplete Bailing tariff or changed unit: ' + target.modelId);
        }
        return [
          target.quoteId,
          tariff(
            target,
            {
              input: currentPrice(row[2]),
              output: currentPrice(row[4]),
              cache_read: currentPrice(row[6]),
            },
            { scope: 'first-party API' },
          ),
        ];
      }),
    );
  },
};
