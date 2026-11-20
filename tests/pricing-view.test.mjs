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
