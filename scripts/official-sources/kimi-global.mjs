import ts from 'typescript';
import {
  array,
  componentProps,
  mintlifyTables,
  properties,
  string,
} from '../official-source-helpers/mintlify-tables.mjs';
import {
  exactRow,
  markdown,
  requireText,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const providerId = 'moonshotai';
const endpoint = 'https://api.moonshot.ai/v1';
const priceList = 'Kimi international standard synchronous pay-as-you-go';
const currency = 'USD';
const models = {
  k2: ['kimi-k2.6', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed'],
  k3: ['kimi-k3', 'kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed'],
};
const cacheHit =
  "Cached input is billed at this rate; each hit automatically refreshes the cache entry's TTL (time-to-live).";
const shortWrite =
  'Writing a prompt prefix into the context cache with a 5-minute TTL (time-to-live); this is the default tier when no TTL is specified.';
const longWrite = 'Writing a prompt prefix into the context cache with a 1-hour TTL.';
const shortConditions = { cacheHitRenewsTtl: true };

export const adapter = {
  id: 'kimi-global',
  url: 'https://platform.kimi.ai/docs/pricing/chat',
  supplemental: [{ id: 'currency', url: 'https://platform.kimi.ai/docs/api/balance.md' }],
  targets: Object.entries(models).flatMap(([group, ids]) =>
    ids.map((modelId) => ({
      quoteId: 'upstream:moonshotai:' + modelId + ':USD',
      providerId,
      endpoint,
      modelId,
      priceList,
      currency,
      group,
      baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
      baselineConditions: shortConditions,
    })),
  ),
  parse,
};

function chargeTable(sectionTables, paragraphs, group) {
  const tables = sectionTables.get(group + '-series-models');
  if (tables?.length !== 1) throw Error('Expected one Kimi international table for ' + group);
  const component = componentProps(tables[0], 'DocTable');
  const charges = ['input', 'output', 'cache_read'];
  const isLong = group === 'k3';
  const expected = [
    ['Model', ''],
    ['Input', ''],
    ['Output', ''],
    ['Cached Input', cacheHit],
  ];
  const conditions = { ...shortConditions };
  if (isLong) {
    expected.push(['5m writes', shortWrite], ['1h writes', longWrite]);
    charges.push('cache_write', 'cache_write_1h');
    const text = paragraphs.join('\n');
    requireText(text, 'with a default TTL (time-to-live) of 5m.');
    requireText(
      text,
      'cached input is billed at the cache-hit price only, with no additional cache write charge.',
    );
    Object.assign(conditions, {
      cacheWriteTtlSeconds: { cache_write: 300, cache_write_1h: 3600 },
      defaultCacheTtlSeconds: 300,
      chargeWriteOnCacheHit: false,
    });
  }
  const groups = array(component.get('groups')).map((group) => {
    const props = properties(group);
    return [string(props.get('title')), props.get('span')?.getText()];
  });
  const columns = array(component.get('columns')).map((column) => {
    const name = properties(column).get('title');
    if (!ts.isCallExpression(name)) return [string(name), ''];
    const tooltip = componentProps(name, 'Tooltip');
    return [string(tooltip.get('children')), string(tooltip.get('tip'))];
  });
  if (
    JSON.stringify(groups) !==
      JSON.stringify([
        ['Base tokens', '2'],
        ['Prompt caching', isLong ? '3' : '1'],
      ]) ||
    JSON.stringify(columns) !== JSON.stringify(expected)
  ) {
    throw Error('Unexpected Kimi international price columns or conditions');
  }
  const rows = array(component.get('rows')).map((row) => {
    const [id, ...amounts] = array(row);
    const name = ts.isCallExpression(id) ? componentProps(id, '_components.a').get('children') : id;
    return [string(name), ...amounts];
  });
  return { charges, conditions, rows };
}

function parse({ body, supplemental }) {
  const balance = markdown(supplemental.get('currency').body);
  requireText(balance, 'https://api.moonshot.ai/v1/users/me/balance');
  requireText(balance, 'The available balance (unit: USD)');
  const { sectionTables, paragraphs } = mintlifyTables(body);
  requireText(paragraphs.join('\n'), '1 MTok = 1,000,000 tokens.');
  const results = new Map();
  for (const [group, targets] of Map.groupBy(adapter.targets, (target) => target.group)) {
    try {
      const { charges, conditions, rows } = chargeTable(sectionTables, paragraphs, group);
      for (const { quoteId, modelId } of targets) {
        const [, ...amounts] = exactRow(
          rows,
          ([id]) => id === modelId,
          modelId,
          charges.length + 1,
        );
        results.set(quoteId, {
          identity: { providerId, endpoint, modelId, priceList, currency },
          recordId: 'usd-moonshot-' + modelId + '-standard',
          sourcePrice: Object.fromEntries(
            charges.map((key, index) => [
              key,
              usd(string(amounts[index]), /^\$(\d+(?:\.\d+)?) \/ MTok$/),
            ]),
          ),
          sourceUnit: 'per_million_tokens',
          required: charges,
          conditions,
        });
      }
    } catch (error) {
      for (const { quoteId } of targets) results.set(quoteId, { error: error.message });
    }
  }
  return results;
}
