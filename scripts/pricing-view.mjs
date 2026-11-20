import {
  CNY_POLICY,
  canonical,
  convertPrice,
  generateCny,
  hash,
} from '../.cache/cny-build/cny/generate.js';
import { adaptPrice, domesticProviders } from './upstream-cny.mjs';

const identity = (providerId, modelId) => JSON.stringify([providerId, modelId]);
const officialSourceId = (record) => 'official-record:' + record.id;
const referenceSourceId = (record) => 'reviewed-reference:' + (record.id ?? hash(record));
const referenceQuoteId = (record) => referenceSourceId(record);
const reviewedProvider = (record) =>
  record.provider ?? (record.officialModel === 'doubao-seedance-2-5-260628' ? 'volcengine' : null);

function toCnyAmount(amount, currency) {
  if (typeof amount !== 'number' || !CNY_POLICY[currency]) return null;
  return amount * CNY_POLICY[currency];
}

function displayRow(rowId, usageKey, amount, currency, unit, conditions, tier) {
  return {
    rowId,
    usageKey,
    amount,
    currency: currency ?? null,
    unit: unit ?? null,
    cnyAmount: toCnyAmount(amount, currency),
    cnyCurrency: CNY_POLICY[currency] ? 'CNY' : null,
    conditions: conditions ?? {},
    ...(tier ? { tier } : {}),
  };
}

function costDisplayRows(cost, unit, currency, conditions, prefix = 'cost') {
  const rows = [];
  for (const [key, amount] of Object.entries(cost ?? {}))
    if (typeof amount === 'number')
      rows.push(displayRow(prefix + ':' + key, key, amount, currency, unit, conditions));
  for (const [index, tier] of (cost?.tiers ?? []).entries())
    for (const [key, amount] of Object.entries(tier))
      if (typeof amount === 'number')
        rows.push(
          displayRow(
            prefix + ':tier-' + index + ':' + key,
            key,
            amount,
            currency,
            unit,
            { ...conditions, tier: tier.tier },
            tier.tier,
          ),
        );
  return rows;
}

