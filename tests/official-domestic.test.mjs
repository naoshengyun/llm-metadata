import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';

const directory = mkdtempSync(join(tmpdir(), 'official-domestic-'));
const baseline = join(directory, 'baseline');
after(() => rmSync(directory, { recursive: true, force: true }));
execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
const attemptedAt = '2026-11-18T13:00:00Z';

function check(sourceName, transform = (body) => body, status = 200) {
  const body = gunzipSync(
    readFileSync(
      new URL(`./fixtures/official-check/domestic/${sourceName}-2026-11-18.gz`, import.meta.url),
    ),
  );
  return checkOfficialPrices({
    baseline,
    attemptedAt,
    getResponse: async ({ id, url }) => {
      const supplementNames = {
        'tencent-cn--migration': 'tencent-migration',
        'alibaba-cn--cache': 'alibaba-cache',
        'stepfun-cn--audio': 'stepfun-audio',
        'minimax-cn--cache': 'minimax-cache',
      };
      if (supplementNames[id] && id.startsWith(sourceName + '-cn--')) {
        return {
          body: gunzipSync(
            readFileSync(
              new URL(
                `./fixtures/official-check/domestic/${supplementNames[id]}-2026-11-18.gz`,
                import.meta.url,
              ),
            ),
          ),
          url,
          obtainedAt: attemptedAt,
        };
      }
      if (id !== `${sourceName}-cn`) throw Error('Response outside fixture scope');
      return { body: transform(body), url, obtainedAt: attemptedAt, status };
    },
  });
}

const xiaomiId = 'cn-xiaomi-mimo-v2.6-pro-standard';
const resultFor = (report, id = xiaomiId) => report.results.find(({ quoteId }) => quoteId === id);

test('Xiaomi uses the domestic real-time tariff and preserves separate cache-write policy', async () => {
  const result = resultFor(await check('xiaomi'));
  assert.equal(result?.status, 'unchanged');
  assert.deepEqual(result.observed.sourcePrice, { input: 3, output: 6, cache_read: 0.025 });
  assert.equal(result.observed.conditions.cacheWrite, 'limited-time-free');
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.equal(data.billing_expr['mimo-v2.6-pro'], 'tier("standard", p * 3 + cr * 0.025 + c * 6)');
});

test('Bailing and LongCat review original RMB prices from tables that also quote discounts', async () => {
  const bailing = resultFor(await check('bailing'), 'cn-bailing-Ling-3.1-flash-standard');
  const longcat = resultFor(await check('longcat'), 'cn-longcat-LongCat-2.0-standard');
  assert.equal(bailing?.status, 'unchanged');
  assert.equal(longcat?.status, 'unchanged');
  assert.deepEqual(bailing.observed.sourcePrice, { input: 2, output: 6, cache_read: 0.4 });
  assert.deepEqual(longcat.observed.sourcePrice, { input: 5, output: 20, cache_read: 0.1 });
});

test('BigModel China reads cache storage and model modalities as conditions alongside CNY charges', async () => {
  const result = resultFor(await check('zhipu'), 'cn-zhipu-glm-5.3-flash-standard');
  assert.equal(result.status, 'changed');
  assert.deepEqual(result.observed.sourcePrice, { input: 0.8, output: 2.8, cache_read: 0.23 });
  assert.equal(result.observed.conditions.cacheStorage, 'limited-time-free');
  assert.deepEqual(result.observed.conditions.inputModalities, ['图片', '视频', '文件', '文本']);
});

test('Ark keeps implicit token tiers and image task charges distinct', async () => {
  const report = await check('volcengine');
  const text = report.results.find(({ quoteId }) =>
    quoteId?.startsWith('volcengine--doubao-seed-2-0-pro-'),
  );
  assert.equal(text.status, 'changed', text.reason);
  assert.deepEqual(text.observed.sourcePrice.tiers[1], {
    tier: { size: 128000 },
    input: 9.6,
    output: 48,
    cache_read: 1.92,
  });
  const image = report.results.find(({ quoteId }) =>
    quoteId?.startsWith('volcengine--doubao-seedream-5-0-flash-'),
  );
  assert.equal(image.status, 'changed');
  assert.equal(image.observed.sourcePrice[0].charges[0].amount, 0.12);
  assert.equal(image.observed.sourcePrice[0].charges[2].amount, 0);
  assert.equal(
    report.results.find(({ identity }) => identity.modelId === 'doubao-seedance-2-5-260628')
      .coverageStatus,
    'validation-held',
  );
});

