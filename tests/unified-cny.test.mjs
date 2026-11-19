import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { readHistoricalCny } from './fixtures/november-2026-cny.mjs';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';

const input = (name) => JSON.parse(readFileSync('data/cny/' + name));
const run = (output, args = []) =>
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', output, ...args], {
    encoding: 'utf8',
  });

test('unified candidate covers the researched catalog and exports every selected model and task', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'unified-cny-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = join(dir, 'candidate');
  run(out);
  const read = (name) => JSON.parse(readFileSync(join(out, name)));
  const config = read('api/newapi/ratio_config.json');
  const {
    data: { billing_mode, billing_expr },
  } = config;
  const manifest = read('manifest.json');
  const coverage = read('coverage.json');
  assert.deepEqual(Object.keys(billing_mode), Object.keys(billing_expr));
  assert.equal(config.success, true);
  assert.equal(manifest.stats.models, coverage.models.length);
  assert.equal(
    manifest.stats.subscriptions,
    coverage.models.filter(({ outputKind }) => outputKind === 'subscription').length,
  );
  const officialRecords = input('official-catalog.json').records.filter(
    ({ provider }) => provider !== 'hunyuan',
  );
  assert.equal(manifest.stats.officialQuotes, officialRecords.length);
  const quoteIds = new Set(coverage.quotes.map(({ quoteId }) => quoteId));
  for (const { id } of officialRecords) assert.ok(quoteIds.has(id), id);
  assert.equal(manifest.stats.apiModels, Object.keys(billing_expr).length);
  const syncable = coverage.models.filter(({ syncable }) => syncable);
  assert.deepEqual(Object.keys(billing_expr).sort(), syncable.map(({ modelId }) => modelId).sort());
  const selectedQuoteIds = new Map(coverage.quotes.map((quote) => [quote.quoteId, quote]));
  const english = read('api/all.json');
  const { notOfferedModels, nativeCapabilityExclusions } = input('unified-policy.json');
  const foreignExclusions = Object.entries(nativeCapabilityExclusions).filter(
    ([, price]) => price.currency === 'USD',
  );
  assert.ok(foreignExclusions.some(([id]) => id === 'lyria-3-clip-preview'));
  for (const [id, price] of foreignExclusions) {
    assert.ok(!Object.hasOwn(billing_expr, id), id);
    const model = english[price.providerId].models[id];
    const notOffered = notOfferedModels.includes(id);
    assert.equal(model.cnyPrice.status, notOffered ? 'not-offered' : 'unsupported', id);
    assert.equal(model.cnyPrice.exported, false, id);
    const quote = notOffered
      ? coverage.models.find(
          ({ modelId, providerId }) => modelId === id && providerId === price.providerId,
        ).upstreamPrice
      : model.cnyPrice.quotes.find(({ source }) => source?.sha256 === price.source.sha256);
    assert.equal(quote.source.sha256, price.source.sha256, id);
    assert.equal(quote.sourceCurrency, 'USD', id);
    assert.equal(quote.sourceUnit, price.sourceUnit, id);
    assert.deepEqual(quote.sourcePrice, price.sourcePrice, id);
    assert.equal(quote.cnyCost, undefined, id);
  }
  for (const { modelId, providerId, selectedQuoteId } of syncable) {
    assert.equal(billing_mode[modelId], 'tiered_expr', modelId);
    const published = english[providerId].models[modelId];
    assert.equal(billing_expr[modelId], published.cnyPrice.expr, modelId);
    const selectedQuote = selectedQuoteIds.get(selectedQuoteId);
    if (selectedQuote) assert.equal(billing_expr[modelId], selectedQuote.billing_expr, modelId);
  }
  for (const { nativeKey } of coverage.quotes.filter(
    ({ outputKind }) => outputKind === 'tool-reference',
  ))
    assert.ok(!Object.hasOwn(billing_expr, nativeKey));
  for (const [path, meta] of Object.entries(manifest.files)) {
    const bytes = readFileSync(join(out, path));
    assert.equal(bytes.byteLength, meta.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256);
  }
});

