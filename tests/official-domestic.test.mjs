import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';
import { readHistoricalOfficialInputs } from './fixtures/november-2026-cny.mjs';

const directory = mkdtempSync(join(tmpdir(), 'official-domestic-'));
const baseline = join(directory, 'baseline');
after(() => rmSync(directory, { recursive: true, force: true }));
execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
const attemptedAt = '2026-11-18T13:00:00Z';

const bailianExplicitReference = 'dashscope--qwen3.7-plus--cn-beijing-online-original-explicit';
const kimiProBatchReference = 'cn-moonshot-kimi-k3.1-pro-batch';
const historicalReferenceBaseline = join(directory, 'historical-reference-baseline');
const currentCatalog = JSON.parse(readFileSync('data/cny/official-catalog.json'));
const historicalReferences = new Map(
  readHistoricalOfficialInputs()
    .catalog.records.filter(({ id }) =>
      [bailianExplicitReference, kimiProBatchReference].includes(id),
    )
    .map((record) => [record.id, record]),
);
assert.equal(historicalReferences.size, 2);
const historicalReferenceCatalog = join(directory, 'historical-reference-catalog.json');
writeFileSync(
  historicalReferenceCatalog,
  JSON.stringify({
    ...currentCatalog,
    records: currentCatalog.records.map((record) => historicalReferences.get(record.id) ?? record),
  }),
);
execFileSync(process.execPath, [
  'scripts/build-unified-cny.mjs',
  historicalReferenceBaseline,
  'data/cny/unified-policy.json',
  historicalReferenceCatalog,
]);

