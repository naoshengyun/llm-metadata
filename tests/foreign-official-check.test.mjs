import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  'openai-upstream': 'osm',
  'openai-upstream--chatgpt-image-latest': 'o-model-chatgpt-image-latest',
  'openai-upstream--gpt-image-1-5': 'o-model-gpt-image-1.5',
  'openai-upstream--o4-mini': 'o-model-o4-mini',
  'openai-upstream--o3-mini': 'o-model-o3-mini',
  'openai-upstream--o1-pro': 'o-model-o1-pro',
  'openai-upstream--o1': 'o-model-o1',
  'openai-upstream--gpt-5-6': 'o-model-gpt-5.6',
  'openai-upstream--gpt-4o': 'o-model-gpt-4o',
  'openai-upstream--gpt-4-1-nano': 'o-model-gpt-4.1-nano',
  'openai-upstream--gpt-4-turbo': 'o-model-gpt-4-turbo',
  'openai-upstream--gpt-4': 'o-model-gpt-4',
  'openai-upstream--gpt-3-5-turbo': 'o-model-gpt-3.5-turbo',
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
  'alibaba-international': 'alibaba',
  'alibaba-international--singapore': 'alibaba-sg-endpoint',
  'gemini-developer': 'gemini-developer',
  'gemini-routed': 'gemini-developer',
  'mistral-standard': 'mistral',
  'mistral-standard--archive-medium': 'm-model-mistral-medium-3-5-26-04',
  'mistral-standard--alias-embed': 'm-model-mistral-embed-23-12',
  'mistral-standard--alias-small': 'm-model-mistral-small-4-0-26-03',
  'mistral-standard--alias-large': 'm-model-mistral-large-4-0',
  'mistral-standard--alias-ministral8': 'm-model-ministral-3-8b-25-12',
  'mistral-standard--alias-ministral3': 'm-model-ministral-3-3b-25-12',
  'mistral-standard--alias-codestral': 'm-model-codestral-25-08',
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
  'anthropic-global--opus-4-5': 'anth-opus45',
  'anthropic-global--ids': 'anthids',
  'morph-list--api-docs': 'morph-docs',
  'kimi-global--currency': 'kimi-balance',
};
const mistralLegacyFixtures = Object.fromEntries(
  [
    'devstral-small-2-25-12',
    'zai-glm-5-2',
    'magistral-medium-1-2-25-09',
    'mistral-medium-3-25-05',
    'mistral-medium-3-1-25-08',
    'mistral-small-3-2-25-06',
    'mistral-nemo-12b-24-07',
  ].map((id) => ['mistral-legacy-' + id, 'm-legacy-' + id + '-2026-11-19']),
);
Object.assign(mistralLegacyFixtures, {
  'mistral-legacy-devstral-2-25-12': 'm-model-devstral-2-25-12-2026-11-18',
  'mistral-legacy-mistral-large-3-25-12': 'm-model-mistral-large-3-25-12-2026-11-18',
  'mistral-legacy-mistral-medium-3-5-26-04': 'm-model-mistral-medium-3-5-26-04-2026-11-18',
  'mistral-voxtral': 'mistral-2026-11-18',
  'mistral-voxtral--model': 'm-legacy-voxtral-small-25-07-2026-11-19',
});
const attemptedAt = '2026-11-18T12:44:58Z';

