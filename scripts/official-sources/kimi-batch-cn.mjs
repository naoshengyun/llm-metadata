import ts from 'typescript';
import {
  array,
  componentProps,
  mintlifyTables,
  properties,
  string,
} from '../official-source-helpers/mintlify-tables.mjs';
import { only, standardTarget, tariff } from './lib/domestic-tables.mjs';

const priceList = 'Kimi China Batch API';
const models = ['kimi-k3.1-pro', 'kimi-k3', 'kimi-k2.7-code'];
const columnNames = ['模型', '输入', '输出', '缓存命中', '缓存写入（5min）', '缓存写入（1h）'];
const baseCharges = ['input', 'output', 'cache_read'];
const writeCharges = ['cache_write', 'cache_write_1h'];

const targets = models.map((modelId) =>
  standardTarget(
    'moonshotai-cn',
    'https://api.moonshot.cn/v1',
    modelId,
    priceList,
    `cn-moonshot-${modelId}-batch`,
    'batch',
  ),
);

export const adapter = {
  id: 'kimi-batch-cn',
  url: 'https://platform.kimi.com/docs/pricing/batch',
  targets,
  parse({ body }) {
    const { sectionTables, paragraphs } = mintlifyTables(body);
    const rate = only(
      paragraphs.flatMap((paragraph) => {
        const match =
          /^Batch API 即批量推理 API，批量推理 API 费用为标准模型价格的 (\d+(?:\.\d+)?)%，/.exec(
            paragraph,
          );
        return match ? [Number(match[1])] : [];
      }),
      'Kimi Batch standard price percentage',
    );
    if (
      rate <= 0 ||
      rate > 100 ||
      !paragraphs.some((paragraph) => paragraph.includes('1 MTok = 1,000,000 tokens'))
    ) {
      throw Error('Invalid Kimi Batch percentage or MTok unit');
    }
    const table = componentProps(
      only(sectionTables.get('产品定价') ?? [], 'Kimi Batch product pricing table'),
      'DocTable',
    );
    const columns = array(table.get('columns')).map((node) => {
      const title = properties(node).get('title');
      if (!ts.isCallExpression(title)) return { label: string(title) };
      const tooltip = componentProps(title, 'Tooltip');
      return { label: string(tooltip.get('children')), tip: string(tooltip.get('tip')) };
    });
    const groups = array(table.get('groups')).map((node) => {
      const props = properties(node);
      return [string(props.get('title')), props.get('span')?.getText()];
    });
    if (
      JSON.stringify(columns.map(({ label }) => label)) !== JSON.stringify(columnNames) ||
      JSON.stringify(groups) !==
        JSON.stringify([
          ['基础 tokens', '2'],
          ['上下文缓存', '3'],
        ])
    ) {
      throw Error('Unexpected Kimi Batch tariff headers');
    }
    if (
      columns[3].tip !==
        '命中缓存的请求前缀按此价格计费；批处理请求异步并发执行，缓存命中为尽力而为。' ||
      columns[4].tip !== '将请求前缀写入上下文缓存，缓存有效期（TTL）为 5 分钟。' ||
      columns[5].tip !== '将请求前缀写入上下文缓存，缓存有效期（TTL）为 1 小时。'
    ) {
      throw Error('Unexpected Kimi Batch cache condition');
    }
    const rows = new Map();
    for (const row of array(table.get('rows'))) {
      const [model, ...cells] = array(row);
      const modelId = ts.isCallExpression(model)
        ? string(componentProps(model, '_components.a').get('children'))
        : string(model);
      if (rows.has(modelId)) throw Error('Duplicate Kimi Batch model: ' + modelId);
      rows.set(modelId, cells);
    }
    return new Map(
      targets.map((target) => {
        const cells = rows.get(target.modelId);
        const hasWrites = target.modelId.startsWith('kimi-k3');
        const fields = hasWrites ? [...baseCharges, ...writeCharges] : baseCharges;
        if (!cells || cells.length !== 5) {
          return [target.quoteId, { error: 'Incomplete Kimi Batch model row: ' + target.modelId }];
        }
        if (!hasWrites && cells.slice(3).some((cell) => string(cell) !== '—')) {
          return [
            target.quoteId,
            { error: 'Unexpected Kimi Batch cache-write fee for ' + target.modelId },
          ];
        }
        const amounts = cells.slice(0, fields.length).map((cell) => {
          const match = /^¥(\d+(?:\.\d+)?) \/ MTok$/.exec(string(cell));
          return match ? Number(match[1]) : NaN;
        });
        if (amounts.some((amount) => !Number.isFinite(amount))) {
          return [target.quoteId, { error: 'Invalid Kimi Batch CNY amount: ' + target.modelId }];
        }
        return [
          target.quoteId,
          tariff(
            target,
            Object.fromEntries(fields.map((field, index) => [field, amounts[index]])),
            {
              service: 'async-batch',
              standardPricePercent: rate,
              cacheHit: 'best-effort',
              ...(hasWrites && {
                cacheWriteTtlSeconds: { cache_write: 300, cache_write_1h: 3600 },
              }),
            },
          ),
        ];
      }),
    );
  },
};
