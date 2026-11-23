import {
  CNY_POLICY,
  canonical,
  convertPrice,
  generateCny,
  hash,
  PRICE_KEYS,
} from '../.cache/cny-build/cny/generate.js';
import { adaptPrice, domesticProviders } from './upstream-cny.mjs';
import {
  expectedDisplayRows,
  expectedPricingSummary,
  expectedPricingCategories,
  hasExpectedReferenceRates,
} from './pricing-view-check.mjs';

const identity = (providerId, modelId) => JSON.stringify([providerId, modelId]);
const officialSourceId = (record) => 'official-record:' + record.id;
const referenceSourceId = (record) => 'reviewed-reference:' + (record.id ?? hash(record));
export const SEEDANCE_REFERENCE_QUOTE_ID =
  'volcengine:doubao-seedance-2-5-260628:official-reference';
const referenceQuoteId = (record) =>
  isSeedanceTable(record) ? SEEDANCE_REFERENCE_QUOTE_ID : referenceSourceId(record);
const METER_UNITS = {
  per_image: 'per_image',
  per_10k_chars: 'per_10k_chars',
  per_second_480p: 'per_second',
  per_second_768p: 'per_second',
  per_second_2k: 'per_second',
  cache_storage: 'per_million_token_hours',
  storage: 'per_million_token_hours',
};
const COST_CHARGE_KEYS = new Set([...PRICE_KEYS, ...Object.keys(METER_UNITS), 'cache_read_audio']);
// Exact reviewed vendor sources. Aliyun's general price page alone does not identify
// the same regional endpoint and direct/router price list as the current model record.
const REFERENCE_PROVIDERS = new Map([
  ['https://docs.volcengine.com/docs/ark/model-pricing?lang=zh', 'volcengine'],
  ['https://docs.volcengine.com/docs/ark/bytedance-seed-1-8?lang=zh', 'volcengine'],
  ['https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya', 'qianfan'],
]);
const reviewedProvider = (record) =>
  record.provider ?? REFERENCE_PROVIDERS.get(record.source?.url) ?? null;
const isSeedanceTable = (record) =>
  record.officialModel === 'doubao-seedance-2-5-260628' &&
  reviewedProvider(record) === 'volcengine';
const structuredConditions = (conditions) =>
  typeof conditions === 'string' ? { officialCondition: conditions } : (conditions ?? {});
const isTokenUnit = (unit) =>
  typeof unit === 'string' &&
  /^(?:[A-Z]{3}[ /])?(?:per[ _])?(?:million|thousand|[0-9,]+)[ _]tokens?$/i.test(unit);

function toCnyAmount(amount, currency) {
  if (typeof amount !== 'number' || !['CNY', 'USD'].includes(currency)) return null;
  return convertPrice(amount, CNY_POLICY[currency], 'input');
}

function displayRow(rowId, usageKey, amount, currency, unit, conditions, tier) {
  const cnyAmount = toCnyAmount(amount, currency);
  return {
    rowId,
    usageKey,
    amount: typeof amount === 'number' ? amount : null,
    ...(typeof amount === 'string' ? { sourceValue: amount } : {}),
    currency: currency ?? null,
    unit: unit ?? null,
    cnyAmount,
    cnyCurrency: cnyAmount === null ? null : 'CNY',
    conditions: conditions ?? {},
    ...(tier ? { tier } : {}),
  };
}

// The ordinary branch applies outside len <= maxInput && output <= maxOutput.
function markOrdinaryOutputBands(rows, cost, prefix) {
  const short = cost?.short_output;
  if (!Number.isSafeInteger(short?.maxInput) || !Number.isSafeInteger(short?.maxOutput))
    return rows;

  const lastLowerToken = (tier) => tier.size - (tier.comparison === 'gte' ? 1 : 0);
  const baseAndTiers = rows.filter(
    ({ rowId }) =>
      rowId.startsWith(prefix + ':') &&
      /^(?:tier-\d+:)?[^:]+$/.test(rowId.slice(prefix.length + 1)),
  );
  for (const row of baseAndTiers) {
    const start = row.tier ? lastLowerToken(row.tier) + 1 : 0;
    if (start > short.maxInput) continue;
    const nextThreshold = Math.min(
      ...baseAndTiers
        .filter(
          ({ usageKey, tier }) =>
            usageKey === row.usageKey && tier && lastLowerToken(tier) >= start,
        )
        .map(({ tier }) => lastLowerToken(tier)),
    );
    row.conditions = {
      ...row.conditions,
      ...(nextThreshold <= short.maxInput
        ? { minOutput: short.maxOutput + 1 }
        : { outsideShortOutput: { maxInput: short.maxInput, maxOutput: short.maxOutput } }),
    };
  }
  return rows;
}

const hasDisplayRate = (rows) =>
  rows.some(({ amount, sourceValue }) => amount !== null || Boolean(sourceValue));

function costDisplayRows(cost, unit, currency, conditions, prefix = 'cost') {
  const rows = [];
  const visit = (sheet, path, inheritedConditions, tier) => {
    const localConditions = { ...inheritedConditions };
    for (const [key, value] of Object.entries(sheet ?? {})) {
      const primitiveMetadata =
        value === null ||
        typeof value !== 'object' ||
        (Array.isArray(value) && value.every((item) => item === null || typeof item !== 'object'));
      if (primitiveMetadata && !COST_CHARGE_KEYS.has(key) && key !== 'currency')
        localConditions[key] = value;
    }
    for (const [key, value] of Object.entries(sheet ?? {})) {
      if (COST_CHARGE_KEYS.has(key) && typeof value === 'number') {
        rows.push(
          displayRow(
            path + ':' + key,
            key,
            value,
            currency,
            METER_UNITS[key] ?? (unit === 'mixed' ? conditions.textUnit : unit),
            key.startsWith('per_second_')
              ? { ...localConditions, resolution: key.slice('per_second_'.length) }
              : localConditions,
            tier,
          ),
        );
      } else if (key === 'tiers' && Array.isArray(value)) {
        value.forEach((child, index) =>
          visit(
            child,
            path + ':tier-' + index,
            { ...localConditions, tier: child.tier },
            child.tier,
          ),
        );
      } else if (value && typeof value === 'object' && !Array.isArray(value) && key !== 'tier') {
        const { amount, unit: meterUnit, currency: meterCurrency, ...qualifiers } = value;
        const meterPath = path + ':' + key;
        if (typeof meterUnit === 'string' && typeof amount === 'number') {
          rows.push(
            displayRow(
              meterPath + ':amount',
              key,
              amount,
              meterCurrency ?? currency,
              meterUnit,
              { ...localConditions, ...qualifiers },
              tier,
            ),
          );
        } else {
          visit(
            value,
            meterPath,
            key === 'audio' ? { ...localConditions, modality: key } : localConditions,
            tier,
          );
        }
      } else if (Array.isArray(value) && value.some((item) => item && typeof item === 'object')) {
        value.forEach((child, index) => {
          if (child && typeof child === 'object')
            visit(child, path + ':' + key + ':' + index, localConditions, tier);
        });
      }
    }
  };
  visit(cost, prefix, conditions, undefined);
  return markOrdinaryOutputBands(rows, cost, prefix);
}

function feeDisplayRows(fees, prefix, conditions) {
  return (fees ?? []).map((fee, index) =>
    displayRow(
      prefix + ':' + index + ':' + (fee.name ?? fee.key ?? fee.usageKey),
      fee.name ?? fee.key ?? fee.usageKey,
      fee.amount,
      fee.unit === 'additional_image_output_tokens_per_partial_image' ? null : fee.currency,
      fee.unit,
      {
        ...conditions,
        ...(fee.condition !== undefined ? { condition: fee.condition } : {}),
        ...(fee.freeQuantity !== undefined ? { freeQuantity: fee.freeQuantity } : {}),
      },
    ),
  );
}

function taskDisplayRows(tiers, conditions) {
  return (tiers ?? []).flatMap((tier, tierIndex) =>
    tier.charges.map((charge) =>
      displayRow(
        'task:' + tierIndex + ':' + tier.name + ':' + charge.usageKey,
        charge.usageKey,
        charge.amount,
        charge.currency,
        charge.unit,
        {
          ...conditions,
          tierName: tier.name,
          when: tier.when ?? {},
          ...(charge.freeQuantity !== undefined ? { freeQuantity: charge.freeQuantity } : {}),
          ...(tier.notApplicable ? { notApplicable: tier.notApplicable } : {}),
        },
      ),
    ),
  );
}

