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

const targets = ['hy3', 'hy3-preview', 'hy4', 'hy4-preview'].map((model) =>
  standardTarget(
    'tencent-tokenhub',
    'https://tokenhub.tencentmaas.com/v1',
    model,
    'TokenHub Guangzhou online pay-as-you-go',
    'cn-tencent-' + model + '-standard',
    model === 'hy3-preview' ? 'hy3' : model,
  ),
);

export const adapter = {
  id: 'tencent-cn',
  url: 'https://cloud.tencent.com/document/product/1823/130055',
  supplemental: [{ id: 'migration', url: 'https://cloud.tencent.com/announce/detail/2391' }],
  targets,
  parse({ body, supplemental }) {
    const page = decode(body);
    const guangzhou = [
      ...page.matchAll(
        /<div class="tse-tabs__item is-active"[^>]*><div class="tse-tabs__item-cont"><div class="tse-tabs__item-label">广州<\/div>(?:(?!<table\b)[^])*(<table\b[^]*?<\/table>)/g,
      ),
    ].flatMap(([, table]) => tables(table));
    const table = only(
      withHeader(guangzhou, [
        '模型名称',
        'model（调用参数）',
        '条件 （token）',
        '峰谷计费',
        '推理输入 （元/百万 tokens）',
        '推理输出 （元/百万 tokens）',
        '缓存命中 （元/百万 tokens）',
        '缓存写入-5min（元/百万 tokens）',
        '缓存写入-1h（元/百万 tokens）',
      ]),
      'TokenHub Guangzhou online table',
    );
    const announcement = htmlText(
      decode(supplemental.get('migration').body).replace(/<script\b[^]*?<\/script>/g, ''),
    );
    const migrated =
      announcement.includes('model 参数值：hy3-preview') &&
      announcement.includes('后付费 API 接入用户：系统将自动为您切换至 Hy3') &&
      announcement.includes('自动切换后，相关调用将按照切换后模型的计费规则执行') &&
      /自动切换将于北京时间 (\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日 (\d{2}:\d{2}) 执行/.exec(
        announcement,
      );
    return new Map(
      targets.map((target) => {
        const alias = target.modelId === 'hy3-preview';
        if (alias && !migrated)
          return [target.quoteId, { error: 'Unverified TokenHub preview migration' }];
        const model = alias ? 'hy3' : target.modelId;
        const row = only(
          table.filter((row) => row[1]?.text === model),
          model,
        ).map(({ text }) => text);
        if (row.length !== 9 || [2, 3, 7, 8].some((i) => row[i] !== '-')) {
          return [target.quoteId, { error: 'Unexpected Tencent charge conditions: ' + model }];
        }
        const result = tariff(
          target,
          {
            input: number(row[4]),
            output: number(row[5]),
            cache_read: number(row[6]),
          },
          { region: 'Guangzhou', ...(alias && { billedAsModel: model }) },
        );
        if (alias) {
          const [, year, month, day, time] = migrated;
          result.effectiveAt = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00+08:00`;
        }
        return [target.quoteId, result];
      }),
    );
  },
};
