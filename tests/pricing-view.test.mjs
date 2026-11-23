import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { reconcileDisplayCoverage } from '../scripts/pricing-view.mjs';

function buildCandidate(t, editOfficial) {
  const directory = mkdtempSync(join(tmpdir(), 'pricing-view-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'candidate');
  const args = [];
  if (editOfficial) {
    const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
    editOfficial(official);
    const path = join(directory, 'official.json');
    writeFileSync(path, JSON.stringify(official));
    args.push('data/cny/unified-policy.json', path);
  }
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', output, ...args], {
    encoding: 'utf8',
  });
  const read = (name) => JSON.parse(readFileSync(join(output, name), 'utf8'));
  read.bytes = (name) => readFileSync(join(output, name));
  return read;
}

function rawReconciliationInputs() {
  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json', 'utf8'));
  return {
    official: JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8')),
    policy,
    selection: JSON.parse(readFileSync('data/cny/proposed-selection.json', 'utf8')).selection,
    upstream: JSON.parse(readFileSync(join(policy.upstreamDirectory, 'en.json'), 'utf8')),
    source: JSON.parse(readFileSync(join(policy.upstreamDirectory, 'source.json'), 'utf8')),
  };
}

const localizedCatalogs = (read) => ({
  en: read('api/all.json'),
  zh: read('api/i18n/zh/all.json'),
  ja: read('api/i18n/ja/all.json'),
});

const modelQuotes = (catalog, provider, model) =>
  catalog[provider].models[model].pricing_view.groups.flatMap(({ quotes }) => quotes);

test('reviewed Flex references retain exact source content and an exact display location', (t) => {
  const read = buildCandidate(t);
  const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
  const source = official.excludedQuotes.find(
    (quote) =>
      quote.provider === 'openai' &&
      quote.officialModel === 'gpt-6.1-sol' &&
      quote.priceList === 'Flex',
  );
  const view = read('api/all.json').openai.models['gpt-6.1-sol'].pricing_view;
  const ledger = read('display-coverage.json').sourceRecords.find(
    (record) =>
      record.sourceType === 'reviewed-reference' &&
      record.providerId === 'openai' &&
      record.modelId === 'gpt-6.1-sol' &&
      record.sourcePriceList === 'Flex',
  );
  assert.ok(ledger);
  assert.equal(ledger.disposition, 'displayed');
  assert.equal(ledger.locations.length, 1);
  const [location] = ledger.locations;
  assert.deepEqual(
    { providerId: location.providerId, modelId: location.modelId },
    { providerId: 'openai', modelId: 'gpt-6.1-sol' },
  );
  const group = view.groups.find(({ groupId }) => groupId === location.groupId);
  const quote = group?.quotes.find(({ quoteId }) => quoteId === location.quoteId);
  assert.ok(quote);
  assert.equal(quote.quoteId, location.quoteId);
  assert.deepEqual(quote.sourcePrice, source.cost);
  assert.equal(quote.sourceCurrency, 'USD');
  assert.equal(quote.sourceUnit, 'per_million_tokens');
  assert.deepEqual(quote.cnyCost, {
    input: 7,
    output: 35,
    cache_read: 0.35,
    cache_write: 8.75,
    cache_write_12h: 17.5,
    tiers: [
      {
        tier: { size: 272000, type: 'input' },
        input: 14,
        output: 52.5,
        cache_read: 0.7,
        cache_write: 17.5,
        cache_write_12h: 35,
      },
    ],
    currency: 'CNY',
  });
  assert.equal(quote.selected, false);
  assert.equal(quote.syncable, false);
  assert.equal(quote.status, 'reference-only');
  assert.deepEqual(quote.originalQuote, source);
  const standard = view.groups
    .flatMap(({ quotes }) => quotes)
    .find(({ quoteId }) => quoteId === 'us-openai-gpt-6.1-sol-standard');
  assert.equal(standard.selected, true);
  assert.equal(standard.sourcePrice.input, 2);
  assert.equal(standard.cnyCost.input, 14);
});

test('source-driven reconciliation rejects an omitted Flex group even when coverage omits it too', (t) => {
  const read = buildCandidate(t);
  const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json', 'utf8'));
  const displayCoverage = read('display-coverage.json');
  assert.ok(displayCoverage.stats.comparedFields > 0);
  assert.ok(
    displayCoverage.sourceRecords
      .filter(({ disposition }) => disposition === 'displayed')
      .every(({ comparisons }) =>
        ['sourcePrice', 'sourceCurrency', 'sourceUnit', 'conditions', 'status'].every((field) =>
          comparisons.some((row) => row.field === field && row.status === 'match'),
        ),
      ),
  );
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const input = {
    ...rawReconciliationInputs(),
    coverage: read('coverage.json'),
    displayCoverage,
    catalogs,
  };
  const positive = reconcileDisplayCoverage(input);
  assert.equal(positive.status, 'passed', JSON.stringify(positive.failures));
  assert.equal(
    positive.sourceRecords.length,
    official.records.length +
      official.excludedQuotes.length +
      official.optionalToolFees.length +
      input.coverage.models.filter(({ upstreamPrice }) => upstreamPrice).length,
  );

  const flexLedger = displayCoverage.sourceRecords.find(
    (record) =>
      record.sourceType === 'reviewed-reference' &&
      record.providerId === 'openai' &&
      record.modelId === 'gpt-6.1-sol' &&
      record.sourcePriceList === 'Flex',
  );
  const flexQuoteId = flexLedger.locations[0].quoteId;
  for (const catalog of Object.values(catalogs)) {
    const view = catalog.openai.models['gpt-6.1-sol'].pricing_view;
    view.groups = view.groups.filter(({ quotes }) =>
      quotes.every(({ quoteId }) => quoteId !== flexQuoteId),
    );
  }
  const model = displayCoverage.models.find(
    ({ providerId, modelId }) => providerId === 'openai' && modelId === 'gpt-6.1-sol',
  );
  model.quoteIds = model.quoteIds.filter((quoteId) => quoteId !== flexQuoteId);
  model.groups = model.groups.filter(({ quoteIds }) => !quoteIds.includes(flexQuoteId));
  displayCoverage.sourceRecords = displayCoverage.sourceRecords.filter(
    ({ sourceRecordId }) => sourceRecordId !== flexLedger.sourceRecordId,
  );
  const negative = reconcileDisplayCoverage(input);
  assert.equal(negative.status, 'failed');
  assert.ok(
    negative.failures.some(
      ({ code, sourceRecordId }) =>
        code === 'missing-source-record' && sourceRecordId === flexLedger.sourceRecordId,
    ),
    JSON.stringify(negative.failures),
  );
});

