import { readHistoricalOfficialInputs } from './fixtures/november-2026-cny.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialSnapshot } from '../scripts/build-official-cny.mjs';
import { buildModelRelease, writeModelRelease } from '../.cache/cny-build/cny/publication.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArtifact } from '../.cache/cny-build/cny/artifact.js';
import { canonical, hash } from '../.cache/cny-build/cny/generate.js';
import { createHash } from 'node:crypto';

function fixture() {
  const records = ['m', 'n'].map((model) => ({
    id: model,
    model,
    provider: 'synthetic',
    priceList: 'standard',
    origin: 'domestic',
    currency: 'CNY',
    source: { url: 'https://example.org/fixture', checkedAt: '2026-11-16' },
    required: ['input', 'output'],
    cost: { input: 21, output: 105 },
  }));
  return buildOfficialSnapshot({
    sourceSha: 'a'.repeat(40),
    catalog: { checkedAt: '2026-11-16', records, excludedQuotes: [], coverage: [] },
    reference: {
      reportedCount: 3,
      providedCount: 2,
      unexplainedDifference: 1,
      platforms: [{ platform: 'synthetic', protocol: 'chat', models: ['m', 'n'] }],
    },
    selection: { m: 'm', n: 'n' },
  }).artifact;
}
const options = { models: ['m'], mode: 'partial', purpose: 'test' };
function reissue(a) {
  const { sourceSha, data, quotes, selection, models, plugins, tools, exclusions } = a;
  return buildArtifact(
    { sourceSha, data, quotes, selection, models, plugins, tools, exclusions },
    a.generatedAt,
  );
}
test('S: explicit test selection produces deterministic native model source without changing candidate', () => {
  const a = fixture(),
    before = JSON.stringify(a);
  const r = buildModelRelease(a, options);
  assert.deepEqual(r.modelSource, {
    success: true,
    data: {
      billing_mode: { m: 'tiered_expr' },
      billing_expr: { m: 'tier("standard", p * 21 + c * 105)' },
    },
  });
  assert.match(r.id, /^[a-f0-9]{64}$/);
  assert.deepEqual(buildModelRelease(a, options), r);
  assert.equal(JSON.stringify(a), before);
});
test('S: a selected model without a complete mode/expression pair cannot produce a release', () => {
  const a = fixture();
  delete a.models.m.billing_expr;
  assert.throws(() => buildModelRelease(reissue(a), options), /complete|expression/);
});
test('S: source eligibility is checked before release even when an artifact identity was recomputed', () => {
  for (const invalid of ['mixed-currency', 'missing-charge', 'wrong-expression']) {
    const a = fixture();
    if (invalid === 'mixed-currency') a.quotes.records[0].currency = 'USD';
    if (invalid === 'missing-charge') delete a.quotes.records[0].cost.output;
    if (invalid === 'wrong-expression') a.models.m.billing_expr = 'tier("free", p * 0)';
    assert.throws(() => buildModelRelease(reissue(a), options), /eligible|source/);
  }
});
test('S: selection is mandatory, unique and model-only; incomplete candidates cannot be full releases', () => {
  for (const bad of [
    undefined,
    { ...options, models: [] },
    { ...options, models: ['m', 'm'] },
    { ...options, models: ['missing'] },
    { ...options, mode: 'full' },
    { ...options, mode: 'other' },
    { ...options, purpose: 'first-sale' },
  ]) {
    assert.throws(() => buildModelRelease(fixture(), bad));
  }
});
test('S: partial release retains every reference/exclusion and original dates, distinguishes unselected ready items', () => {
  const a = fixture(),
    r = buildModelRelease(a, options);
  assert.deepEqual(r.coverage, a.data);
  assert.deepEqual(r.exclusions, a.exclusions);
  assert.equal(r.complete, false);
  assert.equal(r.partial, true);
  assert.deepEqual(r.selected, [
    {
      model: 'm',
      quoteId: 'm',
      source: { url: 'https://example.org/fixture', checkedAt: '2026-11-16' },
    },
  ]);
  assert.ok(r.notSelected.some((x) => x.quoteId === 'n' && x.reason === 'not-selected'));
  assert.equal(r.partitionStatus.plugins, 'separate-configuration-required');
  assert.equal(r.partitionStatus.tools, 'separate-configuration-required');
});
test('S: fixed version writes native JSON bytes once and rejects both overwrite and tampered identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'cny-release-'));
  try {
    const release = buildModelRelease(fixture(), options);
    const dir = writeModelRelease(root, release);
    const original = readFileSync(join(dir, 'ratio_config.json'));
    assert.deepEqual(JSON.parse(original), release.modelSource);
    assert.throws(() => writeModelRelease(root, release), /EEXIST/);
    assert.deepEqual(readFileSync(join(dir, 'ratio_config.json')), original);
    const bad = structuredClone(release);
    bad.modelSource.success = false;
    assert.throws(() => writeModelRelease(root, bad), /identity/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('S: ambiguous official record identity is rejected instead of selecting the first duplicate', () => {
  const a = fixture();
  a.quotes.records.push({ ...a.quotes.records[0], model: 'other' });
  assert.throws(() => buildModelRelease(reissue(a), options), /duplicate|ambiguous/);
});
test('S: source policy, original catalog date and native baseline remain explicit in release provenance', () => {
  const a = fixture(),
    r = buildModelRelease(a, options);
  assert.equal(r.source.checkedAt, '2026-11-16');
  assert.equal(r.source.nativeBaseline, 'f2aa91232ed3e5878a614762ace6736a2b74257f');
  assert.deepEqual(r.source.policy, { USD: 7, CNY: 1, USDExchangeRate: 1, QuotaPerUnit: 500000 });
});
test('S: maintained candidate keeps all136 reference rows and missing-five note for a two-model test selection', () => {
  const historical = readHistoricalOfficialInputs();
  const { reference } = historical;
  const a = buildOfficialSnapshot({
    sourceSha: 'd5a84ca10d8599343370c1541828439a56b8dd1b',
    ...historical,
  }).artifact;
  const selected = { ...options, models: ['kimi-k3.1-pro', 'claude-sonnet-4-5'] };
  const r = buildModelRelease(a, selected);
  assert.equal(r.coverage.coverage.length, 136);
  assert.deepEqual(r.coverage.reference, reference);
  assert.equal(r.coverage.reference.reportedCount, 141);
  assert.equal(r.coverage.reference.unexplainedDifference, 5);
  assert.equal(r.complete, false);
  assert.equal(r.selected.length, 2);
  assert.deepEqual(r.exclusions, a.exclusions);
  assert.deepEqual(
    buildModelRelease(a, { ...selected, models: [...selected.models].reverse() }),
    r,
  );
});
test('S: recomputed hashes cannot make an incomplete model response writable', () => {
  const root = mkdtempSync(join(tmpdir(), 'cny-release-reject-'));
  try {
    const bad = buildModelRelease(fixture(), options);
    delete bad.modelSource.data.billing_expr.m;
    bad.modelSourceSha256 = createHash('sha256')
      .update(JSON.stringify(JSON.parse(canonical(bad.modelSource)), null, 2) + '\n')
      .digest('hex');
    const { id, ...content } = bad;
    bad.id = hash(content);
    assert.throws(() => writeModelRelease(root, bad), /complete|response/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('S: strict publication envelope rejects missing/false/nonboolean success and malformed data', () => {
  const root = mkdtempSync(join(tmpdir(), 'cny-release-envelope-'));
  try {
    for (const alter of [
      (r) => delete r.success,
      (r) => (r.success = false),
      (r) => (r.success = 'true'),
      (r) => delete r.data,
      (r) => (r.data = null),
      (r) => (r.data = {}),
      (r) => (r.data.billing_mode = {}),
    ]) {
      const bad = buildModelRelease(fixture(), options);
      alter(bad.modelSource);
      bad.modelSourceSha256 = createHash('sha256')
        .update(JSON.stringify(JSON.parse(canonical(bad.modelSource)), null, 2) + '\n')
        .digest('hex');
      const { id, ...content } = bad;
      bad.id = hash(content);
      assert.throws(() => writeModelRelease(root, bad), /response/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('S: equivalent selection key ordering produces identical fixed-version file bytes', () => {
  const one = mkdtempSync(join(tmpdir(), 'cny-release-order-a-')),
    two = mkdtempSync(join(tmpdir(), 'cny-release-order-b-'));
  try {
    const reverseKeys = (x) =>
      Array.isArray(x)
        ? x.map(reverseKeys)
        : x && typeof x === 'object'
          ? Object.fromEntries(
              Object.entries(x)
                .reverse()
                .map(([k, v]) => [k, reverseKeys(v)]),
            )
          : x;
    const a = fixture(),
      first = buildModelRelease(a, options),
      second = buildModelRelease(reverseKeys(a), {
        purpose: 'test',
        mode: 'partial',
        models: ['m'],
      });
    assert.equal(first.id, second.id);
    const d1 = writeModelRelease(one, first),
      d2 = writeModelRelease(two, second);
    assert.deepEqual(
      readFileSync(join(d1, 'release.json')),
      readFileSync(join(d2, 'release.json')),
    );
    assert.deepEqual(
      readFileSync(join(d1, 'ratio_config.json')),
      readFileSync(join(d2, 'ratio_config.json')),
    );
  } finally {
    rmSync(one, { recursive: true, force: true });
    rmSync(two, { recursive: true, force: true });
  }
});
test('S: an explicit native-name to official-record mapping remains usable without guessing aliases', () => {
  const seed = fixture();
  const a = buildOfficialSnapshot({
    sourceSha: seed.sourceSha,
    catalog: seed.quotes,
    reference: seed.data.reference,
    selection: { 'native-billing-model': 'm' },
  }).artifact;
  const r = buildModelRelease(a, { ...options, models: ['native-billing-model'] });
  assert.deepEqual(r.modelSource.data, {
    billing_mode: { 'native-billing-model': 'tiered_expr' },
    billing_expr: { 'native-billing-model': 'tier("standard", p * 21 + c * 105)' },
  });
  assert.equal(r.selected[0].quoteId, 'm');
  a.selection['native-billing-model'] = 'missing-record';
  assert.throws(
    () => buildModelRelease(reissue(a), { ...options, models: ['native-billing-model'] }),
    /source/,
  );
});