function run(mutate = (body) => body, options = {}) {
  const checkedAt = options.attemptedAt ?? attemptedAt;
  return checkOfficialPrices({
    baseline,
    attemptedAt: checkedAt,
    previous: options.previous,
    getResponse: async ({ id, url }) => {
      const filename = options.fixtures?.[id] ?? (fixtures[id] && fixtures[id] + '-2026-11-18');
      if (!filename) throw Error('Outside foreign fixture scope');
      const fixture = new URL('./fixtures/official-check/' + filename + '.gz', import.meta.url);
      return {
        url,
        body: mutate(gunzipSync(readFileSync(fixture)), id),
        obtainedAt: checkedAt,
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
    const scoped = report.results.filter(
      (result) =>
        result.sourceId === sourceId &&
        (sourceId !== 'anthropic-global' || result.id.startsWith('us-anthropic-')),
    );
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
  assert.equal(rows.length, 19);
  assert.equal(rows.filter(({ status }) => status === 'unchanged').length, 14);
  assert.equal(
    rows.find(({ nativeKey }) => nativeKey === 'mistral-embed').observed.sourcePrice.cache_read,
    0.01,
  );
  const row = rows.find(({ nativeKey }) => nativeKey === 'ministral-3b-2512');
  assert.equal(row.observed.sourcePrice.cache_read, 0.01);
  assert.equal(row.observed.cnyCost.cache_read, 0.07);
  assert.equal(rows.find(({ nativeKey }) => nativeKey === 'pixtral-12b').status, 'failed');
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
  assert.equal(rows.length, 35);
  const get = (id) => rows.find(({ nativeKey }) => nativeKey === id);
  const carbon = get('gemini-4-carbon');
  assert.equal(carbon.observed.sourcePrice.input, 2);
  assert.equal(carbon.observed.cnyCost.output, 70);
  assert.equal(carbon.observed.conditions.announcedPrices.output.amount, 20);
  const pro = get('gemini-3.1-pro-preview');
  assert.equal(pro.observed.sourcePrice.tiers[0].tier.size, 200000);
  assert.equal(pro.observed.conditions.explicitCacheStorage.amount, 4.5);
  assert.equal(get('gemini-3.1-flash-image').observed.sourcePrice.output_image, 60);
  assert.equal(get('gemini-3.1-flash-lite-image').observed.sourcePrice.output_image, 30);
  assert.equal(get('gemini-3.5-live-translate-preview').observed.sourcePrice.output_audio, 21);
  assert.equal(get('gemini-2.5-flash').status, 'unsupported');
  assert.equal(
    report.results.find(({ nativeKey }) => nativeKey === 'gemini-omni-flash-preview').status,
    'deferred',
  );
});

const googleRoutingEvidence = {
  attemptedAt: '2026-11-19T04:45:00Z',
  fixtures: { 'gemini-routed--deprecations': 'gemini-deprecations-2026-11-19' },
};

test('Google records routed Standard tariffs as reference evidence for the exact request IDs', async () => {
  const report = await run(undefined, googleRoutingEvidence);
  for (const [requested, routed] of [
    ['gemini-3.5-flash', 'gemini-3.6-flash'],
    ['gemini-3.7-flash', 'gemini-3.8-flash'],
  ]) {
    const id = 'upstream:google:' + requested + ':USD';
    const row = report.results.find((result) => result.id === id);
    assert.equal(row.status, 'unsupported', row.reason);
    assert.match(row.reason, /billing terms.*base rates.*unverified/i);
    assert.equal(row.selected, true);
    assert.equal(row.observed.identity.modelId, requested);
    assert.equal(row.observed.identity.endpoint, 'https://generativelanguage.googleapis.com');
    assert.equal(row.observed.identity.currency, 'USD');
    assert.deepEqual(row.observed.sourcePrice, {
      input: 0.75,
      input_audio: 0.75,
      output: 3.75,
      cache_read: 0.075,
    });
    assert.equal(row.observed.cnyCost, undefined);
    assert.equal(row.observed.conditions.routedModelId, routed);
    assert.equal(row.observed.conditions.explicitCacheStorage.amount, 0.5);
    assert.equal(row.observed.conditions.announcedPrices.output.amount, 7.5);
    assert.equal(row.observed.conditions.announcedPrices.output.starts, 'January 1, 2027');
    assert.match(row.evidence.supplemental.deprecations.sha256, /^[0-9a-f]{64}$/);
    assert.ok(!report.changes.some((change) => change.id === id));
  }
});

test('A Gemini migration recommendation cannot price the old request ID', async () => {
  const report = await run(
    (body, id) =>
      id === 'gemini-routed--deprecations'
        ? Buffer.from(
            body
              .toString()
              .replace(
                'automatically routes API requests to `gemini-3.6-flash`',
                'recommends upgrading to `gemini-3.6-flash`',
              ),
          )
        : body,
    googleRoutingEvidence,
  );
  const affected = report.results.find(({ id }) => id === 'upstream:google:gemini-3.5-flash:USD');
  assert.equal(affected.status, 'failed');
  assert.match(affected.reason, /No exact automatic routing/);
  assert.equal(affected.observed, undefined);
  assert.ok(!report.changes.some(({ id }) => id === affected.id));
  const other = report.results.find(({ id }) => id === 'upstream:google:gemini-3.7-flash:USD');
  assert.equal(other.status, 'unsupported', other.reason);
});

test('Routed Gemini pricing requires an hourly storage tariff or explicit implicit-only caching', async () => {
  const storagePrices =
    /^\s*\$0\.50 \/ 1,000,000 tokens per hour \(storage price\) through December 31, 2026\.\s*\n\s*\$1\.00 \/ 1,000,000 tokens per hour \(storage price\) starting January 1, 2027\.$/m;
  const implicitOnly = '  Implicit caching only (explicit caching is not supported).';
  for (const [replacement, expected] of [
    ['', 'failed'],
    ['\n' + implicitOnly, 'unsupported'],
    ['$&\n' + implicitOnly, 'failed'],
  ]) {
    const report = await run((body, id) => {
      if (!['gemini-routed', 'gemini-developer'].includes(id)) return body;
      const page = body.toString();
      const start = page.indexOf('## Gemini 3.6 Flash ');
      const end = page.indexOf('\n## ', start + 3);
      const section = page.slice(start, end);
      assert.match(section, storagePrices);
      const updated = section.replace(storagePrices, replacement);
      return Buffer.from(page.slice(0, start) + updated + page.slice(end));
    }, googleRoutingEvidence);
    const result = (model) =>
      report.results.find(({ id }) => id === 'upstream:google:' + model + ':USD');
    const routed = result('gemini-3.5-flash');
    assert.equal(routed.status, expected, routed.reason);
    if (expected === 'failed') {
      assert.match(routed.reason, /explicit cache storage/);
      assert.ok(!report.changes.some(({ id }) => id === routed.id));
    } else {
      assert.equal(routed.observed.conditions.cacheMode, 'implicit-only');
      assert.equal(routed.observed.conditions.explicitCacheStorage, undefined);
    }
    assert.equal(result('gemini-3.6-flash').status, 'changed');
    assert.equal(result('gemini-3.7-flash').status, 'unsupported');
  }
});

test('Routed Gemini prices require current evidence at their announced rollover', async () => {
  const report = await run(undefined, {
    ...googleRoutingEvidence,
    attemptedAt: '2027-01-01T00:00:00Z',
  });
  const routed = report.results.filter(({ sourceId }) => sourceId === 'gemini-routed');
  assert.equal(routed.length, 2);
  for (const row of routed) {
    assert.equal(row.status, 'failed');
    assert.match(row.reason, /rate needs current price and effective timezone/);
    assert.ok(!report.changes.some(({ id }) => id === row.id));
  }
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
  for (const model of ['solar-pro2', 'solar-pro3']) {
    const retired = row('upstream:upstage:' + model + ':USD');
    assert.equal(retired.status, 'unsupported', retired.reason);
    assert.deepEqual(retired.observed.sourcePrice, { input: 0.15, cache_read: 0.015, output: 0.6 });
    assert.equal(retired.observed.conditions.endOfServiceDate, '2026-10-30');
    assert.equal(retired.observed.conditions.timeZone, 'Asia/Seoul');
    assert.ok(!report.changes.some(({ id }) => id === retired.id));
  }
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

test('OpenAI upstream models use the correct Standard tables and retain explicit old ID gaps', async () => {
  const report = await run();
  const row = (model) =>
    report.results.find(({ id }) => id === 'upstream:openai:' + model + ':USD');
  assert.equal(row('gpt-5').status, 'unchanged');
  assert.equal(row('gpt-5.4').observed.sourcePrice.tiers[0].output, 22.5);
  assert.equal(row('gpt-6.2-astra').observed.sourcePrice.cache_write_12h, 20);
  assert.equal(row('gpt-5.6').observed.sourcePrice.cache_write_12h, 10);
  assert.equal(row('text-embedding-3-large').observed.cnyCost.input, 0.91);
  assert.equal(row('gpt-image-1.5').observed.sourcePrice.output_image, 32);
  assert.match(row('gpt-4o-2024-05-13').reason, /Shut down/);
  assert.match(row('gpt-5.3-codex-spark').reason, /Exact price row/);
});

test('Alibaba International uses the Singapore service scope and preserves mode tariffs', async () => {
  const report = await run();
  const rows = report.results.filter(({ sourceId }) => sourceId === 'alibaba-international');
  assert.equal(rows.length, 49);
  const id = (model) => rows.find(({ nativeKey }) => nativeKey === model);
  assert.equal(id('qwen3.6-35b-a3b').observed.sourcePrice.input, 0.375);
  assert.equal(id('qwen3.6-35b-a3b').observed.cnyCost.output, 15.75);
  assert.equal(id('qwen-plus-character-ja').observed.sourcePrice.input, 0.5);
  assert.match(id('qwen3.7-max').reason, /requires cache evidence/);
});

test('the selected Claude Opus 4.5 API alias has its own reviewed identity and complete cache TTLs', async () => {
  const report = await run();
  const change = report.changes.find(({ id }) => id === 'upstream:anthropic:claude-opus-4-5:USD');
  assert.equal(change?.selected, true);
  assert.equal(change.observed.sourcePrice.cache_write_1h, 10);
  assert.equal(change.observed.cnyCost.cache_write_1h, 70);
});

function replaceEvidence(body, from, to) {
  assert.ok(body.includes(from));
  return Buffer.from(body.toString().replace(from, to));
}

test('a changed selected USD price passes candidate rebuild with precisely one conversion', async () => {
  const report = await run((body, id) =>
    id === 'openai-standard'
      ? replaceEvidence(
          body,
          '| gpt-6.1-terra | $1.00 | $5.00 |',
          '| gpt-6.1-terra | $1.00 | $5.25 |',
        )
      : body,
  );
  const change = report.changes.find(({ id }) => id === 'us-openai-gpt-6.1-terra-standard');
  assert.equal(change.observed.sourcePrice.output, 5.25);
  assert.equal(change.observed.cnyCost.output, 36.75);
  const catalog = JSON.parse(readFileSync('data/cny/official-catalog.json'));
  catalog.records = catalog.records.map((entry) =>
    entry.id === change.id ? change.candidate.record : entry,
  );
  const path = join(directory, 'foreign-mutated-catalog.json');
  writeFileSync(path, JSON.stringify(catalog));
  const out = join(directory, 'foreign-mutated-candidate');
  execFileSync(process.execPath, [
    'scripts/build-unified-cny.mjs',
    out,
    'data/cny/unified-policy.json',
    path,
    'data/cny/proposed-selection.json',
    'data/upstream/24d3f35c',
    baseline,
  ]);
  const actual = JSON.parse(readFileSync(join(out, 'api/newapi/ratio_config.json')));
  assert.equal(actual.data.billing_expr['gpt-6.1-terra'], change.candidate.expression);
  assert.match(change.candidate.expression, /c \* 36\.75/);
});

test('loss of a charged field, a table migration and a network timeout preserve the last successful check', async () => {
  const previous = await run();
  const attempts = [
    {
      id: 'openai-standard',
      result: 'us-openai-gpt-6.1-terra-standard',
      mutate: (body) => replaceEvidence(body, '| gpt-6.1-terra | $1.00 |', '| gpt-6.1-terra | - |'),
      reason: /Invalid USD price/,
    },
    {
      id: 'anthropic-global',
      result: 'us-anthropic-claude-fable-5-2-standard',
      mutate: (body) => replaceEvidence(body, '5m cache writes |', '30m writes |'),
      reason: /changed pricing table/,
    },
    {
      id: 'morph-list',
      result: 'upstream:morph:morph-v3-fast:USD',
      mutate: () => {
        throw Error('fixture timeout');
      },
      reason: /timeout/,
    },
  ];
  for (const { id, result, mutate, reason } of attempts) {
    const report = await run((body, source) => (source === id ? mutate(body) : body), {
      previous,
      attemptedAt: '2026-11-18T13:17:00Z',
    });
    const failure = report.results.find((row) => row.id === result);
    assert.equal(failure.status, 'failed');
    assert.equal(failure.latestSuccessfulAt, attemptedAt);
    assert.match(failure.reason, reason);
    assert.ok(!report.changes.some((change) => change.id === result));
  }
});

test('Morph checks prior real API JSON and rejects the third-party channel response URL', async () => {
  const previous = await run((body, id) =>
    id === 'morph-list'
      ? gunzipSync(
          readFileSync(
            new URL('./fixtures/official-check/morph-earlier-2026-11-18.gz', import.meta.url),
          ),
        )
      : body,
  );
  assert.equal(
    previous.results.find(({ id }) => id === 'upstream:morph:morph-dsv4flash:USD').status,
    'unchanged',
  );
  const { adapter } = await import('../scripts/official-sources/morph-list.mjs');
  const incorrect = await checkOfficialPrices({
    baseline,
    attemptedAt,
    adapters: [adapter],
    getResponse: async ({ url }) => ({
      url: url.replace('?prices=list', ''),
      body: Buffer.from('{}'),
      obtainedAt: attemptedAt,
    }),
  });
  const row = incorrect.results.find(({ id }) => id === 'upstream:morph:morph-v3-fast:USD');
  assert.equal(row.status, 'failed');
  assert.match(row.reason, /unregistered official URL|unregistered URL/);
});

test('Gemini preserves per-song and distinct audio-cache rates without compiling partial quotes', async () => {
  for (const file of ['gemini-developer-2026-11-18', 'gemini-reference-2026-11-19']) {
    const report = await run(undefined, { fixtures: { 'gemini-developer': file } });
    const find = (modelId) =>
      report.results.find(({ id }) => id === 'upstream:google:' + modelId + ':USD');
    const clip = find('lyria-3-clip-preview');
    const pro = find('lyria-3-pro-preview');
    const flash = find('gemini-2.5-flash');
    assert.equal(clip.status, 'unsupported', clip.reason);
    assert.equal(pro.status, 'unsupported', pro.reason);
    assert.equal(clip.observed.sourceUnit, 'per_song');
    assert.deepEqual(clip.observed.sourcePrice, { output: 0.04 });
    assert.deepEqual(clip.observed.conditions, { durationSeconds: 30 });
    assert.deepEqual(pro.observed.sourcePrice, { output: 0.08 });
    assert.deepEqual(pro.observed.conditions, { fullSong: true });
    assert.equal(flash.status, 'unsupported', flash.reason);
    assert.equal(flash.observed.sourcePrice.cache_read, 0.03);
    assert.equal(flash.observed.conditions.audioCacheRead.amount, 0.1);
    assert.equal(flash.observed.conditions.explicitCacheStorage.amount, 1);
    assert.ok(!report.changes.some(({ id }) => [clip.id, pro.id, flash.id].includes(id)));
  }
});

test('Gemini reference results require the exact duration, modality, and storage units', async () => {
  const report = await run((body, id) =>
    id === 'gemini-developer'
      ? replaceEvidence(
          replaceEvidence(body, '$0.04 per song', '$0.04 per second'),
          '$0.1 (audio)',
          '$0.1 (video)',
        )
      : body,
  );
  const result = (id) => report.results.find(({ nativeKey }) => nativeKey === id);
  assert.equal(result('lyria-3-clip-preview').status, 'failed');
  assert.equal(result('lyria-3-pro-preview').status, 'unsupported');
  assert.equal(result('gemini-2.5-flash').status, 'failed');
});

test('Upstage keeps a future or mismatched retired card out of historical results', async () => {
  const report = await run(undefined, { attemptedAt: '2026-10-30T14:59:00Z' });
  const result = (report) =>
    report.results.find(({ id }) => id === 'upstream:upstage:solar-pro3:USD');
  assert.equal(result(report).status, 'failed');
  assert.match(result(report).reason, /Past end of service/);

  const altered = await run((body, id) =>
    id === 'upstage-api'
      ? Buffer.from(body.toString().replaceAll('utm_content=solar-pro3"', 'utm_content=unknown"'))
      : body,
  );
  assert.equal(result(altered).status, 'failed');
  assert.match(result(altered).reason, /Exact Upstage alias/);
});

test('Mistral exact model cards supply archival fees and distinguish future retirement', async () => {
  const report = await run(undefined, { fixtures: mistralLegacyFixtures });
  const historical = report.results.filter(({ sourceId }) =>
    sourceId?.startsWith('mistral-legacy-'),
  );
  assert.equal(historical.length, 13);
  assert.ok(historical.every(({ status }) => status === 'unsupported'));
  const find = (model) => historical.find(({ nativeKey }) => nativeKey === model).observed;
  assert.deepEqual(find('devstral-medium-latest').sourcePrice, { input: 0.4, output: 2 });
  assert.equal(find('devstral-medium-latest').conditions.historical, true);
  assert.equal(find('mistral-medium-latest').conditions.historical, false);
  assert.equal(find('mistral-medium-latest').conditions.retirementDate, '2027-04-30');
  assert.equal(find('glm-5-2').sourcePrice.cache_read, 0.14);
  assert.equal(find('mistral-small-2506').conditions.cacheReadRatePublished, false);
  for (const model of ['voxtral-small-2507', 'voxtral-small-latest']) {
    const quote = report.results.find(({ nativeKey }) => nativeKey === model);
    assert.equal(quote.status, 'unsupported', quote.reason);
    assert.deepEqual(quote.observed.sourcePrice.cachedAudioInput, {
      amount: 0.0004,
      unit: 'per_minute',
    });
    assert.equal(quote.observed.sourcePrice.output, 0.4);
  }
  const named = await run(
    (body, id) =>
      id === 'mistral-legacy-zai-glm-5-2'
        ? Buffer.from(body.toString().replace('`glm-5-2`', '`another-id`'))
        : body,
    { fixtures: mistralLegacyFixtures },
  );
  assert.equal(named.results.find(({ nativeKey }) => nativeKey === 'glm-5-2').status, 'failed');
  assert.equal(
    named.results.find(({ nativeKey }) => nativeKey === 'zai-glm-5-2').status,
    'unsupported',
  );
  assert.ok(!report.changes.some(({ id }) => historical.some((row) => row.id === id)));

  const outage = await run(
    (body, id) => {
      if (id === 'mistral-legacy-zai-glm-5-2') throw Error('Official model card unavailable');
      return body;
    },
    { fixtures: mistralLegacyFixtures },
  );
  assert.equal(
    outage.results.find(({ nativeKey }) => nativeKey === 'zai-glm-5-2').status,
    'failed',
  );
  assert.equal(
    outage.results.find(({ nativeKey }) => nativeKey === 'devstral-2512').status,
    'unsupported',
  );
});

test('OpenAI shutdown tariffs and Realtime cache evidence cannot create a price candidate', async () => {
  const report = await run();
  const result = (model) =>
    report.results.find(({ id }) => id === 'upstream:openai:' + model + ':USD');
  const old = result('gpt-4.1-nano');
  assert.equal(old.status, 'unsupported', old.reason);
  assert.deepEqual(old.observed.sourcePrice, { input: 0.1, output: 0.4, cache_read: 0.025 });
  assert.deepEqual(old.observed.conditions, { historical: true, status: 'shut-down' });
  const realtime = result('gpt-realtime-2.1');
  assert.equal(realtime.status, 'unsupported', realtime.reason);
  assert.equal(realtime.observed.sourcePrice.input_audio, 32);
  assert.equal(realtime.observed.conditions.audioCacheRead.amount, 0.4);
  assert.ok(!report.changes.some(({ id }) => [old.id, realtime.id].includes(id)));

  const renamed = await run((body, id) =>
    id === 'openai-upstream--gpt-4-1-nano'
      ? replaceEvidence(body, 'Status: Shut down', 'Status: Available')
      : body,
  );
  assert.equal(renamed.results.find(({ id }) => id === old.id).status, 'failed');
});

test('Gemini preserves independent media amounts and units without using a partial price', async () => {
  const report = await run(undefined, {
    fixtures: { 'gemini-developer': 'gemini-reference-2026-11-19' },
  });
  const row = (model) => report.results.find(({ nativeKey }) => nativeKey === model);
  const image = row('gemini-2.5-flash-image');
  const live = row('gemini-3.1-flash-live-preview');
  const embed = row('gemini-embedding-2');
  assert.equal(image.status, 'unsupported', image.reason);
  assert.equal(image.observed.conditions.imageEquivalent.amount, 0.039);
  assert.equal(image.observed.conditions.imageEquivalent.outputTokens, 1290);
  assert.equal(live.status, 'unsupported', live.reason);
  assert.equal(live.observed.conditions.videoInput.amount, 1);
  assert.equal(embed.status, 'unsupported', embed.reason);
  assert.equal(embed.observed.conditions.videoInput.amount, 12);
  assert.ok(!report.changes.some(({ id }) => [image.id, live.id, embed.id].includes(id)));
});