test('subscription and retired providers are omitted from the catalog and official checks', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cny-subscription-scope-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const candidate = join(dir, 'candidate');
  run(candidate);
  const load = (file) => JSON.parse(readFileSync(join(candidate, file)));
  const coverage = load('coverage.json');
  const { upstreamDirectory } = input('unified-policy.json');
  const upstream = JSON.parse(readFileSync(join(upstreamDirectory, 'en.json')));
  const subscriptions = Object.values(upstream).filter(({ subscription }) => subscription);
  assert.ok(subscriptions.some(({ id }) => id === 'alibaba-coding-plan-cn'));
  const excluded = new Set([...subscriptions.map(({ id }) => id), 'hunyuan']);
  assert.deepEqual(coverage.excludedProviderIds, [...excluded].sort());
  const removed = new Set([...excluded, 'dashscope-anthropic']);
  assert.ok(coverage.models.every(({ providerId }) => !removed.has(providerId)));
  assert.ok(coverage.quotes.every(({ providerId }) => !removed.has(providerId)));
  for (const prefix of ['api/', 'api/i18n/zh/', 'api/i18n/ja/']) {
    const catalog = load(prefix + 'all.json');
    const { providers } = load(prefix + 'providers.json');
    const { models } = load(prefix + 'index.json');
    for (const id of removed) {
      assert.ok(!Object.hasOwn(catalog, id), id);
      assert.ok(!existsSync(join(candidate, prefix, 'providers', id + '.json')), id);
    }
    assert.ok(providers.every(({ id, subscription }) => !removed.has(id) && !subscription));
    assert.ok(models.every(({ providerId }) => !removed.has(providerId)));
    assert.ok(models.every(({ id }) => id !== 'hunyuan-a13b'));
    assert.deepEqual(Object.keys(catalog['tencent-tokenhub'].models).sort(), [
      'hy3',
      'hy3-preview',
      'hy4',
      'hy4-preview',
    ]);
    const qwen = catalog['alibaba-cn'].models['qwen3.7-max'].cnyPrice;
    assert.equal(
      qwen.selectedQuoteId,
      'dashscope--qwen3.7-max--cn-beijing-online-original-implicit',
    );
    const anthropicQuotes = qwen.quotes.filter(
      ({ sourceProviderId }) => sourceProviderId === 'dashscope-anthropic',
    );
    assert.equal(anthropicQuotes.length, 2);
    for (const quote of anthropicQuotes) {
      assert.equal(quote.providerId, 'alibaba-cn');
      assert.equal(quote.endpoint, 'https://dashscope.aliyuncs.com/apps/anthropic');
      assert.equal(quote.syncable, false);
    }
  }

  const targets = subscriptions.map(({ id, models }) => ({
    quoteId: 'upstream:' + id + ':test',
    providerId: id,
    modelId: Object.keys(models)[0],
    group: id,
  }));
  targets.push({
    quoteId: 'hunyuan--hunyuan-a13b--mainland-legacy-hunyuan-online-postpaid-published',
    providerId: 'hunyuan',
    modelId: 'hunyuan-a13b',
    group: 'hunyuan-a13b',
  });
  const report = await checkOfficialPrices({
    baseline: candidate,
    adapters: [
      {
        id: 'subscription-test',
        url: 'https://example.com/pricing',
        targets,
      },
    ],
    getResponse: async () => assert.fail('Excluded provider triggered a network check'),
  });
  assert.ok(report.results.every(({ identity }) => !removed.has(identity.providerId)));
  assert.deepEqual(report.changes, []);
  assert.ok(load('api/newapi/ratio_config.json').data.billing_expr['MiniMax-M3']);
});

