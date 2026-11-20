import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';
import { adapter } from '../scripts/official-sources/alibaba-wan.mjs';

const cn = 'alibaba-wan-cn';
const sg = 'alibaba-wan-sg';
const attemptedAt = '2026-11-20T05:00:00Z';
const referenceModels = new Set(['wan2.7-r2v', 'wan2.7-r2v-2026-06-12', 'wan2.7-videoedit']);
const fixtureNames = {
  [cn]: 'beijing',
  [sg]: 'singapore',
  activation: 'activation',
  'wan3-api': 'wan3-api',
};

function fixture(id) {
  const name = fixtureNames[id.split('--').at(-1)];
  assert.ok(name, id);
  return gunzipSync(
    readFileSync(
      new URL('./fixtures/official-check/alibaba-wan-' + name + '-2026-11-20.gz', import.meta.url),
    ),
  );
}

function replace(body, before, after) {
  assert.ok(body.includes(before), before);
  return Buffer.from(body.toString('utf8').replace(before, after));
}

test('official Wan prices retain the original rate, region, and billing conditions', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cny-bailian-wan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const baseline = join(dir, 'candidate');
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
  const catalog = JSON.parse(readFileSync('data/cny/official-catalog.json'));
  const records = new Map(catalog.records.map((quote) => [quote.id, quote]));

  const run = (mutate = (_, response) => response) =>
    checkOfficialPrices({
      baseline,
      adapters: adapter,
      attemptedAt,
      getResponse: async ({ id, url }) =>
        mutate(id, { url, body: fixture(id), obtainedAt: attemptedAt, status: 200 }),
    });
  const rows = (report, region) => report.results.filter(({ sourceId }) => sourceId === region);
  const quote = (report, region, model) =>
    rows(report, region).find(({ nativeKey }) => nativeKey === model);
  const prices = (report, region, model) =>
    quote(report, region, model).observed.sourcePrice.map(({ name, charges: [{ amount }] }) => [
      name,
      amount,
    ]);

  const original = await run();
  for (const [region, currency] of [
    [cn, 'CNY'],
    [sg, 'USD'],
  ]) {
    const regional = rows(original, region);
    assert.equal(regional.length, 12);
    assert.equal(new Set(regional.map(({ nativeKey }) => nativeKey)).size, 12);
    for (const row of regional) {
      const reviewed = records.get(row.quoteId);
      assert.equal(row.identity.currency, currency);
      assert.equal(row.evidence.sha256, reviewed.source.sha256);
      for (const supplement of reviewed.source.supplemental) {
        const observed = Object.values(row.evidence.supplemental).find(
          ({ finalUrl }) => finalUrl === supplement.url,
        );
        assert.equal(observed.sha256, supplement.sha256);
      }
      const reference = referenceModels.has(row.nativeKey);
      assert.equal(row.status, reference ? 'unsupported' : 'unchanged', row.nativeKey);
      assert.equal(row.selected, region === cn && !reference, row.nativeKey);
      assert.deepEqual(row.observed.sourcePrice, reviewed.task.tiers, row.nativeKey);
      assert.deepEqual(row.observed.conditions, reviewed.conditions, row.nativeKey);
    }
  }
  assert.deepEqual(prices(original, cn, 'wan3.0-video'), [
    ['1080P', 1.2],
    ['720P', 0.6],
    ['480P', 0.3],
  ]);
  assert.deepEqual(prices(original, sg, 'wan3.0-video'), [
    ['1080P', 0.2],
    ['720P', 0.1],
    ['480P', 0.05],
  ]);
  assert.deepEqual(prices(original, cn, 'wan3.0-video-prime'), [
    ['1080P', 1.8],
    ['720P', 0.9],
    ['480P', 0.45],
  ]);
  assert.deepEqual(prices(original, sg, 'wan3.0-video-prime'), [
    ['1080P', 0.28],
    ['720P', 0.14],
    ['480P', 0.068],
  ]);
  assert.deepEqual(original.changes, []);

  await t.test(
    'the published base rate is identical with and without a promotional label',
    async () => {
      const noPromo = await run((id, response) => {
        const text = response.body.toString('utf8');
        if (id === cn) {
          response.body = Buffer.from(
            text.replace(/原价(\d+(?:\.\d+)?元\/秒)<strong>（限时7折）<\/strong>/g, '$1'),
          );
        }
        if (id === sg) {
          response.body = Buffer.from(
            text.replace(/Original([^<]+)<strong> \(30% off for a limited time\)<\/strong>/g, '$1'),
          );
        }
        if (id === cn || id === sg) assert.ok(response.body.length < Buffer.byteLength(text), id);
        return response;
      });
      for (const region of [cn, sg]) {
        const row = quote(noPromo, region, 'wan3.0-video');
        assert.equal(row.status, 'unchanged', region + ' ' + row.reason);
        assert.deepEqual(
          prices(noPromo, region, 'wan3.0-video'),
          prices(original, region, 'wan3.0-video'),
        );
      }
      assert.deepEqual(noPromo.changes, []);
    },
  );

  await t.test('a missing Beijing model row does not borrow a price from Singapore', async () => {
    const missing = await run((id, response) => {
      if (id === cn)
        response.body = replace(response.body, '>wan2.7-t2v-2026-04-25<', '>wan2.7-t2v-unknown<');
      return response;
    });
    assert.equal(quote(missing, cn, 'wan2.7-t2v-2026-04-25').status, 'failed');
    assert.match(quote(missing, cn, 'wan2.7-t2v-2026-04-25').reason, /Wan model row/);
    assert.equal(quote(missing, sg, 'wan2.7-t2v-2026-04-25').status, 'unchanged');
    assert.deepEqual(missing.changes, []);
  });

  await t.test('a changed Wan 3.0 billing formula rejects both Beijing models', async () => {
    const changed = await run((id, response) => {
      if (id === cn)
        response.body = replace(
          response.body,
          '计费时长 = 输入视频时长 + 输出视频时长。',
          '计费时长 = 输出视频时长。',
        );
      return response;
    });
    for (const model of ['wan3.0-video', 'wan3.0-video-prime']) {
      assert.equal(quote(changed, cn, model).status, 'failed');
      assert.match(quote(changed, cn, model).reason, /Wan billing conditions/);
      assert.equal(quote(changed, sg, model).status, 'unchanged');
    }
    assert.deepEqual(changed.changes, []);
  });

  for (const supplement of ['activation', 'wan3-api']) {
    await t.test('a required ' + supplement + ' response failure blocks that source', async () => {
      const failed = await run((id, response) =>
        id === cn + '--' + supplement ? { ...response, status: 503 } : response,
      );
      assert.equal(rows(failed, cn).filter(({ status }) => status === 'failed').length, 12);
      assert.ok(rows(failed, cn).every(({ reason }) => reason.includes(supplement + ' HTTP 503')));
      assert.equal(rows(failed, sg).filter(({ status }) => status === 'unchanged').length, 9);
      assert.deepEqual(failed.changes, []);
    });
  }
});