function feeDisplayRows(fees, prefix) {
  return (fees ?? []).map((fee, index) =>
    displayRow(
      prefix + ':' + index + ':' + (fee.name ?? fee.key ?? fee.usageKey),
      fee.name ?? fee.key ?? fee.usageKey,
      fee.amount,
      fee.currency,
      fee.unit,
      {
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

function rawFeeArrayRows(values, unit, currency, conditions) {
  return values.flatMap((value, rowIndex) =>
    Object.entries(value).flatMap(([key, amount]) =>
      typeof amount === 'number'
        ? [
            displayRow('raw-fees:' + rowIndex + ':' + key, key, amount, currency, unit, {
              ...conditions,
              ...(value.condition ? { condition: value.condition } : {}),
            }),
          ]
        : [],
    ),
  );
}

function rawFeeObjectRows(raw, currency, conditions) {
  if (Array.isArray(raw.columns) && Array.isArray(raw.rows)) {
    return raw.rows.flatMap((values, rowIndex) => {
      const rowConditions = { ...conditions };
      for (const [index, column] of raw.columns.entries())
        if (typeof values[index] !== 'number') rowConditions[column] = values[index];
      for (const key of ['minimumUsage', 'draft', 'inputIntervals'])
        if (raw[key] !== undefined) rowConditions[key] = raw[key];
      return raw.columns.flatMap((column, columnIndex) =>
        typeof values[columnIndex] === 'number'
          ? [
              displayRow(
                'raw-fees:row-' + rowIndex + ':' + column,
                column,
                values[columnIndex],
                currency,
                raw.unit,
                rowConditions,
              ),
            ]
          : [],
      );
    });
  }
  const rows = [];
  if (raw.tokenFees)
    rows.push(
      ...costDisplayRows(raw.tokenFees, raw.tokenUnit, currency, conditions, 'raw-fees:token'),
    );
  for (const [key, amount] of Object.entries(raw)) {
    if (typeof amount !== 'number') continue;
    const storage = /storage/i.test(key);
    rows.push(
      displayRow(
        'raw-fees:' + key,
        key,
        amount,
        currency,
        storage ? (raw.storageUnit ?? raw.unit) : raw.unit,
        { ...conditions, ...(raw.rounding ? { rounding: raw.rounding } : {}) },
      ),
    );
  }
  return rows;
}

function displayRowsFor(quote) {
  const source = quote.originalQuote;
  const conditions = source?.conditions ?? quote.conditions ?? {};
  const currency = quote.sourceCurrency ?? source?.currency;
  const unit = quote.sourceUnit ?? source?.unit;
  if (source?.kind === 'task' || quote.outputKind === 'task-model')
    return taskDisplayRows(quote.sourcePrice, conditions);
  const rows = [];
  if (source?.cost) rows.push(...costDisplayRows(source.cost, unit, currency, conditions));
  if (source?.fees) rows.push(...feeDisplayRows(source.fees, 'fees'));
  if (source?.tools) rows.push(...feeDisplayRows(source.tools, 'tools'));
  if (rows.length) return rows;
  const value = quote.sourcePrice;
  if (Array.isArray(value)) return rawFeeArrayRows(value, unit, currency, conditions);
  if (source?.rawFees) return rawFeeObjectRows(value, currency, conditions);
  if (source?.candidateCost)
    return costDisplayRows(source.candidateCost, unit, currency, conditions, 'candidate-cost');
  return costDisplayRows(value, unit, currency, conditions);
}

function summaryFor(selectedQuote, status, groups) {
  if (!selectedQuote)
    return groups.length ? { kind: 'reference-only', status } : { kind: 'unavailable', status };
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

function quoteGroup(quote) {
  const displayQuote = structuredClone(quote);
  displayQuote.displayRows = displayRowsFor(quote);
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

function categoriesFor(status, quotes, selectedQuote) {
  const categories = new Set();
  if (['not-offered', 'deprecated', 'withdrawn', 'deferred', 'excluded'].includes(status))
    categories.add(status === 'excluded' ? 'scope-excluded' : status);
  if (!selectedQuote) categories.add('no-current-price');
  if (quotes.some((quote) => !quote.selected)) categories.add('reference-only');
  const tiers = new Set(quotes.map(serviceTier).filter(Boolean));
  if (tiers.size > 1) categories.add('multi-service-tier');
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
    const displayRows = quote.displayRows ?? displayRowsFor(quote);
    if (
      displayRows.some(
        (row) => row.unit && !['per_million_tokens', 'per-charge'].includes(row.unit),
      )
    )
      categories.add('multimedia-usage');
    for (const quoteStatus of ['pending-effective', 'withdrawn', 'deferred'])
      if (quote.status === quoteStatus) categories.add(quoteStatus);
  }
  if (selectedQuote && !categories.has('token-tiers') && selectedQuote.outputKind === 'model')
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
  if (selected && record.officialModel === 'doubao-seedance-2-5-260628' && value?.rows)
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
    priceList: record.priceList ?? 'Reviewed official reference',
    endpoint: record.endpoint ?? current.upstreamPrice?.endpoint ?? null,
    sourceCurrency: record.currency ?? null,
    sourcePrice,
    sourceUnit: record.unit ?? record.rawFees?.unit ?? null,
    source: { ...record.source, recordSha256: hash(record) },
    originalQuote: structuredClone(record),
    status:
      record.status ??
      (current.status === 'validation-held' ? 'validation-held' : 'reference-only'),
    reason: record.reason ?? 'reviewed-reference-only',
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
            .filter(
              (quote) =>
                quote &&
                quote.quoteId !== 'volcengine:doubao-seedance-2-5-260628:official-reference',
            )
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
      categories: categoriesFor(record.status, modelQuotes, selectedQuote),
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
  const byIdentity = new Map();
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
      byIdentity.set(identity(providerId, modelId), row);
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
    byIdentity,
    byQuoteId: new Map(rows.map((row) => [row.quoteId, row])),
    excludedProviderIds,
  };
}

function officialExpectations(official, policy, selection) {
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
      endpoint: source.endpoint ?? null,
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
                amount: toCnyAmount(charge.amount, charge.currency),
                currency: 'CNY',
              })),
            }))
          : undefined,
    });
  }
  return expectations;
}