test('service scope and model deprecation remove only approved native prices', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cny-service-scope-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const policy = input('unified-policy.json');
  const priorPolicy = join(dir, 'prior-policy.json');
  const { notOfferedModels: keys, lifecycle, ...before } = policy;
  const deprecated = Object.keys(lifecycle);
  writeFileSync(priorPolicy, JSON.stringify({ ...before, lifecycle: {} }));
  const prior = join(dir, 'prior');
  const candidate = join(dir, 'candidate');
  run(prior, [priorPolicy]);
  run(candidate, [
    'data/cny/unified-policy.json',
    'data/cny/official-catalog.json',
    'data/cny/proposed-selection.json',
    policy.upstreamDirectory,
    prior,
  ]);
  const load = (directory, filename) => JSON.parse(readFileSync(join(directory, filename)));
  const filename = 'api/newapi/ratio_config.json';
  const config = load(prior, filename);
  assert.ok(keys.includes('MiniMax-M2'));
  assert.ok(deprecated.includes('doubao-seed-1-8-251228'));
  const excludedKeys = [...keys, ...deprecated];
  const alreadyUnpriced = [
    'gemini-embedding-2',
    'glm-4.5',
    'glm-4.5-x',
    'gpt-image-1-mini',
    'qwen3-max',
    'qwen3.6-max-preview',
  ];
  assert.deepEqual(
    excludedKeys.filter((key) => !Object.hasOwn(config.data.billing_expr, key)).sort(),
    alreadyUnpriced,
  );
  const removed = excludedKeys.filter((key) => !alreadyUnpriced.includes(key));
  for (const key of removed) {
    assert.ok(Object.hasOwn(config.data.billing_expr, key), key);
    delete config.data.billing_mode[key];
    delete config.data.billing_expr[key];
  }
  assert.deepEqual(load(candidate, filename), config);
  const { changes } = load(candidate, 'price-diff.json');
  assert.deepEqual(changes.map(({ nativeKey }) => nativeKey).sort(), removed.sort());
  assert.ok(
    changes.every(
      ({ nativeKey, type, reason, evidence }) =>
        type === 'removed' &&
        (deprecated.includes(nativeKey)
          ? reason === 'model-deprecated' &&
            evidence.sha256 === lifecycle[nativeKey][0].evidence.sha256
          : reason === 'naoshengyun-service-scope' && evidence.url === policy.sources.notOffered),
    ),
  );

  const coverage = load(candidate, 'coverage.json');
  const excluded = coverage.models.filter(
    ({ nativeKey }) => keys.includes(nativeKey) || deprecated.includes(nativeKey),
  );
  assert.ok(excluded.every(({ syncable }) => !syncable));
  for (const path of ['api/all.json', 'api/i18n/zh/all.json', 'api/i18n/ja/all.json']) {
    const catalog = load(candidate, path);
    assert.equal(catalog.minimax.models['image-01'].cnyPrice.status, 'not-offered');
    assert.equal(catalog['minimax-cn'].models['image-01'].cnyPrice.status, 'not-offered');
    for (const provider of Object.values(catalog)) {
      for (const model of Object.values(provider.models)) {
        if (model.type === 'embedding') assert.equal(model.cnyPrice.status, 'not-offered');
      }
    }
    for (const { providerId, modelId, status, lifecycle: event } of excluded) {
      const model = catalog[providerId].models[modelId];
      assert.equal(status, keys.includes(modelId) ? 'not-offered' : 'deprecated');
      assert.equal(model.cnyPrice.status, status);
      assert.deepEqual(model.cnyPrice.lifecycle, event);
      assert.equal(model.cnyPrice.exported, false);
      assert.equal(model.cnyPrice.quotes, undefined);
      assert.equal(model.cost, undefined);
      assert.equal(model.sourceCost, undefined);
    }
  }

  const model = excluded.find(({ modelId }) => modelId === 'gpt-4o-2024-05-13');
  const entry = model.upstreamPrice;
  const report = await checkOfficialPrices({
    baseline: candidate,
    adapters: [
      {
        id: 'excluded-test',
        url: 'https://example.com/pricing',
        targets: [
          {
            quoteId: entry.quoteId,
            providerId: entry.providerId,
            modelId: entry.modelId,
            endpoint: 'https://api.openai.com/v1',
            currency: entry.sourceCurrency,
            priceList: entry.priceList,
            group: entry.modelId,
          },
        ],
      },
    ],
    getResponse: async () => assert.fail('Excluded model triggered a network check'),
  });
  const skipped = report.results.find(({ quoteId }) => quoteId === entry.quoteId);
  assert.equal(skipped.status, 'not-offered');
  assert.equal(skipped.latestAttemptedAt, null);
  assert.equal(skipped.selected, false);
  const deprecatedModel = excluded.find(({ modelId }) => modelId === 'doubao-seed-1-8-251228');
  const deprecatedResult = report.results.find(
    ({ quoteId }) => quoteId === deprecatedModel.upstreamPrice.quoteId,
  );
  assert.equal(deprecatedResult.status, 'deprecated');
  assert.equal(deprecatedResult.latestAttemptedAt, null);
  assert.deepEqual(report.changes, []);
});

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'unified-cny-fixture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const [policy, catalog, selection] = readHistoricalCny();
  let upstreamDir;
  return {
    policy,
    catalog,
    selection,
    upstream(edit) {
      upstreamDir = join(dir, 'upstream');
      mkdirSync(upstreamDir, { recursive: true });
      const source = JSON.parse(readFileSync('data/upstream/24d3f35c/source.json'));
      for (const file of Object.keys(source.files)) {
        const raw = readFileSync('data/upstream/24d3f35c/' + file);
        const data = JSON.parse(raw);
        if (file !== 'native.json') edit(data);
        const bytes = JSON.stringify(data);
        source.files[file].sha256 = createHash('sha256').update(bytes).digest('hex');
        writeFileSync(join(upstreamDir, file), bytes);
      }
      writeFileSync(join(upstreamDir, 'source.json'), JSON.stringify(source));
    },
    build(name, previous) {
      const out = join(dir, name);
      for (const [filename, value] of Object.entries({ policy, catalog, selection }))
        writeFileSync(join(dir, filename + '.json'), JSON.stringify(value));
      const args = ['policy', 'catalog', 'selection'].map((file) => join(dir, file + '.json'));
      if (upstreamDir || previous) args.push(upstreamDir ?? resolve(policy.upstreamDirectory));
      if (previous) args.push(join(dir, previous));
      run(out, args);
      return (file) => JSON.parse(readFileSync(join(out, file)));
    },
  };
}

