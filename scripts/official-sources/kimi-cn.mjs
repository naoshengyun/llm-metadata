import ts from 'typescript';
import {
  array,
  componentProps,
  mintlifyTables,
  properties,
  string,
} from '../official-source-helpers/mintlify-tables.mjs';

const priceList = 'Kimi China standard synchronous pay-as-you-go';
const names = {
  k2: ['kimi-k2.6', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed'],
  k3: ['kimi-k3', 'kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed'],
};
const baseHeaders = ['模型', '输入', '输出', '缓存命中'];
const baseCharges = ['input', 'output', 'cache_read'];
const inputConditions = {
  k2: { cacheHitRenewsTtl: true },
  k3: {
    cacheHitRenewsTtl: true,
    cacheWriteTtlSeconds: { cache_write: 300, cache_write_1h: 3600 },
    defaultCacheTtlSeconds: 300,
    chargeWriteOnCacheHit: false,
  },
};

export const adapter = {
  id: 'kimi-cn-chat',
  url: 'https://platform.kimi.com/docs/pricing/chat',
  targets: Object.entries(names).flatMap(([group, models]) =>
    models.map((modelId) => ({
      quoteId:
        modelId === 'kimi-k2.6'
          ? 'upstream:moonshotai-cn:kimi-k2.6:CNY'
          : `cn-moonshot-${modelId}-standard`,
      providerId: 'moonshotai-cn',
      endpoint: 'https://api.moonshot.cn/v1',
      modelId,
      priceList,
      ...(modelId === 'kimi-k2.6' && {
        baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
      }),
      currency: 'CNY',
      group,
      baselineConditions: inputConditions[group],
    })),
  ),
  parse,
};

function parse({ body }) {
  const { sectionTables, paragraphs } = mintlifyTables(body);
  if (!paragraphs.some((paragraph) => paragraph.includes('1 MTok = 1,000,000 tokens'))) {
    throw Error('Kimi MTok billing unit is missing or changed');
  }

  const byId = new Map();
  for (const [group, models] of Object.entries(names)) {
    const targets = adapter.targets.filter((target) => target.group === group);
    try {
      const tables = sectionTables.get(group + '-系列模型') ?? [];
      if (tables.length !== 1) throw Error('Expected one Kimi pricing table for ' + group);
      const table = componentProps(tables[0], 'DocTable');
      const columns = array(table.get('columns')).map((column) => {
        const title = properties(column).get('title');
        if (!ts.isCallExpression(title)) return { title: string(title) };
        const tooltip = componentProps(title, 'Tooltip');
        return { title: string(tooltip.get('children')), tip: string(tooltip.get('tip')) };
      });
      const headers = columns.map(({ title }) => title);
      const hitTip = columns[3]?.tip;
      const cacheHit =
        /^命中缓存的请求前缀按此价格计费，命中后缓存有效期（TTL）(自动续期|不续期)。$/.exec(
          hitTip ?? '',
        );
      if (!cacheHit) throw Error('Kimi cache-hit semantics are missing or unrecognized');
      const conditions = { cacheHitRenewsTtl: cacheHit[1] === '自动续期' };
      let description;
      const expectedHeaders = [...baseHeaders];
      const required = [...baseCharges];
      const groups = array(table.get('groups')).map((item) => {
        const props = properties(item);
        return [string(props.get('title')), props.get('span')?.getText()];
      });
      if (
        JSON.stringify(groups) !==
        JSON.stringify([
          ['基础 tokens', '2'],
          ['上下文缓存', group === 'k3' ? '3' : '1'],
        ])
      )
        throw Error('Unexpected Kimi price column groups for ' + group);
      if (group === 'k3') {
        expectedHeaders.push('缓存写入（5min）', '缓存写入（1h）');
        required.push('cache_write', 'cache_write_1h');
        const defaults = paragraphs.filter((paragraph) => paragraph.includes('TTL）默认为'));
        const ttl = defaults.length === 1 && /TTL）默认为 (5min|1h)。/.exec(defaults[0]);
        const hit = paragraphs.filter((paragraph) => paragraph.includes('缓存命中的输入'));
        const write =
          hit.length === 1 &&
          /缓存命中的输入仅按缓存命中价格计费，(不再重复|同时)收取缓存写入费用。/.exec(hit[0]);
        if (!ttl || !write)
          throw Error('Kimi cache TTL or hit charging semantics are missing or unrecognized');
        const short = '将请求前缀写入上下文缓存，缓存有效期（TTL）为 5 分钟。';
        const long = '将请求前缀写入上下文缓存，缓存有效期（TTL）为 1 小时。';
        const defaultTip = '不指定 TTL 时默认按此档。';
        const expectedTips =
          ttl[1] === '5min'
            ? [short.slice(0, -1) + '；' + defaultTip, long]
            : [short, long.slice(0, -1) + '；' + defaultTip];
        if (columns[4]?.tip !== expectedTips[0] || columns[5]?.tip !== expectedTips[1]) {
          throw Error('Kimi cache-write column conditions disagree with published default TTL');
        }
        description =
          'Standard synchronous pay-as-you-go in original CNY per million tokens. ' +
          'Cache writes use 5-minute or 1-hour TTL with a default of ' +
          ttl[1] +
          '. ' +
          (write[1] === '同时'
            ? 'Cache hits also incur a write fee.'
            : 'Cache hits do not incur another write fee.');
        Object.assign(conditions, {
          cacheWriteTtlSeconds: { cache_write: 300, cache_write_1h: 3600 },
          defaultCacheTtlSeconds: ttl[1] === '5min' ? 300 : 3600,
          chargeWriteOnCacheHit: write[1] === '同时',
        });
      }
      if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
        throw Error('Unexpected Kimi price headers for ' + group);
      }
      const rows = new Map();
      const seen = new Set();
      for (const row of array(table.get('rows'))) {
        const [model, ...cells] = array(row);
        const modelId = ts.isCallExpression(model)
          ? string(componentProps(model, '_components.a').get('children'))
          : string(model);
        if (seen.has(modelId)) throw Error('Duplicate Kimi pricing row: ' + modelId);
        seen.add(modelId);
        if (!models.includes(modelId)) continue;
        if (cells.length !== required.length)
          throw Error('Incomplete Kimi pricing row: ' + modelId);
        const sourcePrice = Object.fromEntries(
          cells.map((cell, index) => {
            const amount = /^¥(\d+(?:\.\d+)?) \/ MTok$/.exec(string(cell));
            if (!amount)
              throw Error('Invalid Kimi CNY amount or unit: ' + modelId + ' ' + required[index]);
            return [required[index], Number(amount[1])];
          }),
        );
        rows.set(modelId, sourcePrice);
      }
      for (const { quoteId, modelId } of targets) {
        const sourcePrice = rows.get(modelId);
        if (sourcePrice)
          byId.set(quoteId, {
            identity: {
              providerId: 'moonshotai-cn',
              endpoint: 'https://api.moonshot.cn/v1',
              modelId,
              priceList,
              currency: 'CNY',
            },
            recordId: `cn-moonshot-${modelId}-standard`,
            description,
            sourcePrice,
            sourceUnit: 'per_million_tokens',
            required,
            conditions,
          });
      }
    } catch (error) {
      for (const { quoteId } of targets) byId.set(quoteId, { error: error.message });
    }
  }
  return byId;
}