test('source-driven reconciliation rejects a wrong Flex cache-write amount with unchanged coverage and billing', (t) => {
  const read = buildCandidate(t);
  const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json', 'utf8'));
  const displayCoverage = read('display-coverage.json');
  const coverage = read('coverage.json');
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const nativeBytes = JSON.stringify(read('api/newapi/ratio_config.json'));
  const coverageBytes = JSON.stringify(displayCoverage);
  const flexLedger = displayCoverage.sourceRecords.find(
    (record) =>
      record.sourceType === 'reviewed-reference' &&
      record.providerId === 'openai' &&
      record.modelId === 'gpt-6.1-sol' &&
      record.sourcePriceList === 'Flex',
  );
  const { quoteId } = flexLedger.locations[0];
  for (const catalog of Object.values(catalogs)) {
    const quote = catalog.openai.models['gpt-6.1-sol'].pricing_view.groups
      .flatMap(({ quotes }) => quotes)
      .find((row) => row.quoteId === quoteId);
    quote.sourcePrice.cache_write = 9.99;
  }
  const negative = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage,
    displayCoverage,
    catalogs,
  });
  assert.equal(negative.status, 'failed');
  assert.ok(
    negative.failures.some(
      (failure) =>
        failure.code === 'content-mismatch' &&
        failure.quoteId === quoteId &&
        failure.field === 'sourcePrice',
    ),
    JSON.stringify(negative.failures),
  );
  const comparison = negative.sourceRecords
    .find(({ sourceRecordId }) => sourceRecordId === flexLedger.sourceRecordId)
    .comparisons.find(({ field }) => field === 'sourcePrice');
  assert.equal(comparison.status, 'mismatch');
  assert.equal(comparison.expected.cache_write, 1.25);
  assert.equal(comparison.actual.cache_write, 9.99);
  assert.equal(JSON.stringify(displayCoverage), coverageBytes);
  assert.equal(JSON.stringify(read('api/newapi/ratio_config.json')), nativeBytes);
});

test('reconciliation derives official expectations from raw records under lockstep artifact mutations', (t) => {
  const read = buildCandidate(t);
  const coverage = read('coverage.json');
  const displayCoverage = read('display-coverage.json');
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const quoteId = 'us-openai-gpt-6.1-sol-standard';
  coverage.quotes.find((quote) => quote.quoteId === quoteId).sourcePrice.input = 999;
  coverage.quotes.find((quote) => quote.quoteId === quoteId).cnyCost.input = 6993;
  for (const catalog of Object.values(catalogs)) {
    const quote = catalog.openai.models['gpt-6.1-sol'].pricing_view.groups
      .flatMap(({ quotes }) => quotes)
      .find((row) => row.quoteId === quoteId);
    quote.sourcePrice.input = 999;
    quote.cnyCost.input = 6993;
  }
  const negative = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage,
    displayCoverage,
    catalogs,
  });
  assert.equal(negative.status, 'failed');
  for (const field of ['sourcePrice', 'cnyPrice'])
    assert.ok(
      negative.failures.some(
        (failure) =>
          failure.code === 'content-mismatch' &&
          failure.quoteId === quoteId &&
          failure.field === field,
      ),
      field,
    );
  const ledger = negative.sourceRecords.find(
    ({ sourceRecordId }) => sourceRecordId === 'official-record:' + quoteId,
  );
  assert.equal(ledger.comparisons.find(({ field }) => field === 'sourcePrice').expected.input, 2);
});

test('reconciliation rejects an omitted official group even when artifacts mark it non-displayed', (t) => {
  const read = buildCandidate(t);
  const coverage = read('coverage.json');
  const displayCoverage = read('display-coverage.json');
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const quoteId = 'us-openai-gpt-6.1-sol-standard';
  const sourceRecordId = 'official-record:' + quoteId;
  coverage.quotes = coverage.quotes.filter((quote) => quote.quoteId !== quoteId);
  for (const catalog of Object.values(catalogs)) {
    const view = catalog.openai.models['gpt-6.1-sol'].pricing_view;
    view.groups = view.groups.filter(({ quotes }) =>
      quotes.every((quote) => quote.quoteId !== quoteId),
    );
  }
  const model = displayCoverage.models.find(
    ({ providerId, modelId }) => providerId === 'openai' && modelId === 'gpt-6.1-sol',
  );
  model.quoteIds = model.quoteIds.filter((id) => id !== quoteId);
  model.groups = model.groups.filter(({ quoteIds }) => !quoteIds.includes(quoteId));
  const ledger = displayCoverage.sourceRecords.find(
    (record) => record.sourceRecordId === sourceRecordId,
  );
  ledger.disposition = 'not-displayed';
  ledger.locations = [];
  ledger.notDisplayedReason = 'source-record-not-in-display-catalog';
  ledger.comparisons = [];
  const negative = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage,
    displayCoverage,
    catalogs,
  });
  assert.equal(negative.status, 'failed');
  assert.ok(
    negative.failures.some(
      ({ code, sourceRecordId: id }) => code === 'missing-candidate-quote' && id === sourceRecordId,
    ),
    JSON.stringify(negative.failures),
  );
  assert.ok(
    negative.failures.some(
      ({ code, sourceRecordId: id }) => code === 'missing-source-location' && id === sourceRecordId,
    ),
  );
});

test('reconciliation derives upstream expectations from the fixed raw snapshot under lockstep mutations', (t) => {
  const read = buildCandidate(t);
  const coverage = read('coverage.json');
  const displayCoverage = read('display-coverage.json');
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const model = coverage.models.find(
    ({ providerId, modelId }) => providerId === 'moonshotai-cn' && modelId === 'kimi-k2.6',
  );
  const quoteId = model.upstreamPrice.quoteId;
  model.upstreamPrice.sourcePrice.input = 999;
  model.upstreamPrice.cnyCost.input = 999;
  for (const catalog of Object.values(catalogs)) {
    const view = catalog['moonshotai-cn'].models['kimi-k2.6'].pricing_view;
    const quote = view.groups
      .flatMap(({ quotes }) => quotes)
      .find((row) => row.quoteId === quoteId);
    quote.sourcePrice.input = 999;
    quote.cnyCost.input = 999;
    quote.displayRows.find(({ usageKey, tier }) => usageKey === 'input' && !tier).amount = 999;
    quote.displayRows.find(({ usageKey, tier }) => usageKey === 'input' && !tier).cnyAmount = 999;
    view.summary.input = 999;
  }
  const negative = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage,
    displayCoverage,
    catalogs,
  });
  assert.equal(negative.status, 'failed');
  assert.ok(
    negative.failures.some(
      (failure) =>
        failure.code === 'content-mismatch' &&
        failure.quoteId === quoteId &&
        failure.field === 'sourcePrice',
    ),
    JSON.stringify(negative.failures),
  );
});