test('the historical Kimi tariff and Seedance hold retain their exact published conditions', (t) => {
  const { build } = fixture(t);
  const read = build('historical');
  const zh = read('api/i18n/zh/all.json');
  const { billing_expr } = read('api/newapi/ratio_config.json').data;
  assert.deepEqual(zh['moonshotai-cn'].models['kimi-k3.1-pro'].cost, {
    input: 13,
    output: 68,
    cache_read: 1.3,
    cache_write: 13,
    cache_write_1h: 26,
    currency: 'CNY',
    publication_expr: 'tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)',
    publication_unit: 'token',
  });
  const seedance = read('coverage.json').quotes.find(
    ({ modelId }) => modelId === 'doubao-seedance-2-5-260628',
  );
  assert.deepEqual(seedance.sourcePrice.rows, [
    ['480p,720p', 70, 42],
    ['1080p', 77, 46],
    ['4K', 31, 19],
  ]);
  assert.equal(seedance.syncable, false);
  assert.ok(!Object.hasOwn(billing_expr, seedance.modelId));
  assert.ok(zh.volcengine.models[seedance.modelId]);
});

test('a selected price cannot silently disappear, and withdrawal blocks all alternate identities', (t) => {
  const { policy, catalog, selection, build } = fixture(t);
  delete selection.selection['kimi-k3.1-pro'];
  assert.throws(() => build('deleted'), /Selected price removed without withdrawal: kimi-k3.1-pro/);
  const key = 'kimi-k3.1-pro';
  const quoteId = 'cn-moonshot-kimi-k3.1-pro-standard';
  const withdrawal = {
    state: 'withdrawn',
    quoteId,
    at: '2026-11-17T09:00:00+08:00',
    evidence: {
      url: 'https://platform.kimi.com/docs/pricing/chat',
      checkedAt: '2026-11-17',
      sha256: '1'.repeat(64),
    },
  };
  policy.lifecycle[key] = [withdrawal];
  const removed = build('withdrawn');
  assert.ok(!Object.hasOwn(removed('api/newapi/ratio_config.json').data.billing_expr, key));
  assert.equal(
    removed('coverage.json').models.filter(
      (row) => row.modelId === key && row.status === 'withdrawn',
    ).length,
    2,
  );
  selection.selection[key] = quoteId;
  const restored = {
    state: 'restored',
    quoteId,
    at: '2026-11-18T12:00:00+08:00',
    evidence: { url: withdrawal.evidence.url, checkedAt: '2026-11-18', sha256: '2'.repeat(64) },
  };
  policy.lifecycle[key].push(restored);
  policy.asOf = '2026-11-18T13:00:00+08:00';
  assert.throws(
    () => build('stale-restore'),
    /Restored quote needs matching new official evidence/,
  );
  catalog.records.find(({ id }) => id === quoteId).source = restored.evidence;
  assert.ok(build('restored')('api/newapi/ratio_config.json').data.billing_expr[key]);
});