const RAW_ROW_CHARGE_KEYS = COST_CHARGE_KEYS;
const RAW_ARRAY_CHARGE_KEYS = new Set([
  'input',
  'cacheHit',
  'output',
  'batchInput',
  'batchCacheHit',
  'batchOutput',
  'singleImageOutput',
  'layerDecompositionOutput',
]);
const RAW_SCALAR_CHARGE_KEYS = new Set([
  ...RAW_ROW_CHARGE_KEYS,
  'amount',
  'cacheStorage',
  'directOriginalInput',
  'directOriginalOutput',
  'explicitCacheStorage',
  'implicitCacheStorage',
  'routerCachedInput',
]);

function rawFeeArrayRows(values, unit, currency, conditions) {
  return values.flatMap((value, rowIndex) => {
    const rowConditions = { ...conditions };
    for (const [key, item] of Object.entries(value))
      if (!RAW_ROW_CHARGE_KEYS.has(key)) rowConditions[key] = item;
    return Object.entries(value).flatMap(([key, amount]) =>
      RAW_ROW_CHARGE_KEYS.has(key) && ['number', 'string'].includes(typeof amount)
        ? [
            displayRow(
              'raw-fees:' + rowIndex + ':' + key,
              key,
              amount,
              currency,
              METER_UNITS[key] ?? unit?.split(';')[0],
              rowConditions,
            ),
          ]
        : [],
    );
  });
}

function rawFeeObjectRows(raw, currency, conditions) {
  const rows = [];
  for (const [rowIndex, cells] of (raw.rows ?? []).entries()) {
    const rowConditions = { ...conditions };
    for (const [columnIndex, column] of raw.columns.entries())
      if (column === 'resolution') rowConditions[column] = cells[columnIndex];
    for (const key of ['minimumUsage', 'draft'])
      if (raw[key] !== undefined) rowConditions[key] = raw[key];
    if (raw.inputIntervals?.[rowIndex]) rowConditions.inputInterval = raw.inputIntervals[rowIndex];
    for (const [columnIndex, column] of raw.columns.entries()) {
      const amount = cells[columnIndex];
      if (column !== 'resolution' && typeof amount === 'number')
        rows.push(
          displayRow(
            'raw-fees:row-' + rowIndex + ':' + column,
            column,
            amount,
            currency,
            raw.unit,
            rowConditions,
          ),
        );
    }
  }
  if (raw.tokenFees)
    rows.push(
      ...costDisplayRows(raw.tokenFees, raw.tokenUnit, currency, conditions, 'raw-fees:token'),
    );
  if (Array.isArray(raw.tiers))
    rows.push(
      ...rawFeeArrayRows(raw.tiers, raw.unit, currency, {
        ...conditions,
        ...(Object.hasOwn(raw, 'thresholdTokens') ? { thresholdTokens: raw.thresholdTokens } : {}),
      }),
    );
  for (const [key, value] of Object.entries(raw)) {
    const unit = /storage/i.test(key) ? (raw.storageUnit ?? raw.unit) : raw.unit;
    if (RAW_SCALAR_CHARGE_KEYS.has(key) && ['number', 'string'].includes(typeof value)) {
      rows.push(
        displayRow('raw-fees:' + key, key, value, currency, unit, {
          ...conditions,
          ...(raw.rounding ? { rounding: raw.rounding } : {}),
          ...(raw.inputRange ? { inputRange: raw.inputRange } : {}),
          ...(key === 'routerCachedInput' && raw.routerPriceSource
            ? { routerPriceSource: raw.routerPriceSource }
            : {}),
        }),
      );
    } else if (RAW_ARRAY_CHARGE_KEYS.has(key) && Array.isArray(value)) {
      value.forEach((amount, index) => {
        const rowConditions = {
          ...conditions,
          ...(raw.conditions?.[index] ? { officialCondition: raw.conditions[index] } : {}),
          ...(raw.outputPixelCutoff !== undefined
            ? { outputPixelCutoff: raw.outputPixelCutoff, outputBand: index }
            : {}),
          ...(typeof raw.input === 'string' ? { inputCondition: raw.input } : {}),
        };
        rows.push(
          displayRow('raw-fees:' + key + ':' + index, key, amount, currency, unit, rowConditions),
        );
      });
    }
  }
  return rows;
}

function paidTierRows(sheet, prefix, currency, sourceUnit, units, conditions) {
  const { next, expires, validThrough = expires, ...prices } = sheet;
  const activeConditions = validThrough ? { ...conditions, validThrough } : conditions;
  const current = costDisplayRows(prices, sourceUnit, currency, activeConditions, prefix);
  const scheduled = next
    ? costDisplayRows(
        next,
        sourceUnit,
        currency,
        {
          ...conditions,
          ...(validThrough ? { effectiveAfter: validThrough } : {}),
          priceState: 'announced',
        },
        prefix + ':next',
      )
    : [];
  return [...current, ...scheduled].map((row) => ({
    ...row,
    unit: units?.[row.usageKey] ?? row.unit,
  }));
}

function capabilityFeeRows(conditions, currency) {
  const fees = [];
  const applicability = {};
  for (const [key, value] of Object.entries(conditions)) {
    if (value?.unit && (typeof value.amount === 'number' || Array.isArray(value.rates))) {
      fees.push([key, value]);
    } else {
      applicability[key] = value;
    }
  }
  return fees.flatMap(([key, fee]) => {
    const { amount, unit, currency: feeCurrency, rates, ...qualifiers } = fee;
    const context = { ...applicability, ...qualifiers };
    if (!rates)
      return [
        displayRow('condition-fee:' + key, key, amount, feeCurrency ?? currency, unit, context),
      ];
    return rates.map((rate, index) =>
      displayRow('condition-fee:' + key + ':' + index, key, rate, feeCurrency ?? currency, unit, {
        ...context,
        ...(key === 'separateExplicitCacheStorage' ? { cacheMode: 'explicit' } : {}),
        ...(conditions.inputBands?.[index] ? { inputBand: conditions.inputBands[index] } : {}),
      }),
    );
  });
}

function displayRowsFor(quote) {
  const source = quote.originalQuote;
  const conditions = structuredConditions(source?.conditions ?? quote.conditions);
  const currency = quote.sourceCurrency ?? source?.currency;
  // The fixed upstream CostFamilyCells schema declares token rates per million,
  // even when adaptPrice cannot classify or compile the complete sheet.
  const unit =
    quote.sourceUnit ?? source?.unit ?? (quote.upstreamReportedCost ? 'per_million_tokens' : null);
  if (source?.kind === 'task' || quote.outputKind === 'task-model')
    return taskDisplayRows(quote.sourcePrice, conditions);
  const rows = [];
  if (source?.cost) rows.push(...costDisplayRows(source.cost, unit, currency, conditions));
  if (source?.fees)
    rows.push(
      ...feeDisplayRows(
        source.fees,
        'fees',
        source.raw?.expires ? { ...conditions, validThrough: source.raw.expires } : conditions,
      ),
    );
  if (source?.tools) rows.push(...feeDisplayRows(source.tools, 'tools', conditions));
  const inputImage = source?.inputImageEquivalent;
  if (Number.isFinite(inputImage?.publishedApproxUSD)) {
    rows.push({
      ...displayRow(
        'image-input-equivalent',
        'image_input_equivalent',
        inputImage.publishedApproxUSD,
        'USD',
        'per_image',
        { ...conditions, inputTokens: inputImage.tokens },
      ),
      approximate: true,
    });
  }
  for (const [index, equivalent] of (source?.imageOutputEquivalents ?? []).entries()) {
    const { publishedApproxUSD, resolution, outputTokens } = equivalent;
    if (Number.isFinite(publishedApproxUSD)) {
      rows.push({
        ...displayRow(
          'image-output-equivalent:' + index,
          'image_output_equivalent',
          publishedApproxUSD,
          'USD',
          'per_image',
          { ...conditions, resolution, outputTokens },
        ),
        approximate: true,
      });
    }
  }

  if (source?.raw) {
    for (const row of paidTierRows(
      source.raw,
      'raw',
      currency,
      unit,
      source.otherTierUnits,
      conditions,
    )) {
      const represented = rows.some(
        (fee) =>
          fee.rowId.startsWith('fees:') &&
          fee.usageKey === row.usageKey &&
          fee.amount === row.amount &&
          fee.unit === row.unit &&
          !row.conditions.priceState,
      );
      if (!represented) rows.push(row);
    }
  }
  for (const [serviceTier, sheet] of Object.entries(source?.otherPaidTiers ?? {}))
    rows.push(
      ...paidTierRows(sheet, 'service:' + serviceTier, currency, unit, source.otherTierUnits, {
        ...conditions,
        serviceTier,
      }),
    );
  if (rows.length) return rows;
  const value = quote.sourcePrice;
  if (Array.isArray(value)) return rawFeeArrayRows(value, unit, currency, conditions);
  if (source?.rawFees) return rawFeeObjectRows(value, currency, conditions);
  if (source?.candidateCost)
    return costDisplayRows(source.candidateCost, unit, currency, conditions, 'candidate-cost');
  const genericRows = [
    ...costDisplayRows(value, unit, currency, conditions),
    ...(source ? [] : capabilityFeeRows(conditions, currency)),
  ];
  return quote.originalCurrencyEligible === false
    ? genericRows.map((row) => ({ ...row, cnyAmount: null, cnyCurrency: null }))
    : genericRows;
}

