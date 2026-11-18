import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';

const directory = mkdtempSync(join(tmpdir(), 'official-usd-'));
const baseline = join(directory, 'baseline');
after(() => rmSync(directory, { recursive: true, force: true }));
execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
const fixtures = {
  'openai-standard': 'osm',
  'anthropic-global': 'anth',
  'morph-list': 'morph',
  'kimi-global': 'kimi-global',
  'minimax-international': 'minimax-md',
  'minimax-international--video-api': 'minimax-video-api',
  'stepfun-international': 'step-intl',
  'stepfun-international--cache': 'step-cache',
  'upstage-api': 'upstage',
  'upstage-api--solar-pro4': 'up-pro4',
  'upstage-api--solar-mini4': 'up-mini4',
  'sakana-namazu': 'sakana-namazu',
  'sakana-fugu': 'sakana-fugu',
  'gemini-developer': 'gemini-developer',
  'mistral-standard': 'mistral',
  'mistral-standard--api-ids': 'mistral-md',
  'zai-international': 'zai',
  'cohere-api': 'co-pricing',
  'cohere-api--command-a': 'co-a',
  'cohere-api--command-r': 'co-r',
  'cohere-api--command-r-plus': 'co-plus',
  'cohere-api--command-r7b': 'co-7b',
  'cohere-api--aya-expanse': 'co-aya',
  'xai-text': 'xai-text',
  'xai-text--cache': 'xcache',
  'xai-video': 'xai-video-current',
  'openai-standard--currency': 'openai-currency',
  'openai-standard--cache': 'oic',
  'openai-standard--images': 'ois',
  'anthropic-global--ids': 'anthids',
  'morph-list--api-docs': 'morph-docs',
  'kimi-global--currency': 'kimi-balance',
};
const attemptedAt = '2026-11-18T12:44:58Z';

function run(mutate = (body) => body) {
  return checkOfficialPrices({
    baseline,
    attemptedAt,
    getResponse: async ({ id, url }) => {
      if (!fixtures[id]) throw Error('Outside foreign fixture scope');
      const fixture = new URL(
        './fixtures/official-check/' + fixtures[id] + '-2026-11-18.gz',
        import.meta.url,
      );
      return {
        url,
        body: mutate(gunzipSync(readFileSync(fixture)), id),
        obtainedAt: attemptedAt,
      };
    },
  });
}

test('verifies precise OpenAI Standard and direct image quotes, Claude global quotes and Morph list prices', async () => {
  const report = await run();
  for (const [sourceId, count] of Object.entries({
    'openai-standard': 11,
    'anthropic-global': 17,
    'morph-list': 11,
  })) {
    const scoped = report.results.filter((result) => result.sourceId === sourceId);
    assert.equal(scoped.length, count, sourceId);
    assert.equal(
      scoped.filter(({ status }) => status === 'unchanged').length,
      count,
      JSON.stringify(scoped.filter(({ status }) => status !== 'unchanged')),
    );
  }
  const price = (id) => report.results.find((row) => row.id === id).observed;
  const openai = price('us-openai-gpt-6.1-terra-standard');
  assert.equal(openai.sourcePrice.tiers[0].cache_write_12h, 5);
  assert.equal(openai.cnyCost.tiers[0].cache_write_12h, 35);
  assert.deepEqual(price('us-openai-gpt-image-2-direct-images-standard').sourcePrice, {
    input: 5,
    input_image: 8,
    output: 30,
  });
  const haiku = price('us-anthropic-claude-haiku-5-5-standard');
  assert.equal(haiku.sourcePrice.tiers[0].tier.size, 100000);
  assert.equal(haiku.cnyCost.tiers[0].output, 17.5);
  assert.equal(price('upstream:morph:morph-dsv4flash:USD').sourcePrice.input, 0.141953125);
  assert.equal(price('upstream:morph:morph-dsv4flash:USD').cnyCost.input, 0.993671875);
  assert.equal(
    report.results.find(({ id }) => id === 'upstream:morph:auto:USD').status,
    'deferred',
  );
});

test('Kimi international checks both cache TTL rates on the matching USD endpoint', async () => {
  const report = await run();
  const results = report.results.filter((row) => row.sourceId === 'kimi-global');
  assert.equal(results.length, 6);
  assert.ok(results.every(({ status }) => ['unchanged', 'changed'].includes(status)));
  const result = results.find(({ nativeKey }) => nativeKey === 'kimi-k3.1-pro');
  assert.equal(result.selected, false);
  assert.equal(result.observed.identity.endpoint, 'https://api.moonshot.ai/v1');
  assert.equal(result.observed.sourcePrice.cache_write_1h, 4);
  assert.equal(result.observed.cnyCost.cache_write_1h, 28);
  assert.equal(result.observed.conditions.defaultCacheTtlSeconds, 300);
});

