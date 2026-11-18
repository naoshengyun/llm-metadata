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
  'devstral-2512',
  'devstral-latest',
  'devstral-medium-latest',
  'glm-5-2',
  'labs-devstral-small-2512',
  'labs-leanstral-1-5-1',
  'magistral-medium-latest',
  'ministral-14b-2512',
  'ministral-3b-2512',
  'ministral-3b-latest',
  'ministral-8b-2512',
  'ministral-8b-latest',
  'mistral-embed',
  'mistral-large-2512',
  'mistral-large-4',
  'mistral-large-4-0-8',
  'mistral-large-latest',
  'mistral-medium-2505',
  'mistral-medium-2508',
  'mistral-medium-2604',
  'mistral-medium-latest',
  'mistral-small-2506',
  'mistral-small-2603',
  'mistral-small-latest',
  'open-mistral-nemo',
  'pixtral-12b',
  'voxtral-small-2507',
  'voxtral-small-latest',
  'zai-glm-5-2',
  'zai-glm-5-3',
  'zai-glm-5-3-flash',
];

export const adapter = {
  id: 'mistral-standard',
  url: 'https://docs.mistral.ai/inference/pricing',
  supplemental: [{ id: 'api-ids', url: 'https://docs.mistral.ai/inference/pricing.md' }],
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

function parse({ body, supplemental }) {
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
        const matches = idRows.filter((match) => match[2] === modelId);
        if (matches.length !== 1)
          throw Error('Exact Mistral API ID absent from current global price list: ' + modelId);
        const [, link, , markdownPrice] = matches[0];
        if (
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
          columns.map((key, index) => [key, usd(row[index + 1].text)]),
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