test('a supplemented tariff records both responses and fails closed if a required document fails', async () => {
  const { adapter } = await import('../scripts/official-sources/xiaomi-cn.mjs');
  const body = gunzipSync(
    readFileSync(
      new URL('./fixtures/official-check/domestic/xiaomi-2026-11-18.gz', import.meta.url),
    ),
  );
  const cache = 'https://mimo.mi.com/static/docs/cache-test.md';
  const source = {
    ...adapter,
    supplemental: [{ id: 'cache', url: cache }],
    parse({ supplemental, ...primary }) {
      assert.equal(supplemental.get('cache').body.toString(), 'Cache fixtures');
      return adapter.parse(primary);
    },
  };
  async function run(cacheStatus) {
    return checkOfficialPrices({
      baseline,
      attemptedAt,
      adapters: [source],
      getResponse: async ({ id, url }) =>
        id === 'xiaomi-cn'
          ? { body, url, obtainedAt: attemptedAt }
          : { body: 'Cache fixtures', url, obtainedAt: attemptedAt, status: cacheStatus },
    });
  }
  const good = await run(200);
  assert.equal(resultFor(good).status, 'unchanged', resultFor(good).reason);
  assert.equal(resultFor(good).evidence.supplemental.cache.finalUrl, cache);
  assert.equal(
    good.responses['xiaomi-cn--cache'].sha256,
    '37cd203d7384dcdc707225e0a53ea9c697911efb38f452ac559746308718b05c',
  );
  const bad = await run(503);
  assert.equal(resultFor(bad).status, 'failed');
  assert.match(resultFor(bad).reason, /cache.*HTTP 503/);
  assert.equal(bad.changes.length, 0);
});

test('Step 5 captures official grandfathering and Tencent distinguishes the migrated API key', async () => {
  const step = resultFor(await check('stepfun'), 'cn-stepfun-step-5-preview-standard');
  assert.equal(step?.status, 'unchanged');
  assert.deepEqual(step.observed.sourcePrice, { input: 7, output: 20, cache_read: 0.7 });
  assert.equal(step.observed.conditions.legacyCacheHit.amount, 0.35);
  const tencent = resultFor(await check('tencent'), 'cn-tencent-hy3-preview-standard');
  assert.equal(tencent?.status, 'unchanged', tencent?.reason);
  assert.deepEqual(tencent.observed.sourcePrice, { input: 1, output: 4, cache_read: 0.25 });
  assert.equal(tencent.observed.conditions.billedAsModel, 'hy3');
  assert.equal(tencent.observed.effectiveAt, '2026-08-31T00:00:00+08:00');
});

test('Ark reviews real video Token tariffs and keeps the #32 4K gate', async () => {
  const report = await check('volcengine');
  const id = 'volcengine--doubao-seedance-2-0-260128--cn-beijing-task-online-original';
  const result = resultFor(report, id);
  assert.equal(result.status, 'changed', result.reason);
  assert.deepEqual(
    result.observed.sourcePrice.slice(0, 2).map((tier) => tier.charges[0].amount),
    [16, 26],
  );
  assert.equal(result.observed.conditions.videoInputTokenMinimum, true);
  assert.equal(result.observed.conditions.billingUsage, 'usage.completion_tokens');
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.equal(data.billing_expr['doubao-seedance-2-5-260628'], undefined);
});

test('Bailian Beijing tiers use compatible-mode original CNY and distinguish cache modes', async () => {
  const report = await check('alibaba');
  const implicit = resultFor(
    report,
    'dashscope--qwen3.7-plus--cn-beijing-online-original-implicit',
  );
  const explicit = resultFor(
    report,
    'dashscope--qwen3.7-plus--cn-beijing-online-original-explicit',
  );
  assert.equal(implicit.status, 'changed', implicit.reason);
  assert.equal(explicit.status, 'changed', explicit.reason);
  assert.equal(implicit.observed.sourcePrice.input, 2);
  assert.equal(implicit.observed.sourcePrice.tiers[0].cache_read, 1.2);
  assert.equal(explicit.observed.sourcePrice.tiers[0].cache_write, 7.5);
  assert.equal(explicit.observed.conditions.cacheWriteTtlSeconds, 300);
  assert.equal(
    explicit.evidence.supplemental.cache.finalUrl,
    'https://help.aliyun.com/zh/model-studio/context-cache',
  );
});