test('pending official schedules require explicit activation at or after the zoned effective time', (t) => {
  const { policy, catalog, selection, build } = fixture(t);
  const key = 'kimi-k3.1-pro';
  const oldId = selection.selection[key];
  const oldQuote = catalog.records.find(({ id }) => id === oldId);
  const next = structuredClone(oldQuote);
  next.id += '-future';
  next.effectiveAt = '2026-11-23T00:00:00+08:00';
  next.cost.input = 14;
  catalog.records.push(next);
  const pending = build('pending');
  assert.equal(
    pending('coverage.json').quotes.find(({ quoteId }) => quoteId === next.id).status,
    'pending-effective',
  );
  assert.match(pending('api/newapi/ratio_config.json').data.billing_expr[key], /p \* 13/);
  selection.selection[key] = next.id;
  assert.throws(() => build('early'), /Selected quote is not yet effective/);
  policy.asOf = '2026-11-23T00:00:00+08:00';
  assert.match(
    build('activated')('api/newapi/ratio_config.json').data.billing_expr[key],
    /p \* 14/,
  );
});

test('a changed selected quote cannot drop required prices, currencies or native conditions', (t) => {
  const { catalog, build } = fixture(t);
  const kimi = catalog.records.find(({ id }) => id === 'cn-moonshot-kimi-k3.1-pro-standard');
  delete kimi.cost.cache_write_1h;
  assert.throws(() => build('missing'), /Selected quote incomplete.*cache_write_1h/);
  kimi.required = kimi.required.filter((name) => name !== 'cache_write_1h');
  assert.throws(
    () => build('deleted-required'),
    /Selected quote dropped charge or condition.*cache_write_1h/,
  );
  kimi.cost.cache_write_1h = 26;
  kimi.required.push('cache_write_1h');
  const task = catalog.records.find(({ model }) => model === 'doubao-seedance-2-0-260128');
  task.task.tiers[0].charges[0].currency = 'USD';
  assert.throws(() => build('mixed'), /Selected quote incomplete.*task.currency/);
  task.task.tiers[0].charges[0].currency = 'CNY';
  task.task.tiers.shift();
  assert.throws(
    () => build('missing-branch'),
    /Selected quote dropped charge or condition.*4k-video/,
  );
});

