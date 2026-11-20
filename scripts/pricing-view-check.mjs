import { CNY_POLICY } from '../.cache/cny-build/cny/generate.js';

// Inventory audited source fields directly. Keep the inventory and the summary assertions
// independent of the production display traversal and its amount conversion.
const tokenRates = [
  'input',
  'output',
  'reasoning',
  'cache_read',
  'cache_write',
  'cache_write_1h',
  'cache_write_12h',
  'input_audio',
  'output_audio',
  'input_image',
  'output_image',
  'cache_read_image',
];
const meteredRates = {
  per_image: 'per_image',
  per_10k_chars: 'per_10k_chars',
  per_second_480p: 'per_second',
  per_second_768p: 'per_second',
  per_second_2k: 'per_second',
  cache_storage: 'per_million_token_hours',
  storage: 'per_million_token_hours',
};
const costRates = [...tokenRates, ...Object.keys(meteredRates), 'cache_read_audio'];
const tierRates = costRates;
const scalarFees = [
  ...tierRates,
  'amount',
  'cacheStorage',
  'directOriginalInput',
  'directOriginalOutput',
  'explicitCacheStorage',
  'implicitCacheStorage',
  'routerCachedInput',
];
const feeBands = [
  'input',
  'cacheHit',
  'output',
  'batchInput',
  'batchCacheHit',
  'batchOutput',
  'singleImageOutput',
  'layerDecompositionOutput',
];

function cny(amount, currency) {
  const factor = CNY_POLICY[currency];
  if (!Number.isFinite(amount) || !['CNY', 'USD'].includes(currency)) return null;
  return factor === 1 ? amount : Number((factor * amount).toPrecision(15));
}

function expectedRow(rowId, usageKey, rate, currency, unit, conditions, tier) {
  const cnyAmount = cny(rate, currency);
  return {
    rowId,
    usageKey,
    amount: typeof rate === 'number' ? rate : null,
    ...(typeof rate === 'string' ? { sourceValue: rate } : {}),
    currency: currency ?? null,
    unit: unit ?? null,
    cnyAmount,
    cnyCurrency: cnyAmount === null ? null : 'CNY',
    conditions,
    ...(tier ? { tier } : {}),
  };
}

function costNodes(node, path, ancestors = []) {
  const entries = Object.entries(node);
  const lineage = [...ancestors, node];
  return [
    { path, node, lineage },
    ...entries.flatMap(([key, value]) => {
      if (Array.isArray(value))
        return value.flatMap((child, index) => {
          if (!child || typeof child !== 'object') return [];
          const childPath = key === 'tiers' ? 'tier-' + index : key + ':' + index;
          return costNodes(child, path + ':' + childPath, lineage);
        });
      return value && typeof value === 'object' && key !== 'tier'
        ? costNodes(value, path + ':' + key, lineage)
        : [];
    }),
  ];
}

function costRows(sheet, path, currency, unit, baseConditions) {
  return costNodes(sheet ?? {}, path).flatMap(({ path, node, lineage }) => {
    const metadata = Object.assign(
      {},
      baseConditions,
      ...lineage.map((ancestor) =>
        Object.fromEntries(
          Object.entries(ancestor).filter(
            ([key, value]) =>
              !costRates.includes(key) &&
              key !== 'currency' &&
              (key === 'tier' ||
                value === null ||
                typeof value !== 'object' ||
                (Array.isArray(value) &&
                  value.every((item) => item === null || typeof item !== 'object'))),
          ),
        ),
      ),
    );
    const pieces = path.split(':');
    if (pieces.length > 1 && Number.isFinite(node.amount) && typeof node.unit === 'string') {
      const usageKey = pieces.at(-1);
      const { amount, currency: meterCurrency, unit: meterUnit, ...meterConditions } = node;
      const { amount: _amount, unit: _unit, ...inherited } = metadata;
      return [
        expectedRow(
          path + ':amount',
          usageKey,
          amount,
          meterCurrency ?? currency,
          meterUnit,
          { ...inherited, ...meterConditions },
          metadata.tier,
        ),
      ];
    }
    if (pieces.includes('audio')) metadata.modality = 'audio';
    return costRates
      .filter((key) => Number.isFinite(node[key]))
      .map((key) => {
        const resolution = /^per_second_(.*)$/.exec(key)?.[1];
        const conditions = resolution ? { ...metadata, resolution } : metadata;
        return expectedRow(
          path + ':' + key,
          key,
          node[key],
          currency,
          meteredRates[key] ?? (unit === 'mixed' ? baseConditions.textUnit : unit),
          conditions,
          metadata.tier,
        );
      });
  });
}

