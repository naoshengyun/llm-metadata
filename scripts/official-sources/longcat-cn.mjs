import { decode, number, only, standardTarget, tables, tariff } from './lib/domestic-tables.mjs';

const target = standardTarget(
  'longcat',
  'https://api.longcat.chat/openai',
  'LongCat-2.0',
  'LongCat-2.0 first-party original RMB tariff',
  'cn-longcat-LongCat-2.0-standard',
);

export const adapter = {
  id: 'longcat-cn',
  url: 'https://longcat.chat/platform/docs/zh/pricing/long-cat-2.0',
  targets: [target],
  parse({ body }) {
    const html = decode(body);
    if (!/<title>LongCat-2\.0\b/.test(html)) throw Error('Missing LongCat-2.0 page identity');
    const table = only(
      tables(html).filter(([header, first]) => {
        if (header?.[0]?.text !== '计费项' || !first?.[1]?.text.startsWith('¥')) return false;
        if (header.length === 2) return /^(?:单价|价格) \/ 百万 Tokens$/.test(header[1]?.text);
        return (
          header.length === 3 &&
          header[1]?.text === '原价 / 百万 Tokens' &&
          /^折扣价 \/ 百万 Tokens(?:（[^）]+）)?$/.test(header[2]?.text)
        );
      }),
      'LongCat published RMB tariff',
    );
    const priceColumn = table[0].length - 1;
    function charge(label) {
      const row = only(
        table.filter(([cell]) => cell?.text === label),
        'LongCat ' + label,
      );
      if (row.length !== table[0].length) throw Error('Incomplete LongCat charge: ' + label);
      return number(row[priceColumn].text, '¥');
    }
    return new Map([
      [
        target.quoteId,
        tariff(
          target,
          {
            input: charge('输入（未命中缓存）'),
            output: charge('输出'),
            cache_read: charge('输入（命中缓存）'),
          },
          { scope: 'first-party published LongCat-2.0 base tariff' },
        ),
      ],
    ]);
  },
};