function summaryFor(selectedQuote, status, groups) {
  if (!selectedQuote)
    return {
      kind: groups.some(({ quotes }) =>
        quotes.some(({ displayRows }) => hasDisplayRate(displayRows)),
      )
        ? 'reference-only'
        : 'unavailable',
      status,
    };
  if (selectedQuote.outputKind === 'task-model') {
    const rows = displayRowsFor(selectedQuote);
    const units = [...new Set(rows.map(({ unit }) => unit).filter(Boolean))].sort();
    const primaryUnit = selectedQuote.originalQuote?.display?.primaryUnit ?? null;
    if (units.length > 1 && !primaryUnit)
      return { kind: 'multiple-units', messageKey: 'multiple-billing-units', units };
    const unit = primaryUnit ?? units[0];
    if (!units.includes(unit))
      return {
        kind: 'invalid-primary-unit',
        messageKey: 'invalid-primary-billing-unit',
        primaryUnit: unit,
        units,
      };
    const unitRows = rows.filter((row) => row.unit === unit);
    const amounts = unitRows.map(({ cnyAmount }) => cnyAmount).filter(Number.isFinite);
    const resolutions = [
      ...new Set(
        unitRows
          .map((row) => row.conditions.when?.resolution ?? row.conditions.resolution)
          .filter(Boolean),
      ),
    ];
    return {
      kind: 'range',
      quoteId: selectedQuote.quoteId,
      currency: 'CNY',
      unit,
      minimum: Math.min(...amounts),
      maximum: Math.max(...amounts),
      ...(resolutions.length ? { resolutions } : {}),
      hasAdditionalUnits: units.length > 1,
      hasMoreConditions:
        Object.keys(selectedQuote.originalQuote?.conditions ?? {}).length > 0 ||
        units.length > 1 ||
        unitRows.some(
          (row) =>
            Object.keys(row.conditions.when ?? {}).length > 0 ||
            row.conditions.freeQuantity !== undefined,
        ),
    };
  }
  const cny = selectedQuote.cnyCost ?? {};
  if (typeof cny.per_image === 'number')
    return {
      kind: 'fixed',
      quoteId: selectedQuote.quoteId,
      currency: 'CNY',
      unit: selectedQuote.sourceUnit,
      amount: cny.per_image,
      hasMoreConditions: Boolean(selectedQuote.originalQuote?.conditions),
    };
  const hasTiers = Boolean(selectedQuote.sourcePrice?.tiers?.length);
  return {
    kind: hasTiers ? 'token-tiers' : 'single-token',
    quoteId: selectedQuote.quoteId,
    currency: 'CNY',
    unit: selectedQuote.sourceUnit,
    input: cny.input ?? null,
    output: cny.output ?? null,
    hasTiers,
    hasMoreConditions:
      hasTiers || Boolean(Object.keys(selectedQuote.originalQuote?.conditions ?? {}).length),
  };
}

// Acceptance conditions in #86 DSP-AC-05/06 apply to these exact reviewed reference
// records. Bind them by digest so a changed source is reviewed before reusing the terms.
const OPENAI_RESPONSES_CACHE_REFERENCES = new Set([
  'ac78ac97fcf28c9e45ce2d4b7cd1d76445f74aa3e01b0324c7e04336cc63738d', // Batch
  '3d7d8d0512145734625d8cfae11db5b95d208f83892f7ea611bd35d7e499b9fc', // Flex
  '3272c723a3e7628e52bc38698f6065b933f307854aff0a1690dc245e1ffc11a1', // Fast
  'a344f33c2b7111c2b5f28a275fc7e6c4ca5b70f98b78db5cbafe2f66653be440', // Ultrafast
]);
const ANTHROPIC_BATCH_CACHE_REFERENCE =
  'f5386f9c833521c4ec9f2f471992f3d3e85065100f5d2a568972467937c7107c';

function documentedFeeTerms(quote) {
  const source = quote.originalQuote;
  if (!source) return [];
  const terms = (source.feeDeclarations ?? []).flatMap(({ field, retention, condition }) => {
    const minutes = /^(\d+)m$/.exec(retention ?? '')?.[1];
    return field && (minutes || condition)
      ? [
          {
            usageKey: field,
            ...(minutes ? { retentionMinutes: Number(minutes) } : {}),
            ...(condition ? { condition } : {}),
          },
        ]
      : [];
  });
  if (!terms.some(({ usageKey }) => usageKey === 'cache_write')) {
    const minutes =
      /cache_write\s*(?:=|is)\s*(\d+)(?:\s*[- ]?minutes?\b|m\b)/i.exec(
        source.description ?? '',
      )?.[1] ?? /\b(\d+)m\/\d+h writes\b/i.exec(source.reason ?? '')?.[1];
    if (minutes) terms.push({ usageKey: 'cache_write', retentionMinutes: Number(minutes) });
  }
  if (OPENAI_RESPONSES_CACHE_REFERENCES.has(quote.source.recordSha256)) {
    if (!terms.some(({ usageKey }) => usageKey === 'cache_write'))
      terms.push({ usageKey: 'cache_write', retentionMinutes: 30 });
    terms.push({ usageKey: 'cache_write_12h', condition: 'Responses API' });
  }
  if (quote.source.recordSha256 === ANTHROPIC_BATCH_CACHE_REFERENCE)
    terms.push({ usageKey: 'cache_write', retentionMinutes: 5 });
  return terms;
}

function quoteGroup(quote) {
  const displayQuote = structuredClone(quote);
  displayQuote.displayRows = displayRowsFor(quote);
  const feeTerms = documentedFeeTerms(quote);
  if (feeTerms.length) displayQuote.displayFeeTerms = feeTerms;
  // Use the same reviewed seconds rate shown beside the illustrative input and output durations.
  const rate = displayQuote.displayRows.find(
    ({ unit, cnyAmount, conditions }) =>
      unit === 'per_second' &&
      cnyAmount !== null &&
      conditions.basis === 'input-and-output-seconds' &&
      /^720p$/i.test(conditions.when?.resolution ?? ''),
  );
  if (rate) {
    const inputSeconds = 5;
    const outputSeconds = 10;
    displayQuote.displayExamples = [
      {
        resolution: rate.conditions.when.resolution,
        inputSeconds,
        outputSeconds,
        amount: Number((rate.cnyAmount * (inputSeconds + outputSeconds)).toPrecision(15)),
        currency: rate.cnyCurrency,
      },
    ];
  }
  return {
    groupId: 'quote:' + quote.quoteId,
    kind:
      displayQuote.displayRows.length === 0
        ? 'status'
        : quote.outputKind === 'task-model'
          ? 'task-tiers'
          : quote.outputKind === 'model-reference'
            ? 'reviewed-reference'
            : 'token-or-media',
    priceList: quote.priceList ?? null,
    endpoint: quote.endpoint ?? null,
    sourceUnit: quote.sourceUnit ?? null,
    quotes: [displayQuote],
  };
}

function hasKeyMatching(value, pattern) {
  if (Array.isArray(value)) return value.some((item) => hasKeyMatching(item, pattern));
  if (value && typeof value === 'object')
    return Object.entries(value).some(
      ([key, item]) => pattern.test(key) || hasKeyMatching(item, pattern),
    );
  return false;
}

function serviceTier(quote) {
  const value = quote.originalQuote?.officialServiceTier ?? quote.priceList ?? '';
  return /^(Standard|Batch|Flex|Fast|Ultrafast|Priority)\b/i.exec(value)?.[1].toLowerCase() ?? null;
}

function isMultimediaCharge({ usageKey, unit }) {
  return (
    /^per_(?:second|minute|count|image|song|10k_chars)$/.test(unit ?? '') ||
    /image_output_tokens|video_tokens|^[A-Z]{3}\/image$/.test(unit ?? '') ||
    /^(?:(?:input|output)_|cache_read_)(?:image|audio|video)$/.test(usageKey) ||
    /^(?:input|cacheHit)Audio$/.test(usageKey) ||
    /^(?:videoInput|audioCacheRead)$/.test(usageKey)
  );
}