function rateRows(records, currency, unit, baseConditions) {
  return records.flatMap((record, index) => {
    const conditions = {
      ...baseConditions,
      ...Object.fromEntries(Object.entries(record).filter(([key]) => !tierRates.includes(key))),
    };
    return tierRates.flatMap((key) =>
      ['string', 'number'].includes(typeof record[key])
        ? [
            expectedRow(
              'raw-fees:' + index + ':' + key,
              key,
              record[key],
              currency,
              meteredRates[key] ?? unit?.split(';')[0],
              conditions,
            ),
          ]
        : [],
    );
  });
}

function rawRows(sheet, currency, conditions) {
  const table = (sheet.rows ?? []).flatMap((cells, index) => {
    const tableConditions = { ...conditions };
    const resolution = sheet.columns.indexOf('resolution');
    if (resolution >= 0) tableConditions.resolution = cells[resolution];
    if (Object.hasOwn(sheet, 'minimumUsage')) tableConditions.minimumUsage = sheet.minimumUsage;
    if (Object.hasOwn(sheet, 'draft')) tableConditions.draft = sheet.draft;
    if (sheet.inputIntervals?.[index]) tableConditions.inputInterval = sheet.inputIntervals[index];
    return cells.flatMap((amount, column) => {
      const key = sheet.columns[column];
      return key && column !== resolution && Number.isFinite(amount)
        ? [
            expectedRow(
              'raw-fees:row-' + index + ':' + key,
              key,
              amount,
              currency,
              sheet.unit,
              tableConditions,
            ),
          ]
        : [];
    });
  });
  const tierConditions = Object.hasOwn(sheet, 'thresholdTokens')
    ? { ...conditions, thresholdTokens: sheet.thresholdTokens }
    : conditions;
  const tiers = rateRows(sheet.tiers ?? [], currency, sheet.unit, tierConditions);
  const tokens = costRows(sheet.tokenFees, 'raw-fees:token', currency, sheet.tokenUnit, conditions);
  const fees = scalarFees
    .filter((key) => ['string', 'number'].includes(typeof sheet[key]))
    .map((key) => {
      const applicable = { ...conditions };
      if (sheet.rounding) applicable.rounding = sheet.rounding;
      if (sheet.inputRange) applicable.inputRange = sheet.inputRange;
      if (key === 'routerCachedInput' && sheet.routerPriceSource)
        applicable.routerPriceSource = sheet.routerPriceSource;
      const unit = /storage/i.test(key) && sheet.storageUnit ? sheet.storageUnit : sheet.unit;
      return expectedRow('raw-fees:' + key, key, sheet[key], currency, unit, applicable);
    });
  const bands = feeBands.flatMap((key) =>
    Array.isArray(sheet[key])
      ? sheet[key].map((rate, index) => {
          const applicable = { ...conditions };
          if (sheet.conditions?.[index]) applicable.officialCondition = sheet.conditions[index];
          if (Object.hasOwn(sheet, 'outputPixelCutoff')) {
            applicable.outputPixelCutoff = sheet.outputPixelCutoff;
            applicable.outputBand = index;
          }
          if (typeof sheet.input === 'string') applicable.inputCondition = sheet.input;
          return expectedRow(
            'raw-fees:' + key + ':' + index,
            key,
            rate,
            currency,
            sheet.unit,
            applicable,
          );
        })
      : [],
  );
  return [...table, ...tiers, ...tokens, ...fees, ...bands];
}

