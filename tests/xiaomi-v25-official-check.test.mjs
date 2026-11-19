import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';
import { adapter } from '../scripts/official-sources/xiaomi-v25-history.mjs';

const fixtures = new Map([
  ['xiaomi-v25-history', 'notice'],
  ['xiaomi-v25-history--cny-table', 'cny'],
  ['xiaomi-v25-history--deprecation', 'deprecation'],
]);

function fixture(id) {
  const name = 'xiaomi-v25-' + fixtures.get(id) + '-2026-11-19.gz';
  return gunzipSync(
    readFileSync(new URL('./fixtures/official-check/domestic/' + name, import.meta.url)),
  );
}

test('retired MiMo V2.5 IDs retain only the reviewed CNY image rates and exact lifecycle', async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'cny-xiaomi-history-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const baseline = join(work, 'baseline');
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
  const quoteId = 'upstream:xiaomi:mimo-v2.5:USD';
  const attemptedAt = '2026-11-19T06:00:00Z';
  const check = (mutate = (_id, body) => body) =>
    checkOfficialPrices({
      baseline,
      attemptedAt,
      adapters: [adapter],
      getResponse: async ({ id, url }) => ({
        url,
        body: mutate(id, fixture(id)),
        obtainedAt: attemptedAt,
      }),
    });
  const result = (report, id = quoteId) => report.results.find((row) => row.id === id);

  const report = await check();
  const base = result(report);
  const pro = result(report, 'upstream:xiaomi:mimo-v2.5-pro:USD');
  assert.equal(base.status, 'unsupported', base.reason);
  assert.equal(pro.status, 'unsupported', pro.reason);
  assert.equal(base.observed.identity.currency, 'CNY');
  assert.deepEqual(base.observed.sourcePrice, { input: 1, output: 2, cache_read: 0.02 });
  assert.deepEqual(pro.observed.sourcePrice, { input: 3, output: 6, cache_read: 0.025 });
  assert.equal(pro.observed.conditions.endOfService, '2026-10-21T10:00:00+08:00');
  assert.equal(pro.observed.conditions.beforeAdjustment.above.output, 42);
  assert.equal(pro.observed.effectiveAt, '2026-05-27T00:00:00+08:00');
  assert.deepEqual(report.changes, []);

  const changedImage = await check((id, body) =>
    id.endsWith('--cny-table') ? Buffer.concat([body, Buffer.from('changed')]) : body,
  );
  assert.equal(result(changedImage).status, 'failed');
  assert.match(result(changedImage).reason, /image changed/);
  const unmatchedDeprecation = await check((id, body) =>
    id.endsWith('--deprecation')
      ? Buffer.from(body.toString().replace('>mimo-v2.5</span>', '>different-id</span>'))
      : body,
  );
  assert.equal(result(unmatchedDeprecation).status, 'failed');
  assert.equal(
    result(unmatchedDeprecation, 'upstream:xiaomi:mimo-v2.5-pro:USD').status,
    'unsupported',
  );
});
