import { tables } from '../official-source-helpers/html-table.mjs';
import { markdown, requireText, usd } from '../official-source-helpers/markdown-table.mjs';

const providerId = 'alibaba';
const endpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const priceList = 'Model Studio / Singapore International pay-as-you-go';
const currency = 'USD';
const models = [
  'qvq-max',
  'qwen-flash',
  'qwen-max',
  'qwen-mt-plus',
  'qwen-mt-turbo',
  'qwen-omni-turbo',
  'qwen-omni-turbo-realtime',
  'qwen-plus',
  'qwen-plus-character-ja',
  'qwen-turbo',
  'qwen-vl-max',
  'qwen-vl-ocr',
  'qwen-vl-plus',
  'qwen2-5-omni-7b',
  'qwen3-14b',
  'qwen3-235b-a22b',
  'qwen3-32b',
  'qwen3-8b',
  'qwen3-coder-30b-a3b-instruct',
  'qwen3-coder-480b-a35b-instruct',
  'qwen3-coder-flash',
  'qwen3-coder-plus',
  'qwen3-livetranslate-flash-realtime',
  'qwen3-max',
  'qwen3-next-80b-a3b-instruct',
  'qwen3-next-80b-a3b-thinking',
  'qwen3-omni-flash',
  'qwen3-omni-flash-realtime',
  'qwen3-vl-235b-a22b',
  'qwen3-vl-30b-a3b',
  'qwen3-vl-plus',
  'qwen3.5-122b-a10b',
  'qwen3.5-27b',
  'qwen3.5-35b-a3b',
  'qwen3.5-397b-a17b',
  'qwen3.5-flash',
  'qwen3.5-plus',
  'qwen3.6-27b',
  'qwen3.6-35b-a3b',
  'qwen3.6-flash',
  'qwen3.6-max-preview',
  'qwen3.6-plus',
  'qwen3.7-flash',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.8-flash',
  'qwen3.8-max',
  'qwen3.8-omni-flash',
  'qwq-plus',
];
const conditions = { region: 'Singapore', deployment: 'International' };

export const adapter = {
  id: 'alibaba-international',
  url: 'https://www.alibabacloud.com/help/en/model-studio/model-pricing',
  supplemental: [
    {
      id: 'singapore',
      url: 'https://www.alibabacloud.com/help/en/model-studio/singapore-regional-access-information',
    },
  ],
  targets: models.map((modelId) => ({
    quoteId: 'upstream:alibaba:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
    baselineConditions: conditions,
  })),
  parse,
};

function prices({ header, row }, modelId) {
  const [model, deployment] = row;
  if (model.text.includes('Context cache enjoys a discount'))
    throw Error(
      'Singapore model requires cache evidence for its exact Standard conditions: ' + modelId,
    );
  if (deployment?.text !== 'International')
    throw Error('Exact Singapore International deployment scope missing: ' + modelId);
  if (model.rowSpan !== 1 || deployment.rowSpan !== 1)
    throw Error(
      'Singapore model has multiple rows or modes requiring an exact tier mapping: ' + modelId,
    );
  const labels = header.map((cell) => cell.text);
  const amountIndex = labels.indexOf('Input unit price (per million tokens)');
  if (
    amountIndex < 2 ||
    !labels[amountIndex + 1]?.startsWith('Output unit price (per million tokens)')
  ) {
    throw Error('Singapore unit or modality differs from token tariff: ' + modelId);
  }
  if (
    labels[2] === 'Pattern' &&
    !/^Non-thinking and thinking modes$|^Thinking mode only$/.test(row[2]?.text)
  ) {
    throw Error('Singapore model uses nonuniform reasoning mode rates: ' + modelId);
  }
  if (
    labels[amountIndex - 1].startsWith('Input token') &&
    !/^0(?:&lt;|<)Token≤\d+[KM]$/.test(row[amountIndex - 1]?.text)
  ) {
    throw Error('Singapore spans a non-base token-price band: ' + modelId);
  }
  const freeQuota = labels.at(-1).startsWith('Free quota');
  const rates = row.slice(amountIndex, freeQuota ? -1 : undefined).map((cell) => usd(cell.text));
  if (rates.length < 2 || rates.length > 3 || (rates.length === 3 && rates[1] !== rates[2]))
    throw Error('Singapore thinking and non-thinking output rates are distinct: ' + modelId);
  return { input: rates[0], output: rates[1] };
}

function parse({ body, supplemental }) {
  const html = markdown(body);
  const region = markdown(supplemental.get('singapore').body);
  requireText(region, '<code>' + endpoint + '</code>');
  requireText(region, 'International (global nodes excluding Chinese mainland)');
  requireText(html, 'Unit price: USD/million tokens.');
  const blocks = [
    ...html.matchAll(
      /<section id="singapore(?:-\d+)?" class="section"><h4[^>]*>Singapore<\/h4>([\s\S]*?)<\/section>/g,
    ),
  ];
  if (!blocks.length) throw Error('Missing Singapore pricing sections');
  const regionalRows = blocks
    .flatMap(([, block]) => tables(block))
    .filter(
      ([header]) =>
        header[0]?.text === 'Model ID' && header[1]?.text === 'Service Deployment Scope',
    )
    .flatMap(([header, ...rows]) => rows.map((row) => ({ header, row })));
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const matches = regionalRows.filter(({ row }) => row[0]?.text.split(' ')[0] === modelId);
        if (matches.length !== 1)
          throw Error('Exact Singapore International tariff absent or ambiguous: ' + modelId);
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'usd-alibaba-' + modelId + '-singapore',
            sourcePrice: prices(matches[0], modelId),
            sourceUnit: 'per_million_tokens',
            required: ['input', 'output'],
            conditions,
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