function chargedFees(fees, prefix, baseConditions) {
  return (fees ?? []).map(
    ({ name, key, usageKey, amount, currency, unit, condition, freeQuantity }, index) => {
      const usage = name ?? key ?? usageKey;
      const conditions = { ...baseConditions };
      if (condition !== undefined) conditions.condition = condition;
      if (freeQuantity !== undefined) conditions.freeQuantity = freeQuantity;
      return expectedRow(
        prefix + ':' + index + ':' + usage,
        usage,
        amount,
        unit === 'additional_image_output_tokens_per_partial_image' ? undefined : currency,
        unit,
        conditions,
      );
    },
  );
}

function explicitChargesInConditions(conditions, currency) {
  const rates = Object.entries(conditions).filter(
    ([, value]) =>
      typeof value?.unit === 'string' &&
      (Number.isFinite(value.amount) || Array.isArray(value.rates)),
  );
  const qualifiers = Object.fromEntries(
    Object.entries(conditions).filter(([name]) => !rates.some(([meter]) => meter === name)),
  );
  return rates.flatMap(([name, rate]) => {
    const entries = rate.rates ?? [rate.amount];
    const { rates: _rates, amount: _amount, unit, currency: rateCurrency, ...metadata } = rate;
    return entries.map((amount, index) => {
      const conditionsForMeter = { ...qualifiers, ...metadata };
      if (name === 'separateExplicitCacheStorage') conditionsForMeter.cacheMode = 'explicit';
      if (rate.rates && conditions.inputBands?.[index])
        conditionsForMeter.inputBand = conditions.inputBands[index];
      const rowId = ['condition-fee', name, ...(rate.rates ? [index] : [])].join(':');
      return expectedRow(rowId, name, amount, rateCurrency ?? currency, unit, conditionsForMeter);
    });
  });
}

export function expectedDisplayRows(quote) {
  const source = quote.originalQuote ?? {};
  const { sourcePrice, sourceUnit, sourceCurrency } = quote;
  const originalConditions = source.conditions ?? quote.conditions;
  const conditions =
    typeof originalConditions === 'string'
      ? { officialCondition: originalConditions }
      : (originalConditions ?? {});
  if (source.task && source.kind === 'task') {
    const rows = [];
    for (const [
      index,
      { name, when = {}, notApplicable, charges },
    ] of source.task.tiers.entries()) {
      for (const charge of charges) {
        const applicability = { ...conditions, tierName: name, when };
        if (notApplicable) applicability.notApplicable = notApplicable;
        if (charge.freeQuantity !== undefined) applicability.freeQuantity = charge.freeQuantity;
        rows.push(
          expectedRow(
            'task:' + index + ':' + name + ':' + charge.usageKey,
            charge.usageKey,
            charge.amount,
            charge.currency,
            charge.unit,
            applicability,
          ),
        );
      }
    }
    return rows;
  }
  const sections = [];
  if (source.raw) {
    const { expires, next, ...current } = source.raw;
    sections.push([
      'raw',
      current,
      expires ? { ...conditions, validThrough: expires } : conditions,
    ]);
    if (next) {
      const when = { ...conditions, priceState: 'announced' };
      if (expires) when.effectiveAfter = expires;
      sections.push(['raw:next', next, when]);
    }
  }
  for (const [name, tier] of Object.entries(source.otherPaidTiers ?? {})) {
    const { validThrough, expires, next, ...current } = tier;
    const cutoff = validThrough ?? expires;
    const label = { ...conditions, serviceTier: name };
    sections.push([
      'service:' + name,
      current,
      cutoff ? { ...label, validThrough: cutoff } : label,
    ]);
    if (next) {
      const when = { ...label, priceState: 'announced' };
      if (cutoff) when.effectiveAfter = cutoff;
      sections.push(['service:' + name + ':next', next, when]);
    }
  }
  const supplementalRates = sections.flatMap(([id, sheet, when]) => {
    const rows = costRows(sheet, id, sourceCurrency, sourceUnit, when).map((row) => ({
      ...row,
      unit: source.otherTierUnits?.[row.usageKey] ?? row.unit,
    }));
    if (id !== 'raw') return rows;
    return rows.filter(
      ({ usageKey, amount, unit }) =>
        !(source.fees ?? []).some(
          (fee) => fee.name === usageKey && fee.amount === amount && fee.unit === unit,
        ),
    );
  });
  const reviewedPrices = [
    ...costRows(source.cost, 'cost', sourceCurrency, sourceUnit, conditions),
    ...chargedFees(
      source.fees,
      'fees',
      source.raw?.expires ? { ...conditions, validThrough: source.raw.expires } : conditions,
    ),
    ...chargedFees(source.tools, 'tools', conditions),
    ...supplementalRates,
  ];
  if (reviewedPrices.length) return reviewedPrices;
  if (Array.isArray(sourcePrice))
    return rateRows(sourcePrice, sourceCurrency, sourceUnit, conditions);
  if (source.rawFees) return rawRows(sourcePrice, sourceCurrency, conditions);
  const result = costRows(
    source.candidateCost ?? sourcePrice,
    source.candidateCost ? 'candidate-cost' : 'cost',
    sourceCurrency,
    sourceUnit,
    conditions,
  );
  if (!quote.originalQuote) result.push(...explicitChargesInConditions(conditions, sourceCurrency));
  if (quote.originalCurrencyEligible === false) {
    for (const row of result) Object.assign(row, { cnyAmount: null, cnyCurrency: null });
  }
  return result;
}