test('an existing selected quote cannot lose official charging conditions', (t) => {
  const { catalog, build } = fixture(t);
  const quote = catalog.records.find(({ id }) => id === 'cn-moonshot-kimi-k3.1-pro-standard');
  quote.conditions = { cacheStorage: 'limited-time-free' };
  build('baseline');
  delete quote.conditions;
  assert.throws(
    () => build('missing-conditions', 'baseline'),
    /Selected quote dropped charge or condition.*conditions\.cacheStorage/,
  );
});

test('a default cache TTL change appears in the price diff even with the same expression', (t) => {
  const { catalog, build } = fixture(t);
  const quote = catalog.records.find(({ id }) => id === 'cn-moonshot-kimi-k3.1-pro-standard');
  quote.conditions = { defaultCacheTtlSeconds: 300 };
  build('baseline');
  quote.source.checkedAt = '2026-11-18';
  quote.source.sha256 = 'b'.repeat(64);
  assert.deepEqual(build('evidence-only', 'baseline')('price-diff.json').changes, []);
  quote.conditions.defaultCacheTtlSeconds = 3600;
  const report = build('changed-ttl', 'baseline')('price-diff.json');
  assert.equal(report.changes.length, 1);
  const { nativeKey, before, after } = report.changes[0];
  assert.equal(nativeKey, 'kimi-k3.1-pro');
  assert.equal(before.billing_expr, after.billing_expr);
  assert.equal(before.conditions.defaultCacheTtlSeconds, 300);
  assert.equal(after.conditions.defaultCacheTtlSeconds, 3600);
});

test('candidate reports the published wrong-currency keys and produces deterministic bytes', (t) => {
  const { build } = fixture(t);
  const first = build('first');
  const second = build('second');
  assert.deepEqual(first('manifest.json'), second('manifest.json'));
  assert.deepEqual(first('api/newapi/ratio_config.json'), second('api/newapi/ratio_config.json'));
  const report = first('price-diff.json');
  assert.equal(report.baseline.releaseId, input('publication/upstream-release.json').releaseId);
  for (const key of ['sarvam-105b']) {
    const correction = report.changes.find((entry) => entry.nativeKey === key);
    assert.equal(correction.type, 'removed');
    assert.equal(correction.reason, 'source-currency-correction');
    assert.ok(correction.before.billing_expr);
    assert.ok(correction.evidence.url);
    assert.ok(!Object.hasOwn(first('api/newapi/ratio_config.json').data.billing_expr, key));
  }
});

test('source selection rejects equal-price ambiguity and survives the loss of upstream metadata', (t) => {
  const { policy, build, upstream } = fixture(t);
  const key = 'fixture-same-model';
  const china = { id: key, cost: { currency: 'CNY', input: 13, output: 13 } };
  const usa = { id: key, cost: { currency: 'USD', input: 10, output: 10 } };
  upstream((catalog) => {
    catalog['alibaba-cn'].models[key] = china;
    catalog['moonshotai-cn'].models[key] = china;
    catalog.openai.models[key] = usa;
    delete catalog['moonshotai-cn'].models['kimi-k3.1-pro'];
  });
  assert.throws(() => build('ambiguous'), /Ambiguous upstream price identity.*fixture-same-model/);
  policy.upstreamSelection[key] = 'upstream:openai:' + key + ':USD';
  const explicit = build('explicit')('api/newapi/ratio_config.json').data.billing_expr;
  assert.match(explicit[key], /p \* 70/);
  assert.match(explicit['kimi-k3.1-pro'], /p \* 13/);
  policy.upstreamSelection[key] = 'upstream:moonshotai-cn:' + key + ':USD';
  assert.throws(() => build('wrong-identity'), /Explicit upstream price is no longer eligible/);
});

