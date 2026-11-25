import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const OFFICIAL = 'deepseek-flash';
const PUBLIC = 'deepseek-v4.1-flash';
const OTHER = ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4-pro'];
const basePolicy = JSON.parse(readFileSync('data/cny/unified-policy.json', 'utf8'));

function build(t, edit = () => {}, previous) {
  const directory = mkdtempSync(join(tmpdir(), 'deepseek-native-rename-'));
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

function renameDeclaration(policy) {
  return policy.nativeBillingIdentityRenames[0];
}

test('only the approved DeepSeek native key changes and a later candidate stays continuous', (t) => {
  const before = build(t, (policy) => delete policy.nativeBillingIdentityRenames);
  const after = build(t, () => {}, before.directory);
  const oldConfig = before('api/newapi/ratio_config.json').data;
  const newConfig = after('api/newapi/ratio_config.json').data;
  assert.equal(Object.keys(oldConfig.billing_expr).length, 210);
  assert.equal(Object.keys(newConfig.billing_expr).length, 210);
  assert.ok(!Object.hasOwn(newConfig.billing_expr, OFFICIAL));
  assert.ok(!Object.hasOwn(newConfig.billing_mode, OFFICIAL));
  assert.equal(newConfig.billing_expr[PUBLIC], oldConfig.billing_expr[OFFICIAL]);
  assert.equal(newConfig.billing_mode[PUBLIC], oldConfig.billing_mode[OFFICIAL]);
  for (const key of Object.keys(oldConfig.billing_expr)) {
    if (key === OFFICIAL) continue;
    assert.equal(newConfig.billing_expr[key], oldConfig.billing_expr[key], key);
    assert.equal(newConfig.billing_mode[key], oldConfig.billing_mode[key], key);
  }
  for (const model of OTHER) {
    assert.equal(newConfig.billing_expr[model], oldConfig.billing_expr[model], model);
    assert.equal(newConfig.billing_mode[model], oldConfig.billing_mode[model], model);
  }
  const diff = after('price-diff.json');
  assert.deepEqual(
    diff.changes.map(({ nativeKey, type }) => ({ nativeKey, type })),
    [
      { nativeKey: OFFICIAL, type: 'removed' },
      { nativeKey: PUBLIC, type: 'added' },
    ],
  );
  assert.ok(diff.changes.every(({ reason }) => reason === 'user-approved-native-model-rename'));
  const [removed, added] = diff.changes;
  assert.equal(added.after.billing_expr, removed.before.billing_expr);
  assert.equal(added.after.billing_mode, removed.before.billing_mode);
  assert.deepEqual(added.after.sourcePrice, removed.before.sourcePrice);
  assert.deepEqual(added.after.conditions, removed.before.conditions);
  assert.equal(added.after.quoteId, removed.before.quoteId);
  assert.equal(after('selection.json')[PUBLIC], before('selection.json')[OFFICIAL]);
  assert.ok(!Object.hasOwn(after('selection.json'), OFFICIAL));

  const beforeRow = before('coverage.json').models.find(
    (row) => row.providerId === 'deepseek' && row.modelId === OFFICIAL,
  );
  const afterRow = after('coverage.json').models.find(
    (row) => row.providerId === 'deepseek' && row.modelId === PUBLIC,
  );
  assert.equal(beforeRow.nativeKey, OFFICIAL);
  assert.equal(afterRow.nativeKey, PUBLIC);
  assert.equal(afterRow.officialModelId, OFFICIAL);
  assert.equal(afterRow.upstreamPrice.nativeKey, PUBLIC);
  assert.equal(afterRow.upstreamPrice.modelId, OFFICIAL);
  assert.equal(afterRow.upstreamPrice.endpoint, 'https://api.deepseek.com');
  assert.equal(afterRow.upstreamPrice.billing_expr, beforeRow.upstreamPrice.billing_expr);
  assert.deepEqual(afterRow.upstreamPrice.sourcePrice, beforeRow.upstreamPrice.sourcePrice);
  assert.deepEqual(afterRow.upstreamPrice.conditions, beforeRow.upstreamPrice.conditions);
  const displayRow = after('display-coverage.json').models.find(
    (row) => row.providerId === 'deepseek' && row.modelId === PUBLIC,
  );
  assert.equal(displayRow.nativeKey, PUBLIC);

  for (const locale of ['en', 'zh', 'ja']) {
    const prefix = 'api/' + (locale === 'en' ? '' : 'i18n/' + locale + '/');
    const catalog = after(prefix + 'all.json');
    assert.ok(!catalog.deepseek.models[OFFICIAL]);
    const model = catalog.deepseek.models[PUBLIC];
    assert.equal(model.id, PUBLIC);
    assert.equal(model.name, 'DeepSeek V4.1 Flash 1017');
    assert.deepEqual(model.legacyIds, [OFFICIAL]);
    assert.equal(model.pricing_view.modelId, PUBLIC);
    assert.equal(model.pricing_view.officialModelId, OFFICIAL);
    assert.equal(model.pricing_view.nativeKey, PUBLIC);
    assert.equal(model.cost.publication_expr, oldConfig.billing_expr[OFFICIAL]);
    assert.ok(model.cnyPrice.quotes.every((quote) => quote.nativeKey === PUBLIC));
    const provider = after(prefix + 'providers/deepseek.json');
    assert.ok(!provider.models[OFFICIAL]);
    assert.equal(provider.models[PUBLIC].id, PUBLIC);
    const index = after(prefix + 'index.json').models;
    assert.ok(index.some((row) => row.providerId === 'deepseek' && row.id === PUBLIC));
    assert.ok(!index.some((row) => row.providerId === 'deepseek' && row.id === OFFICIAL));
  }

  const rebuilt = build(t, () => {}, after.directory);
  assert.equal(Object.keys(rebuilt('api/newapi/ratio_config.json').data.billing_expr).length, 210);
  assert.equal(rebuilt('price-diff.json').changes.length, 0);
  assert.throws(
    () => build(t, (policy) => delete policy.nativeBillingIdentityRenames, after.directory),
    /rename|identity/i,
    'a reviewed public identity cannot be silently renamed back',
  );
});

test('the native rename is exact and cannot widen weekly or endpoint authorization', (t) => {
  assert.deepEqual(Object.keys(basePolicy.weeklyScheduleExceptions).sort(), [OFFICIAL, ...OTHER].sort());
  assert.equal(renameDeclaration(basePolicy).officialModelId, OFFICIAL);
  assert.equal(renameDeclaration(basePolicy).nativeKey, PUBLIC);
  for (const [name, mutate] of [
    ['wrong provider', (policy) => { renameDeclaration(policy).providerId = 'other'; }],
    ['wrong endpoint', (policy) => { renameDeclaration(policy).endpoint = 'https://example.invalid'; }],
    ['wrong official model', (policy) => { renameDeclaration(policy).officialModelId = OTHER[0]; }],
    ['fifth identity', (policy) => {
      policy.nativeBillingIdentityRenames.push({
        ...structuredClone(renameDeclaration(policy)),
        officialModelId: OTHER[0],
        nativeKey: 'unapproved-fifth-model',
      });
    }],
    ['weekly exception under public name', (policy) => {
      policy.weeklyScheduleExceptions[PUBLIC] = structuredClone(policy.weeklyScheduleExceptions[OFFICIAL]);
    }],
  ]) {
    assert.throws(() => build(t, mutate), /rename|identity|authorized|exception/i, name);
  }
  const upstream = JSON.parse(readFileSync(join(basePolicy.upstreamDirectory, 'en.json'), 'utf8'));
  assert.ok(upstream.deepseek.models[OFFICIAL]);
  assert.ok(!upstream.deepseek.models[PUBLIC]);
});