test('Chinese holidays and hourly ASR enter coverage with complete evidence and no sync candidate', async () => {
  const deepseek = await check('deepseek');
  const flash = resultFor(deepseek, 'upstream:deepseek:deepseek-v4-flash-vision-exp:CNY');
  assert.equal(flash.status, 'unsupported');
  assert.equal(flash.observed.conditions.billedAsModel, 'deepseek-flash');
  assert.equal(flash.observed.conditions.chineseLegalHolidays, 'off_peak');
  assert.equal(flash.observed.sourcePrice.schedule.windows[0].input, 2);
  assert.equal(
    deepseek.changes.some(({ id }) => id === flash.id),
    false,
  );

  const step = await check('stepfun');
  const asr = resultFor(step, 'upstream:stepfun:stepaudio-2.5-asr:unknown');
  assert.equal(asr.status, 'future-effective');
  assert.deepEqual(asr.observed.sourcePrice, { amount: 0.45 });
  assert.equal(asr.observed.conditions.beforeEffectiveRate.amount, 0.15);
  assert.equal(asr.observed.effectiveAt, '2026-11-23T12:00:00+08:00');
  assert.equal(step.changes.find(({ id }) => id === asr.id)?.candidate, undefined);
});

test('MiniMax uses the original standard M3 bands and confirms the M3.1 prompt-cache meter', async () => {
  const report = await check('minimax');
  const m3 = resultFor(report, 'cn-minimax-MiniMax-M3-standard');
  assert.equal(m3?.status, 'unchanged', m3?.reason);
  assert.equal(m3.observed.sourcePrice.input, 4.2);
  assert.equal(m3.observed.sourcePrice.tiers[0].tier.size, 512000);
  assert.equal(m3.observed.sourcePrice.tiers[0].output, 33.6);
  const flash = resultFor(report, 'cn-minimax-MiniMax-M3.1-Flash-standard');
  assert.equal(flash?.status, 'unchanged', flash?.reason);
  assert.deepEqual(flash.observed.sourcePrice, { input: 1, output: 4, cache_read: 0.1 });
  assert.equal(flash.observed.conditions.cacheMinimumInputTokens, 512);
});

test('missing official structure and HTTP errors fail through the daily checker', async () => {
  const examples = {
    alibaba: 'dashscope--qwen3.7-plus--cn-beijing-online-original-implicit',
    bailing: 'cn-bailing-Ling-3.1-flash-standard',
    deepseek: 'upstream:deepseek:deepseek-v4-pro:CNY',
    longcat: 'cn-longcat-LongCat-2.0-standard',
    minimax: 'cn-minimax-MiniMax-M3.1-Flash-standard',
    stepfun: 'cn-stepfun-step-5-preview-standard',
    tencent: 'cn-tencent-hy4-standard',
    volcengine: 'volcengine--doubao-seedream-5-0-flash-260915--cn-beijing-task-online-original',
    xiaomi: xiaomiId,
    zhipu: 'cn-zhipu-glm-5.3-flash-standard',
  };
  for (const [family, quoteId] of Object.entries(examples)) {
    const absent = await check(family, () => Buffer.from('<html>no tariff here</html>'));
    assert.equal(resultFor(absent, quoteId).status, 'failed', family);
    assert.equal(
      absent.changes.some(({ id }) => id === quoteId),
      false,
      family,
    );
    const failed = await check(family, (body) => body, 503);
    assert.equal(resultFor(failed, quoteId).reason, 'Official source HTTP 503', family);
  }
});

