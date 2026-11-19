import { tables } from '../official-source-helpers/html-table.mjs';
import {
  exactRow,
  markdown,
  requireText,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const providerId = 'mistral';
const endpoint = 'https://api.mistral.ai/v1';
const priceList = 'Mistral API / global standard';
const currency = 'USD';
const columns = ['input', 'cache_read', 'output'];
const models = [
  'codestral-2508',
  'codestral-latest',
  'deepseek-v4-1-flash-1017',
  'labs-leanstral-1-5-1',
  'ministral-14b-2512',
  'ministral-3b-2512',
  'ministral-3b-latest',
  'ministral-8b-2512',
  'ministral-8b-latest',
  'mistral-embed',
  'mistral-large-4',
  'mistral-large-4-0-8',
  'mistral-large-latest',
  'mistral-medium-2604',
  'mistral-small-2603',
  'mistral-small-latest',
  'pixtral-12b',
  'zai-glm-5-3',
  'zai-glm-5-3-flash',
];

const modelCards = {
  'alias-codestral': ['codestral-25-08', 'codestral-2508', ['codestral-latest']],
  'alias-ministral3': ['ministral-3-3b-25-12', 'ministral-3b-2512', ['ministral-3b-latest']],
  'alias-ministral8': ['ministral-3-8b-25-12', 'ministral-8b-2512', ['ministral-8b-latest']],
  'alias-large': [
    'mistral-large-4-0',
    'mistral-large-4',
    ['mistral-large-latest', 'mistral-large-4-0-8'],
  ],
  'alias-small': ['mistral-small-4-0-26-03', 'mistral-small-2603', ['mistral-small-latest']],
  'alias-embed': ['mistral-embed-23-12', 'mistral-embed-2312', ['mistral-embed']],
  'archive-medium': ['mistral-medium-3-5-26-04', 'mistral-medium-3-5', ['mistral-medium-2604']],
};
const aliases = new Map(
  Object.entries(modelCards).flatMap(([id, [, primary, names]]) =>
    names.map((name) => [name, { id, primary }]),
  ),
);

export const adapter = {
  id: 'mistral-standard',
  url: 'https://docs.mistral.ai/inference/pricing',
  supplemental: [
    { id: 'api-ids', url: 'https://docs.mistral.ai/inference/pricing.md' },
    ...Object.entries(modelCards).map(([id, [slug]]) => ({
      id,
      url: 'https://docs.mistral.ai/models/' + slug + '.md',
    })),
  ],
  targets: models.map((modelId) => ({
    quoteId: 'upstream:mistral:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { endpoint: null, priceList: 'fixed upstream primary or original CNY sheet' },
  })),
  parse,
};

function parse({ body, supplemental, evidence }) {
  const html = markdown(body);
  requireText(html, 'aria-pressed="true">USD</button>');
  requireText(html, 'aria-pressed="true">Standard</button>');
  requireText(html, 'aria-pressed="false">EUR</button>');
  const ids = markdown(supplemental.get('api-ids').body);
  const idRows = [
    ...ids.matchAll(/^\| \[[^\]]+\]\((\/models\/[\w-]+)\) \| `([\w.-]+)` \| ([^|]+) \|$/gm),
  ];
  const rows = tables(html)
    .filter(
      ([header]) => header.map((cell) => cell.text).join('|') === 'Model|Input|Cached input|Output',
    )
    .flatMap((table) => table.slice(1));
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const routing = aliases.get(modelId);
        const embedding = modelId === 'mistral-embed';
        if (routing) {
          const card = markdown(supplemental.get(routing.id).body);
          const names = /^- API names: (.+)$/m.exec(card)?.[1] ?? '';
          requireText(names, '`' + modelId + '`');
          requireText(names, '`' + routing.primary + '`');
          const retirement = /^- Retirement date: (\d{4}-\d{2}-\d{2})$/m.exec(card)?.[1];
          if (retirement && retirement <= evidence.obtainedAt.slice(0, 10))
            throw Error('Mistral model card lists a past retirement date: ' + retirement);
          if (embedding) requireText(card, '- Output: embeddings');
        }
        const matches = idRows.filter((match) => match[2] === (routing?.primary ?? modelId));
        if (matches.length !== 1)
          throw Error('Exact Mistral API ID absent from current global price list: ' + modelId);
        const [, link, , markdownPrice] = matches[0];
        if (
          !embedding &&
          !/^Input \$\d+(?:\.\d+)? \/M Tokens(?:<br>Cached input \$\d+(?:\.\d+)? \/M Tokens)?<br>Output \$\d+(?:\.\d+)? \/M Tokens$/.test(
            markdownPrice,
          )
        ) {
          throw Error('Mistral quote has non-token, input-only, or mixed units: ' + modelId);
        }
        const row = exactRow(
          rows,
          ([first]) => first?.html.includes('href="' + link + '"'),
          modelId,
          4,
        );
        const sourcePrice = Object.fromEntries(
          columns.map((key, index) => [
            key,
            embedding && key === 'output' && row[index + 1].text === '—'
              ? 0
              : usd(row[index + 1].text),
          ]),
        );
        const shownRates = [
          ...markdownPrice.matchAll(/(Input|Cached input|Output) \$(\d+(?:\.\d+)?) /g),
        ];
        for (const [, label, amount] of shownRates) {
          const key = label === 'Cached input' ? 'cache_read' : label.toLowerCase();
          if (sourcePrice[key] !== Number(amount))
            throw Error('Mistral HTML and Markdown rates disagree: ' + modelId);
        }
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'us-mistral-' + modelId + '-global-standard',
            sourcePrice,
            sourceUnit: 'per_million_tokens',
            required: columns,
            conditions: {},
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