function categoriesFor(status, quotes, selectedQuote) {
  const categories = new Set();
  if (['not-offered', 'deprecated', 'withdrawn', 'deferred', 'excluded'].includes(status))
    categories.add(status === 'excluded' ? 'scope-excluded' : status);
  if (!selectedQuote) categories.add('no-current-price');
  const tiers = new Set(quotes.map(serviceTier).filter(Boolean));
  if (
    tiers.size > 1 ||
    quotes.some((quote) => Object.keys(quote.originalQuote?.otherPaidTiers ?? {}).length)
  )
    categories.add('multi-service-tier');
  const endpoints = new Set(quotes.map((quote) => quote.endpoint).filter(Boolean));
  if (
    endpoints.size > 1 ||
    quotes.some(
      (quote) =>
        quote.originalQuote?.officialRegion ||
        quote.originalQuote?.region ||
        /inference_geo|\/ global|mainland|singapore|cn-beijing/i.test(quote.priceList ?? ''),
    )
  )
    categories.add('multi-region-endpoint');
  for (const quote of quotes) {
    const source = quote.originalQuote;
    if (hasKeyMatching(quote.sourcePrice, /^cache|cache_|Ttl|TTL/) || source?.cache)
      categories.add('cache-and-ttl');
    if (
      hasKeyMatching(quote.sourcePrice, /^tiers$/) ||
      hasKeyMatching(source?.rawFees?.tokenFees, /^tiers$/)
    )
      categories.add('token-tiers');
    if (quote.outputKind === 'task-model' || source?.task)
      categories.add('task-conditions').add('multimedia-usage');
    const displayRows = quote.displayRows;
    if (!quote.selected && hasDisplayRate(displayRows)) categories.add('reference-only');
    if (displayRows.some(isMultimediaCharge)) categories.add('multimedia-usage');
    for (const quoteStatus of ['pending-effective', 'withdrawn', 'deferred'])
      if (quote.status === quoteStatus) categories.add(quoteStatus);
  }
  if (
    selectedQuote &&
    !categories.has('token-tiers') &&
    selectedQuote.outputKind === 'model' &&
    isTokenUnit(selectedQuote.sourceUnit) &&
    displayRowsFor(selectedQuote).some(({ unit }) => isTokenUnit(unit))
  )
    categories.add('single-token');
  return [...categories].sort();
}

function hasNumericPrice(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasNumericPrice);
  if (value && typeof value === 'object')
    return Object.entries(value).some(
      ([key, item]) => !['size', 'maxInput', 'maxOutput'].includes(key) && hasNumericPrice(item),
    );
  return false;
}

function referenceSourcePrice(record, selected) {
  let value =
    record.cost ??
    record.candidateCost ??
    record.fees ??
    record.rawFees ??
    record.raw ??
    record.tools ??
    null;
  if (selected && isSeedanceTable(record) && value?.rows)
    value = { ...value, rows: value.rows.filter(([resolution]) => resolution === '4K') };
  return structuredClone(value);
}

function referenceQuote(record, current, policy, selectedQuote) {
  const sourceProviderId = reviewedProvider(record);
  const providerId = sourceProviderId
    ? (policy.providerAliases[sourceProviderId] ?? sourceProviderId)
    : null;
  const modelId = record.officialModel ?? record.model;
  const sourcePrice = referenceSourcePrice(record, selectedQuote);
  const cost = record.cost ?? record.candidateCost;
  return {
    quoteId: referenceQuoteId(record),
    sourceRecordId: referenceSourceId(record),
    providerId,
    sourceProviderId,
    modelId,
    nativeKey: modelId,
    priceList:
      record.priceList ??
      (isSeedanceTable(record)
        ? 'Volcengine Ark / mainland / online'
        : record.officialServiceTier
          ? record.officialServiceTier[0].toUpperCase() + record.officialServiceTier.slice(1)
          : 'Reviewed official reference'),
    endpoint: record.endpoint ?? current.upstreamPrice?.endpoint ?? null,
    sourceCurrency: record.currency ?? null,
    sourcePrice,
    sourceUnit: record.unit ?? record.rawFees?.unit ?? null,
    source: { ...record.source, recordSha256: hash(record) },
    originalQuote: structuredClone(record),
    status: isSeedanceTable(record) ? 'validation-held' : (record.status ?? 'reference-only'),
    reason: isSeedanceTable(record)
      ? 'seedance-4k-two-target-billing-cases-unverified'
      : (record.reason ?? 'reviewed-reference-only'),
    ...(isSeedanceTable(record)
      ? {
          verification: {
            decision: policy.sources.seedance,
            officialPrice: true,
            modelExpressionImportEvidence: policy.sources.seedance,
            actual4kBillingVerified: false,
          },
        }
      : {}),
    conditions: structuredClone(record.conditions ?? null),
    selected: false,
    syncable: false,
    outputKind: 'model-reference',
    cnyCost: cost
      ? {
          ...convertPrice(cost, CNY_POLICY[record.currency]),
          currency: 'CNY',
        }
      : undefined,
  };
}

function sourceLedgerEntry(
  sourceType,
  sourceRecordId,
  record,
  providerId,
  modelId,
  location,
  reason,
) {
  return {
    sourceType,
    sourceRecordId,
    providerId: providerId ?? null,
    modelId: modelId ?? null,
    sourcePriceList: record.priceList ?? null,
    disposition: location ? 'displayed' : 'not-displayed',
    locations: location ? [location] : [],
    notDisplayedReason: location ? null : reason,
  };
}