export function expectedPricingSummary(quote, status, hasQuotes) {
  if (!quote) return { kind: hasQuotes ? 'reference-only' : 'unavailable', status };

  const identity = { quoteId: quote.quoteId, currency: 'CNY' };
  const source = quote.originalQuote;
  if (source?.kind === 'task') {
    const chargesByUnit = new Map();
    for (const tier of source.task.tiers) {
      for (const charge of tier.charges) {
        if (!charge.unit) continue;
        if (!chargesByUnit.has(charge.unit)) chargesByUnit.set(charge.unit, []);
        chargesByUnit.get(charge.unit).push({ charge, when: tier.when });
      }
    }
    const units = [...chargesByUnit.keys()].sort();
    const primaryUnit = source.display?.primaryUnit;
    if (!primaryUnit && units.length > 1)
      return { kind: 'multiple-units', messageKey: 'multiple-billing-units', units };
    const unit = primaryUnit ?? units[0];
    const charges = chargesByUnit.get(unit);
    if (!charges)
      return {
        kind: 'invalid-primary-unit',
        messageKey: 'invalid-primary-billing-unit',
        primaryUnit: unit,
        units,
      };

    const amounts = charges
      .map(({ charge }) => cny(charge.amount, charge.currency))
      .filter(Number.isFinite);
    const resolutions = [
      ...new Set(
        charges
          .map(({ when }) => when?.resolution ?? source.conditions?.resolution)
          .filter(Boolean),
      ),
    ];
    const conditional = charges.some(
      ({ charge, when }) => Object.keys(when ?? {}).length || charge.freeQuantity !== undefined,
    );
    return {
      kind: 'range',
      ...identity,
      unit,
      minimum: Math.min(...amounts),
      maximum: Math.max(...amounts),
      ...(resolutions.length ? { resolutions } : {}),
      hasAdditionalUnits: units.length > 1,
      hasMoreConditions:
        units.length > 1 || Boolean(conditional || Object.keys(source.conditions ?? {}).length),
    };
  }
  const cost = source?.cost ?? quote.sourcePrice;
  const unit = quote.sourceUnit;
  if (Number.isFinite(cost?.per_image))
    return {
      kind: 'fixed',
      ...identity,
      unit,
      amount: cny(cost.per_image, quote.sourceCurrency),
      hasMoreConditions: Boolean(source?.conditions),
    };
  const hasTiers = (cost?.tiers?.length ?? 0) > 0;
  return {
    kind: hasTiers ? 'token-tiers' : 'single-token',
    ...identity,
    unit,
    input: cny(cost?.input, quote.sourceCurrency),
    output: cny(cost?.output, quote.sourceCurrency),
    hasTiers,
    hasMoreConditions: hasTiers || Object.keys(source?.conditions ?? {}).length > 0,
  };
}