test('xAI task quotes preserve media units and per-resolution original USD rates', async () => {
  for (const historical of [false, true]) {
    const report = await run((body, id) =>
      historical && id === 'xai-video'
        ? gunzipSync(
            readFileSync(
              new URL('./fixtures/official-check/xai-video-earlier-2026-11-18.gz', import.meta.url),
            ),
          )
        : body,
    );
    const ids = [
      'us-xai-grok-imagine-video-standard',
      'us-xai-grok-imagine-video-1.5-standard',
      'us-xai-grok-imagine-video-1.5-lite-standard',
    ];
    const results = ids.map((id) => report.results.find((row) => row.id === id));
    assert.ok(
      results.every((row) => row?.status === 'unchanged'),
      JSON.stringify(results.map((row) => [row?.status, row?.reason])),
    );
    const [original, next, lite] = results;
    assert.equal(original.selected, false);
    assert.equal(original.observed.identity.endpoint, 'https://api.x.ai/v1/videos/generations');
    assert.equal(original.observed.sourcePrice[0].when.resolution, '720p');
    assert.equal(
      original.observed.sourcePrice[0].charges.find(
        (charge) => charge.usageKey === 'input_video_seconds',
      ).amount,
      0.01,
    );
    assert.equal(
      next.observed.cnyCost.find(({ name }) => name === '1080p').charges[0].amount,
      1.75,
    );
    assert.equal(
      lite.observed.sourcePrice.find(({ name }) => name === '1080p').charges[0].amount,
      0.14,
    );
  }
});

test('USD review binds the official documents carrying charge conditions and currency evidence', async () => {
  const report = await run();
  const price = (source, support) => report.responses[source]?.supplemental?.[support];
  assert.ok(price('openai-standard', 'cache')?.sha256);
  assert.ok(price('openai-standard', 'images')?.sha256);
  assert.ok(price('anthropic-global', 'ids')?.sha256);
  assert.ok(price('morph-list', 'api-docs')?.sha256);
  assert.ok(price('kimi-global', 'currency')?.sha256);
});

test('Cohere verifies five priced production IDs and preserves the exact deferred rows', async () => {
  const report = await run();
  const results = report.results.filter(({ sourceId }) => sourceId === 'cohere-api');
  assert.equal(results.length, 5);
  assert.ok(results.every(({ status }) => status === 'unchanged'));
  const r7b = results.find(({ nativeKey }) => nativeKey === 'command-r7b-12-2024');
  assert.equal(r7b.observed.sourcePrice.input, 0.0375);
  assert.equal(r7b.observed.cnyCost.input, 0.2625);
  assert.equal(
    report.results.find(({ nativeKey }) => nativeKey === 'command-a-plus-05-2026').status,
    'deferred',
  );
});

test('xAI global long context starts at exactly 200,000 tokens', async () => {
  const report = await run();
  const rows = report.results.filter(({ sourceId }) => sourceId === 'xai-text');
  assert.equal(rows.length, 9);
  assert.equal(rows.filter(({ status }) => status === 'changed').length, 8);
  const change = report.changes.find(({ id }) => id === 'upstream:xai:grok-4.7:USD');
  assert.equal(change.difference.amounts, undefined);
  assert.equal(change.observed.sourcePrice.tiers[0].tier.comparison, 'gte');
  assert.match(change.candidate.expression, /len <= 199999 \?/);
  assert.equal(change.candidate.record.id, 'us-xai-grok-4.7-global-standard');
  const old = rows.find(({ nativeKey }) => nativeKey === 'grok-4.7-build-fast');
  assert.equal(old.status, 'failed');
  assert.match(old.reason, /Exact xAI text price row/);
});

test('Mistral binds active global USD rates to exact API IDs, and reports older missing IDs', async () => {
  const report = await run();
  const rows = report.results.filter(({ sourceId }) => sourceId === 'mistral-standard');
  assert.equal(rows.length, 34);
  assert.equal(rows.filter(({ status }) => status === 'unchanged').length, 9);
  const row = rows.find(({ nativeKey }) => nativeKey === 'ministral-3b-2512');
  assert.equal(row.observed.sourcePrice.cache_read, 0.01);
  assert.equal(row.observed.cnyCost.cache_read, 0.07);
  assert.equal(rows.find(({ nativeKey }) => nativeKey === 'mistral-medium-2505').status, 'failed');
});
test('Z.AI explicit Free rows are distinct from limited-time free storage and missing Turbo IDs', async () => {
  const report = await run();
  const rows = report.results.filter(({ sourceId }) => sourceId === 'zai-international');
  assert.equal(rows.length, 18);
  const flash = rows.find(({ nativeKey }) => nativeKey === 'glm-4.5-flash');
  assert.equal(flash.status, 'unchanged');
  assert.equal(flash.observed.sourcePrice.cache_read, 0);
  assert.match(
    rows.find(({ nativeKey }) => nativeKey === 'glm-5.3').reason,
    /limited-time free storage/,
  );
  assert.match(rows.find(({ nativeKey }) => nativeKey === 'glm-5-turbo').reason, /Exact price row/);
});