/** Build locale-neutral display data after selection; no display value feeds billing. */
export function buildDisplayData({ records, quotes, selected, official, policy }) {
  const models = [];
  const views = new Map();
  const locations = new Map();
  const referenceReasons = new Map();
  const referencesByModel = new Map();
  for (const source of official.excludedQuotes ?? []) {
    const sourceRecordId = referenceSourceId(source);
    const sourceProviderId = reviewedProvider(source);
    const providerId = sourceProviderId
      ? (policy.providerAliases[sourceProviderId] ?? sourceProviderId)
      : null;
    const modelId = source.officialModel ?? source.model ?? null;
    const current = providerId && modelId ? records.get(identity(providerId, modelId)) : null;
    let reason = null;
    if (!providerId || !modelId) reason = 'source-record-identity-incomplete';
    else if (!current) reason = 'model-not-in-current-catalog';
    else if (['not-offered', 'deprecated'].includes(current.status))
      reason = current.status === 'not-offered' ? 'model-not-offered' : 'model-deprecated';
    else if (source.routedRawStandard) reason = 'routed-model-has-no-independent-price';
    else if (!hasNumericPrice(referenceSourcePrice(source, selected[modelId])))
      reason = 'source-price-not-provided';
    if (reason) {
      referenceReasons.set(sourceRecordId, reason);
      continue;
    }
    const selectedQuote = selected[modelId]?.providerId === providerId ? selected[modelId] : null;
    const quote = referenceQuote(source, current, policy, selectedQuote);
    const key = identity(providerId, modelId);
    if (!referencesByModel.has(key)) referencesByModel.set(key, []);
    referencesByModel.get(key).push(quote);
  }

  for (const record of records.values()) {
    const selectedQuote =
      selected[record.modelId]?.providerId === record.providerId ? selected[record.modelId] : null;
    const hidePrices = ['not-offered', 'deprecated'].includes(record.status);
    const modelQuotes = hidePrices
      ? []
      : [
          ...record.quoteIds
            .map((quoteId) => quotes.get(quoteId))
            .filter((quote) => quote && quote.quoteId !== SEEDANCE_REFERENCE_QUOTE_ID)
            .map((quote) => ({ ...quote, sourceRecordId: officialSourceId(quote.originalQuote) })),
          ...(record.upstreamPrice
            ? [
                {
                  ...record.upstreamPrice,
                  sourceRecordId: 'upstream:' + record.upstreamPrice.quoteId,
                },
              ]
            : []),
          ...(referencesByModel.get(identity(record.providerId, record.modelId)) ?? []),
        ];
    modelQuotes.sort(
      (a, b) =>
        Number(b.selected) - Number(a.selected) ||
        (a.priceList ?? '').localeCompare(b.priceList ?? '') ||
        a.quoteId.localeCompare(b.quoteId),
    );
    const groups = modelQuotes.map(quoteGroup);
    for (const group of groups)
      for (const quote of group.quotes)
        locations.set(quote.sourceRecordId, {
          providerId: record.providerId,
          modelId: record.modelId,
          quoteId: quote.quoteId,
          groupId: group.groupId,
        });
    const view = {
      schemaVersion: 1,
      providerId: record.providerId,
      modelId: record.modelId,
      status: record.status,
      reason: record.reason ?? null,
      selectedQuoteId: selectedQuote?.quoteId ?? null,
      summary: summaryFor(selectedQuote, record.status, groups),
      groups,
    };
    views.set(identity(record.providerId, record.modelId), view);
    models.push({
      providerId: record.providerId,
      modelId: record.modelId,
      nativeKey: record.nativeKey ?? record.modelId,
      status: record.status,
      reason: record.reason ?? null,
      categories: categoriesFor(
        record.status,
        groups.flatMap(({ quotes }) => quotes),
        selectedQuote,
      ),
      quoteIds: modelQuotes.map((quote) => quote.quoteId),
      selectedQuoteId: selectedQuote?.quoteId ?? null,
      groups: groups.map(({ groupId, quotes }) => ({
        groupId,
        quoteIds: quotes.map((quote) => quote.quoteId),
      })),
      notDisplayedReason: groups.length ? null : (record.reason ?? 'no-displayable-price'),
    });
  }
  models.sort((a, b) =>
    identity(a.providerId, a.modelId).localeCompare(identity(b.providerId, b.modelId)),
  );

  const sourceRecords = [];
  for (const source of official.records ?? []) {
    const providerId = policy.providerAliases[source.provider] ?? source.provider;
    const sourceRecordId = officialSourceId(source);
    const reason =
      source.kind === 'tool'
        ? 'tool-reference-not-model-priced'
        : 'source-record-not-in-display-catalog';
    sourceRecords.push(
      sourceLedgerEntry(
        'official-record',
        sourceRecordId,
        source,
        providerId,
        source.model,
        locations.get(sourceRecordId),
        reason,
      ),
    );
  }
  for (const source of official.excludedQuotes ?? []) {
    const sourceProviderId = reviewedProvider(source);
    const providerId = sourceProviderId
      ? (policy.providerAliases[sourceProviderId] ?? sourceProviderId)
      : null;
    const modelId = source.officialModel ?? source.model ?? null;
    const sourceRecordId = referenceSourceId(source);
    sourceRecords.push(
      sourceLedgerEntry(
        'reviewed-reference',
        sourceRecordId,
        source,
        providerId,
        modelId,
        locations.get(sourceRecordId),
        referenceReasons.get(sourceRecordId) ?? 'source-record-not-in-display-catalog',
      ),
    );
  }
  for (const source of official.optionalToolFees ?? [])
    sourceRecords.push(
      sourceLedgerEntry(
        'optional-tool-reference',
        'optional-tool-reference:' + hash(source),
        source,
        source.provider,
        null,
        null,
        'optional-tool-without-exact-model-identity',
      ),
    );
  for (const record of records.values()) {
    const source = record.upstreamPrice;
    if (!source) continue;
    const sourceRecordId = 'upstream:' + source.quoteId;
    sourceRecords.push(
      sourceLedgerEntry(
        'upstream',
        sourceRecordId,
        source,
        record.providerId,
        record.modelId,
        locations.get(sourceRecordId),
        ['not-offered', 'deprecated'].includes(record.status)
          ? record.status === 'not-offered'
            ? 'model-not-offered'
            : 'model-deprecated'
          : 'source-record-not-in-display-catalog',
      ),
    );
  }
  sourceRecords.sort((a, b) => a.sourceRecordId.localeCompare(b.sourceRecordId));
  return {
    views,
    coverage: {
      schemaVersion: 1,
      status: 'passed',
      models,
      sourceRecords,
      failures: [],
    },
  };
}

function valueHash(value) {
  return value === undefined ? null : hash(value);
}

function compareField(field, expected, actual) {
  const match = canonical(expected) === canonical(actual);
  const result = {
    field,
    status: match ? 'match' : 'mismatch',
    sourceHash: valueHash(expected),
    displayHash: valueHash(actual),
  };
  if (!match) {
    result.expected = expected ?? null;
    result.actual = actual ?? null;
  }
  return result;
}

function originalUpstreamPrice(model, currency) {
  if (!model.cost) return null;
  if (currency && model.cost.currency !== currency && model.cost.currency_options?.[currency])
    return model.cost.currency_options[currency];
  const { currency_options: _currencyOptions, currency: _currency, ...price } = model.cost;
  return price;
}

function upstreamExpectations(upstream, policy, source, selection, official) {
  const excludedProviderIds = new Set(policy.outOfScopeProviders ?? []);
  for (const provider of Object.values(upstream))
    if (provider.subscription) excludedProviderIds.add(provider.id);
  const rows = [];
  for (const [providerId, provider] of Object.entries(upstream)) {
    if (excludedProviderIds.has(providerId)) continue;
    for (const [modelId, model] of Object.entries(provider.models)) {
      const price = adaptPrice(provider, model);
      const deferred = policy.deferredModels[providerId]?.includes(modelId);
      const deferredEvidence = policy.deferredEvidence[providerId];
      const evidence = deferredEvidence?.models.includes(modelId)
        ? deferredEvidence.criterion
        : null;
      const correction = policy.ineligibleUpstream[modelId];
      const exclusion = policy.nativeCapabilityExclusions?.[modelId];
      const incapable =
        exclusion?.providerId === providerId && exclusion.endpoint === (provider.api ?? null);
      const corrected = correction?.providerId === providerId;
      const domestic = domesticProviders.has(providerId) || provider.currency === 'CNY';
      const sourceCurrency = corrected
        ? correction.sourceCurrency
        : incapable
          ? exclusion.currency
          : evidence === 'source-currency'
            ? null
            : (price.sourceCurrency ?? model.cost?.currency ?? (model.cost ? 'USD' : null));
      let status =
        deferred || evidence
          ? 'deferred'
          : corrected || price.reason?.startsWith('unsupported-source-currency:')
            ? 'excluded'
            : incapable
              ? 'unsupported'
              : price.status;
      const event = policy.lifecycle[modelId]?.at(-1);
      if (policy.notOfferedModels?.includes(modelId)) status = 'not-offered';
      else if (event?.state === 'withdrawn' && event.reason === 'model-deprecated')
        status = 'deprecated';
      const amount = originalUpstreamPrice(model, sourceCurrency);
      const quoteId =
        'upstream:' + providerId + ':' + modelId + ':' + (sourceCurrency ?? 'unknown');
      const row = {
        quoteId,
        providerId,
        modelId,
        nativeKey: modelId,
        priceList: 'fixed upstream primary or original CNY sheet',
        endpoint: provider.api ?? null,
        sourceCurrency,
        originalCurrencyEligible: incapable
          ? Boolean(exclusion.sourcePrice)
          : Boolean(amount && price.sourceCurrency && !corrected && evidence !== 'source-currency'),
        sourcePrice:
          corrected || evidence === 'source-currency'
            ? null
            : incapable
              ? exclusion.sourcePrice
              : amount,
        sourceUnit: incapable
          ? exclusion.sourceUnit
          : price.unit === 'image'
            ? 'per_image'
            : price.unit === 'token'
              ? 'per_million_tokens'
              : null,
        source: incapable
          ? exclusion.source
          : {
              url: corrected ? correction.source : (provider.doc ?? null),
              upstreamSha: source.upstreamSha,
              snapshotAt: source.snapshotAt,
              checkedAt: null,
              sha256: amount ? hash({ amount, sourceCurrency }) : null,
            },
        status,
        selected: false,
        syncable: false,
        outputKind: 'model',
        cnyCost: incapable
          ? domestic
            ? exclusion.sourcePrice
            : undefined
          : corrected || deferred || evidence
            ? undefined
            : price.cost,
        conditions: incapable ? exclusion.conditions : undefined,
        upstreamReportedCost: model.cost ?? null,
        unit: price.unit,
        billing_expr: status === 'eligible' ? price.expr : undefined,
        domestic,
      };
      rows.push(row);
    }
  }
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.modelId)) groups.set(row.modelId, []);
    groups.get(row.modelId).push(row);
  }
  for (const [modelId, current] of groups) {
    const event = policy.lifecycle[modelId]?.at(-1);
    const excluded =
      selection[modelId] ||
      policy.notOfferedModels?.includes(modelId) ||
      event?.state === 'withdrawn' ||
      policy.ineligibleUpstream[modelId] ||
      policy.nativeCapabilityExclusions?.[modelId] ||
      (modelId === 'doubao-seedance-2-5-260628' && !selection[modelId]);
    if (excluded) continue;
    const explicit = policy.upstreamSelection[modelId];
    const domestic = current.filter((row) => row.domestic);
    const hasDomesticOfficial = official.records.some(
      (quote) => quote.model === modelId && quote.origin === 'domestic' && quote.kind !== 'tool',
    );
    const pool = domestic.length || hasDomesticOfficial ? domestic : current;
    const eligible = (explicit ? current : pool).filter((row) => row.status === 'eligible');
    const winner = explicit
      ? eligible.find((row) => row.quoteId === explicit)
      : eligible.length === 1
        ? eligible[0]
        : undefined;
    if (winner) {
      winner.selected = true;
      winner.syncable = true;
    }
  }
  return {
    rows,
    excludedProviderIds,
  };
}

