import { markdown, requireText, usd } from '../official-source-helpers/markdown-table.mjs';

const providerId = 'google';
const endpoint = 'https://generativelanguage.googleapis.com';
const priceList = 'Gemini Developer API / Standard paid';
const currency = 'USD';
const models = [
  'deep-research-max-preview-04-2026',
  'deep-research-preview-04-2026',
  'gemini-2.5-computer-use-preview-10-2025',
  'gemini-2.5-flash',
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview-tts',
  'gemini-3-flash-preview',
  'gemini-3-pro-image',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-live-preview',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-live-translate-preview',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemini-4-hydrogen',
  'gemini-embedding-001',
  'gemini-embedding-2',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  'lyria-3-clip-preview',
  'lyria-3-pro-preview',
];
const uniformAudio = new Set([
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemini-4-hydrogen',
]);
const markdocTable = /\{% table %\}([\s\S]*?)\{% \/table %\}/g;
const escaped = (id) => id.replaceAll('.', '\\.');

export const adapter = {
  id: 'gemini-developer',
  url: 'https://aistudio.google.com/docs/pricing.md',
  targets: models.map((modelId) => ({
    quoteId: 'upstream:google:' + modelId + ':USD',
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

function paidRows(modelSection) {
  const standard = [
    ...modelSection.matchAll(/\{% tab title="Standard" %\}([\s\S]*?)\{% \/tab %\}/g),
  ];
  const tables = [
    ...(standard.length === 1 ? standard[0][1] : modelSection).matchAll(markdocTable),
  ];
  if (
    (!standard.length && /\{% tab title=/.test(modelSection)) ||
    tables.length !== 1 ||
    standard.length > 1
  )
    throw Error('Missing or ambiguous Gemini Standard tariff');
  const [header, ...rows] = tables[0][1]
    .trim()
    .split(/^\s*---\s*$/m)
    .map((row) =>
      row
        .trim()
        .split(/^\s*\* /m)
        .filter(Boolean)
        .map((column) => column.trim()),
    );
  if (header.join('|') !== 'Feature|Free Tier|Paid Tier, per 1M tokens in USD') {
    throw Error('Gemini paid tariff uses a different unit or service tier: ' + header.join(', '));
  }
  return rows;
}

function rowCost(rows, label) {
  const result = rows.filter(([name]) => label.test(name));
  if (result.length === 0) return undefined;
  if (result.length !== 1 || result[0].length !== 3)
    throw Error('Missing or ambiguous Gemini price cell for ' + label);
  const paid = result[0][2];
  if (/^(?:Not available|N\/A)\.?$/.test(paid))
    throw Error('Gemini charge has no paid tariff: ' + label);
  return paid;
}

function listedRate(text, key, result, modelId, checkedAt) {
  const amount = '(\\$\\d+(?:\\.\\d+)?)';
  const dated = new RegExp(
    '^' +
      amount +
      ' through ([A-Za-z]+ \\d{1,2}, \\d{4})\\.\\s+' +
      amount +
      ' starting ([A-Za-z]+ \\d{1,2}, \\d{4})\\.$',
  ).exec(text);
  if (dated) {
    const [, current, through, future, starts] = dated;
    const lastDay = Date.parse(through + ' 00:00:00 UTC');
    const startDay = Date.parse(starts + ' 00:00:00 UTC');
    if (
      !Number.isFinite(lastDay) ||
      startDay - lastDay !== 86400000 ||
      checkedAt >= new Date(startDay).toISOString().slice(0, 10)
    ) {
      throw Error('Gemini date-bound rate needs current price and effective timezone: ' + modelId);
    }
    result.conditions.announcedPrices ??= {};
    result.conditions.announcedPrices[key] = { amount: usd(future), currency, through, starts };
    result.sourcePrice[key] = usd(current);
    return;
  }
  const tier = new RegExp(
    '^' +
      amount +
      ', prompts <= (\\d+)k(?: tokens)?\\s+' +
      amount +
      ', prompts > \\2k(?: tokens)?$',
  ).exec(text);
  if (tier) {
    const size = Number(tier[2]) * 1000;
    if (result.tierSize !== undefined && result.tierSize !== size)
      throw Error('Inconsistent Gemini context thresholds: ' + modelId);
    result.tierSize = size;
    result.high[key] = usd(tier[3]);
    result.sourcePrice[key] = usd(tier[1]);
    return;
  }
  result.sourcePrice[key] = usd(text);
}

function stripEquivalents(text) {
  return text
    ?.split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => !/^(?:[Ee]quivalent to |and \$|\$\d+(?:\.\d+)? per [1248]K image)/.test(line))
    .join('\n');
}

function plainPrices(rows, modelId, checkedAt) {
  const result = { sourcePrice: {}, high: {}, conditions: {} };
  const { sourcePrice, conditions } = result;
  if (modelId === 'gemini-3.5-live-translate-preview') {
    function audioRate(label) {
      const cell = rowCost(rows, label);
      const tokens =
        /^(\$\d+(?:\.\d+)?) or \$\d+(?:\.\d+)?\/min\{% sup %\}\*\{% \/sup %\} \(audio\)$/.exec(
          cell ?? '',
        );
      if (!tokens) throw Error('Missing Gemini live translation audio-token or time equivalence');
      return usd(tokens[1]);
    }
    const input = audioRate(/^Input price$/);
    const output = audioRate(/^Output price \(including thinking tokens\)$/);
    const sourcePrice = { input, input_audio: input, output, output_audio: output };
    return {
      sourcePrice,
      required: Object.keys(sourcePrice),
      conditions: { modalities: 'audio-only' },
    };
  }
  if (modelId === 'gemini-3.1-flash-live-preview') {
    throw Error(
      'Gemini Live Standard has distinct audio and video input rates; native video input meter unavailable',
    );
  }
  if (modelId === 'gemini-2.5-flash-image') {
    throw Error(
      'Gemini Standard publishes token input and per-image output; native model quote cannot combine both units',
    );
  }
  const read = (text, key) => listedRate(text, key, result, modelId, checkedAt);
  const input = stripEquivalents(rowCost(rows, /^Input price(?: \(text, image, video\))?$/));
  if (!input)
    throw Error('Gemini price has separate non-text input units or no exact input row: ' + modelId);
  const pair = /^(\$\d+(?:\.\d+)?) \(text \/ image \/ video\)\s+(\$\d+(?:\.\d+)?) \(audio\)$/.exec(
    input,
  );
  if (pair) {
    read(pair[1], 'input');
    read(pair[2], 'input_audio');
  } else {
    read(
      input.replace(/ \((?:text(?: ?\/ ?image(?: ?\/ ?video(?: ?\/ ?audio)?)?)?|audio)\)$/, ''),
      'input',
    );
    if (uniformAudio.has(modelId)) sourcePrice.input_audio = sourcePrice.input;
  }
  const output = stripEquivalents(
    rowCost(rows, /^Output price(?: \(including thinking tokens\))?$/),
  );
  if (output === undefined) {
    if (modelId !== 'gemini-embedding-001') throw Error('Missing Gemini output charge: ' + modelId);
    sourcePrice.output = 0;
  } else {
    const image = /^(\$\d+(?:\.\d+)?) \(text and thinking\)\s+(\$\d+(?:\.\d+)?) \(images\)$/.exec(
      output,
    );
    if (image) {
      read(image[1], 'output');
      read(image[2], 'output_image');
    } else {
      read(output.replace(/ \((?:text|audio)\)$/, ''), 'output');
    }
  }
  const caching = rowCost(rows, /^Context caching price$/);
  if (caching) {
    const lines = caching
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const storage = lines.filter((line) => line.includes('(storage price)'));
    const implicit = lines.includes('Implicit caching only (explicit caching is not supported).');
    const usage = lines.filter(
      (line) =>
        !storage.includes(line) &&
        line !== 'Implicit caching only (explicit caching is not supported).',
    );
    if (usage.some((line) => line.endsWith('(audio)')))
      throw Error(
        'Gemini publishes a separate audio cache rate with no native fee field: ' + modelId,
      );
    if (implicit) conditions.cacheMode = 'implicit-only';
    if (storage.length) {
      const recurring = storage
        .map((line) => line.replace(' / 1,000,000 tokens per hour (storage price)', ''))
        .join('\n');
      const reference = { sourcePrice: {}, conditions: {} };
      listedRate(recurring, 'storage', reference, modelId, checkedAt);
      conditions.explicitCacheStorage = {
        amount: reference.sourcePrice.storage,
        currency,
        unit: 'per_million_tokens_per_hour',
        ...(reference.conditions.announcedPrices && {
          announcedPrice: reference.conditions.announcedPrices.storage,
        }),
      };
    }
    read(usage.join('\n'), 'cache_read');
  }
  const required = Object.keys(sourcePrice);
  if (result.tierSize !== undefined) {
    if (!['input', 'output', 'cache_read'].every((key) => Object.hasOwn(result.high, key)))
      throw Error('Incomplete Gemini context tariff: ' + modelId);
    sourcePrice.context_over_200k = result.high;
    sourcePrice.tiers = [{ tier: { size: result.tierSize, type: 'context' }, ...result.high }];
    required.push(
      ...Object.keys(result.high).flatMap((key) => ['tiers.0.' + key, 'context_over_200k.' + key]),
    );
  }
  return { sourcePrice, required, conditions };
}

function parse({ body, evidence }) {
  const text = markdown(body);
  requireText(text, '# Gemini Developer API pricing');
  const sections = text.split(/^## /m).slice(1);
  const checkedAt = evidence.obtainedAt.slice(0, 10);
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const id = escaped(modelId);
        const key = 'id="' + modelId + '"';
        const explicitLink = new RegExp('\\[`' + id + '`\\]\\(/docs/models/');
        const matches = sections.filter(
          (block) =>
            block.split('\n', 1)[0].includes(key) ||
            explicitLink.test(block.split('{% hr /%}', 1)[0]),
        );
        if (matches.length !== 1)
          throw Error('Exact model ID absent from Gemini Developer API price sections: ' + modelId);
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            recordId: 'us-google-' + modelId + '-developer-standard',
            sourceUnit: 'per_million_tokens',
            ...plainPrices(paidRows(matches[0]), modelId, checkedAt),
          },
        ];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
