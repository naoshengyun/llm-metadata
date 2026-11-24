import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const flash = 'qwen3.8-flash';
const approvedModels = [
  'qwen-doc-turbo',
  'qwen-flash',
  'qwen-plus',
  'qwen3-coder-flash',
  'qwen3-vl-plus',
  'qwen3.7-flash',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.8-max',
];
const selectionDocument = JSON.parse(readFileSync('data/cny/proposed-selection.json', 'utf8'));
const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
const policy = JSON.parse(readFileSync('data/cny/unified-policy.json', 'utf8'));
const quoteId = (modelId, mode) =>
  `dashscope--${modelId}--cn-beijing-online-original-${mode}`;

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

const record = (modelId, mode) => official.records.find((quote) => quote.id === quoteId(modelId, mode));
const rates = (cost, key) =>
  cost.tiers ? [cost[key], ...cost.tiers.map((tier) => tier[key])] : [cost[key]];
const tiers = (cost) =>
  cost.tiers?.map(({ tier, input, output, cache_read }) => ({ tier, input, output, cache_read })) ?? {
    input: cost.input,
    output: cost.output,
    cache_read: cost.cache_read,
  };

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

test('exactly nine approved Beijing native keys change to their complete explicit tariffs', (t) => {
  const before = build(t, (selection) => {
    for (const modelId of approvedModels) selection.selection[modelId] = quoteId(modelId, 'implicit');
  });
  const after = build(t, () => {}, before.directory);
  const oldConfig = before('api/newapi/ratio_config.json').data;
  const newConfig = after('api/newapi/ratio_config.json').data;
  assert.equal(Object.keys(oldConfig.billing_expr).length, 210);
  assert.equal(Object.keys(newConfig.billing_expr).length, 210);
  for (const key of Object.keys(oldConfig.billing_expr)) {
    if (approvedModels.includes(key)) continue;
    assert.equal(newConfig.billing_expr[key], oldConfig.billing_expr[key], key + ' expression');
    assert.equal(newConfig.billing_mode[key], oldConfig.billing_mode[key], key + ' mode');
  }
  for (const modelId of approvedModels) {
    assert.equal(newConfig.billing_mode[modelId], oldConfig.billing_mode[modelId], modelId + ' mode');
    assert.match(newConfig.billing_expr[modelId], /\bcc \*/, modelId + ' cache-write expression');
  }
  assert.equal(
    newConfig.billing_expr[flash],
    'tier("standard", p * 0.8 + cr * 0.1 + cc * 1.25 + c * 2.7)',
    'the previously approved Flash expression remains unchanged',
  );
  const diff = after('price-diff.json').changes;
  assert.equal(diff.length, 9);
  assert.deepEqual(new Set(diff.map((change) => change.nativeKey)), new Set(approvedModels));
  for (const change of diff) {
    assert.equal(change.type, 'changed');
    assert.equal(change.before.quoteId, quoteId(change.nativeKey, 'implicit'));
    assert.equal(change.after.quoteId, quoteId(change.nativeKey, 'explicit'));
    assert.deepEqual(change.after.sourcePrice, record(change.nativeKey, 'explicit').cost);
    assert.deepEqual(change.after.conditions, record(change.nativeKey, 'explicit').conditions);
    assert.equal(change.after.conditions.region, 'China mainland, Beijing');
    assert.equal(change.after.conditions.cacheMode, 'explicit');
    assert.equal(change.after.conditions.cacheMinimumInputTokens, 1024);
    assert.equal(change.after.conditions.cacheWriteTtlSeconds, 300);
    assert.equal(change.after.conditions.cacheHitRenewsTtl, true);
  }
  assert.equal(after('selection.json')[flash], quoteId(flash, 'explicit'));
});

test('all nine approved explicit selections preserve official tiers, CNY evidence and TTL', (t) => {
  const read = build(t, () => {});
  const coverage = read('coverage.json');
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
    assert.deepEqual(rates(implicit.cost, 'cache_read'), amounts.implicitRead, modelId + ' audit read');
    assert.equal(read('selection.json')[modelId], explicit.id, modelId + ' approved explicit selection');
    assert.ok(
      !selectionDocument.notProposed.some((quote) => quote.id === explicit.id),
      modelId + ' selected quote must not remain notProposed',
    );
    const selected = coverage.quotes.find((quote) => quote.quoteId === explicit.id);
    assert.equal(selected.status, 'ready', modelId + ' explicit selection compiles');
    assert.equal(selected.selected, true, modelId + ' is selected');
    assert.equal(selected.syncable, true, modelId + ' is the synchronization candidate');
    assert.deepEqual(rates(selected.cnyCost, 'cache_write'), amounts.write, modelId + ' compiled write');
    const audit = coverage.quotes.find((quote) => quote.quoteId === implicit.id);
    assert.equal(audit.selected, false, modelId + ' implicit evidence is not selected');
    assert.equal(audit.syncable, false, modelId + ' implicit evidence is not a second candidate');
  }
  for (const modelId of ['qwen3.5-flash', 'qwen3.5-plus', 'qwen3.6-flash', 'qwen3.6-plus'])
    assert.equal(read('selection.json')[modelId], quoteId(modelId, 'explicit'), modelId + ' existing explicit');
  for (const modelId of ['qwen-max', 'qwen3.8-omni-flash', 'qwen-plus-character']) {
    assert.equal(read('selection.json')[modelId], quoteId(modelId, 'implicit'), modelId + ' incomplete evidence');
    assert.equal(record(modelId, 'explicit'), undefined, modelId + ' must not invent explicit prices');
  }
});

test('all approved explicit tariffs expose complete selected evidence in every locale', (t) => {
  const read = build(t, () => {});
  for (const path of ['api/all.json', 'api/i18n/zh/all.json', 'api/i18n/ja/all.json']) {
    const catalog = read(path);
    for (const modelId of [flash, ...approvedModels]) {
      const view = catalog['alibaba-cn'].models[modelId].pricing_view;
      const quote = view.groups.flatMap((group) => group.quotes).find((row) => row.selected);
      assert.equal(view.selectedQuoteId, quoteId(modelId, 'explicit'), path + ' ' + modelId);
      assert.equal(quote.quoteId, quoteId(modelId, 'explicit'), path + ' ' + modelId);
      assert.equal(quote.syncable, true, path + ' ' + modelId);
      assert.equal(quote.sourceCurrency, 'CNY', path + ' ' + modelId);
      assert.deepEqual(quote.sourcePrice, record(modelId, 'explicit').cost, path + ' ' + modelId);
      assert.equal(quote.originalQuote.conditions.cacheMode, 'explicit', path + ' ' + modelId);
      assert.equal(quote.originalQuote.conditions.cacheMinimumInputTokens, 1024, path + ' ' + modelId);
      assert.equal(quote.originalQuote.conditions.cacheWriteTtlSeconds, 300, path + ' ' + modelId);
      assert.equal(quote.originalQuote.conditions.cacheHitRenewsTtl, true, path + ' ' + modelId);
      assert.equal(
        quote.displayFeeTerms.find((term) => term.usageKey === 'cache_write').retentionMinutes,
        5,
        path + ' ' + modelId,
      );
      const implicit = view.groups.flatMap((group) => group.quotes).find((row) => row.quoteId === quoteId(modelId, 'implicit'));
      if (implicit) {
        assert.equal(implicit.selected, false, path + ' ' + modelId + ' implicit is audit only');
        assert.equal(implicit.syncable, false, path + ' ' + modelId + ' implicit is not default');
      }
    }
  }
});
