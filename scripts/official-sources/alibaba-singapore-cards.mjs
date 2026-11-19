import {
  decode,
  htmlText,
  number,
  only,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

const both = ['implicit', 'explicit'];
const profiles = {
  'qwen-flash': { modes: both, upper: 1_000_000 },
  'qwen-max': { modes: ['implicit'] },
  'qwen-plus': { modes: both, upper: 1_000_000 },
  'qwen3-coder-flash': { modes: both, upper: 1_000_000 },
  'qwen3-vl-plus': { modes: both, upper: 256_000 },
  'qwen3.5-flash': { modes: ['explicit'] },
  'qwen3.5-plus': { modes: ['explicit'], upper: 1_000_000 },
  'qwen3.6-flash': { modes: ['explicit'], upper: 1_000_000 },
  'qwen3.6-plus': { modes: ['explicit'], upper: 1_000_000 },
  'qwen3.7-flash': { modes: both, upper: 1_000_000 },
  'qwen3.7-max': { modes: both },
  'qwen3.7-plus': { modes: both, upper: 1_000_000 },
};
const docs = 'https://docs.modelstudio.console.alibabacloud.com/en/model-studio/';
const endpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const preface =
  'This page only shows the original pricing for model API calls, excluding any limited-time promotions. ' +
  'Visit [Model Studio Console](https://modelstudio.console.alibabacloud.com/ap-southeast-1/model/market) for promotional offers.';
const headers = ['Billing Item', 'Price (USD)', 'Unit'];
const baseLabels = ['Input', 'Output'];
const cacheLabels = {
  implicit: ['Input(Implicit Cache)'],
  explicit: ['Explicit Cache Creation', 'Explicit Cache Read'],
};
const thinkingLabels = {
  Input: 'Input(Thinking)',
  Output: 'Output(Thinking)',
  'Input(Implicit Cache)': 'Input(Thinking Implicit Cache)',
  'Explicit Cache Creation': 'Explicit Cache Creation(Thinking)',
  'Explicit Cache Read': 'Explicit Cache Read(Thinking)',
};
const batchLabels = [
  'Input(Batch File)',
  'Output(Batch File)',
  'Input(Thinking Batch File)',
  'Thinking Output(Batch File)',
];
const bandsPattern = /<Accordion title="([^"]+)"(?: defaultOpen)?>([^]*?)<\/Accordion>/g;
const tabPattern = /<Tab title="([^"]+)">([^]*?)<\/Tab>/g;

function singaporeTab(source) {
  const tabs = [...source.matchAll(tabPattern)];
  return only(
    tabs.filter(([, title]) => title === 'Singapore'),
    'Qwen Singapore tab',
  )[2];
}

