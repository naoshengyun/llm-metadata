import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';

const sourceId = 'volcengine-seed-1-8';
const quoteId = 'upstream:volcengine:doubao-seed-1-8-251228:CNY';
const attemptedAt = '2026-11-19T04:46:00Z';
const page = gunzipSync(
  readFileSync(
    new URL(
      './fixtures/official-check/domestic/volcengine-seed-1-8-pricing-excerpt-2026-11-19.gz',
      import.meta.url,
    ),
  ),
).toString('utf8');

test('records the exact Seed 1.8 hourly cache tariff as reference and fails closed on missing charges', async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'cny-ark-seed-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const baseline = join(work, 'baseline');
  const policyPath = join(work, 'archive-policy.json');
  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json'));
  delete policy.lifecycle['doubao-seed-1-8-251228'];
  writeFileSync(policyPath, JSON.stringify(policy));
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline, policyPath]);
  const check = (document) =>
    checkOfficialPrices({
      baseline,
      attemptedAt,
      getResponse: async ({ id, url }) => {
        if (id !== sourceId) throw Error('Outside Ark Seed fixture scope');
        return { url, body: Buffer.from(document), obtainedAt: attemptedAt };
      },
    });

  const report = await check(page);
  const result = report.results.find((row) => row.id === quoteId);
  assert.equal(result?.status, 'unsupported', result?.reason);
  assert.match(result.reason, /hourly cache storage/);
  assert.equal(result.observed.sourcePrice.online[0].output, 2);
  assert.equal(result.observed.sourcePrice.online[1].output, 8);
  assert.deepEqual(result.observed.sourcePrice.cacheStorage[0], {
    amount: 0.017,
    unit: 'per_million_token_hours',
  });
  assert.equal(result.observed.conditions.bands[0].outputTokens.maximum, 200);
  assert.equal(result.observed.conditions.batchReference[0].output, 1);
  assert.ok(!report.changes.some((row) => row.id === quoteId));

  const incomplete = await check(page.replace('>0.017<', '>—<'));
  const failed = incomplete.results.find((row) => row.id === quoteId);
  assert.equal(failed.status, 'failed');
  assert.match(failed.reason, /Unexpected official amount/);
  assert.ok(!incomplete.changes.some((row) => row.id === quoteId && row.candidate));

  const unrelated = await check(page.replace('豆包大模型1.8', '豆包大模型1.6'));
  assert.equal(unrelated.results.find((row) => row.id === quoteId).status, 'failed');

  const outsidePricing = await check(page.replace('>模型价格<', '>示例<'));
  assert.equal(outsidePricing.results.find((row) => row.id === quoteId).status, 'failed');
});