function referenceExclusionReason(source, current, selectedQuote, policy) {
  const modelId = source.officialModel ?? source.model;
  if (!reviewedProvider(source) || !modelId) return 'source-record-identity-incomplete';
  if (!current) return 'model-not-in-current-catalog';
  if (policy.notOfferedModels?.includes(modelId)) return 'model-not-offered';
  const event = policy.lifecycle[modelId]?.at(-1);
  if (event?.state === 'withdrawn' && event.reason === 'model-deprecated')
    return 'model-deprecated';
  if (source.routedRawStandard) return 'routed-model-has-no-independent-price';
  if (!hasNumericPrice(referenceSourcePrice(source, selectedQuote)))
    return 'source-price-not-provided';
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
  const officialPrices = officialExpectations(official, policy, selection);
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
    const selectedQuote = model.selectedQuoteId
      ? (officialPrices.get(model.selectedQuoteId) ??
        upstreamPrices.byQuoteId.get(model.selectedQuoteId) ??
        model.upstreamPrice)
      : null;
    const expectedSummary = summaryFor(selectedQuote, model.status, view.groups ?? []);
    if (JSON.stringify(view.summary) !== JSON.stringify(expectedSummary))
      fail('summary-mismatch', 'Pricing summary differs from selected quote for ' + key, {
        providerId: model.providerId,
        modelId: model.modelId,
      });
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
          actualBySource.get(quote.sourceRecordId).push({ location, quote });
        }
      }
    }
    const coverageRow = displayModels.get(key);
    if (
      coverageRow &&
      JSON.stringify([...(coverageRow.quoteIds ?? [])].sort()) !== JSON.stringify(quoteIds.sort())
    )
      fail('coverage-view-quote-mismatch', 'Coverage quote IDs differ from view for ' + key, {
        providerId: model.providerId,
        modelId: model.modelId,
      });
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
    const selectedQuote = current?.selectedQuoteId
      ? (officialPrices.get(current.selectedQuoteId) ??
        upstreamPrices.byQuoteId.get(current.selectedQuoteId) ??
        null)
      : null;
    expectedSources.push({
      source,
      sourceType: 'reviewed-reference',
      sourceRecordId: referenceSourceId(source),
      providerId,
      modelId,
      current,
      selectedQuote,
      reason: referenceExclusionReason(source, current, selectedQuote, policy),
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
      const actual = actualEntries[0].quote;
      const expectedPrice = normalized
        ? normalized.sourcePrice
        : referenceSourcePrice(source, selectedQuote);
      const expectedConditions = normalized
        ? (normalized.originalQuote?.conditions ?? normalized.conditions ?? null)
        : (source.conditions ?? null);
      const expectedStatus = normalized
        ? normalized.status
        : (source.status ??
          (modelId === 'doubao-seedance-2-5-260628' && !selection[modelId]
            ? 'validation-held'
            : 'reference-only'));
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
      const expectedDisplayQuote = normalized ?? {
        ...actual,
        originalQuote: source,
        sourcePrice: expectedPrice,
        sourceCurrency: source.currency ?? null,
        sourceUnit: source.unit ?? source.rawFees?.unit ?? null,
        cnyCost: expectedCny ?? undefined,
      };
      fields.push([
        'displayRows',
        displayRowsFor(expectedDisplayQuote),
        actual.displayRows ?? null,
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