function pricingRegion(document, modelId) {
  const text = document.replace(/\r\n/g, '\n');
  if (text.split('\n').find((line) => line.startsWith('# ')) !== '# ' + modelId)
    throw Error('Expected exact Qwen model card: ' + modelId);
  const pricing = only(
    text.split(/^## /m).filter((section) => /^Pricing(?: <span id="[\w-]+" \/>)?\n/.test(section)),
    'Qwen price section',
  );
  const wrapper = /^[^\n]*\n([^]*?)<Tabs>([^]*?)<\/Tabs>\s*$/.exec(pricing);
  if (!wrapper || wrapper[1].trim() !== preface || wrapper[2].replace(tabPattern, '').trim())
    throw Error('Unexpected Qwen price preface or effective conditions');
  const region = /^Scope: International\s+([^]+)$/.exec(singaporeTab(wrapper[2]).trim());
  if (!region) throw Error('Expected Qwen Singapore International prices');
  return region[1].trim();
}

function rateRows(body, labels) {
  if (!/^<table\b[^>]*>[^]*?<\/table>$/.test(body.trim()))
    throw Error('Unexpected text or conditions around Qwen price table');
  const table = only(tables(body), 'Qwen Singapore price table');
  const [, ...rows] = only(withHeader([table], headers), 'Qwen USD per-token table');
  const online = rows.filter(([name]) => !batchLabels.includes(name?.text));
  if (online.some(([name]) => !labels.includes(name?.text)))
    throw Error('Unexpected Qwen online charge');
  return new Map(
    labels.map((label) => {
      const row = only(
        online.filter(([name]) => name?.text === label),
        'Qwen online charge ' + label,
      );
      if (row.length !== 3 || row[2].text !== 'Per 1M tokens')
        throw Error('Unexpected Qwen billing unit for ' + label);
      return [label, number(row[1].text)];
    }),
  );
}

function priceBands(region, labels, expectedUpper) {
  if (expectedUpper === undefined) return [{ rates: rateRows(region, labels) }];
  const bands = [...region.matchAll(bandsPattern)];
  if (bands.length < 2 || region.replace(bandsPattern, '').trim())
    throw Error('Missing or unsupported Qwen tier structure');
  const boundary = (amount = '0', scale = 'k') =>
    Number(amount) * (scale === 'k' ? 1000 : 1_000_000);
  let preceding = 0;
  const parsed = bands.map(([, range, body]) => {
    const match = /^(?:(\d+)([km])<)?Input<=(\d+)([km])$/.exec(range);
    if (!match) throw Error('Unexpected Qwen input range: ' + range);
    const lower = boundary(match[1], match[2]);
    const upper = boundary(match[3], match[4]);
    if (lower !== preceding || upper <= lower) throw Error('Discontinuous Qwen input ranges');
    preceding = upper;
    return { lower, upper, rates: rateRows(body, labels) };
  });
  if (preceding !== expectedUpper) throw Error('Incomplete Qwen input range coverage');
  return parsed;
}

function cacheConditions(document, modelId, modes) {
  const [, ...rows] = only(
    withHeader(tables(document), ['Item', 'Explicit cache', 'Implicit cache']),
    'Qwen cache comparison table',
  );
  const knownTerms = [
    'Impact on response quality',
    'Billing for cache creation tokens',
    'Billing for cached input tokens',
    'Minimum tokens for caching',
    'Cache validity period',
  ];
  if (
    rows.length !== knownTerms.length ||
    rows.some((row) => row.length !== 3) ||
    new Set(rows.map(([name]) => name.text)).size !== knownTerms.length ||
    rows.some(([name]) => !knownTerms.includes(name.text))
  )
    throw Error('Unexpected Qwen cache policy table');
  const condition = (label) =>
    only(
      rows.filter(([name]) => name?.text === label),
      'Qwen cache condition ' + label,
    ).map(({ text }) => text);
  const [, explicitMinimum, implicitMinimum] = condition('Minimum tokens for caching');
  const [, explicitLife, implicitLife] = condition('Cache validity period');
  const [, , implicitCreation] = condition('Billing for cache creation tokens');
  const minutes = /^(\d+) minutes \(resets on hit\)$/.exec(explicitLife);
  if (
    !/^\d+$/.test(explicitMinimum) ||
    explicitMinimum !== implicitMinimum ||
    !minutes ||
    implicitLife !== 'Indeterminate. The system periodically clears old, unused cache data.' ||
    implicitCreation !== '100% of the standard input token price' ||
    !document.includes('Explicit cache and implicit cache are mutually exclusive.')
  )
    throw Error('Unexpected Qwen cache charges or validity conditions');
  const chapters = document.split(/^## /m);
  for (const mode of ['implicit', 'explicit']) {
    const heading = mode[0].toUpperCase() + mode.slice(1) + ' cache ';
    const region = singaporeTab(
      only(
        chapters.filter((part) => part.startsWith(heading)),
        heading,
      ),
    );
    const ids = new Set(htmlText(region).match(/[a-z0-9]+(?:[./-][a-z0-9]+)*/gi));
    if (ids.has(modelId) !== modes.includes(mode))
      throw Error('Qwen Singapore cache mode changed for ' + modelId);
  }
  return { minimum: number(explicitMinimum), ttl: number(minutes[1]) * 60 };
}

function quote(target, bands, mode, terms, thinking) {
  const explicit = mode === 'explicit';
  const charges = bands.map(({ rates }) => ({
    input: rates.get('Input'),
    output: rates.get('Output'),
    cache_read: rates.get(explicit ? 'Explicit Cache Read' : 'Input(Implicit Cache)'),
    ...(explicit && { cache_write: rates.get('Explicit Cache Creation') }),
    ...(thinking && { reasoning: rates.get('Output(Thinking)') }),
  }));
  const thinkingToggle = { param: 'enable_thinking', value: true };
  const result = tariff(
    target,
    {
      ...charges[0],
      ...(bands.length > 1 && {
        tiers: bands.slice(1).map(({ lower }, i) => ({ tier: { size: lower }, ...charges[i + 1] })),
      }),
    },
    {
      region: 'Singapore',
      deployment: 'International',
      ...(bands.length > 1 && {
        inputBands: bands.map(({ lower, upper }) => ({ lower, upper })),
      }),
      reasoningBilledAsOutput: true,
      ...(thinking && { thinkingToggle: { ...thinkingToggle, default: false } }),
      cacheMode: mode,
      cacheMinimumInputTokens: terms.minimum,
      ...(explicit
        ? { cacheWriteTtlSeconds: terms.ttl, cacheHitRenewsTtl: true }
        : { cacheTtl: 'no fixed TTL', cacheWriteIncludedInInput: true }),
    },
  );
  result.required = Object.keys(charges[0]).concat(
    charges
      .slice(1)
      .flatMap((rates, i) => Object.keys(rates).map((key) => 'tiers.' + i + '.' + key)),
  );
  if (thinking) result.thinkingToggle = thinkingToggle;
  return result;
}

export const adapter = Object.entries(profiles).map(([modelId, { modes, upper }]) => {
  const slug = modelId.replaceAll('.', '-');
  const thinking = modelId === 'qwen-plus';
  const targets = modes.map((mode) => {
    const priceList = 'sg-international-online-original-' + mode;
    return {
      quoteId: 'dashscope--' + modelId + '--' + priceList,
      providerId: 'alibaba',
      modelId,
      endpoint,
      priceList,
      currency: 'USD',
      group: modelId,
    };
  });
  return {
    id: 'bailian-sg-' + slug,
    url: docs + slug + '.md',
    supplemental: [
      { id: 'cache', url: docs + 'context-cache.md' },
      ...(thinking ? [{ id: 'thinking', url: docs + 'deep-thinking.md' }] : []),
    ],
    targets,
    parse({ body, supplemental }) {
      const standardLabels = [...baseLabels, ...modes.flatMap((mode) => cacheLabels[mode])];
      const labels = thinking
        ? standardLabels.concat(standardLabels.map((label) => thinkingLabels[label]))
        : standardLabels;
      const bands = priceBands(pricingRegion(decode(body), modelId), labels, upper);
      const terms = cacheConditions(decode(supplemental.get('cache').body), modelId, modes);
      if (thinking) {
        const guide = decode(supplemental.get('thinking').body);
        if (
          !guide.includes(
            'Qwen Plus Series</strong> (Hybrid thinking mode, thinking mode not enabled by default): qwen-plus,',
          ) ||
          !guide.includes('Set to`true`: the model thinks before responding') ||
          !guide.includes('Set to`false`: the model responds directly') ||
          bands.some(({ rates }) =>
            standardLabels.some(
              (label) =>
                label !== 'Output' && rates.get(label) !== rates.get(thinkingLabels[label]),
            ),
          )
        )
          throw Error('Unsupported Qwen Plus thinking conditions or rates');
      }
      return new Map(
        targets.map((target, i) => [
          target.quoteId,
          quote(target, bands, modes[i], terms, thinking),
        ]),
      );
    },
  };
});