test('reconciliation detects omitted nested rows and consistently miscalculated summaries', (t) => {
  const read = buildCandidate(t);
  const input = {
    ...rawReconciliationInputs(),
    coverage: read('coverage.json'),
    displayCoverage: read('display-coverage.json'),
    catalogs: {
      en: read('api/all.json'),
      zh: read('api/i18n/zh/all.json'),
      ja: read('api/i18n/ja/all.json'),
    },
  };
  const billingHash = createHash('sha256')
    .update(read.bytes('api/newapi/ratio_config.json'))
    .digest('hex');
  const glmQuoteId = 'cn-zhipu-glm-4.7-standard';
  const seedanceModelId = 'doubao-seedance-2-5-260628';
  for (const catalog of Object.values(input.catalogs)) {
    const glm = catalog.zhipuai.models['glm-4.7'].pricing_view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ quoteId }) => quoteId === glmQuoteId);
    glm.displayRows = glm.displayRows.filter(
      ({ rowId }) => !rowId.startsWith('cost:short_output:'),
    );

    const seedance = catalog.volcengine.models[seedanceModelId].pricing_view;
    const selected = seedance.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ selected }) => selected);
    for (const row of selected.displayRows) {
      row.amount += 100;
      row.cnyAmount += 100;
    }
    seedance.summary.minimum += 100;
    seedance.summary.maximum += 100;
  }
  const result = reconcileDisplayCoverage(input);
  assert.equal(result.status, 'failed');
  assert.ok(
    result.failures.some(({ field, quoteId }) => field === 'displayRows' && quoteId === glmQuoteId),
  );
  assert.ok(
    result.failures.some(
      ({ code, modelId }) => code === 'summary-mismatch' && modelId === seedanceModelId,
    ),
  );
  assert.ok(
    result.failures.some(
      ({ field, modelId }) => field === 'displayRows' && modelId === seedanceModelId,
    ),
  );
  assert.ok(!result.failures.some(({ code }) => code === 'locale-view-mismatch'));
  assert.equal(
    createHash('sha256').update(read.bytes('api/newapi/ratio_config.json')).digest('hex'),
    billingHash,
  );
});

test('token, task, media, and generic reference quotes expose structured display rows', (t) => {
  const read = buildCandidate(t);
  const catalog = read('api/all.json');
  const quotesFor = (provider, model) =>
    catalog[provider].models[model].pricing_view.groups.flatMap(({ quotes }) => quotes);
  const flex = quotesFor('openai', 'gpt-6.1-sol').find(
    ({ originalQuote }) => originalQuote?.priceList === 'Flex',
  );
  const flexCacheWrite = flex.displayRows.find(
    ({ usageKey, tier }) => usageKey === 'cache_write' && !tier,
  );
  assert.deepEqual(
    {
      amount: flexCacheWrite.amount,
      currency: flexCacheWrite.currency,
      unit: flexCacheWrite.unit,
      cnyAmount: flexCacheWrite.cnyAmount,
    },
    { amount: 1.25, currency: 'USD', unit: 'per_million_tokens', cnyAmount: 8.75 },
  );
  assert.ok(flex.displayRows.some(({ tier }) => tier?.size === 272000));

  const seedance = quotesFor('volcengine', 'doubao-seedance-2-5-260628');
  const selected = seedance.find(({ selected }) => selected);
  assert.equal(selected.displayRows.length, 6);
  assert.ok(selected.displayRows.every(({ unit }) => unit === 'per_million_tokens'));
  const reference4k = seedance.find(({ outputKind }) => outputKind === 'model-reference');
  assert.deepEqual(
    reference4k.displayRows.map(({ amount, conditions }) => [amount, conditions.resolution]),
    [
      [31, '4K'],
      [19, '4K'],
    ],
  );
  assert.match(reference4k.originalQuote.rawFees.minimumUsage, /successful video tasks/);
  assert.match(reference4k.originalQuote.rawFees.draft, /separately charged/);

  const gemini = quotesFor('google', 'gemini-3.8-flash').find(
    ({ outputKind }) => outputKind === 'model-reference',
  );
  const storage = gemini.displayRows.find(({ usageKey }) => usageKey === 'storage');
  assert.deepEqual(
    { amount: storage.amount, unit: storage.unit, cnyAmount: storage.cnyAmount },
    { amount: 0.5, unit: 'per_million_token_hours', cnyAmount: 3.5 },
  );
  const search = gemini.displayRows.find(({ usageKey }) => usageKey === 'Google Search');
  assert.equal(search.unit, 'per_thousand_search_queries');
  assert.match(search.conditions.condition, /First5000/);

  const deepseek = quotesFor('deepseek', 'deepseek-v4-pro').find(
    ({ outputKind }) => outputKind === 'model-reference',
  );
  const offPeak = deepseek.displayRows.find(
    ({ usageKey, conditions }) => usageKey === 'input' && conditions.condition === 'off-peak',
  );
  assert.equal(offPeak.amount, 4.5);
  assert.equal(offPeak.cnyAmount, 4.5);
  assert.equal(deepseek.conditions.timezone, 'Asia/Shanghai');
});

