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
  'xai-video': 'xai-video-current',
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