test('a newly withdrawn key and its selection remain sticky against the last fixed candidate', (t) => {
  const { policy, catalog, selection, build } = fixture(t);
  const key = 'new-fixture-model';
  const quote = structuredClone(
    catalog.records.find((row) => row.id === 'cn-zhipu-glm-5.3-standard'),
  );
  quote.model = key;
  quote.id = 'fixture-model-quote';
  catalog.records.push(quote);
  selection.selection[key] = quote.id;
  build('original');
  delete selection.selection[key];
  assert.throws(
    () => build('silently-deleted', 'original'),
    /Selected price removed without withdrawal/,
  );
  policy.lifecycle[key] = [
    {
      state: 'withdrawn',
      quoteId: quote.id,
      at: '2026-11-17T09:00:00+08:00',
      evidence: { url: quote.source.url, checkedAt: '2026-11-17', sha256: '4'.repeat(64) },
    },
  ];
  const withdrawn = build('later-withdrawn', 'original');
  assert.equal(
    withdrawn('price-diff.json').changes.find((row) => row.nativeKey === key).reason,
    'formal-withdrawal',
  );
  delete policy.lifecycle[key];
  selection.selection[key] = quote.id;
  assert.throws(
    () => build('silently-reintroduced', 'later-withdrawn'),
    /Lifecycle history was removed or rewritten/,
  );
});

test('an automatic upstream selection cannot disappear or switch providers without review', (t) => {
  const { policy, build, upstream } = fixture(t);
  const key = 'kimi-k2.6';
  const domestic = 'upstream:moonshotai-cn:kimi-k2.6:CNY';
  const international = 'upstream:moonshotai:kimi-k2.6:USD';
  assert.equal(build('reviewed')('selection.json')[key], domestic);

  upstream((catalog) => {
    delete catalog['moonshotai-cn'].models[key];
    delete catalog.moonshotai.models[key];
  });
  assert.throws(
    () => build('missing', 'reviewed'),
    /Selected price removed without withdrawal or replacement: kimi-k2.6/,
  );

  upstream((catalog) => {
    delete catalog['moonshotai-cn'].models[key];
  });
  assert.throws(
    () => build('automatic-replacement', 'reviewed'),
    /Selected price identity changed without explicit replacement: kimi-k2.6/,
  );
  policy.upstreamSelection[key] = international;
  assert.equal(build('explicit-replacement', 'reviewed')('selection.json')[key], international);

  delete policy.upstreamSelection[key];
  policy.lifecycle[key] = [
    {
      state: 'withdrawn',
      quoteId: domestic,
      at: '2026-11-17T09:00:00+08:00',
      evidence: {
        url: 'https://example.com/withdrawal',
        checkedAt: '2026-11-17',
        sha256: '5'.repeat(64),
      },
    },
  ];
  const withdrawn = build('withdrawn', 'reviewed');
  assert.ok(!Object.hasOwn(withdrawn('api/newapi/ratio_config.json').data.billing_expr, key));
  assert.equal(
    withdrawn('price-diff.json').changes.find((row) => row.nativeKey === key).reason,
    'formal-withdrawal',
  );
});

test('an upstream endpoint cannot drift under an unchanged quote ID', (t) => {
  const { policy, build, upstream } = fixture(t);
  const key = 'kimi-k2.6';
  const read = build('reviewed');
  upstream((catalog) => {
    catalog['moonshotai-cn'].api = 'https://different.example.com/v1';
  });
  assert.throws(
    () => build('automatic-endpoint-change', 'reviewed'),
    /Selected price identity changed under the same quote ID: kimi-k2.6/,
  );
  policy.upstreamSelection[key] = read('selection.json')[key];
  assert.throws(
    () => build('explicit-same-quote-id', 'reviewed'),
    /Selected price identity changed under the same quote ID: kimi-k2.6/,
  );
});