test('fixed reviewed references retain scheduled rates, explicit applicability and source identity', (t) => {
  const read = buildCandidate(t);
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const view = (catalog, provider, model) => catalog[provider].models[model].pricing_view;
  const references = (catalog, provider, model) =>
    view(catalog, provider, model)
      .groups.flatMap(({ quotes }) => quotes)
      .filter(({ outputKind }) => outputKind === 'model-reference');
  const gemini = references(catalogs.en, 'google', 'gemini-3.8-flash')[0];
  const byId = new Map(gemini.displayRows.map((row) => [row.rowId, row]));
  assert.equal(byId.get('fees:0:input').conditions.validThrough, '2026-12-31');
  assert.deepEqual(byId.get('raw:next:storage'), {
    rowId: 'raw:next:storage',
    usageKey: 'storage',
    amount: 1,
    currency: 'USD',
    unit: 'per_million_token_hours',
    cnyAmount: 7,
    cnyCurrency: 'CNY',
    conditions: { effectiveAfter: '2026-12-31', priceState: 'announced' },
  });
  assert.equal(byId.get('service:Batch:input').amount, 0.375);
  assert.equal(byId.get('service:Flex:next:input').conditions.serviceTier, 'Flex');
  assert.equal(byId.get('service:Priority:output').amount, 6.75);

  const minimax = references(catalogs.en, 'minimax-cn', 'MiniMax-M3')[0];
  assert.match(minimax.displayRows[0].conditions.officialCondition, /defaults standard/);
  assert.ok(!Object.hasOwn(minimax.displayRows[0].conditions, '0'));
  const volces = references(catalogs.en, 'volcengine', 'doubao-seed-2-0-lite-260428')[0];
  const storage = volces.displayRows.find(({ usageKey }) => usageKey === 'explicitCacheStorage');
  assert.equal(storage.amount, 0.017);
  assert.equal(storage.unit, 'CNY/million_token_hours');
  assert.equal(volces.displayRows[0].conditions.inputInterval, '[0,32000]');
  const held = references(catalogs.en, 'volcengine', 'doubao-seedance-2-5-260628')[0];
  assert.equal(held.status, 'validation-held');
  assert.equal(held.verification.actual4kBillingVerified, false);

  const coverage = read('coverage.json');
  const displayCoverage = read('display-coverage.json');
  const imageId = 'image-01-live';
  const imageIn = (models) =>
    models.find(({ providerId, modelId }) => providerId === 'minimax-cn' && modelId === imageId);
  const imageCoverage = imageIn(displayCoverage.models);
  imageCoverage.selectedQuoteId = null;
  imageCoverage.categories = ['single-token'];
  imageCoverage.groups[0].groupId = 'bogus';
  imageIn(coverage.models).selectedQuoteId = null;
  const deepseek = displayCoverage.models.find(
    ({ providerId, modelId }) => providerId === 'deepseek' && modelId === 'deepseek-v4-pro',
  );
  assert.ok(!deepseek.categories.includes('multimedia-usage'));
  for (const catalog of Object.values(catalogs)) {
    const openai = view(catalog, 'openai', 'gpt-6.1-sol');
    const group = openai.groups.find(({ priceList }) => priceList === 'Flex');
    group.priceList = group.quotes[0].priceList = 'Batch';
    group.endpoint = group.quotes[0].endpoint = 'unreviewed endpoint';

    const google = references(catalog, 'google', 'gemini-3.8-flash')[0];
    google.displayRows = google.displayRows.filter(
      ({ conditions }) => conditions.priceState === undefined,
    );
    const seedance = references(catalog, 'volcengine', 'doubao-seedance-2-5-260628')[0];
    delete seedance.verification;

    const image = view(catalog, 'minimax-cn', imageId);
    image.selectedQuoteId = null;
    image.summary = { kind: 'reference-only', status: image.status };
  }
  const negative = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage,
    displayCoverage,
    catalogs,
  });
  assert.equal(negative.status, 'failed');
  for (const [modelId, field] of [
    ['gpt-6.1-sol', 'quoteIdentity'],
    ['gpt-6.1-sol', 'groupIdentity'],
    ['gemini-3.8-flash', 'displayRows'],
    ['doubao-seedance-2-5-260628', 'verification'],
  ]) {
    assert.ok(
      negative.failures.some((row) => row.modelId === modelId && row.field === field),
      modelId + ' ' + field,
    );
  }
  for (const code of [
    'model-selection-mismatch',
    'model-category-mismatch',
    'coverage-view-group-mismatch',
    'summary-mismatch',
  ])
    assert.ok(
      negative.failures.some((row) => row.modelId === imageId && row.code === code),
      code,
    );
});

test('mixed-meter references preserve each unit and upstream domestic estimates have no CNY basis', (t) => {
  const read = buildCandidate(t);
  const getView = (catalog, provider, model) => catalog[provider].models[model].pricing_view;
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const getUpstream = (view) =>
    view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ sourceRecordId }) => sourceRecordId.startsWith('upstream:'));
  const voxtral = getUpstream(getView(catalogs.en, 'mistral', 'voxtral-small-2507'));
  assert.deepEqual(
    voxtral.displayRows.map(({ usageKey, amount, unit }) => [usageKey, amount, unit]),
    [
      ['input', 0.1, 'per_million_tokens'],
      ['output', 0.4, 'per_million_tokens'],
      ['audioInput', 0.004, 'per_minute'],
      ['cachedAudioInput', 0.0004, 'per_minute'],
    ],
  );
  const live = getUpstream(getView(catalogs.en, 'google', 'gemini-3.1-flash-live-preview'));
  const video = live.displayRows.find(({ usageKey }) => usageKey === 'videoInput');
  assert.equal(video.unit, 'per_million_tokens');
  assert.equal(video.amount, 1);
  assert.equal(video.cnyAmount, 7);
  const qvq = getUpstream(getView(catalogs.en, 'alibaba-cn', 'qvq-max'));
  assert.equal(qvq.reason, 'missing-original-CNY');
  assert.deepEqual(
    qvq.displayRows.map(({ currency, cnyAmount }) => [currency, cnyAmount]),
    [
      ['USD', null],
      ['USD', null],
    ],
  );
  const coverage = read('coverage.json');
  const displayCoverage = read('display-coverage.json');
  for (const catalog of Object.values(catalogs)) {
    const qvq = getUpstream(getView(catalog, 'alibaba-cn', 'qvq-max'));
    qvq.displayRows[0].cnyAmount = 8.029;
    qvq.displayRows[0].cnyCurrency = 'CNY';
    const model = getView(catalog, 'minimax', 'image-01');
    model.status = 'ready';
    model.providerId = 'other-provider';
    const sol = getView(catalog, 'openai', 'gpt-6.1-sol');
    sol.groups.find(({ priceList }) => priceList === 'Flex').kind = 'status';
  }
  const solRow = displayCoverage.models.find(
    ({ providerId, modelId }) => providerId === 'openai' && modelId === 'gpt-6.1-sol',
  );
  solRow.categories = solRow.categories.filter((category) => category !== 'multi-service-tier');
  const negative = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage,
    displayCoverage,
    catalogs,
  });
  for (const [modelId, field] of [
    ['qvq-max', 'displayRows'],
    ['image-01', 'status'],
    ['image-01', 'providerId'],
    ['gpt-6.1-sol', 'groupKind'],
  ]) {
    assert.ok(
      negative.failures.some((row) => row.modelId === modelId && row.field === field),
      modelId + ' ' + field,
    );
  }
  assert.ok(
    negative.failures.some(
      ({ code, modelId }) => code === 'model-category-mismatch' && modelId === 'gpt-6.1-sol',
    ),
  );
});

