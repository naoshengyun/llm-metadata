import {
  exactRow,
  markdown,
  requireText,
  section,
  table,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const labels = {
  'claude-fable-5-2': 'Claude Fable 5.2',
  'claude-fable-5-1': 'Claude Fable 5.1',
  'claude-fable-5': 'Claude Fable 5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-opus-5': 'Claude Opus 5',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-opus-4-5': 'Claude Opus 4.5',
  'claude-opus-4-5-20251101': 'Claude Opus 4.5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
};
const providerId = 'anthropic';
const endpoint = 'https://api.anthropic.com/v1/messages';
const priceList = 'Claude API / Standard / global';
const currency = 'USD';
const conditions = {
  cacheWriteTtlSeconds: { cache_write: 300, cache_write_1h: 3600 },
  cacheHitRenewsTtl: true,
};
const columns = [
  'Model',
  'Base input tokens',
  '5m cache writes',
  '1h cache writes',
  'Cache hits and refreshes',
  'Output tokens',
];
const charges = ['input', 'cache_write', 'cache_write_1h', 'cache_read', 'output'];

export const adapter = {
  id: 'anthropic-global',
  url: 'https://platform.claude.com/docs/en/about-claude/pricing.md',
  supplemental: [
    { id: 'opus-4-5', url: 'https://platform.claude.com/docs/en/models/opus-4-5/overview.md' },
    {
      id: 'ids',
      url: 'https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions.md',
    },
  ],
  targets: Object.keys(labels).map((modelId) => ({
    quoteId: 'us-anthropic-' + modelId + '-standard',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    ...(modelId !== 'claude-opus-4-5' && { baselineIdentity: { endpoint: null } }),
    baselineConditions: conditions,
    group: 'global-standard',
  })),
  parse,
};

function parse({ body, supplemental }) {
  const idDocs = markdown(supplemental.get('ids').body);
  requireText(idDocs, '`claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`');
  requireText(idDocs, 'that point to the most recent dated snapshot for that minor version.');
  const opus = markdown(supplemental.get('opus-4-5').body);
  requireText(opus, 'Model ID: `claude-opus-4-5-20251101`');
  if (!/^\| Claude API alias\s+\| `claude-opus-4-5`\s+\|$/m.test(opus))
    throw Error('Claude Opus 4.5 alias evidence is missing');
  const text = markdown(body);
  requireText(text, 'All prices are in USD.');
  requireText(text, 'Global routing (the default) uses standard pricing.');
  const standard = section(text, '## Model pricing');
  requireText(standard, '**MTok:** Million tokens.');
  requireText(standard, 'Writing a prompt prefix to the 5-minute prompt cache.');
  requireText(standard, 'Writing a prompt prefix to the 1-hour prompt cache.');
  requireText(standard, 'Reading a prompt prefix from the prompt cache, which also refreshes it.');
  const rows = table(standard, columns);

  function price(predicate, name) {
    const row = exactRow(rows, predicate, name, columns.length);
    return Object.fromEntries(
      charges.map((key, index) => [
        key,
        usd(row[index + 1], /^\$(\d+(?:\.\d+)?) \/ MTok(?:<sup>[1-3]<\/sup>)?$/),
      ]),
    );
  }

  const results = new Map();
  for (const { quoteId, modelId } of adapter.targets) {
    try {
      const label = labels[modelId];
      const required = [...charges];
      let sourcePrice;
      if (modelId === 'claude-haiku-5-5') {
        const long = section(text, '### Long context pricing');
        requireText(
          long,
          'A request’s prompt length counts all of its input tokens, including cache reads and cache writes.',
        );
        const context =
          /Claude Haiku 5\.5 is priced by prompt length: a request whose prompt is over ([\d,]+) tokens pays higher prices\./.exec(
            long,
          );
        if (!context) throw Error('Missing Claude Haiku 5.5 context threshold');
        const size = Number(context[1].replaceAll(',', ''));
        const low = price(
          ([name]) => name === label + ' (for prompts up to ' + context[1] + ' tokens)',
          label,
        );
        const high = price(
          ([name]) => name === label + ' (for prompts over ' + context[1] + ' tokens)',
          label,
        );
        sourcePrice = { ...low, tiers: [{ tier: { size, type: 'input' }, ...high }] };
        required.push(...charges.map((item) => 'tiers.0.' + item));
      } else {
        sourcePrice = price(([name]) => name === label, label);
      }
      results.set(quoteId, {
        identity: { providerId, endpoint, modelId, priceList, currency },
        recordId: 'us-anthropic-' + modelId + '-standard',
        sourcePrice,
        sourceUnit: 'per_million_tokens',
        required,
        conditions,
      });
    } catch (error) {
      results.set(quoteId, { error: error.message });
    }
  }
  return results;
}
