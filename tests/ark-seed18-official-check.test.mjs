import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';

const sourceId = 'volcengine-seed-1-8';
const quoteId = 'upstream:volcengine:doubao-seed-1-8-251228:CNY';
const attemptedAt = '2026-11-19T04:46:00Z';
const headers = [
  '条件 千 token',
  '输入 元/百万 token',
  '输入命中缓存 元/百万 token',
  '输出单价 元/百万 token',
  '缓存存储 元/百万 token*小时',
  '输入单价[批量] 元/百万 token',
  '输入命中缓存[批量] 元/百万 token',
  '输出单价[批量] 元/百万 token',
];
// The published table on the exact Ark model page contains both realtime and Batch columns.
const rows = [
  ['输入长度 [0, 32] 且输出长度 [0, 0.2]', '0.80', '0.16', '2.00', '0.017', '0.40', '0.16', '1.00'],
  ['输入长度 [0, 32] 且输出长度 (0.2,+∞)', '0.80', '0.16', '8.00', '0.017', '0.40', '0.16', '4.00'],
  ['输入长度 (32, 128]', '1.20', '0.16', '16.00', '0.017', '0.60', '0.16', '8.00'],
  ['输入长度 (128, 256]', '2.40', '0.16', '24.00', '0.017', '1.20', '0.16', '12.00'],
];

test('records the exact Seed 1.8 hourly cache tariff as reference and fails closed on missing charges', async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'cny-ark-seed-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const baseline = join(work, 'baseline');
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
  const table = [headers, ...rows]
    .map((cells) => '<tr>' + cells.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>')
    .join('');
  const page = '<div>Model ID：doubao-seed-1-8-251228</div><table>' + table + '</table>';
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

  const incomplete = await check(page.replace('<td>0.017</td>', '<td>—</td>'));
  const failed = incomplete.results.find((row) => row.id === quoteId);
  assert.equal(failed.status, 'failed');
  assert.match(failed.reason, /Unexpected official amount/);
  assert.ok(!incomplete.changes.some((row) => row.id === quoteId && row.candidate));
});