test('a malformed Xiaomi field rejects the tariff, while an exact change builds a CNY candidate', async () => {
  const mutate = (replacement) => (body) =>
    Buffer.from(body.toString().replace('¥0.025</span>', replacement + '</span>'));
  const given = await check('xiaomi', mutate('—'));
  assert.equal(resultFor(given).status, 'failed');
  assert.equal(resultFor(given).latestSuccessfulAt, null);
  const updated = await check('xiaomi', mutate('¥0.026'));
  const change = updated.changes.find(({ id }) => id === xiaomiId);
  assert.equal(change.difference.amounts.before.cache_read, 0.025);
  assert.equal(change.difference.amounts.after.cache_read, 0.026);
  assert.equal(change.observed.cnyCost.cache_read, 0.026);
  const { writeFileSync } = await import('node:fs');
  const rawCatalog = JSON.parse(readFileSync('data/cny/official-catalog.json'));
  rawCatalog.records = rawCatalog.records.map((record) =>
    record.id === xiaomiId ? change.candidate.record : record,
  );
  const catalogPath = join(directory, 'updated-catalog.json');
  writeFileSync(catalogPath, JSON.stringify(rawCatalog));
  const out = join(directory, 'updated-candidate');
  execFileSync(process.execPath, [
    'scripts/build-unified-cny.mjs',
    out,
    'data/cny/unified-policy.json',
    catalogPath,
    'data/cny/proposed-selection.json',
    'data/upstream/24d3f35c',
    baseline,
  ]);
  const { data } = JSON.parse(readFileSync(join(out, 'api/newapi/ratio_config.json')));
  assert.equal(data.billing_expr['mimo-v2.6-pro'], 'tier("standard", p * 3 + cr * 0.026 + c * 6)');
  assert.equal(data.billing_expr['doubao-seedance-2-5-260628'], undefined);
});

test('a native capability exclusion keeps DeepSeek official evidence and prevents fallback pricing', async () => {
  const read = (name) => JSON.parse(readFileSync(join(baseline, name)));
  const { data } = read('api/newapi/ratio_config.json');
  const { models } = read('coverage.json');
  const keys = [
    'deepseek-flash',
    'deepseek-v4-flash',
    'deepseek-v4-flash-vision-exp',
    'deepseek-v4-pro',
  ];
  for (const modelId of keys) {
    const model = models.find((row) => row.providerId === 'deepseek' && row.modelId === modelId);
    assert.equal(data.billing_expr[modelId], undefined, modelId);
    assert.equal(model.status, 'unsupported');
    assert.equal(model.upstreamPrice.sourceCurrency, 'CNY');
    assert.equal(model.upstreamPrice.conditions.chineseLegalHolidays, 'off_peak');
    assert.equal(
      model.upstreamPrice.source.url,
      'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    );
    assert.match(model.upstreamPrice.source.sha256, /^[0-9a-f]{64}$/);
  }
});

test('BigModel publishes exact current and maintained legacy bands, including a free official price', async () => {
  const report = await check('zhipu');
  const tiered = resultFor(report, 'cn-zhipu-glm-5.1-standard');
  assert.equal(tiered?.status, 'unchanged', tiered?.reason);
  assert.deepEqual(tiered.observed.sourcePrice.tiers, [
    { tier: { size: 31999 }, input: 8, output: 28, cache_read: 2 },
  ]);
  const free = resultFor(report, 'cn-zhipu-glm-4.6v-flash-standard');
  assert.equal(free?.status, 'unchanged', free?.reason);
  assert.deepEqual(free.observed.sourcePrice, { input: 0, output: 0, cache_read: 0 });
  assert.equal(free.observed.conditions.tokenTariff, 'official-free');
});

test('BigModel input and output cross-conditions have evidence without a misleading sync expression', async () => {
  const report = await check('zhipu');
  const result = resultFor(report, 'upstream:zhipuai:glm-4.7:CNY');
  assert.equal(result.status, 'unsupported');
  assert.equal(result.observed.sourcePrice.bands[0].output, 8);
  assert.equal(result.observed.sourcePrice.bands[1].output, 14);
  assert.equal(
    report.changes.some(({ id }) => id === result.id),
    false,
  );
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.equal(data.billing_expr['glm-4.7'], undefined);
  assert.equal(data.billing_expr['glm-4.5-air'], undefined);
});