test('an incomplete domestic official quote blocks an automatic international fallback', (t) => {
  const { policy, catalog, build, upstream } = fixture(t);
  const model = 'fixture-kimi-missing-domestic';
  const id = 'fixture-missing-domestic-quote';
  const international = 'upstream:moonshotai:' + model + ':USD';
  const template = catalog.records.find((row) => row.id === 'cn-moonshot-kimi-k3.1-pro-standard');
  const { upstreamKey, ...quote } = structuredClone(template);
  build('reviewed');
  catalog.records.push({ ...quote, id, model, cost: {} });
  upstream((providers) => {
    providers.moonshotai.models[model] = { id: model, cost: { input: 1, output: 2 } };
  });

  const candidate = build('unselected', 'reviewed');
  const { models, quotes } = candidate('coverage.json');
  assert.equal(quotes.find(({ quoteId }) => quoteId === id).status, 'incomplete');
  assert.deepEqual(
    models
      .filter(({ modelId }) => modelId === model)
      .map(({ providerId }) => providerId)
      .sort(),
    ['moonshotai', 'moonshotai-cn'],
  );
  assert.ok(!Object.hasOwn(candidate('api/newapi/ratio_config.json').data.billing_expr, model));

  policy.upstreamSelection[model] = international;
  assert.equal(build('explicit', 'reviewed')('selection.json')[model], international);
});

test('unselected official models and providers stay searchable in every locale without exporting a price', (t) => {
  const { catalog, build } = fixture(t);
  const template = catalog.records.find((row) => row.id === 'cn-zhipu-glm-5.3-standard');
  const associations = [
    { provider: template.provider, model: 'fixture-new-model', quoteCount: 1 },
    { provider: 'fixture-new-provider', model: 'fixture-new-endpoint-model', quoteCount: 2 },
  ];
  for (const { provider, model, quoteCount } of associations) {
    for (let index = 0; index < quoteCount; index++) {
      const { upstreamKey, ...quote } = structuredClone(template);
      catalog.records.push({
        ...quote,
        id: model + '-' + index,
        provider,
        model,
        priceList: 'Fixture price list ' + index,
        endpoint: 'https://endpoint-' + index + '.example.com/v1',
      });
    }
  }

  const read = build('official-associations');
  const coverage = read('coverage.json');
  const config = read('api/newapi/ratio_config.json').data;
  const { stats } = read('manifest.json');
  for (const prefix of ['api/', 'api/i18n/zh/', 'api/i18n/ja/']) {
    assert.equal(read(prefix + 'providers.json').providers.length, stats.providers);
  }
  for (const { provider, model, quoteCount } of associations) {
    const row = coverage.models.find(
      ({ providerId, modelId }) => providerId === provider && modelId === model,
    );
    assert.equal(row?.status, 'not-selected', provider + '/' + model);
    assert.equal(row.syncable, false);
    assert.equal(row.quoteIds.length, quoteCount);
    assert.ok(!Object.hasOwn(config.billing_mode, model));
    assert.ok(!Object.hasOwn(config.billing_expr, model));
    for (const prefix of ['api/', 'api/i18n/zh/', 'api/i18n/ja/']) {
      assert.ok(read(prefix + 'providers.json').providers.some(({ id }) => id === provider));
      assert.ok(
        read(prefix + 'index.json').models.some(
          ({ id, providerId }) => id === model && providerId === provider,
        ),
      );
      const detail = read(prefix + 'providers/' + provider + '.json').models[model];
      assert.deepEqual(detail, read(prefix + 'all.json')[provider].models[model]);
      assert.equal(detail.cnyPrice.status, 'not-selected');
      assert.equal(detail.cnyPrice.exported, false);
      assert.deepEqual(
        detail.cnyPrice.quotes.map(({ quoteId }) => quoteId),
        row.quoteIds,
      );
      assert.equal(
        new Set(detail.cnyPrice.quotes.map(({ endpoint }) => endpoint)).size,
        quoteCount,
      );
    }
  }
});
