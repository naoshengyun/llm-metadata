import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';
import { adapter as kimi } from '../scripts/official-sources/kimi-cn.mjs';

const directory = mkdtempSync(join(tmpdir(), 'official-check-'));
const baseline = join(directory, 'baseline');
after(() => rmSync(directory, { recursive: true, force: true }));
execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
const fixture = (date) =>
  gunzipSync(
    readFileSync(new URL(`./fixtures/official-check/kimi-cn-${date}.html.gz`, import.meta.url)),
  );
const historical = fixture('2026-11-16');
const current = fixture('2026-11-18');
const url = 'https://platform.kimi.com/docs/pricing/chat';
const attemptedAt = '2026-11-18T08:00:00Z';
const pro = 'cn-moonshot-kimi-k3.1-pro-standard';

function check(body = current, options = {}) {
  return checkOfficialPrices({
    baseline,
    attemptedAt,
    adapters: [kimi],
    getResponse: async () => ({ body, url, obtainedAt: attemptedAt }),
    ...options,
  });
}

test('official Kimi HTML verifies exact domestic quotes against the fixed candidate', async () => {
  for (const [body, sha] of [
    [historical, '9afe502615e0e0b9568f46545dd5fb5b4fb442b30e6c090ae0ba0d1373a63ffa'],
    [current, 'a19a8f3f9c0a456384a58ea85d88081b2b80c065a34ad488cc5324850467529a'],
  ]) {
    const report = await check(body);
    const result = report.results.find(({ quoteId }) => quoteId === pro);
    assert.equal(result.status, 'unchanged');
    assert.equal(createHash('sha256').update(body).digest('hex'), sha);
    assert.equal(result.evidence.sha256, sha);
    assert.equal(result.latestSuccessfulAt, attemptedAt);
    assert.equal(result.publishedEvidence.checkedAt, '2026-11-16');
    assert.deepEqual(result.observed.sourcePrice, {
      input: 13,
      output: 68,
      cache_read: 1.3,
      cache_write: 13,
      cache_write_1h: 26,
    });
    assert.equal(report.results.filter(({ status }) => status === 'unchanged').length, 6);
    assert.ok(report.results.some(({ status }) => status === 'deferred'));
    assert.ok(report.results.some(({ status }) => status === 'not-registered'));
    assert.deepEqual(report.changes, []);
  }
});

function mutate(from, to) {
  assert.ok(current.includes(from), 'Fixture no longer contains ' + from);
  return Buffer.from(current.toString().replace(from, to));
}

test('amount changes produce a reviewable candidate that the unified builder can verify', async () => {
  const report = await check(mutate('¥68.00 / MTok', '¥69.25 / MTok'));
  assert.equal(report.changes.length, 1);
  const [change] = report.changes;
  assert.equal(change.id, pro);
  assert.equal(change.difference.amounts.before.output, 68);
  assert.equal(change.difference.amounts.after.output, 69.25);
  assert.equal(change.observed.cnyCost.output, 69.25);
  assert.equal(
    change.candidate.expression,
    'tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 69.25)',
  );
  assert.equal(change.candidate.record.source.sha256, change.evidence.sha256);

  const { writeFileSync } = await import('node:fs');
  const catalog = JSON.parse(readFileSync('data/cny/official-catalog.json'));
  catalog.records = catalog.records.map((record) =>
    record.id === pro ? change.candidate.record : record,
  );
  const candidateCatalog = join(directory, 'changed-catalog.json');
  writeFileSync(candidateCatalog, JSON.stringify(catalog));
  const candidate = join(directory, 'changed-candidate');
  execFileSync(process.execPath, [
    'scripts/build-unified-cny.mjs',
    candidate,
    'data/cny/unified-policy.json',
    candidateCatalog,
    'data/cny/proposed-selection.json',
    'data/upstream/24d3f35c',
    baseline,
  ]);
  const checked = JSON.parse(readFileSync(join(candidate, 'api/newapi/ratio_config.json')));
  assert.equal(checked.data.billing_expr['kimi-k3.1-pro'], change.candidate.expression);
});

test('a changed cache condition produces a semantic change without changing any amount', async () => {
  const changed = mutate(
    'TTL）默认为 5min。TTL 设置及成本优化建议详见 `',
    'TTL）默认为 1h。TTL 设置及成本优化建议详见 `',
  )
    .toString()
    .replace('TTL）为 5 分钟；不指定 TTL 时默认按此档。`', 'TTL）为 5 分钟。`')
    .replace('TTL）为 1 小时。`', 'TTL）为 1 小时；不指定 TTL 时默认按此档。`');
  const report = await check(Buffer.from(changed));
  const change = report.changes.find(({ id }) => id === pro);
  assert.deepEqual(
    change.difference.chargingConditions.before.declared.defaultCacheTtlSeconds,
    300,
  );
  assert.deepEqual(
    change.difference.chargingConditions.after.declared.defaultCacheTtlSeconds,
    3600,
  );
  assert.equal(change.difference.amounts, undefined);
});

test('unrelated HTML changes alter the evidence hash without producing a candidate', async () => {
  const report = await check(Buffer.concat([current, Buffer.from('<!-- unrelated footer -->')]));
  assert.equal(report.results.find(({ id }) => id === pro).status, 'unchanged');
  assert.equal(report.changes.length, 0);
});