export function expectedPricingCategories(records, selected, status, upstream) {
  const categories = new Set();
  if (['not-offered', 'deprecated', 'withdrawn', 'deferred'].includes(status))
    categories.add(status);
  if (status === 'excluded') categories.add('scope-excluded');
  if (!selected) categories.add('no-current-price');
  const lists = new Set();
  const endpoints = new Set();
  function keysIn(value) {
    if (!value || typeof value !== 'object') return [];
    return [...Object.keys(value), ...Object.values(value).flatMap(keysIn)];
  }
  for (const { source, normalized, sourceType, providerId, modelId } of records) {
    const quote = normalized ?? {
      originalQuote: source,
      sourcePrice:
        source.cost ??
        source.candidateCost ??
        source.fees ??
        source.rawFees ??
        source.raw ??
        source.tools,
      sourceCurrency: source.currency,
      sourceUnit: source.unit ?? source.rawFees?.unit,
    };
    if (!normalized?.selected) categories.add('reference-only');
    const endpoint =
      normalized?.endpoint ??
      source.endpoint ??
      (sourceType === 'reviewed-reference' && upstream[providerId]?.models?.[modelId]
        ? upstream[providerId].api
        : null);
    if (endpoint) endpoints.add(endpoint);
    const original = quote.originalQuote;
    const listName =
      normalized?.priceList ??
      source.priceList ??
      (modelId === 'doubao-seedance-2-5-260628' && providerId === 'volcengine'
        ? 'Volcengine Ark / mainland / online'
        : '');
    const prefix = (original?.officialServiceTier ?? listName).match(/^[a-z]+/i)?.[0].toLowerCase();
    if (['standard', 'batch', 'flex', 'fast', 'ultrafast', 'priority'].includes(prefix))
      lists.add(prefix);
    if (original?.otherPaidTiers && Object.keys(original.otherPaidTiers).length)
      categories.add('multi-service-tier');
    if (
      original?.officialRegion ||
      original?.region ||
      ['inference_geo', '/ global', 'mainland', 'singapore', 'cn-beijing'].some((label) =>
        listName.toLowerCase().includes(label),
      )
    )
      categories.add('multi-region-endpoint');
    const fields = keysIn(quote.sourcePrice);
    if (fields.includes('tiers') || keysIn(original?.rawFees?.tokenFees).includes('tiers'))
      categories.add('token-tiers');
    if (
      original?.cache ||
      fields.some(
        (key) =>
          key.startsWith('cache') ||
          key.includes('cache_') ||
          key.includes('Ttl') ||
          key.includes('TTL'),
      )
    )
      categories.add('cache-and-ttl');
    if (normalized?.outputKind === 'task-model' || original?.task) {
      categories.add('task-conditions');
      categories.add('multimedia-usage');
    }
    const quoteStatus =
      normalized?.status ??
      (modelId === 'doubao-seedance-2-5-260628' && providerId === 'volcengine'
        ? 'validation-held'
        : (source.status ?? 'reference-only'));
    if (['pending-effective', 'withdrawn', 'deferred'].includes(quoteStatus))
      categories.add(quoteStatus);
    for (const { usageKey, unit } of expectedDisplayRows(quote)) {
      const mediaUnit = [
        'per_second',
        'per_count',
        'per_minute',
        'per_image',
        'per_song',
        'per_10k_chars',
        'additional_image_output_tokens_per_partial_image',
        'CNY/million_billable_video_tokens',
        'CNY/image',
      ].includes(unit);
      const [meter, modality] = usageKey.split('_').slice(-2);
      const mediaToken =
        ['image', 'video', 'audio'].includes(modality) &&
        ['input', 'output', 'read'].includes(meter);
      if (
        mediaUnit ||
        mediaToken ||
        ['inputAudio', 'cacheHitAudio', 'videoInput', 'audioCacheRead'].includes(usageKey)
      )
        categories.add('multimedia-usage');
    }
  }
  if (lists.size > 1) categories.add('multi-service-tier');
  if (endpoints.size > 1) categories.add('multi-region-endpoint');
  if (
    selected?.outputKind === 'model' &&
    selected.sourceUnit === 'per_million_tokens' &&
    !categories.has('token-tiers') &&
    expectedDisplayRows(selected).some(({ unit }) => unit === 'per_million_tokens')
  )
    categories.add('single-token');
  return [...categories].sort();
}