function officialExpectations(official, policy, selection, upstream) {
  const records = official.records.map(({ upstreamKey: _upstreamKey, ...quote }) => quote);
  const compiled = generateCny({ upstream: { providers: {} }, records, selection: {} });
  const expectations = new Map();
  for (const [index, entry] of compiled.catalog.entries()) {
    const source = official.records[index];
    const diagnostic = entry.diagnostic;
    const event = policy.lifecycle[source.model]?.at(-1);
    const notOffered = policy.notOfferedModels?.includes(source.model);
    const withdrawn = event?.state === 'withdrawn';
    const pending =
      source.effectiveAt !== undefined && Date.parse(source.effectiveAt) > Date.parse(policy.asOf);
    const task = source.kind === 'task';
    const tool = source.kind === 'tool';
    const selected = selection[source.model] === source.id;
    const status = notOffered
      ? 'not-offered'
      : withdrawn
        ? event.reason === 'model-deprecated'
          ? 'deprecated'
          : 'withdrawn'
        : pending
          ? 'pending-effective'
          : diagnostic.status;
    expectations.set(source.id, {
      quoteId: source.id,
      providerId: policy.providerAliases[source.provider] ?? source.provider,
      sourceProviderId: source.provider,
      modelId: source.model,
      nativeKey: tool ? null : source.model,
      priceList: source.priceList,
      endpoint:
        source.endpoint ??
        upstream[policy.providerAliases[source.provider] ?? source.provider]?.api ??
        null,
      sourceCurrency: source.currency ?? null,
      sourcePrice: task ? source.task?.tiers : tool ? source.tools : source.cost,
      sourceUnit:
        task || tool
          ? 'per-charge'
          : source.cost?.per_image !== undefined
            ? 'per_image'
            : 'per_million_tokens',
      source: {
        ...source.source,
        recordSha256: hash(source),
        historicalEvidence:
          policy.fixedEvidence?.[source.id]?.recordSha256 === hash(source)
            ? policy.fixedEvidence[source.id]
            : undefined,
      },
      originalQuote: source,
      status,
      selected,
      syncable: selected && status === 'ready',
      outputKind: tool ? 'tool-reference' : task ? 'task-model' : 'model',
      cnyCost:
        task || tool || diagnostic.status !== 'ready'
          ? undefined
          : { ...convertPrice(source.cost, CNY_POLICY[source.currency]), currency: 'CNY' },
      cnyTaskTiers:
        task && diagnostic.status === 'ready'
          ? source.task.tiers.map((tier) => ({
              ...tier,
              charges: tier.charges.map((charge) => ({
                ...charge,
                amount: charge.amount * CNY_POLICY[charge.currency],
                currency: 'CNY',
              })),
            }))
          : undefined,
    });
  }
  return expectations;
}

function referenceExclusionReason(source, current, policy) {
  const modelId = source.officialModel ?? source.model;
  if (!reviewedProvider(source) || !modelId) return 'source-record-identity-incomplete';
  if (!current) return 'model-not-in-current-catalog';
  if (policy.notOfferedModels?.includes(modelId)) return 'model-not-offered';
  const event = policy.lifecycle[modelId]?.at(-1);
  if (event?.state === 'withdrawn' && event.reason === 'model-deprecated')
    return 'model-deprecated';
  if (source.routedRawStandard) return 'routed-model-has-no-independent-price';
  const sourcePrice =
    source.cost ??
    source.candidateCost ??
    source.fees ??
    source.rawFees ??
    source.raw ??
    source.tools;
  if (!hasNumericPrice(sourcePrice)) return 'source-price-not-provided';
  return null;
}

/**
 * Independently reconcile emitted artifacts against raw reviewed inputs. This function never
 * derives or mutates New API billing configuration.
 */
