import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const model = 'qwen3.8-flash';
const implicitId = `dashscope--${model}--cn-beijing-online-original-implicit`;
const explicitId = `dashscope--${model}--cn-beijing-online-original-explicit`;
const selectionDocument = JSON.parse(readFileSync('data/cny/proposed-selection.json', 'utf8'));
const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
const policy = JSON.parse(readFileSync('data/cny/unified-policy.json', 'utf8'));

function build(t, edit, previous) {
  const directory = mkdtempSync(join(tmpdir(), 'qwen-explicit-cache-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const selection = structuredClone(selectionDocument);
  edit(selection);
  const selectionPath = join(directory, 'selection.json');
  writeFileSync(selectionPath, JSON.stringify(selection));
  const output = join(directory, 'candidate');
  execFileSync(process.execPath, [
    'scripts/build-unified-cny.mjs',
    output,
    'data/cny/unified-policy.json',
    'data/cny/official-catalog.json',
    selectionPath,
    policy.upstreamDirectory,
    ...(previous ? [previous] : []),
  ]);
  const read = (name) => JSON.parse(readFileSync(join(output, name), 'utf8'));
  read.directory = output;
  return read;
}

const record = (modelId, mode) =>
  official.records.find(
    (quote) => quote.id === `dashscope--${modelId}--cn-beijing-online-original-${mode}`,
  );
const rates = (cost, key) =>
  cost.tiers ? [cost[key], ...cost.tiers.map((tier) => tier[key])] : [cost[key]];
const tiers = (cost) =>
  cost.tiers?.map(({ tier, input, output, cache_read }) => ({ tier, input, output, cache_read })) ?? {
    input: cost.input,
    output: cost.output,
    cache_read: cost.cache_read,
  };

test('only Beijing qwen3.8-flash changes to the complete explicit tariff', (t) => {
  const before = build(t, (selection) => {
    selection.selection[model] = implicitId;
  });
  const after = build(t, () => {}, before.directory);
  const oldConfig = before('api/newapi/ratio_config.json').data;
  const newConfig = after('api/newapi/ratio_config.json').data;
  assert.equal(Object.keys(oldConfig.billing_expr).length, 210);
  assert.equal(Object.keys(newConfig.billing_expr).length, 210);
  for (const key of Object.keys(oldConfig.billing_expr)) {
    if (key === model) continue;
    assert.equal(newConfig.billing_expr[key], oldConfig.billing_expr[key], key);
    assert.equal(newConfig.billing_mode[key], oldConfig.billing_mode[key], key);
  }
  assert.equal(
    newConfig.billing_expr[model],
    'tier("standard", p * 0.8 + cr * 0.1 + cc * 1.25 + c * 2.7)',
  );
  assert.equal(newConfig.billing_mode[model], oldConfig.billing_mode[model]);
  const diff = after('price-diff.json').changes;
  assert.equal(diff.length, 1);
  assert.equal(diff[0].nativeKey, model);
  assert.equal(diff[0].type, 'changed');
  assert.equal(diff[0].before.quoteId, implicitId);
  assert.equal(diff[0].after.quoteId, explicitId);
  assert.deepEqual(diff[0].after.sourcePrice, {
    input: 0.8,
    output: 2.7,
    cache_read: 0.1,
    cache_write: 1.25,
  });
  assert.deepEqual(diff[0].after.conditions, {
    region: 'China mainland, Beijing',
    cacheMode: 'explicit',
    cacheMinimumInputTokens: 1024,
    cacheWriteTtlSeconds: 300,
    cacheHitRenewsTtl: true,
  });
  assert.equal(after('selection.json')[model], explicitId);
});

test('nine different-read-rate explicit tariffs remain review candidates, not mode-routed completions', (t) => {
  const read = build(t, () => {});
  const coverage = read('coverage.json');
  const expected = {
    'qwen-doc-turbo': { implicitRead: [0.12], read: [0.06], write: [0.75] },
    'qwen-flash': { implicitRead: [0.03, 0.12, 0.24], read: [0.015, 0.06, 0.12], write: [0.1875, 0.75, 1.5] },
    'qwen-plus': { implicitRead: [0.16, 0.48, 0.96], read: [0.08, 0.24, 0.48], write: [1, 3, 6] },
    'qwen3-coder-flash': { implicitRead: [0.2, 0.3, 0.5, 1], read: [0.1, 0.15, 0.25, 0.5], write: [1.25, 1.875, 3.125, 6.25] },
    'qwen3-vl-plus': { implicitRead: [0.2, 0.3, 0.6], read: [0.1, 0.15, 0.3], write: [1.25, 1.875, 3.75] },
    'qwen3.7-flash': { implicitRead: [0.04, 0.12, 0.24], read: [0.02, 0.06, 0.12], write: [0.25, 0.75, 1.5] },
    'qwen3.7-max': { implicitRead: [2.4], read: [1.2], write: [15] },
    'qwen3.7-plus': { implicitRead: [0.4, 1.2], read: [0.2, 0.6], write: [2.5, 7.5] },
    'qwen3.8-max': { implicitRead: [1.5], read: [1], write: [15] },
  };
  for (const [modelId, amounts] of Object.entries(expected)) {
    const implicit = record(modelId, 'implicit');
    const explicit = record(modelId, 'explicit');
    assert.ok(implicit && explicit, modelId);
    const implicitShape = tiers(implicit.cost);
    const explicitShape = tiers(explicit.cost);
    if (Array.isArray(implicitShape)) {
      assert.deepEqual(
        explicitShape.map(({ tier, input, output }) => ({ tier, input, output })),
        implicitShape.map(({ tier, input, output }) => ({ tier, input, output })),
        modelId + ' thresholds/input/output',
      );
    } else {
      assert.equal(explicitShape.input, implicitShape.input, modelId + ' input');
      assert.equal(explicitShape.output, implicitShape.output, modelId + ' output');
    }
    assert.deepEqual(rates(explicit.cost, 'cache_read'), amounts.read, modelId + ' explicit read');
    assert.deepEqual(rates(explicit.cost, 'cache_write'), amounts.write, modelId + ' explicit write');
    assert.deepEqual(
      rates(implicit.cost, 'cache_read'),
      amounts.implicitRead,
      modelId + ' implicit read differs and must not be silently undercharged',
    );
    assert.equal(read('selection.json')[modelId], implicit.id, modelId + ' remains implicit');
    const candidate = coverage.quotes.find((quote) => quote.quoteId === explicit.id);
    assert.equal(candidate.status, 'ready', modelId + ' explicit candidate compiles');
    assert.equal(candidate.selected, false, modelId + ' is not selected');
    assert.equal(candidate.syncable, false, modelId + ' is not presented as routed');
    assert.deepEqual(rates(candidate.cnyCost, 'cache_write'), amounts.write, modelId + ' compiled write');
  }
  for (const modelId of ['qwen3.5-flash', 'qwen3.5-plus', 'qwen3.6-flash', 'qwen3.6-plus'])
    assert.match(read('selection.json')[modelId], /-explicit$/, modelId + ' existing explicit selection');
  for (const modelId of ['qwen-max', 'qwen3.8-omni-flash', 'qwen-plus-character']) {
    assert.match(read('selection.json')[modelId], /-implicit$/, modelId + ' incomplete evidence stays implicit');
    assert.equal(record(modelId, 'explicit'), undefined, modelId + ' must not invent explicit prices');
  }
});

test('Flash explicit selection preserves CNY evidence and five-minute TTL in all locales', (t) => {
  const read = build(t, () => {});
  for (const path of ['api/all.json', 'api/i18n/zh/all.json', 'api/i18n/ja/all.json']) {
    const catalog = read(path);
    const quote = catalog['alibaba-cn'].models[model].pricing_view.groups
      .flatMap((group) => group.quotes)
      .find((row) => row.selected);
    assert.equal(quote.quoteId, explicitId, path);
    assert.equal(quote.syncable, true, path);
    assert.equal(quote.sourceCurrency, 'CNY', path);
    assert.deepEqual(quote.sourcePrice, record(model, 'explicit').cost, path);
    assert.equal(quote.originalQuote.conditions.cacheMode, 'explicit', path);
    assert.equal(quote.originalQuote.conditions.cacheMinimumInputTokens, 1024, path);
    assert.equal(quote.originalQuote.conditions.cacheWriteTtlSeconds, 300, path);
    assert.equal(quote.originalQuote.conditions.cacheHitRenewsTtl, true, path);
    assert.equal(
      quote.displayRows.find((row) => row.usageKey === 'cache_write').amount,
      1.25,
      path,
    );
    assert.equal(
      quote.displayFeeTerms.find((term) => term.usageKey === 'cache_write').retentionMinutes,
      5,
      path,
    );
  }
});