function check(
  sourceName,
  transform = (body) => body,
  status = 200,
  supplementalStatus = 200,
  captureAt = attemptedAt,
  { sourceFixtures = {}, comparison = baseline } = {},
) {
  const captureDate = captureAt.slice(0, 10);
  const body = gunzipSync(
    readFileSync(
      new URL(
        `./fixtures/official-check/domestic/${sourceName}-${captureDate}.gz`,
        import.meta.url,
      ),
    ),
  );
  return checkOfficialPrices({
    baseline: comparison,
    attemptedAt: captureAt,
    getResponse: async ({ id, url }) => {
      const supplementNames = {
        'tencent-cn--migration': 'tencent-migration',
        'alibaba-cn--cache': 'alibaba-cache',
        'alibaba-cn--thinking': 'alibaba-thinking',
        'alibaba-cn--omni': 'alibaba-omni',
        'alibaba-cn--character': 'alibaba-character',
        'volcengine-cn--model-list': 'volcengine-models',
        'minimax-cn--cache': 'minimax-cache',
        'minimax-cn--video': 'minimax-video',
      };
      const stepfunAudio =
        sourceName === 'stepfun' &&
        url === 'https://platform.stepfun.com/docs/zh/guides/models/audio.md';
      const supplement = stepfunAudio
        ? 'stepfun-audio'
        : id.startsWith(sourceName + '-cn--') && supplementNames[id];
      if (supplement) {
        const supplementDate = supplement === 'volcengine-models' ? captureDate : '2026-11-18';
        const fixture = sourceFixtures[id] ?? supplement + '-' + supplementDate;
        return {
          body: gunzipSync(
            readFileSync(
              new URL(`./fixtures/official-check/domestic/${fixture}.gz`, import.meta.url),
            ),
          ),
          url,
          obtainedAt: captureAt,
          status: supplementalStatus,
        };
      }
      const stepfunPricing =
        sourceName === 'stepfun' &&
        url === 'https://platform.stepfun.com/docs/zh/guides/pricing/details.md';
      if (!stepfunPricing && id !== `${sourceName}-cn`)
        throw Error('Response outside fixture scope');
      return { body: transform(body), url, obtainedAt: captureAt, status };
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

test('Bailing and LongCat use the current public RMB rates from the exact first-party tables', async () => {
  const bailing = resultFor(await check('bailing'), 'cn-bailing-Ling-3.1-flash-standard');
  const longcat = resultFor(await check('longcat'), 'cn-longcat-LongCat-2.0-standard');
  assert.equal(bailing?.status, 'unchanged');
  assert.equal(longcat?.status, 'unchanged');
  assert.deepEqual(bailing.observed.sourcePrice, { input: 0.5, output: 1.5, cache_read: 0.1 });
  assert.deepEqual(longcat.observed.sourcePrice, { input: 2, output: 8, cache_read: 0.04 });
});

test('BigModel China reads cache storage and model modalities as conditions alongside CNY charges', async () => {
  for (const captureAt of [attemptedAt, '2026-11-19T11:18:39.857Z']) {
    const report = await check('zhipu', undefined, 200, 200, captureAt);
    const result = resultFor(report, 'cn-zhipu-glm-5.3-flash-standard');
    assert.equal(result.status, 'unchanged');
    assert.deepEqual(result.observed.sourcePrice, { input: 0.8, output: 2.8, cache_read: 0.23 });
    assert.equal(result.observed.conditions.cacheStorage, 'limited-time-free');
    assert.deepEqual(result.observed.conditions.inputModalities, ['图片', '视频', '文件', '文本']);
  }
});

test('Ark keeps implicit token tiers and image task charges distinct', async () => {
  const report = await check('volcengine');
  const text = report.results.find(({ quoteId }) =>
    quoteId?.startsWith('volcengine--doubao-seed-2-0-pro-'),
  );
  assert.equal(text.status, 'unchanged', text.reason);
  assert.deepEqual(text.observed.sourcePrice.tiers[1], {
    tier: { size: 128000 },
    input: 9.6,
    output: 48,
    cache_read: 1.92,
  });
  const image = report.results.find(({ quoteId }) =>
    quoteId?.startsWith('volcengine--doubao-seedream-5-0-flash-'),
  );
  assert.equal(image.status, 'unchanged');
  assert.equal(image.observed.sourcePrice[0].charges[0].amount, 0.12);
  assert.equal(image.observed.sourcePrice[0].charges[2].amount, 0);
  assert.equal(
    resultFor(report, 'volcengine:doubao-seedance-2-5-260628:official-reference').coverageStatus,
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

test('Ark checks Seedance 2.5 online tariffs through 1080p', async () => {
  const report = await check('volcengine');
  const id = 'volcengine--doubao-seedance-2-0-260128--cn-beijing-task-online-original';
  const result = resultFor(report, id);
  assert.equal(result.status, 'unchanged', result.reason);
  assert.deepEqual(
    result.observed.sourcePrice.slice(0, 2).map((tier) => tier.charges[0].amount),
    [16, 26],
  );
  assert.equal(result.observed.conditions.videoInputTokenMinimum, true);
  assert.equal(result.observed.conditions.billingUsage, 'usage.completion_tokens');
  const seedance25 = resultFor(
    report,
    'volcengine--doubao-seedance-2-5-260628--cn-beijing-task-online-original',
  );
  assert.equal(seedance25.status, 'unchanged', seedance25.reason);
  assert.deepEqual(seedance25.observed.conditions.syncableResolutions, ['480p', '720p', '1080p']);
  assert.deepEqual(
    seedance25.observed.sourcePrice.map((tier) => tier.charges[0].amount),
    [70, 42, 70, 42, 77, 46],
  );
});

test('Bailian Beijing tiers use compatible-mode original CNY and distinguish cache modes', async () => {
  const report = await check('alibaba', undefined, 200, 200, attemptedAt, {
    comparison: historicalReferenceBaseline,
  });
  const implicit = resultFor(
    report,
    'dashscope--qwen3.7-plus--cn-beijing-online-original-implicit',
  );
  const explicit = resultFor(report, bailianExplicitReference);
  assert.equal(implicit.status, 'unchanged', implicit.reason);
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

test('DeepSeek weekly exception preserves official holiday evidence without inventing an official change', async () => {
  const deepseek = await check('deepseek');
  const flash = resultFor(deepseek, 'upstream:deepseek:deepseek-v4-flash-vision-exp:CNY');
  assert.equal(flash.status, 'unchanged');
  assert.equal(flash.reason, 'user-approved-weekday-schedule-ignores-chinese-legal-holidays-and-adjusted-workdays');
  assert.equal(flash.observed.conditions.billedAsModel, 'deepseek-flash');
  assert.equal(flash.observed.conditions.chineseLegalHolidays, 'off_peak');
  assert.equal(flash.observed.conditions.scheduleApplicability, undefined);
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

test('a real DeepSeek rate change is reported independently of the approved holiday deviation', async () => {
  const report = await check('deepseek', (body) =>
    Buffer.from(
      body.toString().replace(
        '<td>高峰时段</td><td>2元</td><td>9.0元</td>',
        '<td>高峰时段</td><td>2.5元</td><td>9.0元</td>',
      ),
    ),
  );
  for (const modelId of ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']) {
    const result = resultFor(report, `upstream:deepseek:${modelId}:CNY`);
    assert.equal(result.status, 'changed');
    assert.equal(result.observed.sourcePrice.schedule.windows[0].input, 2.5);
    assert.equal(result.observed.conditions.chineseLegalHolidays, 'off_peak');
    assert.equal(result.observed.conditions.scheduleApplicability, undefined);
    assert.equal(result.difference.chargingConditions, undefined);
    assert.equal(
      report.changes.find((change) => change.id === result.id)?.candidate.record.cost.schedule.windows[0].input,
      2.5,
    );
  }
  assert.equal(resultFor(report, 'upstream:deepseek:deepseek-v4-pro:CNY').status, 'unchanged');
});

test('a missing StepFun model row leaves other verified tariffs and ASR available', async () => {
  const report = await check('stepfun', (body) =>
    Buffer.from(body.toString().replace('| `step-3.7-flash` | 1.35 | 0.27 | 8.1 |', '')),
  );
  const missing = resultFor(report, 'upstream:stepfun:step-3.7-flash:CNY');
  assert.equal(missing.status, 'failed');
  assert.match(missing.reason, /step-3\.7-flash missing or ambiguous/);
  const unchanged = resultFor(report, 'upstream:stepfun:step-3.5-flash:CNY');
  assert.equal(unchanged.status, 'unchanged');
  assert.equal(unchanged.latestSuccessfulAt, attemptedAt);
  const asr = resultFor(report, 'upstream:stepfun:stepaudio-2.5-asr:unknown');
  assert.equal(asr.status, 'future-effective');
});

test('StepFun verifies text tariffs when the ASR documentation is unavailable', async () => {
  const report = await check('stepfun', (body) => body, 200, 503);
  const asr = resultFor(report, 'upstream:stepfun:stepaudio-2.5-asr:unknown');
  assert.equal(asr.status, 'failed');
  assert.match(asr.reason, /Supplemental official source audio HTTP 503/);
  const text = resultFor(report, 'upstream:stepfun:step-3.5-flash:CNY');
  assert.equal(text.status, 'unchanged', text.reason);
  assert.equal(text.latestSuccessfulAt, attemptedAt);
});

test('StepFun verifies ASR when the CNY token table is missing', async () => {
  const report = await check('stepfun', (body) =>
    Buffer.from(body.toString().replace(/^## 文本与多模态模型[^]*?(?=^## 语音模型)/m, '')),
  );
  const text = resultFor(report, 'upstream:stepfun:step-3.5-flash:CNY');
  assert.equal(text.status, 'failed');
  assert.match(text.reason, /Missing StepFun CNY token table/);
  const asr = resultFor(report, 'upstream:stepfun:stepaudio-2.5-asr:unknown');
  assert.equal(asr.status, 'future-effective', asr.reason);
  assert.equal(asr.latestSuccessfulAt, attemptedAt);
  assert.equal(asr.evidence.supplemental.audio.status, 200);
});

test('MiniMax uses the current public standard M3 bands and confirms the M3.1 prompt-cache meter', async () => {
  const report = await check('minimax');
  const m3 = resultFor(report, 'cn-minimax-MiniMax-M3-standard');
  assert.equal(m3?.status, 'unchanged', m3?.reason);
  assert.equal(m3.observed.sourcePrice.input, 2.1);
  assert.equal(m3.observed.sourcePrice.tiers[0].tier.size, 512000);
  assert.equal(m3.observed.sourcePrice.tiers[0].output, 16.8);
  const flash = resultFor(report, 'cn-minimax-MiniMax-M3.1-Flash-standard');
  assert.equal(flash?.status, 'unchanged', flash?.reason);
  assert.deepEqual(flash.observed.sourcePrice, { input: 1, output: 4, cache_read: 0.1 });
  assert.equal(flash.observed.conditions.cacheMinimumInputTokens, 512);
});

test('MiniMax China tolerates a promotion deadline or an unlabeled current tariff', async () => {
  const id = 'cn-minimax-MiniMax-M3-standard';
  for (const note of [' 优惠至 2026-12-07', '']) {
    const report = await check('minimax', (body) => {
      const page = body.toString().replaceAll(' 永久五折', note);
      return Buffer.from(note ? page : page.replace(/~~[^~]+~~ +/g, ''));
    });
    const result = resultFor(report, id);
    assert.equal(result.status, 'unchanged', result.reason);
    assert.equal(result.observed.sourcePrice.cache_read, 0.42);
    assert.equal(result.observed.sourcePrice.tiers[0].cache_read, 0.84);
    assert.ok(!report.changes.some((change) => change.id === id));
  }
});

test('MiniMax China rejects unrecognized request conditions and formal future prices', async () => {
  const id = 'cn-minimax-MiniMax-M3-standard';
  const cases = [
    ['≤ 512k 输入 tokens 永久五折', '≤ 512k 输入 tokens 仅限批量请求', '仅限批量请求'],
    [
      '> 512k 输入 tokens\\* 永久五折',
      '> 512k 输入 tokens\\* 正式报价自 2026-12-01 00:00 UTC+8 起生效',
      '正式报价自 2026-12-01',
    ],
    ['≤ 512k 输入 tokens 永久五折', '≤ 512k 输入 tokens 永久五折 仅限批量请求', '仅限批量请求'],
  ];
  for (const [original, replacement, reason] of cases) {
    const report = await check('minimax', (body) => {
      const page = body.toString();
      assert.ok(page.includes(original));
      return Buffer.from(page.replace(original, replacement));
    });
    const result = resultFor(report, id);
    assert.equal(result.status, 'failed', result.reason);
    assert.ok(result.reason.includes(reason), result.reason);
    assert.equal(result.observed, undefined);
    assert.ok(!report.changes.some((change) => change.id === id));
    assert.equal(resultFor(report, 'cn-minimax-MiniMax-H3-video').status, 'unchanged');
  }
});

test('a missing active LongCat price cannot fall back to the comparison amount', async () => {
  const result = resultFor(
    await check('longcat', (body) => Buffer.from(body.toString().replace('¥0.04</td>', '—</td>'))),
    'cn-longcat-LongCat-2.0-standard',
  );
  assert.equal(result.status, 'failed', result.reason);
  assert.equal(result.observed, undefined);
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
  const { upstreamDirectory } = JSON.parse(readFileSync(join(baseline, 'policy.json')));
  execFileSync(process.execPath, [
    'scripts/build-unified-cny.mjs',
    out,
    'data/cny/unified-policy.json',
    catalogPath,
    'data/cny/proposed-selection.json',
    upstreamDirectory,
    baseline,
  ]);
  const { data } = JSON.parse(readFileSync(join(out, 'api/newapi/ratio_config.json')));
  assert.equal(data.billing_expr['mimo-v2.6-pro'], 'tier("standard", p * 3 + cr * 0.026 + c * 6)');
  const before = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json'))).data;
  assert.equal(
    data.billing_expr['doubao-seedance-2-5-260628'],
    before.billing_expr['doubao-seedance-2-5-260628'],
  );
});

test('the exact DeepSeek exception enters sync while preserving official CNY and holiday evidence', async () => {
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
    assert.ok(data.billing_expr[modelId], modelId);
    assert.equal(model.status, 'selected');
    assert.equal(model.upstreamPrice.selected, true);
    assert.equal(model.upstreamPrice.syncable, true);
    assert.equal(model.upstreamPrice.sourceCurrency, 'CNY');
    assert.equal(model.upstreamPrice.conditions.chineseLegalHolidays, 'off_peak');
    assert.equal(
      model.upstreamPrice.conditions.scheduleApplicability,
      'weekdays-ignore-chinese-legal-holidays-and-adjusted-workdays',
    );
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

test('BigModel cross-conditions select the short-output rate before the native input tiers', async () => {
  const report = await check('zhipu');
  const result = resultFor(report, 'cn-zhipu-glm-4.7-standard');
  assert.equal(result?.status, 'unchanged', result?.reason);
  assert.equal(result.observed.sourcePrice.short_output.output, 8);
  assert.equal(result.observed.sourcePrice.output, 14);
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.match(
    data.billing_expr['glm-4.7'],
    /^len <= 31999 && c <= 199 \? tier\("short_output", p \* 2 \+ cr \* 0.4 \+ c \* 8\) : len <= 31999/,
  );
  assert.match(data.billing_expr['glm-4.5-air'], /^len <= 31999 && c <= 199/);
});

test('MiniMax H3 China charges video duration and only images above its free quota', async () => {
  const report = await check('minimax');
  const h3 = resultFor(report, 'cn-minimax-MiniMax-H3-video');
  assert.equal(h3?.status, 'unchanged', h3?.reason);
  assert.equal(h3.identity.endpoint, 'https://api.minimax.cn/v2/video_generation');
  assert.deepEqual(
    h3.observed.sourcePrice[0].charges.map(({ amount }) => amount),
    [0.8, 0.8, 0.2],
  );
  assert.equal(h3.observed.sourcePrice[0].charges[2].freeQuantity, 5);
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.match(data.billing_expr['MiniMax-H3'], /u\("input_images"\) > 5/);
  assert.equal(data.billing_expr['MiniMax-H3-Max'], undefined);
});

test('Bailian parses Beijing single, tiered and explicit-cache tariffs without using international rows', async () => {
  const report = await check('alibaba');
  const one = resultFor(report, 'dashscope--qwen-long--cn-beijing-online-original-token');
  assert.equal(one?.status, 'unchanged', one?.reason);
  assert.deepEqual(one.observed.sourcePrice, { input: 0.5, output: 2 });
  const tiered = resultFor(
    report,
    'dashscope--qwen3-coder-flash--cn-beijing-online-original-implicit',
  );
  assert.equal(tiered?.status, 'unchanged', tiered?.reason);
  assert.equal(tiered.observed.sourcePrice.tiers[2].output, 25);
  assert.equal(tiered.observed.sourcePrice.tiers[2].cache_read, 1);
  const explicit = resultFor(
    report,
    'dashscope--qwen3.6-plus--cn-beijing-online-original-explicit',
  );
  assert.equal(explicit?.status, 'unchanged', explicit?.reason);
  assert.equal(explicit.observed.sourcePrice.tiers[0].cache_write, 10);
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.equal(data.billing_expr['qwen-long'], 'tier("standard", p * 0.5 + c * 2)');
});

test('Bailian Qwen Plus keeps both price modes and native request selection', async () => {
  const report = await check('alibaba');
  const plus = resultFor(report, 'dashscope--qwen-plus--cn-beijing-online-original-implicit');
  assert.equal(plus?.status, 'unchanged', plus?.reason);
  assert.equal(plus.observed.sourcePrice.output, 2);
  assert.equal(plus.observed.sourcePrice.reasoning, 8);
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.match(data.billing_expr['qwen-plus'], /^param\("enable_thinking"\) == true/);
});

test('Bailian distinguishes unified multimodal tokens from non-uniform output and ASR seconds', async () => {
  const report = await check('alibaba');
  const omni = resultFor(
    report,
    'dashscope--qwen3.8-omni-flash--cn-beijing-online-original-implicit',
  );
  assert.equal(omni?.status, 'unchanged', omni?.reason);
  assert.deepEqual(omni.observed.sourcePrice, { input: 0.8, cache_read: 0.1, output: 2.7 });
  const oldOmni = resultFor(report, 'upstream:alibaba-cn:qwen3-omni-flash:USD');
  assert.equal(oldOmni?.status, 'unsupported', oldOmni?.reason);
  assert.equal(oldOmni.observed.sourcePrice.multimodal.output, 12.7);
  const asr = resultFor(report, 'upstream:alibaba-cn:qwen3-asr-flash:unknown');
  assert.equal(asr?.status, 'unsupported', asr?.reason);
  assert.equal(asr.observed.sourcePrice.amount, 0.00022);
});

test('Bailian Character preserves the native session-cache rate and header condition', async () => {
  const result = resultFor(
    await check('alibaba'),
    'dashscope--qwen-plus-character--cn-beijing-online-original-implicit',
  );
  assert.equal(result?.status, 'unchanged', result?.reason);
  assert.deepEqual(result.observed.sourcePrice, { input: 0.8, output: 2, cache_read: 0.16 });
  assert.equal(result.observed.conditions.sessionCacheRequestHeader, 'x-dashscope-aca-session');
});

test('Ark model IDs bind evolving text, character tariffs and the published Seedream alias', async () => {
  const report = await check('volcengine', undefined, 200, 200, '2026-11-19T11:30:38Z');
  const evolving = resultFor(
    report,
    'volcengine--doubao-seed-evolving--cn-beijing-online-regular-implicit-original',
  );
  assert.equal(evolving.status, 'unchanged', evolving.reason);
  assert.equal(evolving.observed.sourcePrice.input, 6);
  const character = resultFor(
    report,
    'volcengine--doubao-seed-character-260628--cn-beijing-online-regular-implicit-original',
  );
  assert.equal(character.status, 'unchanged', character.reason);
  assert.equal(character.observed.sourcePrice.tiers[0].output, 6);
  assert.equal(character.observed.sourcePrice.tiers[0].cache_read, 0.16);
  assert.equal(
    character.observed.conditions.separateExplicitCacheStorage.unit,
    'per_million_token_hours',
  );
  const { billing_expr } = JSON.parse(
    readFileSync(join(baseline, 'api/newapi/ratio_config.json')),
  ).data;
  assert.match(billing_expr['doubao-seed-character-260628'], /p \* 1\.2 \+ cr \* 0\.16 \+ c \* 6/);
  const image = resultFor(
    report,
    'volcengine--doubao-seedream-5-0-260128--cn-beijing-task-online-original',
  );
  assert.equal(image.status, 'unchanged', image.reason);
  assert.equal(image.observed.sourcePrice[0].charges[0].amount, 0.22);
  assert.equal(image.observed.conditions.publicPriceName, 'doubao-seedream-5-0-lite');
});

test('Ark uses the real model list on the client-rendered response', async () => {
  const report = await check('volcengine', undefined, 200, 200, '2026-11-19T12:13:00Z', {
    sourceFixtures: { 'volcengine-cn--model-list': 'volcengine-models-reader-2026-11-19' },
  });
  const ark = report.results.filter(
    ({ sourceId, selected }) => sourceId === 'volcengine-cn' && selected,
  );
  assert.ok(ark.some(({ nativeKey }) => nativeKey === 'doubao-seedream-5-0-260128'));
  for (const row of ark) assert.equal(row.status, 'unchanged', row.id + ': ' + row.reason);
});

test('Ark audio-cache amounts remain readable without exporting the incomplete old token expression', async () => {
  const report = await check('volcengine');
  const audio = resultFor(report, 'upstream:volcengine:doubao-seed-2-0-lite-260428:CNY');
  assert.equal(audio?.status, 'unsupported', audio?.reason);
  assert.deepEqual(audio.observed.sourcePrice.audio, { input: 9, cache_read: 1.8 });
  const { data } = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.equal(data.billing_expr['doubao-seed-2-0-lite-260428'], undefined);
  assert.equal(data.billing_expr['doubao-seed-2-0-mini-260428'], undefined);
});

test('Ark official Markdown and rendered HTML produce the same selected rates', async () => {
  const markdown = gunzipSync(
    readFileSync(
      new URL(
        './fixtures/official-check/domestic/volcengine-markdown-2026-11-18.gz',
        import.meta.url,
      ),
    ),
  );
  const json = (report) =>
    report.results
      .filter((result) => result.sourceId === 'volcengine-cn')
      .map(({ id, status, observed }) => ({ id, status, observed }));
  assert.deepEqual(
    json(await check('volcengine', () => markdown)),
    json(await check('volcengine')),
  );
});

test('Kimi China Batch reads four independent, unselected official references', async () => {
  const report = await check('kimi-batch', undefined, 200, 200, attemptedAt, {
    comparison: historicalReferenceBaseline,
  });
  const rows = report.results.filter((row) => row.sourceId === 'kimi-batch-cn');
  assert.equal(rows.length, 4);
  const pro = resultFor(report, kimiProBatchReference);
  assert.equal(pro?.status, 'changed', pro?.reason);
  assert.equal(pro.selected, false);
  assert.equal(
    pro.evidence.sha256,
    '91e1ad367a7e4d5ee19026c9347a772b412fec406db3a56ce314b3fd7ab94f9f',
  );
  assert.deepEqual(pro.observed.sourcePrice, {
    input: 7.8,
    output: 40.8,
    cache_read: 0.78,
    cache_write: 7.8,
    cache_write_1h: 15.6,
  });
  assert.equal(pro.observed.conditions.standardPricePercent, 60);
  assert.equal(pro.observed.conditions.cacheHit, 'best-effort');
  const k2 = resultFor(report, 'cn-moonshot-kimi-k2.7-code-batch');
  assert.deepEqual(k2.observed.sourcePrice, { input: 3.9, output: 16.2, cache_read: 0.78 });
  assert.equal(Object.hasOwn(k2.observed.sourcePrice, 'cache_write'), false);
  const k26 = resultFor(report, 'cn-moonshot-kimi-k2.6-batch');
  assert.equal(k26?.status, 'unchanged', k26?.reason);
  assert.equal(k26.selected, false);
  assert.deepEqual(k26.observed.sourcePrice, { input: 3.9, output: 16.2, cache_read: 0.66 });
  assert.deepEqual(k26.observed.conditions, {
    service: 'async-batch',
    standardPricePercent: 60,
    cacheHit: 'best-effort',
  });
  const realtime = resultFor(report, 'upstream:moonshotai-cn:kimi-k2.6:CNY');
  assert.equal(realtime.selected, true);
  assert.ok(
    report.changes.filter(({ id }) => id.endsWith('-batch')).every(({ selected }) => !selected),
  );
  const config = JSON.parse(readFileSync(join(baseline, 'api/newapi/ratio_config.json')));
  assert.equal(
    config.data.billing_expr['kimi-k2.6'],
    'tier("standard", p * 6.5 + cr * 1.1 + c * 27)',
  );
  assert.equal(
    config.data.billing_expr['kimi-k3.1-pro'],
    'tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)',
  );
});

test('Kimi China Batch detects a K2.6 change for review without selecting it', async () => {
  const fixture = gunzipSync(
    readFileSync(
      new URL('./fixtures/official-check/domestic/kimi-batch-2026-11-19.gz', import.meta.url),
    ),
  );
  const id = 'cn-moonshot-kimi-k2.6-batch';
  const verified = resultFor(await check('kimi-batch', () => fixture), id);
  assert.equal(verified.status, 'unchanged');
  assert.equal(
    verified.evidence.sha256,
    '05b212e197f3b9cf0bf12999efa656486d74707e2dd30825d2ff405e89bf28c6',
  );

  const report = await check('kimi-batch', () =>
    Buffer.from(fixture.toString().replace('`¥0.66 / MTok`', '`¥0.67 / MTok`')),
  );
  const change = report.changes.find((row) => row.id === id);
  assert.equal(change?.status, 'changed');
  assert.equal(change.selected, false);
  assert.equal(change.difference.amounts.before.cache_read, 0.66);
  assert.equal(change.difference.amounts.after.cache_read, 0.67);
});

test('Kimi China Batch rejects missing amount fields and an unexpected table heading', async () => {
  const id = 'cn-moonshot-kimi-k3.1-pro-batch';
  const missing = await check('kimi-batch', (body) =>
    Buffer.from(body.toString().replace('`¥15.60 / MTok`', '`—`')),
  );
  assert.match(resultFor(missing, id).reason, /Invalid Kimi Batch CNY amount/);
  const translated = await check('kimi-batch', (body) =>
    Buffer.from(
      body.toString().replace('children:`缓存写入（5min）`', 'children:`Kimi Cache Write`'),
    ),
  );
  assert.equal(resultFor(translated, id).status, 'failed');
  assert.match(resultFor(translated, id).reason, /Unexpected Kimi Batch tariff headers/);
});

test('MiniMax M2 launch evidence preserves exact original CNY without inventing cache rates', async () => {
  const id = 'upstream:minimax-cn:MiniMax-M2:CNY';
  const historicalBaseline = join(directory, 'minimax-m2-baseline');
  const policyPath = join(directory, 'minimax-m2-policy.json');
  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json'));
  policy.notOfferedModels = policy.notOfferedModels.filter((model) => model !== 'MiniMax-M2');
  writeFileSync(policyPath, JSON.stringify(policy));
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', historicalBaseline, policyPath]);
  const fixture = gunzipSync(
    readFileSync(
      new URL(
        './fixtures/official-check/domestic/minimax-m2-launch-2026-11-19.gz',
        import.meta.url,
      ),
    ),
  );
  const run = (body) =>
    checkOfficialPrices({
      baseline: historicalBaseline,
      attemptedAt,
      getResponse: async ({ id, url }) => {
        if (id !== 'minimax-m2-cn-launch') throw Error('Outside MiniMax launch fixture scope');
        return { url, body, obtainedAt: attemptedAt };
      },
    });
  const report = await run(fixture);
  const price = resultFor(report, id);
  assert.equal(price.status, 'unsupported', price.reason);
  assert.equal(price.selected, true);
  assert.deepEqual(price.observed.sourcePrice, { input: 2.1, output: 8.4 });
  assert.deepEqual(price.observed.cnyCost, price.observed.sourcePrice);
  assert.equal(price.observed.conditions.cacheRatesUnverified, true);
  assert.ok(!report.changes.some((row) => row.id === id));
  const edited = await run(Buffer.from(fixture.toString().replaceAll('¥2.1 RMB', '$2.1 USD')));
  assert.equal(resultFor(edited, id).status, 'failed');
});