export function reconcileDisplayCoverage({
  official,
  policy,
  selection,
  upstream,
  source: upstreamSource,
  coverage,
  displayCoverage,
  catalogs,
}) {
  const failures = [];
  const fail = (code, message, detail = {}) => failures.push({ code, message, ...detail });
  const officialPrices = officialExpectations(official, policy, selection, upstream);
  const upstreamPrices = upstreamExpectations(
    upstream,
    policy,
    upstreamSource,
    selection,
    official,
  );
  const models = new Map();
  for (const row of coverage.models) {
    const key = identity(row.providerId, row.modelId);
    if (models.has(key))
      fail('duplicate-candidate-model', 'Duplicate candidate coverage for ' + key, {
        providerId: row.providerId,
        modelId: row.modelId,
      });
    models.set(key, row);
  }
  const expectedModelKeys = new Set(
    upstreamPrices.rows.map((row) => identity(row.providerId, row.modelId)),
  );
  for (const quote of official.records) {
    if (quote.kind === 'tool') continue;
    const providerId = policy.providerAliases[quote.provider] ?? quote.provider;
    if (
      upstreamPrices.excludedProviderIds.has(quote.provider) ||
      upstreamPrices.excludedProviderIds.has(providerId)
    )
      continue;
    expectedModelKeys.add(identity(providerId, quote.model));
  }
  for (const quote of official.excludedQuotes ?? []) {
    if (quote.officialModel === 'doubao-seedance-2-5-260628')
      expectedModelKeys.add(identity('volcengine', quote.officialModel));
  }
  for (const key of expectedModelKeys)
    if (!models.has(key)) {
      const [providerId, modelId] = JSON.parse(key);
      fail('missing-candidate-model', 'Raw catalog model missing from candidate: ' + key, {
        providerId,
        modelId,
      });
    }
  for (const key of models.keys())
    if (!expectedModelKeys.has(key)) {
      const [providerId, modelId] = JSON.parse(key);
      fail('unexpected-candidate-model', 'Candidate model absent from raw catalog: ' + key, {
        providerId,
        modelId,
      });
    }
  const coverageQuotes = new Map(coverage.quotes.map((quote) => [quote.quoteId, quote]));
  const displayModels = new Map();
  for (const row of displayCoverage.models ?? []) {
    const key = identity(row.providerId, row.modelId);
    if (displayModels.has(key))
      fail('duplicate-model-coverage', 'Duplicate display coverage for ' + key, {
        providerId: row.providerId,
        modelId: row.modelId,
      });
    displayModels.set(key, row);
  }
  for (const [key, expected] of models) {
    const actual = displayModels.get(key);
    if (!actual) {
      fail('missing-model-coverage', 'Missing display coverage for ' + key, {
        providerId: expected.providerId,
        modelId: expected.modelId,
      });
      continue;
    }
    for (const field of ['nativeKey', 'status', 'reason', 'selectedQuoteId'])
      if (JSON.stringify(actual[field] ?? null) !== JSON.stringify(expected[field] ?? null))
        fail('model-coverage-mismatch', 'Display coverage mismatch: ' + key + ':' + field, {
          providerId: expected.providerId,
          modelId: expected.modelId,
          field,
        });
  }
  for (const [key, row] of displayModels)
    if (!models.has(key))
      fail('unexpected-model-coverage', 'Unexpected display coverage for ' + key, {
        providerId: row.providerId,
        modelId: row.modelId,
      });

  const actualBySource = new Map();
  const englishViews = new Map();
  for (const [key, model] of models) {
    const view = catalogs.en?.[model.providerId]?.models?.[model.modelId]?.pricing_view;
    if (!view) {
      fail('missing-pricing-view', 'Missing pricing view for ' + key, {
        providerId: model.providerId,
        modelId: model.modelId,
      });
      continue;
    }
    englishViews.set(key, view);
    for (const field of ['providerId', 'modelId', 'status', 'reason']) {
      if ((view[field] ?? null) !== (model[field] ?? null))
        fail('pricing-view-mismatch', 'View metadata differs from catalog coverage for ' + key, {
          providerId: model.providerId,
          modelId: model.modelId,
          field,
        });
    }
    if (view.summary?.kind === 'invalid-primary-unit')
      fail(
        'invalid-primary-unit',
        'Primary display unit is not offered by selected quote for ' + key,
        {
          providerId: model.providerId,
          modelId: model.modelId,
        },
      );
    const groupIds = new Set();
    const quoteIds = [];
    for (const group of view.groups ?? []) {
      if (groupIds.has(group.groupId))
        fail('duplicate-display-group', 'Duplicate group ' + group.groupId + ' in ' + key, {
          providerId: model.providerId,
          modelId: model.modelId,
        });
      groupIds.add(group.groupId);
      for (const quote of group.quotes ?? []) {
        quoteIds.push(quote.quoteId);
        const location = {
          providerId: model.providerId,
          modelId: model.modelId,
          quoteId: quote.quoteId,
          groupId: group.groupId,
        };
        if (!quote.sourceRecordId)
          fail(
            'missing-source-identity',
            'Displayed quote lacks source identity: ' + quote.quoteId,
            location,
          );
        else {
          if (!actualBySource.has(quote.sourceRecordId))
            actualBySource.set(quote.sourceRecordId, []);
          actualBySource.get(quote.sourceRecordId).push({ location, quote, group });
        }
      }
    }
    const coverageRow = displayModels.get(key);
    if (
      coverageRow &&
      canonical(coverageRow.groups) !==
        canonical(
          (view.groups ?? []).map(({ groupId, quotes }) => ({
            groupId,
            quoteIds: quotes.map(({ quoteId }) => quoteId),
          })),
        )
    )
      fail('coverage-view-group-mismatch', 'Coverage groups differ from view for ' + key, {
        providerId: model.providerId,
        modelId: model.modelId,
      });
    if (
      coverageRow &&
      JSON.stringify([...(coverageRow.quoteIds ?? [])].sort()) !== JSON.stringify(quoteIds.sort())
    )
      fail('coverage-view-quote-mismatch', 'Coverage quote IDs differ from view for ' + key, {
        providerId: model.providerId,
        modelId: model.modelId,
      });
  }
  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const [providerId, provider] of Object.entries(catalog)) {
      for (const modelId of Object.keys(provider.models)) {
        if (!models.has(identity(providerId, modelId)))
          fail('unexpected-catalog-model', 'Catalog has an unreviewed model for ' + locale, {
            providerId,
            modelId,
            locale,
          });
      }
    }
  }
  for (const locale of ['zh', 'ja']) {
    for (const [key, view] of englishViews) {
      const [providerId, modelId] = JSON.parse(key);
      const localized = catalogs[locale]?.[providerId]?.models?.[modelId]?.pricing_view;
      if (!localized || JSON.stringify(localized) !== JSON.stringify(view))
        fail('locale-view-mismatch', 'Localized pricing view differs for ' + locale + ':' + key, {
          providerId,
          modelId,
        });
    }
  }

  const selectedByModel = new Map(
    [...officialPrices.values(), ...upstreamPrices.rows]
      .filter((quote) => quote.syncable && quote.outputKind !== 'tool-reference')
      .map((quote) => [identity(quote.providerId, quote.modelId), quote]),
  );
  const expectedSources = [];
  for (const source of official.records ?? []) {
    const providerId = policy.providerAliases[source.provider] ?? source.provider;
    const key = identity(providerId, source.model);
    const current = models.get(key);
    const normalized = officialPrices.get(source.id);
    let reason = null;
    if (source.kind === 'tool') reason = 'tool-reference-not-model-priced';
    else if (!current) reason = 'source-record-not-in-display-catalog';
    else if (normalized.status === 'not-offered') reason = 'model-not-offered';
    else if (normalized.status === 'deprecated') reason = 'model-deprecated';
    if (current && source.kind !== 'tool' && !coverageQuotes.has(source.id))
      fail('missing-candidate-quote', 'Raw official quote missing from candidate: ' + source.id, {
        sourceRecordId: officialSourceId(source),
        providerId,
        modelId: source.model,
      });
    expectedSources.push({
      source,
      sourceType: 'official-record',
      sourceRecordId: officialSourceId(source),
      providerId,
      modelId: source.model,
      normalized,
      current,
      reason,
    });
  }
  for (const source of official.excludedQuotes ?? []) {
    const sourceProviderId = reviewedProvider(source);
    const providerId = sourceProviderId
      ? (policy.providerAliases[sourceProviderId] ?? sourceProviderId)
      : null;
    const modelId = source.officialModel ?? source.model ?? null;
    const current = providerId && modelId ? models.get(identity(providerId, modelId)) : null;
    const selectedQuote = selectedByModel.get(identity(providerId, modelId));
    expectedSources.push({
      source,
      sourceType: 'reviewed-reference',
      sourceRecordId: referenceSourceId(source),
      providerId,
      modelId,
      current,
      selectedQuote,
      reason: referenceExclusionReason(source, current, policy),
    });
  }
  for (const source of official.optionalToolFees ?? [])
    expectedSources.push({
      source,
      sourceType: 'optional-tool-reference',
      sourceRecordId: 'optional-tool-reference:' + hash(source),
      providerId: source.provider ?? null,
      modelId: null,
      reason: 'optional-tool-without-exact-model-identity',
    });
  for (const normalized of upstreamPrices.rows) {
    const current = models.get(identity(normalized.providerId, normalized.modelId));
    expectedSources.push({
      source: normalized,
      sourceType: 'upstream',
      sourceRecordId: 'upstream:' + normalized.quoteId,
      providerId: normalized.providerId,
      modelId: normalized.modelId,
      normalized,
      current,
      reason:
        normalized.status === 'not-offered'
          ? 'model-not-offered'
          : normalized.status === 'deprecated'
            ? 'model-deprecated'
            : null,
    });
  }

  const reviewedByModel = new Map();
  for (const item of expectedSources) {
    if (item.reason) continue;
    const key = identity(item.providerId, item.modelId);
    if (!reviewedByModel.has(key)) reviewedByModel.set(key, []);
    reviewedByModel.get(key).push(item);
  }
  for (const [key, view] of englishViews) {
    const model = models.get(key);
    const selectedQuote = selectedByModel.get(key);
    const selectedQuoteId = selectedQuote?.quoteId ?? null;
    const detail = { providerId: model.providerId, modelId: model.modelId };
    const expectedCategories = expectedPricingCategories(
      reviewedByModel.get(key) ?? [],
      selectedQuote,
      model.status,
      upstream,
    );
    if (canonical(displayModels.get(key)?.categories ?? []) !== canonical(expectedCategories))
      fail('model-category-mismatch', 'Categories differ from reviewed inputs for ' + key, detail);
    if (
      (model.selectedQuoteId ?? null) !== selectedQuoteId ||
      view.selectedQuoteId !== selectedQuoteId
    )
      fail(
        'model-selection-mismatch',
        'Model selection differs from reviewed input for ' + key,
        detail,
      );
    if (
      canonical(view.summary) !==
      canonical(
        expectedPricingSummary(
          selectedQuote,
          model.status,
          !selectedQuote && hasExpectedReferenceRates(reviewedByModel.get(key) ?? []),
        ),
      )
    )
      fail('summary-mismatch', 'Pricing summary differs from selected quote for ' + key, detail);
  }

  const inputLedger = new Map();
  for (const row of displayCoverage.sourceRecords ?? []) {
    if (inputLedger.has(row.sourceRecordId))
      fail('duplicate-source-record', 'Duplicate source ledger row: ' + row.sourceRecordId, {
        sourceRecordId: row.sourceRecordId,
      });
    inputLedger.set(row.sourceRecordId, row);
  }
  const expectedIds = new Set(expectedSources.map(({ sourceRecordId }) => sourceRecordId));
  for (const row of inputLedger.values())
    if (!expectedIds.has(row.sourceRecordId))
      fail('unexpected-source-record', 'Unexpected source ledger row: ' + row.sourceRecordId, {
        sourceRecordId: row.sourceRecordId,
      });

  const sourceRecords = [];
  let displayed = 0;
  let notDisplayed = 0;
  let comparedFields = 0;
  for (const expected of expectedSources) {
    const {
      source,
      sourceType,
      sourceRecordId,
      providerId,
      modelId,
      normalized,
      current,
      selectedQuote,
      reason,
    } = expected;
    const ledger = inputLedger.get(sourceRecordId);
    if (!ledger)
      fail(
        'missing-source-record',
        'Reviewed source record missing from ledger: ' + sourceRecordId,
        {
          sourceRecordId,
          providerId,
          modelId,
        },
      );
    const actualEntries = actualBySource.get(sourceRecordId) ?? [];
    const shouldDisplay = !reason;
    if (shouldDisplay) displayed += 1;
    else notDisplayed += 1;
    if (shouldDisplay && actualEntries.length !== 1)
      fail(
        'missing-source-location',
        'Displayed source requires exactly one location: ' + sourceRecordId,
        {
          sourceRecordId,
          providerId,
          modelId,
        },
      );
    if (!shouldDisplay && actualEntries.length)
      fail('unexpected-display-location', 'Excluded source was displayed: ' + sourceRecordId, {
        sourceRecordId,
        providerId,
        modelId,
      });
    const actualLocations = actualEntries.map(({ location }) => location);
    if (ledger && JSON.stringify(ledger.locations ?? []) !== JSON.stringify(actualLocations))
      fail('ledger-location-mismatch', 'Ledger location differs from view: ' + sourceRecordId, {
        sourceRecordId,
        providerId,
        modelId,
      });
    if (ledger && !shouldDisplay && !ledger.notDisplayedReason)
      fail('missing-non-display-reason', 'Non-displayed source lacks a reason: ' + sourceRecordId, {
        sourceRecordId,
        providerId,
        modelId,
      });

    const comparisons = [];
    if (shouldDisplay && actualEntries.length === 1) {
      const { quote: actual, group } = actualEntries[0];
      const rawPrice =
        source.cost ??
        source.candidateCost ??
        source.fees ??
        source.rawFees ??
        source.raw ??
        source.tools ??
        null;
      const seedance =
        source.officialModel === 'doubao-seedance-2-5-260628' && providerId === 'volcengine';
      const expectedPrice = normalized
        ? normalized.sourcePrice
        : seedance && selectedQuote
          ? { ...rawPrice, rows: rawPrice.rows.filter((cells) => cells[0] === '4K') }
          : rawPrice;
      const expectedConditions =
        normalized?.originalQuote?.conditions ??
        normalized?.conditions ??
        source.conditions ??
        null;
      const expectedStatus =
        normalized?.status ?? (seedance ? 'validation-held' : (source.status ?? 'reference-only'));
      const priceList =
        normalized?.priceList ??
        source.priceList ??
        (seedance
          ? 'Volcengine Ark / mainland / online'
          : source.officialServiceTier?.replace(/^./, (initial) => initial.toUpperCase()) ||
            'Reviewed official reference');
      const endpoint = normalized
        ? normalized.endpoint
        : (source.endpoint ??
          (upstream[providerId]?.models?.[modelId] ? (upstream[providerId].api ?? null) : null));
      const expectedCny = normalized
        ? (normalized.cnyTaskTiers ?? normalized.cnyCost ?? null)
        : source.cost || source.candidateCost
          ? {
              ...convertPrice(source.cost ?? source.candidateCost, CNY_POLICY[source.currency]),
              currency: 'CNY',
            }
          : null;
      const fields = [
        ['sourcePrice', expectedPrice ?? null, actual.sourcePrice ?? null],
        [
          'sourceCurrency',
          normalized?.sourceCurrency ?? source.currency ?? null,
          actual.sourceCurrency ?? null,
        ],
        [
          'sourceUnit',
          normalized?.sourceUnit ?? source.unit ?? source.rawFees?.unit ?? null,
          actual.sourceUnit ?? null,
        ],
        [
          'conditions',
          expectedConditions,
          actual.originalQuote?.conditions ?? actual.conditions ?? null,
        ],
        ['status', expectedStatus, actual.status],
        [
          'quoteIdentity',
          { providerId, modelId, priceList, endpoint },
          {
            providerId: actual.providerId,
            modelId: actual.modelId,
            priceList: actual.priceList,
            endpoint: actual.endpoint,
          },
        ],
        [
          'groupIdentity',
          {
            priceList,
            endpoint,
            sourceUnit: normalized?.sourceUnit ?? source.unit ?? source.rawFees?.unit ?? null,
          },
          {
            priceList: group.priceList,
            endpoint: group.endpoint,
            sourceUnit: group.sourceUnit,
          },
        ],
        [
          'selection',
          normalized
            ? {
                selected: Boolean(normalized.selected),
                syncable: Boolean(normalized.syncable),
                outputKind: normalized.outputKind,
              }
            : { selected: false, syncable: false, outputKind: 'model-reference' },
          {
            selected: Boolean(actual.selected),
            syncable: Boolean(actual.syncable),
            outputKind: actual.outputKind,
          },
        ],
        ['cnyPrice', expectedCny, actual.cnyTaskTiers ?? actual.cnyCost ?? null],
        [
          'evidence',
          normalized?.source ??
            (sourceType === 'reviewed-reference'
              ? { ...source.source, recordSha256: hash(source) }
              : (source.source ?? null)),
          actual.source ?? null,
        ],
      ];
      if (sourceType === 'official-record' || sourceType === 'reviewed-reference')
        fields.push(['sourceRecord', source, actual.originalQuote]);
      const sourceQuote = normalized ?? {
        originalQuote: source,
        sourcePrice: expectedPrice,
        sourceCurrency: source.currency ?? null,
        sourceUnit: source.unit ?? source.rawFees?.unit ?? null,
      };
      const expectedRows = expectedDisplayRows(sourceQuote);
      const expectedGroupKind =
        expectedRows.length === 0
          ? 'status'
          : normalized?.outputKind === 'task-model'
            ? 'task-tiers'
            : normalized
              ? 'token-or-media'
              : 'reviewed-reference';
      fields.push(['groupKind', expectedGroupKind, group.kind]);
      const byRowId = (rows) => [...rows].sort((a, b) => a.rowId.localeCompare(b.rowId));
      fields.push([
        'displayRows',
        byRowId(expectedRows),
        Array.isArray(actual.displayRows) ? byRowId(actual.displayRows) : null,
      ]);
      if (seedance)
        fields.push([
          'verification',
          {
            decision: policy.sources.seedance,
            officialPrice: true,
            modelExpressionImportEvidence: policy.sources.seedance,
            actual4kBillingVerified: false,
          },
          actual.verification,
        ]);
      const expectedQuoteId =
        normalized?.quoteId ?? (seedance ? SEEDANCE_REFERENCE_QUOTE_ID : referenceSourceId(source));
      fields.push([
        'location',
        { providerId, modelId, quoteId: expectedQuoteId, groupId: 'quote:' + expectedQuoteId },
        actualLocations[0],
      ]);
      for (const [field, expectedValue, actualValue] of fields) {
        const comparison = compareField(field, expectedValue, actualValue);
        comparisons.push(comparison);
        comparedFields += 1;
        if (comparison.status === 'mismatch')
          fail('content-mismatch', 'Display content mismatch: ' + sourceRecordId + ':' + field, {
            sourceRecordId,
            providerId,
            modelId,
            quoteId: actual.quoteId,
            field,
          });
      }
    }
    sourceRecords.push({
      sourceType,
      sourceRecordId,
      providerId,
      modelId,
      sourcePriceList: source.priceList ?? null,
      disposition: shouldDisplay ? 'displayed' : 'not-displayed',
      locations: actualLocations,
      notDisplayedReason: shouldDisplay ? null : reason,
      comparisons,
    });
  }
  for (const [sourceRecordId, entries] of actualBySource) {
    if (!expectedIds.has(sourceRecordId))
      fail('orphan-display-quote', 'Displayed quote has no reviewed source: ' + sourceRecordId, {
        sourceRecordId,
      });
    if (entries.length > 1)
      fail(
        'duplicate-display-source',
        'Source record has multiple display locations: ' + sourceRecordId,
        {
          sourceRecordId,
        },
      );
  }
  sourceRecords.sort((a, b) => a.sourceRecordId.localeCompare(b.sourceRecordId));
  failures.sort(
    (a, b) =>
      (a.sourceRecordId ?? '').localeCompare(b.sourceRecordId ?? '') ||
      a.code.localeCompare(b.code) ||
      (a.field ?? '').localeCompare(b.field ?? ''),
  );
  return {
    schemaVersion: 1,
    status: failures.length ? 'failed' : 'passed',
    models: structuredClone(displayCoverage.models ?? []),
    sourceRecords,
    stats: {
      catalogModels: models.size,
      sourceRecords: expectedSources.length,
      displayedSourceRecords: displayed,
      notDisplayedSourceRecords: notDisplayed,
      comparedFields,
      failures: failures.length,
    },
    failures,
  };
}

export function pricingViewIdentity(providerId, modelId) {
  return identity(providerId, modelId);
}
