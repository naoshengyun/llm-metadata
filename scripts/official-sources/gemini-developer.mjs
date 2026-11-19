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
  'gemini-3.5-flash-lite',
  'gemini-3.5-live-translate-preview',
  'gemini-3.6-flash',
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
const splitAudioCache = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
]);
const mediaReferences = {
  'gemini-2.5-flash-image':
    'Native Gemini model sync cannot represent per-image rules and token rates together',
  'gemini-3.1-flash-live-preview':
    'Native Gemini model sync has no distinct Live video input meter',
  'gemini-embedding-2': 'Native Gemini model sync has no distinct embedding video input meter',
};
const music = {
  'lyria-3-clip-preview': { label: 'Lyria 3 Clip Preview (30s)', durationSeconds: 30 },
  'lyria-3-pro-preview': { label: 'Lyria 3 Pro Preview (Full Song)' },
};
const markdocTable = /\{% table %\}([\s\S]*?)\{% \/table %\}/g;
const escaped = (id) => id.replaceAll('.', '\\.');

export const adapter = {
  id: 'gemini-developer',
  url: 'https://aistudio.google.com/docs/pricing.md',
  targets: models.map(geminiDeveloperTarget),
  parse,
};

export function geminiDeveloperTarget(modelId) {
  return {
    quoteId: 'upstream:google:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { endpoint: null, priceList: 'fixed upstream primary or original CNY sheet' },
    ...(Object.hasOwn(mediaReferences, modelId) && {
      referenceOnlyReason: mediaReferences[modelId],
    }),
    ...((Object.hasOwn(music, modelId) || splitAudioCache.has(modelId)) && {
      referenceOnlyReason: Object.hasOwn(music, modelId)
        ? 'Native Gemini model sync has no generated-song usage'
        : 'Native Gemini model sync has no dedicated audio cache read or hourly cache storage charge',
    }),
  };
}

export function markdocRows(body) {
  return body
    .trim()
    .split(/^\s*---\s*$/m)
    .map((row) =>
      row
        .trim()
        .split(/^\s*\* /m)
        .filter(Boolean)
        .map((column) => column.trim()),
    );
}

