import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  WEEKLY_SCHEDULE_CONDITION,
  WEEKLY_SCHEDULE_EXCEPTION_REASON,
  weeklyScheduleException,
} from '../scripts/weekly-schedule-exceptions.mjs';

const models = ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4-pro'];
const basePolicy = JSON.parse(readFileSync('data/cny/unified-policy.json', 'utf8'));
const upstream = JSON.parse(readFileSync(join(basePolicy.upstreamDirectory, 'en.json'), 'utf8'));
const amounts = (modelId) => ({
  input: modelId === 'deepseek-v4-pro' ? 4.5 : 1,
  output: modelId === 'deepseek-v4-pro' ? 13.5 : 4,
  cache_read: modelId === 'deepseek-v4-pro' ? 0.15 : 0.02,
  schedule: {
    timezone: 'Asia/Shanghai',
    fallback: 'off_peak',
    windows: [{
      name: 'peak',
      weekdays: [1, 2, 3, 4, 5],
      hours: ['09:00-12:00', '14:00-18:00'],
      input: modelId === 'deepseek-v4-pro' ? 9 : 2,
      output: modelId === 'deepseek-v4-pro' ? 27 : 8,
      cache_read: modelId === 'deepseek-v4-pro' ? 0.3 : 0.04,
    }],
  },
});