test('summaries use only selected prices and never choose an arbitrary unit', (t) => {
  const read = buildCandidate(t);
  const catalog = read('api/all.json');
  const seedance = catalog.volcengine.models['doubao-seedance-2-5-260628'].pricing_view;
  assert.deepEqual(seedance.summary, {
    kind: 'range',
    quoteId: 'volcengine--doubao-seedance-2-5-260628--cn-beijing-task-online-original',
    currency: 'CNY',
    unit: 'per_million_tokens',
    minimum: 42,
    maximum: 77,
    resolutions: ['480p', '720p', '1080p'],
    hasAdditionalUnits: false,
    hasMoreConditions: true,
  });
  assert.ok(!JSON.stringify(seedance.summary).includes('4K'));

  const multiUnit = catalog['minimax-cn'].models['MiniMax-H3'].pricing_view.summary;
  assert.equal(multiUnit.kind, 'multiple-units');
  assert.equal(multiUnit.messageKey, 'multiple-billing-units');
  assert.deepEqual(multiUnit.units, ['per_count', 'per_second']);
  assert.equal(multiUnit.minimum, undefined);

  const single = Object.values(catalog)
    .flatMap((provider) => Object.values(provider.models))
    .find(
      (model) =>
        model.pricing_view?.selectedQuoteId &&
        model.pricing_view.groups.some(({ quotes }) =>
          quotes.some(
            (quote) => quote.selected && quote.outputKind === 'model' && !quote.sourcePrice?.tiers,
          ),
        ),
    );
  assert.ok(single);
  assert.equal(single.pricing_view.summary.kind, 'single-token');

  const unavailable = catalog.minimax.models['image-01'].pricing_view;
  assert.equal(unavailable.status, 'not-offered');
  assert.equal(unavailable.summary.kind, 'unavailable');
  assert.deepEqual(unavailable.groups, []);

  const primaryRead = buildCandidate(t, (official) => {
    official.records.find(({ id }) => id === 'cn-minimax-MiniMax-H3-video').display = {
      primaryUnit: 'per_second',
    };
  });
  const primary =
    primaryRead('api/all.json')['minimax-cn'].models['MiniMax-H3'].pricing_view.summary;
  assert.equal(primary.kind, 'range');
  assert.equal(primary.unit, 'per_second');
  assert.equal(primary.minimum, 0.5);
  assert.equal(primary.maximum, 0.8);
  assert.equal(primary.hasAdditionalUnits, true);
  assert.equal(primary.hasMoreConditions, true);
});

test('task summaries mark quote-wide charging conditions even with one unit and no tier predicate', (t) => {
  const read = buildCandidate(t);
  const catalog = read('api/all.json');
  for (const modelId of ['doubao-seedream-5-0-flash-260915', 'doubao-seedance-1-0-pro-250528']) {
    const view = catalog.volcengine.models[modelId].pricing_view;
    assert.ok(Object.keys(view.groups[0].quotes[0].originalQuote.conditions).length > 0);
    assert.equal(view.summary.hasMoreConditions, true, modelId);
  }
});

test('all nested and generic charge shapes are rows, while numeric metadata stays conditional', (t) => {
  const read = buildCandidate(t);
  const glm = read('api/all.json')
    .zhipuai.models['glm-4.7'].pricing_view.groups.flatMap(({ quotes }) => quotes)
    .find(({ quoteId }) => quoteId === 'cn-zhipu-glm-4.7-standard');
  const glmRows = new Map(glm.displayRows.map((row) => [row.rowId, row]));
  assert.equal(glmRows.get('cost:short_output:input').amount, 2);
  assert.equal(glmRows.get('cost:short_output:output').amount, 8);
  assert.equal(glmRows.get('cost:short_output:cache_read').amount, 0.4);
  assert.deepEqual(glmRows.get('cost:short_output:input').conditions.maxInput, 31999);
  assert.deepEqual(glmRows.get('cost:short_output:input').conditions.maxOutput, 199);
  assert.ok(!glm.displayRows.some(({ usageKey }) => ['maxInput', 'maxOutput'].includes(usageKey)));

  const fixtureRead = buildCandidate(t, (official) => {
    for (const [model, provider] of [
      ['doubao-seedream-5-0-pro-260628', 'volcengine'],
      ['ernie-5.1', 'qianfan'],
    ]) {
      const reference = official.excludedQuotes.find(
        ({ officialModel }) => officialModel === model,
      );
      reference.provider = provider;
      official.records.push({
        id: 'fixture-catalog-identity:' + model,
        provider,
        model,
        priceList: 'Fixture catalog identity',
        origin: 'domestic',
        currency: 'CNY',
        required: [],
        cost: {},
        source: reference.source,
      });
    }
  });
  const catalog = fixtureRead('api/all.json');
  const seedream = catalog.volcengine.models['doubao-seedream-5-0-pro-260628'].pricing_view.groups
    .flatMap(({ quotes }) => quotes)
    .find(({ outputKind }) => outputKind === 'model-reference');
  const seedreamRows = new Map(seedream.displayRows.map((row) => [row.rowId, row]));
  assert.equal(seedreamRows.get('raw-fees:singleImageOutput:0').amount, 0.3);
  assert.equal(seedreamRows.get('raw-fees:singleImageOutput:1').amount, 0.6);
  assert.equal(seedreamRows.get('raw-fees:layerDecompositionOutput:0').amount, 0.15);
  assert.equal(seedreamRows.get('raw-fees:layerDecompositionOutput:1').amount, 0.3);
  assert.equal(
    seedreamRows.get('raw-fees:input').sourceValue,
    'first image free, second onward0.02',
  );
  assert.equal(
    seedreamRows.get('raw-fees:singleImageOutput:0').conditions.outputPixelCutoff,
    2610000,
  );
  assert.ok(!seedream.displayRows.some(({ usageKey }) => usageKey === 'outputPixelCutoff'));

  const ernie = catalog.qianfan.models['ernie-5.1'].pricing_view.groups
    .flatMap(({ quotes }) => quotes)
    .find(({ outputKind }) => outputKind === 'model-reference');
  assert.deepEqual(
    ernie.displayRows.map(({ usageKey, amount, conditions }) => [
      usageKey,
      amount,
      conditions.officialCondition,
    ]),
    [
      ['input', 0.004, 'input<=32k'],
      ['output', 0.018, 'input<=32k'],
      ['input', 0.006, '32k<input<=128k'],
      ['output', 0.022, '32k<input<=128k'],
    ],
  );
  assert.ok(!ernie.displayRows.some(({ usageKey }) => usageKey === 'thresholdTokens'));
});

test('generic display amounts use candidate precision normalization', (t) => {
  const read = buildCandidate(t);
  const wan = read('api/all.json')
    .alibaba.models['wan3.0-video'].pricing_view.groups.flatMap(({ quotes }) => quotes)
    .find(({ sourceCurrency }) => sourceCurrency === 'USD');
  const row = wan.displayRows.find(({ amount }) => amount === 0.1);
  assert.equal(row.cnyAmount, 0.7);
});