test('bad fields, structural changes, a missing model, timeouts and HTTP errors retain published prices', async () => {
  const first = await check();
  const later = '2026-11-19T08:00:00Z';
  const cases = [
    { body: mutate('¥68.00 / MTok', '—'), message: /invalid Kimi CNY/i },
    { body: mutate('title:`输出`', 'title:`changed header`'), message: /headers/ },
    {
      body: mutate('children:`kimi-k3.1-pro`}),`¥13.00', 'children:`missing-model`}),`¥13.00'),
      message: /exact official price row/i,
    },
    {
      getResponse: async () => {
        throw new DOMException('request timed out', 'TimeoutError');
      },
      message: /timed out/,
    },
    { status: 503, message: /HTTP 503/ },
    { body: Buffer.from('<html>pricing temporarily unavailable</html>'), message: /manifest/ },
  ];
  for (const { body, status, getResponse, message } of cases) {
    const report = await check(body ?? current, {
      previous: first,
      attemptedAt: later,
      getResponse:
        getResponse ?? (async () => ({ body: body ?? current, url, obtainedAt: later, status })),
    });
    const result = report.results.find(({ id }) => id === pro);
    assert.equal(result.status, 'failed');
    assert.match(result.reason, message);
    assert.equal(result.latestAttemptedAt, later);
    assert.equal(result.latestSuccessfulAt, attemptedAt);
    assert.equal(result.publishedEvidence.checkedAt, '2026-11-16');
    assert.ok(!report.changes.some(({ id }) => id === pro));
  }
});

test('a selected quote failure rejects changes to its shared tariff and leaves independent sources usable', async () => {
  const { adapter: kimi } = await import('../scripts/official-sources/kimi-cn.mjs');
  const target = kimi.targets.find(({ modelId }) => modelId === 'kimi-k2.6');
  const other = {
    id: 'independent-kimi-fixture',
    url: 'https://platform.kimi.com/docs/pricing/chat-test',
    targets: [target],
    parse: ({ body }) => {
      const parsed = JSON.parse(body);
      return new Map([[target.quoteId, parsed]]);
    },
  };
  const { quoteId, group, baselineConditions, baselineIdentity, ...identity } = target;
  const badAndChanged = mutate('¥68.00 / MTok', 'invalid')
    .toString()
    .replace('¥100.00 / MTok', '¥102.00 / MTok');
  const report = await check(current, {
    adapters: [{ ...kimi, targets: kimi.targets.filter((item) => item !== target) }, other],
    getResponse: async (source) => ({
      body:
        source === other
          ? Buffer.from(
              JSON.stringify({
                identity,
                sourcePrice: { input: 7, output: 27, cache_read: 1.1 },
                sourceUnit: 'per_million_tokens',
                required: ['input', 'output', 'cache_read'],
                conditions: {},
              }),
            )
          : Buffer.from(badAndChanged),
      url: source.url,
      obtainedAt: attemptedAt,
    }),
  });
  assert.equal(report.results.find(({ id }) => id === pro).status, 'failed');
  assert.equal(report.changes.length, 1);
  assert.equal(report.changes[0].id, quoteId);
});

test('official future dates and evidenced withdrawals are distinct from missing rows', async () => {
  const { adapter: kimi } = await import('../scripts/official-sources/kimi-cn.mjs');
  const [target] = kimi.targets.filter(({ quoteId }) => quoteId === pro);
  const { quoteId, group, baselineConditions, baselineIdentity, ...identity } = target;
  const source = {
    id: 'lifecycle-fixture',
    url,
    targets: [target],
    parse: ({ body }) => new Map([[pro, JSON.parse(body)]]),
  };
  const row = {
    identity,
    sourcePrice: { input: 15, output: 68, cache_read: 1.3, cache_write: 13, cache_write_1h: 26 },
    sourceUnit: 'per_million_tokens',
    required: ['input', 'output', 'cache_read', 'cache_write', 'cache_write_1h'],
    conditions: baselineConditions,
  };
  const future = '2026-12-01T00:00:00+08:00';
  const statement = 'The official domestic standard tariff for kimi-k3.1-pro is withdrawn.';
  for (const [parsed, status] of [
    [{ ...row, effectiveAt: future }, 'future-effective'],
    [
      { identity, withdrawal: { statement }, effectiveAt: '2026-11-18T00:00:00+08:00' },
      'withdrawal',
    ],
    [{ identity }, 'failed'],
    [{ ...row, identity: { ...identity, endpoint: 'https://api.moonshot.ai/v1' } }, 'failed'],
    [{ ...row, effectiveAt: '2026-12-01T00:00:00' }, 'failed'],
    [{ identity, withdrawal: { statement: ' ' } }, 'failed'],
  ]) {
    const report = await check(Buffer.from(JSON.stringify(parsed)), { adapters: [source] });
    const result = report.results.find(({ id }) => id === pro);
    assert.equal(result.status, status);
    assert.equal(result.publishedEvidence.checkedAt, '2026-11-16');
    if (status === 'future-effective')
      assert.equal(report.changes[0].candidate.record.effectiveAt, future);
    if (status === 'withdrawal')
      assert.equal(report.changes[0].observed.withdrawal.statement, statement);
    if (status === 'failed') assert.equal(report.changes.length, 0);
  }
});
