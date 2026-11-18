import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

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
  const zh = read('api/i18n/zh/all.json');
  const ja = read('api/i18n/ja/all.json');
  assert.deepEqual(Object.keys(billing_mode), Object.keys(billing_expr));
  assert.equal(config.success, true);
  assert.equal(manifest.stats.models, 630);
  assert.equal(manifest.stats.subscriptions, 125);
  assert.equal(manifest.stats.officialQuotes, 62);
  assert.equal(manifest.stats.apiModels, Object.keys(billing_expr).length);
  const selected = input('proposed-selection.json').selection;
  for (const [key, id] of Object.entries(selected)) {
    const quote = coverage.quotes.find((r) => r.quoteId === id);
    assert.ok(quote, id);
    if (key === 'search_std') {
      assert.equal(quote.outputKind, 'tool-reference');
      assert.equal(quote.syncable, false);
      assert.ok(!Object.hasOwn(billing_expr, key));
      continue;
    }
    assert.equal(billing_mode[key], 'tiered_expr', id);
    assert.equal(billing_expr[key], quote.billing_expr, id);
    assert.equal(quote.nativeKey, key, id);
    assert.equal(quote.syncable, true, id);
  }
  assert.deepEqual(zh['moonshotai-cn'].models['kimi-k3.1-pro'].cost, {
    input: 13,
    output: 68,
    cache_read: 1.3,
    cache_write: 13,
    cache_write_1h: 26,
    currency: 'CNY',
    publication_expr: billing_expr['kimi-k3.1-pro'],
    publication_unit: 'token',
  });
  assert.ok(ja.openai.models['gpt-image-2.5-sunburst']);
  const seedance = coverage.quotes.find((r) => r.modelId === 'doubao-seedance-2-5-260628');
  assert.deepEqual(seedance.sourcePrice.rows, [
    ['480p,720p', 70, 42],
    ['1080p', 77, 46],
    ['4K', 31, 19],
  ]);
  assert.equal(seedance.syncable, false);
  assert.ok(!Object.hasOwn(billing_expr, seedance.modelId));
  assert.ok(zh.volcengine.models[seedance.modelId]);
  for (const [path, meta] of Object.entries(manifest.files)) {
    const bytes = readFileSync(join(out, path));
    assert.equal(bytes.byteLength, meta.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256);
  }
});

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'unified-cny-fixture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const policy = input('unified-policy.json');
  const catalog = input('official-catalog.json');
  const selection = input('proposed-selection.json');
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