function paidRows(modelSection, unit) {
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
  const [header, ...rows] = markdocRows(tables[0][1]);
  if (header.join('|') !== 'Feature|Free Tier|Paid Tier, per ' + unit + ' in USD') {
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
  if (splitAudioCache.has(modelId) && !caching)
    throw Error('Missing advertised Gemini audio cache tariff: ' + modelId);
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
    if (splitAudioCache.has(modelId)) {
      const rates = /^(\$[\d.]+) \(text \/ image \/ video\)\n(\$[\d.]+) \(audio\)$/.exec(
        usage.join('\n'),
      );
      if (!rates || implicit || storage.length !== 1 || !Object.hasOwn(sourcePrice, 'input_audio'))
        throw Error('Missing Gemini modality or hourly cache storage tariff: ' + modelId);
      read(rates[1], 'cache_read');
      conditions.audioCacheRead = { amount: usd(rates[2]), currency, unit: 'per_million_tokens' };
    } else {
      read(usage.join('\n'), 'cache_read');
    }
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

function modalityRates(rows, label, expected) {
  const cell = rowCost(rows, label);
  const lines = cell?.split('\n').map((line) => line.trim()) ?? [];
  if (lines.length !== expected.length) throw Error('Incomplete Gemini modality tariff: ' + label);
  return expected.map((pattern, index) => usd(lines[index], pattern));
}

function mediaTariff(modelId, sectionText) {
  const rows = paidRows(sectionText, '1M tokens');
  const inputRow = /^Input price$/;
  const outputRow = /^Output price(?: \(including thinking tokens\))?$/;
  let sourcePrice;
  let conditions;
  if (modelId === 'gemini-2.5-flash-image') {
    requireText(sectionText, 'Text input and output is priced the same as');
    const [input] = modalityRates(rows, inputRow, [/^\$(\d+(?:\.\d+)?) \(text \/ image\)$/]);
    const [perImage] = modalityRates(rows, outputRow, [
      /^\$(\d+(?:\.\d+)?) per image\{% sup %\}\*\{% \/sup %\}$/,
    ]);
    const image =
      /Image output is priced at \$(\d+(?:\.\d+)?) per 1,000,000 tokens\. Output\s+images up to (\d+)x(\d+)px consume (\d+) tokens/.exec(
        sectionText,
      );
    if (!image) throw Error('Missing Gemini image output token equivalence');
    sourcePrice = { input, input_image: input, output_image: Number(image[1]) };
    conditions = {
      imageEquivalent: {
        amount: perImage,
        currency,
        unit: 'per_image',
        maximumWidth: Number(image[2]),
        maximumHeight: Number(image[3]),
        outputTokens: Number(image[4]),
      },
      textOutputTariffReference: 'gemini-2.5-flash',
    };
  } else if (modelId === 'gemini-3.1-flash-live-preview') {
    const [input, inputAudio, inputMedia] = modalityRates(rows, inputRow, [
      /^\$(\d+(?:\.\d+)?) \(text\)$/,
      /^\$(\d+(?:\.\d+)?) or \$[\d.]+\/min \(audio\)$/,
      /^\$(\d+(?:\.\d+)?) or \$[\d.]+\/min \(image\/video\)$/,
    ]);
    const [output, outputAudio] = modalityRates(rows, outputRow, [
      /^\$(\d+(?:\.\d+)?) \(text\)$/,
      /^\$(\d+(?:\.\d+)?) or \$[\d.]+\/min \(audio\)$/,
    ]);
    sourcePrice = {
      input,
      input_audio: inputAudio,
      input_image: inputMedia,
      output,
      output_audio: outputAudio,
    };
    conditions = { videoInput: { amount: inputMedia, currency, unit: 'per_million_tokens' } };
  } else {
    sourcePrice = {
      input: usd(rowCost(rows, /^Text input price$/)),
      input_image: usd(
        rowCost(rows, /^Image input price$/),
        /^\$(\d+(?:\.\d+)?) \(\$[\d.]+ per image\)$/,
      ),
      input_audio: usd(
        rowCost(rows, /^Audio input price$/),
        /^\$(\d+(?:\.\d+)?) \(\$[\d.]+ per second\)$/,
      ),
    };
    const amount = usd(
      rowCost(rows, /^Video input price$/),
      /^\$(\d+(?:\.\d+)?) \(\$[\d.]+ per frame\)$/,
    );
    conditions = {
      output: 'embeddings',
      videoInput: { amount, currency, unit: 'per_million_tokens' },
    };
  }
  return { sourcePrice, conditions, required: Object.keys(sourcePrice) };
}

function modelPriceSections(sections, modelId) {
  const key = 'id="' + modelId + '"';
  const explicitLink = new RegExp('\\[`' + escaped(modelId) + '`\\]\\(/docs/models/');
  return sections.filter(
    (block) =>
      block.split('\n', 1)[0].includes(key) || explicitLink.test(block.split('{% hr /%}', 1)[0]),
  );
}

export function standardTariffs(text, checkedAt) {
  requireText(text, '# Gemini Developer API pricing');
  const sections = text.split(/^## /m).slice(1);
  return (modelId, priceModelId = modelId) => {
    const routed = priceModelId !== modelId;
    if (routed && modelPriceSections(sections, modelId).length)
      throw Error('Independent Gemini tariff conflicts with automatic routing: ' + modelId);
    const matches = modelPriceSections(sections, priceModelId);
    if (matches.length !== 1)
      throw Error(
        'Exact model ID absent from Gemini Developer API price sections: ' + priceModelId,
      );
    const song = Object.hasOwn(music, priceModelId) ? music[priceModelId] : undefined;
    let tariff;
    if (song) {
      const rows = paidRows(matches[0], 'request');
      const rate = rows.filter(([label]) => label === song.label);
      if (rate.length !== 1 || rate[0].length !== 3 || rate[0][1] !== 'Not available')
        throw Error('Missing exact Lyria paid song tariff: ' + priceModelId);
      tariff = {
        sourcePrice: { output: usd(rate[0][2], /^\$(\d+(?:\.\d+)?) per song$/) },
        required: ['output'],
        conditions: song.durationSeconds
          ? { durationSeconds: song.durationSeconds }
          : { fullSong: true },
      };
    } else if (Object.hasOwn(mediaReferences, priceModelId)) {
      tariff = mediaTariff(priceModelId, matches[0]);
    } else {
      tariff = plainPrices(paidRows(matches[0], '1M tokens'), priceModelId, checkedAt);
    }
    if (routed) tariff.conditions.routedModelId = priceModelId;
    return {
      identity: { providerId, endpoint, modelId, priceList, currency },
      recordId: 'us-google-' + modelId + '-developer-standard',
      sourceUnit: song ? 'per_song' : 'per_million_tokens',
      ...tariff,
    };
  };
}

function parse({ body, evidence }) {
  const read = standardTariffs(markdown(body), evidence.obtainedAt.slice(0, 10));
  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        return [quoteId, read(modelId)];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