test('selected per-image models are not categorized as single-token', (t) => {
  const read = buildCandidate(t);
  const row = read('display-coverage.json').models.find(
    ({ providerId, modelId }) => providerId === 'minimax-cn' && modelId === 'image-01-live',
  );
  assert.ok(row.selectedQuoteId);
  assert.deepEqual(
    row.categories.filter((category) => ['single-token', 'multimedia-usage'].includes(category)),
    ['multimedia-usage'],
  );
  const image = read('api/all.json')['minimax-cn'].models['image-01-live'].pricing_view;
  assert.deepEqual(image.summary, {
    kind: 'fixed',
    quoteId: row.selectedQuoteId,
    currency: 'CNY',
    unit: 'per_image',
    amount: 0.025,
    hasMoreConditions: false,
  });
  assert.ok(row.categories.includes('multimedia-usage'));
});

test('fixed reviewed rates declare mutually exclusive branches and reject lost applicability', (t) => {
  const read = buildCandidate(t);
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  for (const catalog of Object.values(catalogs)) {
    for (const id of ['glm-4.7', 'glm-4.5-air']) {
      const { pricing_view: view } = catalog.zhipuai.models[id];
      const quote = view.groups.flatMap(({ quotes }) => quotes).find(({ syncable }) => syncable);
      const rows = new Map(quote.displayRows.map((row) => [row.rowId, row]));
      for (const key of ['input', 'output', 'cache_read']) {
        assert.equal(rows.get('cost:' + key).conditions.minOutput, 200);
        const short = rows.get('cost:short_output:' + key).conditions;
        assert.deepEqual([short.maxInput, short.maxOutput], [31999, 199]);
        assert.equal(rows.get('cost:tier-0:' + key).tier.size, 31999);
        assert.equal(rows.get('cost:tier-0:' + key).conditions.minOutput, undefined);
      }
      delete rows.get('cost:input').conditions.minOutput;
    }
  }
  const result = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage: read('coverage.json'),
    displayCoverage: read('display-coverage.json'),
    catalogs,
  });
  for (const modelId of ['glm-4.7', 'glm-4.5-air'])
    assert.ok(
      result.failures.some(
        (failure) => failure.modelId === modelId && failure.field === 'displayRows',
      ),
    );
});

test('the reviewed input image equivalent is displayed and its omission fails reconciliation', (t) => {
  const read = buildCandidate(t);
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  let quoteId;
  for (const catalog of Object.values(catalogs)) {
    const { pricing_view: view } = catalog.google.models['gemini-3-pro-image'];
    const quote = view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ originalQuote }) => originalQuote?.inputImageEquivalent);
    quoteId = quote.quoteId;
    assert.equal(quote.syncable, false);
    assert.deepEqual(
      quote.displayRows.find(({ rowId }) => rowId === 'image-input-equivalent'),
      {
        rowId: 'image-input-equivalent',
        usageKey: 'image_input_equivalent',
        amount: 0.0011,
        currency: 'USD',
        unit: 'per_image',
        cnyAmount: 0.0077,
        cnyCurrency: 'CNY',
        conditions: { inputTokens: 560 },
        approximate: true,
      },
    );
    quote.displayRows = quote.displayRows.filter(({ rowId }) => rowId !== 'image-input-equivalent');
  }
  const result = reconcileDisplayCoverage({
    ...rawReconciliationInputs(),
    coverage: read('coverage.json'),
    displayCoverage: read('display-coverage.json'),
    catalogs,
  });
  assert.ok(
    result.failures.some(
      (failure) => failure.quoteId === quoteId && failure.field === 'displayRows',
    ),
  );
});

test('image equivalents supplement token tariffs that are supplied only by candidateCost', (t) => {
  const model = 'gemini-3-pro-image';
  const setup = (official) => {
    const source = official.excludedQuotes.find(({ officialModel }) => officialModel === model);
    delete source.fees;
    delete source.tools;
  };
  const read = buildCandidate(t, setup);
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  let quoteId;
  for (const catalog of Object.values(catalogs)) {
    const { pricing_view: view } = catalog.google.models[model];
    const quote = view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ originalQuote }) => originalQuote?.inputImageEquivalent);
    quoteId = quote.quoteId;
    const tokenRows = quote.displayRows.filter(({ unit }) => unit === 'per_million_tokens');
    assert.deepEqual(
      tokenRows.map(({ usageKey, amount, cnyAmount }) => [usageKey, amount, cnyAmount]),
      [
        ['input', 2, 14],
        ['input_image', 2, 14],
        ['output', 12, 84],
        ['output_image', 120, 840],
      ],
    );
    assert.deepEqual(
      quote.displayRows.filter(({ unit }) => unit === 'per_image').map(({ amount }) => amount),
      [0.0011, 0.134, 0.24],
    );
    quote.displayRows = quote.displayRows.filter(({ unit }) => unit !== 'per_million_tokens');
  }
  const inputs = rawReconciliationInputs();
  setup(inputs.official);
  const result = reconcileDisplayCoverage({
    ...inputs,
    coverage: read('coverage.json'),
    displayCoverage: read('display-coverage.json'),
    catalogs,
  });
  assert.ok(
    result.failures.some(
      (failure) => failure.quoteId === quoteId && failure.field === 'displayRows',
    ),
  );
});

test('candidateCost completes partially itemized Gemini rates in every locale', (t) => {
  const model = 'gemini-3-pro-image';
  const setup = (official) => {
    const source = official.excludedQuotes.find(({ officialModel }) => officialModel === model);
    source.fees = source.fees.filter(({ name }) => name !== 'output_image');
  };
  const read = buildCandidate(t, setup);
  const catalogs = {
    en: read('api/all.json'),
    zh: read('api/i18n/zh/all.json'),
    ja: read('api/i18n/ja/all.json'),
  };
  const quotes = Object.values(catalogs).map((catalog) =>
    catalog.google.models[model].pricing_view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ originalQuote }) => originalQuote?.inputImageEquivalent),
  );
  for (const { displayRows } of quotes) {
    assert.deepEqual(
      displayRows
        .filter(({ unit }) => unit === 'per_million_tokens')
        .map(({ rowId, usageKey, amount, currency, cnyAmount }) => [
          rowId,
          usageKey,
          amount,
          currency,
          cnyAmount,
        ]),
      [
        ['fees:0:input', 'input', 2, 'USD', 14],
        ['fees:1:input_image', 'input_image', 2, 'USD', 14],
        ['fees:2:output', 'output', 12, 'USD', 84],
        ['candidate-cost:output_image', 'output_image', 120, 'USD', 840],
      ],
    );
    assert.equal(displayRows.filter(({ approximate }) => approximate).length, 3);
    assert.equal(displayRows.filter(({ usageKey }) => usageKey === 'Google Search').length, 1);
  }

  const { quoteId, displayRows } = quotes[0];
  const inputs = rawReconciliationInputs();
  setup(inputs.official);
  const candidate = {
    ...inputs,
    coverage: read('coverage.json'),
    displayCoverage: read('display-coverage.json'),
    catalogs,
  };
  assert.equal(reconcileDisplayCoverage(candidate).status, 'passed');
  for (const { rowId } of displayRows) {
    // Simulate the same omission in all locales so only the source audit detects it.
    for (const quote of quotes)
      quote.displayRows = displayRows.filter((row) => row.rowId !== rowId);
    const result = reconcileDisplayCoverage(candidate);
    assert.ok(
      result.failures.some(
        (failure) => failure.quoteId === quoteId && failure.field === 'displayRows',
      ),
      `Expected an independent source mismatch after removing ${rowId}`,
    );
  }
});

