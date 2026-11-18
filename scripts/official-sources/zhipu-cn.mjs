import {
  decode,
  number,
  only,
  standardTarget,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

const targets = ['glm-5.2', 'glm-5.3', 'glm-5.3-flash'].map((model) =>
  standardTarget(
    'zhipuai',
    'https://open.bigmodel.cn/api/paas/v4',
    model,
    'BigModel China standard API pay-as-you-go',
    'cn-zhipu-' + model + '-standard',
    'online',
  ),
);

export const adapter = {
  id: 'zhipu-cn',
  url: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
  targets,
  parse({ body }) {
    const html = decode(body);
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
    const legacy = withHeader(all, headers);
    return new Map(
      targets.map((target) => {
        const rows = (target.modelId === 'glm-5.2' ? legacy.flat() : main).filter(
          ([model]) => model?.text.toLowerCase() === target.modelId,
        );
        const row = only(rows, target.modelId);
        if (row.length !== (target.modelId === 'glm-5.2' ? 6 : 7))
          throw Error('Incomplete BigModel tariff');
        const [, context, input, output, storage, hit, modalities] = row.map(({ text }) => text);
        if (!/^\d+[KM]$/.test(context) || storage !== '限时免费') {
          throw Error('Unrecognized BigModel context or cache-storage condition');
        }
        return [
          target.quoteId,
          tariff(
            target,
            {
              input: number(input),
              output: number(output),
              cache_read: number(hit),
            },
            {
              context,
              cacheStorage: 'limited-time-free',
              cacheStorageUnit: 'per_million_token_hours',
              ...(modalities && { inputModalities: modalities.split('、') }),
            },
          ),
        ];
      }),
    );
  },
};
