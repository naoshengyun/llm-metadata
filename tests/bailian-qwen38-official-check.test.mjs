import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';
import { adapter } from '../scripts/official-sources/alibaba-qwen38.mjs';

test('Qwen3.8 cards verify both cache modes and original regional currencies', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'bailian-qwen38-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const baseline = join(dir, 'baseline');
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
  const run = (change = (body) => body) =>
    checkOfficialPrices({
      baseline,
      adapters: adapter,
      attemptedAt: '2026-11-19T09:30:00Z',
      getResponse: async ({ id, url }) => {
        const name = id.endsWith('--cache') ? 'bailian-card-cache' : id;
        const body = gunzipSync(
          readFileSync('tests/fixtures/official-check/' + name + '-2026-11-19.gz'),
        ).toString('utf8');
        return { url, body: Buffer.from(change(body, id)), obtainedAt: '2026-11-19T09:30:00Z' };
      },
    });
  const published = await run();
  const rows = published.results.filter(({ sourceId }) => sourceId?.startsWith('bailian-'));
  assert.equal(rows.length, 8);
  assert.ok(rows.every(({ status }) => status === 'unchanged'));
  const byId = new Map(rows.map((row) => [row.quoteId, row]));
  const cnId = 'dashscope--qwen3.8-max--cn-beijing-online-original-explicit';
  const sgId = 'dashscope--qwen3.8-max--sg-international-online-original-explicit';
  assert.deepEqual(byId.get(cnId).observed.sourcePrice, {
    input: 12,
    output: 36,
    cache_read: 1,
    cache_write: 15,
  });
  assert.deepEqual(byId.get(sgId).observed.sourcePrice, {
    input: 2,
    output: 6,
    cache_read: 0.17,
    cache_write: 2.5,
  });
  assert.equal(byId.get(sgId).observed.cnyCost.cache_write, 17.5);
  assert.equal(byId.get(cnId).observed.conditions.cacheWriteTtlSeconds, 300);

  const changed = await run((body, id) =>
    id === 'bailian-usd-qwen3-8-max' ? body.replace('>0.17<', '>0.18<') : body,
  );
  const priceChange = changed.changes.find(({ id }) => id === sgId);
  assert.equal(priceChange.status, 'changed');
  assert.equal(priceChange.observed.sourcePrice.cache_read, 0.18);

  const incomplete = await run((body, id) =>
    id === 'bailian-cny-qwen3-8-max' ? body.replaceAll('显式缓存命中', '未知收费项') : body,
  );
  assert.equal(incomplete.results.find(({ id }) => id === cnId).status, 'failed');
  assert.deepEqual(incomplete.changes, []);
});