test('candidateCost deduplicates only fees with matching amount, currency, unit and applicability', (t) => {
  const model = 'gemini-3-pro-image';
  const read = buildCandidate(t, (official) => {
    const source = official.excludedQuotes.find(({ officialModel }) => officialModel === model);
    // Give each explicit fee one independent reason to differ from the candidate rate.
    const differences = {
      input: { amount: 3 },
      input_image: { currency: 'CNY' },
      output: { unit: 'per_thousand_tokens' },
      output_image: { condition: 'Batch only' },
    };
    for (const fee of source.fees) Object.assign(fee, differences[fee.name]);
  });
  const view = read('api/all.json').google.models[model].pricing_view;
  const { displayRows } = view.groups
    .flatMap(({ quotes }) => quotes)
    .find(({ originalQuote }) => originalQuote?.inputImageEquivalent);
  const rates = displayRows
    .filter(({ rowId }) => rowId.startsWith('fees:') || rowId.startsWith('candidate-cost:'))
    .map(({ rowId, amount, currency, unit, conditions }) => [
      rowId,
      amount,
      currency,
      unit,
      conditions,
    ]);
  assert.deepEqual(rates, [
    ['fees:0:input', 3, 'USD', 'per_million_tokens', {}],
    ['fees:1:input_image', 2, 'CNY', 'per_million_tokens', {}],
    ['fees:2:output', 12, 'USD', 'per_thousand_tokens', {}],
    ['fees:3:output_image', 120, 'USD', 'per_million_tokens', { condition: 'Batch only' }],
    ['candidate-cost:input', 2, 'USD', 'per_million_tokens', {}],
    ['candidate-cost:input_image', 2, 'USD', 'per_million_tokens', {}],
    ['candidate-cost:output', 12, 'USD', 'per_million_tokens', {}],
    ['candidate-cost:output_image', 120, 'USD', 'per_million_tokens', {}],
  ]);
});

test('raw rates survive equal itemized amounts with different currency, unit or conditions', (t) => {
  const model = 'gemini-3.1-pro-preview';
  const edit = (official) => {
    const reference = official.excludedQuotes.find(
      (quote) => quote.officialModel === model && quote.raw?.tiers?.length,
    );
    const highFee = (usage) => reference.fees.find((fee) => fee.name === usage && fee.condition);
    highFee('input').currency = 'EUR';
    highFee('output').condition = 'Entire request prompt >300000 input tokens.';
    highFee('cache_read').unit = 'per_thousand_tokens';
  };
  const read = buildCandidate(t, edit);
  const catalogs = localizedCatalogs(read);
  for (const catalog of Object.values(catalogs)) {
    const quote = modelQuotes(catalog, 'google', model).find((q) => q.originalQuote?.raw?.tiers);
    const high = quote.displayRows.filter(({ rowId }) => rowId.startsWith('raw:tier-0:'));
    assert.deepEqual(
      high.map(({ usageKey, amount, currency, unit, cnyAmount, conditions }) => [
        usageKey,
        amount,
        currency,
        unit,
        cnyAmount,
        conditions.above,
      ]),
      [
        ['input', 4, 'USD', 'per_million_tokens', 28, 200000],
        ['output', 18, 'USD', 'per_million_tokens', 126, 200000],
        ['cache_read', 0.4, 'USD', 'per_million_tokens', 2.8, 200000],
      ],
    );
    const fees = quote.displayRows.filter(({ rowId }) => rowId.startsWith('fees:'));
    assert.deepEqual(
      fees.map(({ usageKey, currency, unit, conditions }) => [
        usageKey,
        currency,
        unit,
        conditions.condition,
      ]),
      [
        ['input', 'EUR', 'per_million_tokens', 'Entire request prompt >200000 input tokens.'],
        ['output', 'USD', 'per_million_tokens', 'Entire request prompt >300000 input tokens.'],
        ['cache_read', 'USD', 'per_thousand_tokens', 'Entire request prompt >200000 input tokens.'],
      ],
    );
    quote.displayRows = quote.displayRows.filter(({ rowId }) => rowId !== 'raw:tier-0:input');
  }
  const inputs = rawReconciliationInputs();
  edit(inputs.official);
  const result = reconcileDisplayCoverage({
    ...inputs,
    coverage: read('coverage.json'),
    displayCoverage: read('display-coverage.json'),
    catalogs,
  });
  assert.ok(
    result.failures.some((failure) => failure.modelId === model && failure.field === 'displayRows'),
  );
});

test('independent audit rejects altered native identity, cache TTL and example amount', (t) => {
  const read = buildCandidate(t);
  const inputs = {
    ...rawReconciliationInputs(),
    coverage: read('coverage.json'),
    displayCoverage: read('display-coverage.json'),
  };
  const cases = [
    [
      'anthropic',
      'claude-haiku-5-5',
      'nativeKey',
      (quote) => {
        quote.nativeKey = 'wrong-native-identity';
      },
    ],
    [
      'anthropic',
      'claude-haiku-5-5',
      'displayFeeTerms',
      (quote) => {
        delete quote.displayFeeTerms;
      },
    ],
    [
      'alibaba-cn',
      'wan3.0-video',
      'displayExamples',
      (quote) => {
        quote.displayExamples[0].amount = 999;
      },
    ],
  ];
  for (const [provider, model, field, mutate] of cases) {
    const catalogs = localizedCatalogs(read);
    for (const catalog of Object.values(catalogs)) {
      mutate(modelQuotes(catalog, provider, model).find(({ selected }) => selected));
    }
    const result = reconcileDisplayCoverage({ ...inputs, catalogs });
    assert.ok(
      result.failures.some(
        (failure) =>
          failure.providerId === provider && failure.modelId === model && failure.field === field,
      ),
      `Expected independent reconciliation to reject changed ${field}`,
    );
  }
});

