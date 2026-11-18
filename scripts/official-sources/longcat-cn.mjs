import {
  decode,
  number,
  only,
  standardTarget,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

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
      withHeader(tables(html), [
        '计费项',
        '原价 / 百万 Tokens',
        '折扣价 / 百万 Tokens（限时）',
      ]).filter((rows) => rows[1]?.[1]?.text.startsWith('¥')),
      'LongCat original RMB tariff',
    );
    function charge(label) {
      const row = only(
        table.filter(([cell]) => cell?.text === label),
        'LongCat ' + label,
      );
      if (row.length !== 3) throw Error('Incomplete LongCat charge: ' + label);
      return number(row[1].text, '¥');
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