function build(t, edit = () => {}, previous) {
  const directory = mkdtempSync(join(tmpdir(), 'deepseek-weekly-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const policy = structuredClone(basePolicy);
  edit(policy);
  const policyPath = join(directory, 'policy.json');
  writeFileSync(policyPath, JSON.stringify(policy));
  const output = join(directory, 'candidate');
  execFileSync(process.execPath, [
    'scripts/build-unified-cny.mjs', output, policyPath,
    'data/cny/official-catalog.json', 'data/cny/proposed-selection.json',
    basePolicy.upstreamDirectory, ...(previous ? [previous] : []),
  ]);
  const read = (name) => JSON.parse(readFileSync(join(output, name), 'utf8'));
  read.directory = output;
  return read;
}

test('exact four DeepSeek exceptions bind official CNY evidence to equivalent upstream UTC weeks', () => {
  assert.deepEqual(Object.keys(basePolicy.weeklyScheduleExceptions).sort(), [...models].sort());
  for (const modelId of models) {
    const exception = basePolicy.weeklyScheduleExceptions[modelId];
    const exclusion = basePolicy.nativeCapabilityExclusions[modelId];
    assert.equal(exception.providerId, 'deepseek');
    assert.equal(exception.endpoint, 'https://api.deepseek.com');
    assert.equal(exception.reason, WEEKLY_SCHEDULE_EXCEPTION_REASON);
    assert.equal(exclusion.providerId, exception.providerId);
    assert.equal(exclusion.endpoint, exception.endpoint);
    assert.equal(exclusion.conditions.chineseLegalHolidays, 'off_peak');
    assert.deepEqual(exclusion.sourcePrice, amounts(modelId));
    const upstreamCost = upstream.deepseek.models[modelId].cost.currency_options.CNY;
    for (const key of ['input', 'output', 'cache_read'])
      assert.equal(upstreamCost[key], exclusion.sourcePrice[key], modelId + ' ' + key);
    assert.equal(upstreamCost.schedule.timezone, 'UTC');
    assert.deepEqual(upstreamCost.schedule.windows[0].hours, ['01:00-04:00', '06:00-10:00']);
    assert.deepEqual(upstreamCost.schedule.windows[0].weekdays, [1, 2, 3, 4, 5]);
    for (const key of ['input', 'output', 'cache_read'])
      assert.equal(
        upstreamCost.schedule.windows[0][key],
        exclusion.sourcePrice.schedule.windows[0][key],
        modelId + ' peak ' + key,
      );
  }
});

test('runtime authorization is closed to four keys and only the holiday capability gap', () => {
  const fifth = structuredClone(basePolicy);
  fifth.weeklyScheduleExceptions['unapproved-fifth-model'] = structuredClone(
    fifth.weeklyScheduleExceptions['deepseek-flash'],
  );
  fifth.nativeCapabilityExclusions['unapproved-fifth-model'] = structuredClone(
    fifth.nativeCapabilityExclusions['deepseek-flash'],
  );
  assert.throws(
    () => weeklyScheduleException(fifth, 'unapproved-fifth-model', 'deepseek', 'https://api.deepseek.com'),
    /authorized|exception policy/,
    'a cloned declaration and exclusion must not authorize a fifth native key',
  );
  for (const [name, mutate, expected] of [
    ['wrong provider', (policy) => { policy.weeklyScheduleExceptions['deepseek-flash'].providerId = 'other'; }, /providerId/],
    ['wrong endpoint', (policy) => { policy.weeklyScheduleExceptions['deepseek-flash'].endpoint = 'https://example.invalid'; }, /endpoint/],
    ['additional unsupported condition', (policy) => { policy.nativeCapabilityExclusions['deepseek-flash'].conditions.unrepresentableMeter = 'audio-cache'; }, /conditions/],
    ['changed exclusion nature', (policy) => { policy.nativeCapabilityExclusions['deepseek-flash'].reason = 'Native audio-cache metering is unsupported'; }, /reason/],
    ['unknown top-level capability', (policy) => { policy.nativeCapabilityExclusions['deepseek-flash'].unrepresentableMeter = 'audio-cache'; }, /shape|keys/],
  ]) {
    const policy = structuredClone(basePolicy);
    mutate(policy);
    assert.throws(
      () => weeklyScheduleException(policy, 'deepseek-flash', 'deepseek', 'https://api.deepseek.com'),
      expected,
      name,
    );
  }

  const updated = structuredClone(basePolicy);
  const cost = structuredClone(upstream.deepseek.models['deepseek-flash'].cost.currency_options.CNY);
  updated.nativeCapabilityExclusions['deepseek-flash'].sourcePrice.input = 1.25;
  updated.nativeCapabilityExclusions['deepseek-flash'].sourcePrice.schedule.windows[0].input = 2.5;
  cost.input = 1.25;
  cost.schedule.windows[0].input = 2.5;
  assert.ok(
    weeklyScheduleException(updated, 'deepseek-flash', 'deepseek', 'https://api.deepseek.com', {
      cost,
      expr: 'p * 1.25',
    }),
    'matching official and upstream price updates must not be blocked by hardcoded amounts',
  );
});

test('exactly four keys join synchronization with complete conditions and a complete price diff', (t) => {
  const before = build(t, (policy) => delete policy.weeklyScheduleExceptions);
  const after = build(t, () => {}, before.directory);
  const oldConfig = before('api/newapi/ratio_config.json').data;
  const newConfig = after('api/newapi/ratio_config.json').data;
  assert.equal(Object.keys(oldConfig.billing_expr).length, 206);
  assert.equal(Object.keys(newConfig.billing_expr).length, 210);
  for (const key of Object.keys(oldConfig.billing_expr)) {
    assert.equal(newConfig.billing_expr[key], oldConfig.billing_expr[key], key);
    assert.equal(newConfig.billing_mode[key], oldConfig.billing_mode[key], key);
  }
  const diff = after('price-diff.json');
  assert.equal(diff.changes.length, 4);
  assert.deepEqual(diff.changes.map((row) => row.nativeKey).sort(), [...models].sort());
  assert.ok(diff.changes.every((row) => row.type === 'added'));
  const coverage = after('coverage.json');
  const english = after('api/all.json');
  for (const modelId of models) {
    const model = coverage.models.find((row) => row.providerId === 'deepseek' && row.modelId === modelId);
    assert.equal(model.status, 'selected');
    const quote = model.upstreamPrice;
    assert.equal(quote.selected, true);
    assert.equal(quote.syncable, true);
    assert.equal(quote.sourceCurrency, 'CNY');
    assert.equal(quote.originalCurrencyEligible, true);
    assert.deepEqual(quote.sourcePrice, amounts(modelId));
    assert.deepEqual(quote.cnyCost, amounts(modelId));
    assert.equal(quote.conditions.chineseLegalHolidays, 'off_peak');
    assert.equal(quote.conditions.scheduleApplicability, WEEKLY_SCHEDULE_CONDITION);
    assert.equal(quote.reason, WEEKLY_SCHEDULE_EXCEPTION_REASON);
    assert.match(quote.billing_expr, /weekday\("UTC"\)/);
    assert.match(quote.billing_expr, /hour\("UTC"\)/);
    const viewQuote = english.deepseek.models[modelId].pricing_view.groups
      .flatMap((group) => group.quotes)
      .find((row) => row.quoteId === quote.quoteId);
    assert.equal(viewQuote.selected, true);
    assert.equal(viewQuote.syncable, true);
    assert.deepEqual(viewQuote.sourcePrice, quote.sourcePrice);
    assert.equal(viewQuote.conditions.scheduleApplicability, WEEKLY_SCHEDULE_CONDITION);
  }
});

test('weekly exception cannot bypass other exclusions, lifecycle, deferral or selection guards', (t) => {
  for (const [name, edit, expected] of [
    ['missing evidence', (policy) => delete policy.nativeCapabilityExclusions['deepseek-flash'], /requires native capability evidence/],
    ['wrong endpoint', (policy) => { policy.weeklyScheduleExceptions['deepseek-flash'].endpoint = 'https://example.invalid'; }, /exception endpoint/],
    ['wrong official window', (policy) => { policy.nativeCapabilityExclusions['deepseek-flash'].sourcePrice.schedule.windows[0].hours = ['08:00-12:00']; }, /exception hours/],
    ['unrelated unsupported model', (policy) => { policy.weeklyScheduleExceptions['doubao-seed-2-0-lite-260428'] = { providerId: 'volcengine', endpoint: 'https://ark.cn-beijing.volces.com', reason: WEEKLY_SCHEDULE_EXCEPTION_REASON }; }, /exception|evidence/],
    ['cloned fifth model', (policy) => { policy.weeklyScheduleExceptions['unapproved-fifth-model'] = structuredClone(policy.weeklyScheduleExceptions['deepseek-flash']); policy.nativeCapabilityExclusions['unapproved-fifth-model'] = structuredClone(policy.nativeCapabilityExclusions['deepseek-flash']); }, /authorized|exception policy/],
    ['wrong provider', (policy) => { policy.weeklyScheduleExceptions['deepseek-flash'].providerId = 'other'; }, /providerId/],
    ['additional unsupported condition', (policy) => { policy.nativeCapabilityExclusions['deepseek-flash'].conditions.unrepresentableMeter = 'audio-cache'; }, /conditions/],
    ['changed exclusion reason', (policy) => { policy.nativeCapabilityExclusions['deepseek-flash'].reason = 'Native audio-cache metering is unsupported'; }, /reason/],
    ['wrong explicit selection', (policy) => { policy.upstreamSelection['deepseek-flash'] = 'upstream:deepseek:deepseek-v4-pro:CNY'; }, /Explicit upstream price is no longer eligible/],
  ]) {
    assert.throws(() => build(t, edit), expected, name);
  }
  for (const [name, edit] of [
    ['not offered', (policy) => policy.notOfferedModels.push('deepseek-flash')],
    ['withdrawn', (policy) => { policy.lifecycle['deepseek-flash'] = [{ state: 'withdrawn', reason: 'model-deprecated', at: '2026-01-01T00:00:00Z', quoteId: 'upstream:deepseek:deepseek-flash:CNY', evidence: { url: 'https://example.invalid/withdrawn', sha256: 'a'.repeat(64), checkedAt: '2026-01-01', detail: 'withdrawn' } }]; }],
  ]) {
    const read = build(t, edit);
    const config = read('api/newapi/ratio_config.json').data;
    assert.ok(!Object.hasOwn(config.billing_expr, 'deepseek-flash'), name);
    for (const modelId of models.slice(1)) assert.ok(config.billing_expr[modelId], name + ' ' + modelId);
  }
  assert.throws(
    () => build(t, (policy) => {
      policy.deferredModels.deepseek = [...(policy.deferredModels.deepseek ?? []), 'deepseek-flash'];
    }),
    /Invalid native capability exclusion evidence: deepseek-flash/,
    'deferral retains the existing fail-closed guard',
  );
});