test('zero-rate summaries stay unavailable across the fixed catalog', (t) => {
  const read = buildCandidate(t);
  const catalog = read('api/all.json');
  const displayCoverage = read('display-coverage.json');
  const rates = (view) =>
    view.groups.flatMap(({ quotes }) => quotes).flatMap(({ displayRows }) => displayRows);
  for (const { providerId, modelId, categories } of displayCoverage.models) {
    const view = catalog[providerId].models[modelId].pricing_view;
    if (rates(view).some(({ amount, sourceValue }) => amount !== null || sourceValue)) continue;
    assert.equal(view.summary.kind, 'unavailable', providerId + '/' + modelId);
    assert.ok(!categories.includes('reference-only'), providerId + '/' + modelId);
  }
  assert.equal(
    catalog['alibaba-cn'].models['qwen3-asr-flash'].pricing_view.summary.status,
    'missing',
  );
});

test('coverage categories compose across the full catalog and retain lifecycle states', (t) => {
  const read = buildCandidate(t);
  const display = read('display-coverage.json');
  const catalog = read('api/all.json');
  const row = (providerId, modelId) =>
    display.models.find((model) => model.providerId === providerId && model.modelId === modelId);
  const sol = row('openai', 'gpt-6.1-sol');
  for (const category of ['token-tiers', 'cache-and-ttl', 'multi-service-tier', 'reference-only'])
    assert.ok(sol.categories.includes(category), category);
  const haiku = row('anthropic', 'claude-haiku-5-5');
  assert.ok(haiku.categories.includes('multi-region-endpoint'));
  const seedance = row('volcengine', 'doubao-seedance-2-5-260628');
  assert.ok(seedance.categories.includes('task-conditions'));
  assert.ok(seedance.categories.includes('multimedia-usage'));
  assert.ok(row('minimax', 'image-01').categories.includes('not-offered'));
  assert.ok(row('volcengine', 'doubao-seed-1-8-251228').categories.includes('deprecated'));

  const pendingRead = buildCandidate(t, (official) => {
    const current = official.records.find(({ id }) => id === 'cn-moonshot-kimi-k3.1-pro-standard');
    official.records.push({
      ...structuredClone(current),
      id: current.id + '-pending-display',
      effectiveAt: '2099-01-01T00:00:00Z',
    });
  });
  const pendingCatalog = pendingRead('api/all.json');
  const pendingView = pendingCatalog['moonshotai-cn'].models['kimi-k3.1-pro'].pricing_view;
  assert.ok(
    pendingView.groups.some(({ quotes }) =>
      quotes.some(({ status }) => status === 'pending-effective'),
    ),
  );
  assert.ok(
    pendingRead('display-coverage.json')
      .models.find(
        ({ providerId, modelId }) => providerId === 'moonshotai-cn' && modelId === 'kimi-k3.1-pro',
      )
      .categories.includes('pending-effective'),
  );
  for (const model of display.models) {
    const view = catalog[model.providerId].models[model.modelId].pricing_view;
    if (['not-offered', 'deprecated'].includes(model.status)) assert.deepEqual(view.groups, []);
    for (const group of view.groups)
      if (!group.quotes.some((quote) => quote.displayRows.length))
        assert.equal(group.kind, 'status');
  }
});

test('display data is read-only and native price bytes remain invariant', (t) => {
  const read = buildCandidate(t);
  const ratioPath = 'api/newapi/ratio_config.json';
  const baseline = read.bytes(ratioPath);
  assert.equal(
    createHash('sha256').update(baseline).digest('hex'),
    '4ce3d8a4415534e3e44423b99d1d09cca0347793b188623dcd40c7ec821a6152',
  );
  const config = read(ratioPath);
  assert.deepEqual(Object.keys(config), ['success', 'message', 'data']);
  assert.deepEqual(Object.keys(config.data), ['billing_mode', 'billing_expr']);
  assert.deepEqual(Object.keys(config.data.billing_mode), Object.keys(config.data.billing_expr));

  const displayOnly = buildCandidate(t, (official) => {
    official.records.find(({ id }) => id === 'cn-minimax-MiniMax-H3-video').display = {
      primaryUnit: 'per_second',
    };
  });
  assert.ok(displayOnly.bytes(ratioPath).equals(baseline));
  assert.deepEqual(displayOnly('selection.json'), read('selection.json'));

  const selectedQuotes = new Set(Object.values(read('selection.json')));
  for (const provider of Object.values(read('api/all.json'))) {
    for (const model of Object.values(provider.models)) {
      for (const forbidden of ['variants', 'rate_card', 'context_pricing_rule'])
        assert.ok(!Object.hasOwn(model.cost ?? {}, forbidden), forbidden);
      for (const group of model.pricing_view.groups)
        for (const quote of group.quotes)
          if (quote.outputKind === 'model-reference') {
            assert.equal(quote.selected, false);
            assert.equal(quote.syncable, false);
            assert.equal(quote.billing_expr, undefined);
            assert.ok(!selectedQuotes.has(quote.quoteId));
          }
    }
  }
});

test('the unified build exposes one independent pricing view and coverage row per catalog model', (t) => {
  const read = buildCandidate(t);
  const coverage = read('coverage.json');
  const display = read('display-coverage.json');
  assert.equal(display.schemaVersion, 1);
  assert.equal(display.status, 'passed');
  assert.equal(display.models.length, coverage.models.length);
  assert.equal(
    new Set(display.models.map(({ providerId, modelId }) => providerId + '/' + modelId)).size,
    display.models.length,
  );
  for (const model of coverage.models) {
    const row = display.models.find(
      ({ providerId, modelId }) => providerId === model.providerId && modelId === model.modelId,
    );
    assert.ok(row, model.providerId + '/' + model.modelId);
    assert.equal(row.nativeKey, model.nativeKey);
    assert.equal(row.status, model.status);
    assert.ok(Array.isArray(row.categories));
    assert.ok(Array.isArray(row.quoteIds));
  }
  for (const path of ['api/all.json', 'api/i18n/zh/all.json', 'api/i18n/ja/all.json']) {
    const catalog = read(path);
    for (const { providerId, modelId } of coverage.models) {
      const view = catalog[providerId].models[modelId].pricing_view;
      assert.ok(view, path + ':' + providerId + '/' + modelId);
      assert.equal(view.providerId, providerId);
      assert.equal(view.modelId, modelId);
      assert.ok(Array.isArray(view.groups));
    }
  }
});