test('Google Developer API preserves Standard modality prices, context tiers and announced future prices separately', async () => {
  const report = await run();
  const rows = report.results.filter(({ sourceId }) => sourceId === 'gemini-developer');
  assert.equal(rows.length, 37);
  const get = (id) => rows.find(({ nativeKey }) => nativeKey === id);
  const carbon = get('gemini-4-carbon');
  assert.equal(carbon.observed.sourcePrice.input, 2);
  assert.equal(carbon.observed.cnyCost.output, 70);
  assert.equal(carbon.observed.conditions.announcedPrices.output.amount, 20);
  const pro = get('gemini-3.1-pro-preview');
  assert.equal(pro.observed.sourcePrice.tiers[0].tier.size, 200000);
  assert.equal(pro.observed.conditions.explicitCacheStorage.amount, 4.5);
  assert.equal(get('gemini-3.1-flash-image').observed.sourcePrice.output_image, 60);
  assert.match(get('gemini-2.5-flash').reason, /audio cache rate.*native/);
  assert.equal(
    report.results.find(({ nativeKey }) => nativeKey === 'gemini-omni-flash-preview').status,
    'deferred',
  );
});

test('MiniMax international preserves the Standard threshold and charges H3 only beyond its free image quota', async () => {
  const report = await run();
  const row = (id) => report.results.find(({ id: resultId }) => resultId === id);
  const llm = row('upstream:minimax:MiniMax-M3:USD');
  assert.equal(llm.observed.sourcePrice.tiers[0].tier.size, 512000);
  assert.equal(llm.observed.sourcePrice.input, 0.3);
  assert.equal(llm.observed.conditions.undiscounted.base.input, 0.6);
  const video = row('us-minimax-minimax-h3-global-video');
  assert.equal(video.status, 'unchanged', video.reason);
  assert.equal(video.observed.identity.endpoint, 'https://api.minimax.io/v2/video_generation');
  assert.equal(video.observed.sourcePrice[0].charges[2].freeQuantity, 5);
  assert.equal(video.observed.cnyCost[0].charges[2].amount, 0.28);
  assert.match(row('upstream:minimax:MiniMax-H3-Max:USD').reason, /native.*binding/);

  const adjusted = await run((body, id) =>
    id === 'minimax-international'
      ? Buffer.from(body.toString().replace('first **5 images**', 'first **6 images**'))
      : body,
  );
  const change = adjusted.changes.find(({ id }) => id === 'us-minimax-minimax-h3-global-video');
  assert.match(
    change.candidate.expression,
    /u\("input_images"\) > 6 \? u\("input_images"\) - 6 : 0/,
  );
  assert.equal(change.difference.amounts, undefined);
});

test('international Step and Upstage retain USD precision and distinguish retired services', async () => {
  const report = await run();
  const row = (id) => report.results.find(({ id: resultId }) => resultId === id);
  assert.equal(row('upstream:stepfun-ai:step-5-preview:USD').status, 'unchanged');
  assert.equal(row('upstream:stepfun-ai:step-3.7-flash:USD').observed.cnyCost.output, 8.05);
  assert.equal(row('upstream:upstage:solar-pro4:USD').status, 'unchanged');
  assert.equal(row('upstream:upstage:solar-mini4:USD').observed.sourcePrice.cache_read, 0.01);
  assert.match(row('upstream:upstage:solar-pro3:USD').reason, /retired.*2026-10-30/);
});
test('Sakana reports a formal future Namazu rate without treating it as currently effective', async () => {
  const report = await run();
  const row = report.results.find(({ id }) => id === 'upstream:sakana:sakana-namazu:USD');
  assert.equal(row?.status, 'future-effective', row?.reason);
  assert.equal(row.observed.effectiveAt, '2026-12-01T10:00:00+09:00');
  assert.equal(row.observed.sourcePrice.input, 1.9);
  assert.equal(row.observed.conditions.currentTariff.input, 0.95);
  assert.equal(row.observed.cnyCost.input, 13.3);
});
