import assert from 'node:assert/strict';

export const NATIVE_RENAME_REASON = 'user-approved-native-model-rename';
const DECLARATION_REASON = 'user-approved-naoshengyun-public-model-rename';
const DECLARATION_KEYS = [
  'providerId',
  'endpoint',
  'officialModelId',
  'nativeKey',
  'reason',
];

export function nativeBillingRenames(policy) {
  return policy.nativeBillingIdentityRenames ?? [];
}

export function nativeBillingRename(policy, key) {
  return nativeBillingRenames(policy).find(
    (rename) => rename.officialModelId === key || rename.nativeKey === key,
  );
}

export function nativeBillingKey(policy, providerId, endpoint, officialModelId) {
  return nativeBillingRenames(policy).find(
    (rename) =>
      rename.providerId === providerId &&
      rename.endpoint === endpoint &&
      rename.officialModelId === officialModelId,
  )?.nativeKey ?? officialModelId;
}

export function officialModelKey(policy, publicKey) {
  return nativeBillingRenames(policy).find((rename) => rename.nativeKey === publicKey)
    ?.officialModelId ?? publicKey;
}

export function previousSelectedQuote(previous, officialModelId) {
  if (!previous) return undefined;
  const rename = nativeBillingRenames(previous.policy).find(
    (item) => item.officialModelId === officialModelId,
  );
  return previous.selected[rename?.nativeKey ?? officialModelId];
}

export function validateNativeBillingRenames(policy, snapshots, previous) {
  const renames = nativeBillingRenames(policy);
  assert.ok(Array.isArray(renames) && renames.length <= 1, 'Only one reviewed native rename is allowed');
  if (previous && nativeBillingRenames(previous.policy).length)
    assert.deepEqual(
      renames,
      nativeBillingRenames(previous.policy),
      'Native billing rename identity cannot be removed or changed',
    );
  if (!renames.length) return;
  const [rename] = renames;
  assert.deepEqual(Object.keys(rename).sort(), [...DECLARATION_KEYS].sort(), 'Native rename declaration keys');
  assert.equal(rename.reason, DECLARATION_REASON, 'Native rename decision');
  assert.equal(rename.providerId, 'deepseek', 'Approved native rename provider');
  assert.equal(rename.endpoint, 'https://api.deepseek.com', 'Approved native rename endpoint');
  assert.equal(rename.officialModelId, 'deepseek-flash', 'Approved native rename source');
  assert.equal(rename.nativeKey, 'deepseek-v4.1-flash', 'Approved native rename target');
  assert.ok(rename.providerId && rename.endpoint?.startsWith('https://'), 'Native rename endpoint');
  assert.ok(rename.officialModelId && rename.nativeKey, 'Native rename identities');
  assert.notEqual(rename.officialModelId, rename.nativeKey, 'Native rename must change the public key');
  for (const field of [
    'weeklyScheduleExceptions',
    'nativeCapabilityExclusions',
    'lifecycle',
    'upstreamSelection',
  ])
    assert.ok(
      !Object.hasOwn(policy[field] ?? {}, rename.nativeKey),
      'Native rename cannot create a policy or exception identity: ' + field,
    );
  for (const [locale, providers] of Object.entries(snapshots)) {
    const provider = providers[rename.providerId];
    assert.ok(provider, 'Missing native rename provider: ' + locale);
    assert.equal(provider.api, rename.endpoint, 'Native rename endpoint must match upstream');
    assert.ok(provider.models[rename.officialModelId], 'Missing official native rename source');
    for (const [providerId, current] of Object.entries(providers))
      assert.ok(
        !Object.hasOwn(current.models, rename.nativeKey),
        'Native rename target already exists: ' + locale + '/' + providerId,
      );
  }
}

export function publicSelectedPrices(selected, policy) {
  const output = Object.create(null);
  for (const [officialKey, price] of Object.entries(selected)) {
    const publicKey = nativeBillingKey(policy, price.providerId, price.endpoint, officialKey);
    assert.ok(!Object.hasOwn(output, publicKey), 'Duplicate native billing identity: ' + publicKey);
    output[publicKey] = price;
  }
  return output;
}

export function publicModelRows(models, policy) {
  return models.map((row) => ({
    ...row,
    nativeKey: nativeBillingKey(policy, row.providerId, row.endpoint, row.modelId),
  }));
}

function renameNativeKeyFields(value, rename) {
  if (Array.isArray(value)) {
    for (const item of value) renameNativeKeyFields(item, rename);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (
    value.nativeKey === rename.officialModelId &&
    value.providerId === rename.providerId &&
    value.modelId === rename.officialModelId &&
    (value.endpoint === undefined || value.endpoint === rename.endpoint)
  )
    value.nativeKey = rename.nativeKey;
  for (const item of Object.values(value)) renameNativeKeyFields(item, rename);
}

function renameProvider(provider, rename) {
  const model = provider.models[rename.officialModelId];
  assert.ok(model, 'Localized official model missing during native rename');
  assert.ok(!provider.models[rename.nativeKey], 'Localized native rename target already exists');
  delete provider.models[rename.officialModelId];
  model.id = rename.nativeKey;
  model.legacyIds = [...new Set([...(model.legacyIds ?? []), rename.officialModelId])];
  if (model.pricing_view) {
    assert.equal(model.pricing_view.modelId, rename.officialModelId);
    model.pricing_view.modelId = rename.nativeKey;
    model.pricing_view.officialModelId = rename.officialModelId;
    model.pricing_view.nativeKey = rename.nativeKey;
  }
  model.officialModelId = rename.officialModelId;
  renameNativeKeyFields(model, rename);
  provider.models[rename.nativeKey] = model;
}

/** Rename only generated public identities after all official and coverage guards pass. */
export function renameNativeBillingOutputs(files, policy) {
  const [rename] = nativeBillingRenames(policy);
  if (!rename) return;
  for (const name of ['coverage.json', 'display-coverage.json']) {
    const value = JSON.parse(files[name]);
    renameNativeKeyFields(value, rename);
    for (const model of value.models ?? [])
      if (model.providerId === rename.providerId && model.modelId === rename.officialModelId) {
        model.modelId = rename.nativeKey;
        model.officialModelId = rename.officialModelId;
      }
    for (const source of value.sourceRecords ?? [])
      for (const location of source.locations ?? [])
        if (location.providerId === rename.providerId && location.modelId === rename.officialModelId)
          location.modelId = rename.nativeKey;
    files[name] = JSON.stringify(value, null, 2) + '\n';
  }
  for (const locale of ['en', 'zh', 'ja']) {
    const prefix = 'api/' + (locale === 'en' ? '' : 'i18n/' + locale + '/');
    for (const name of [prefix + 'all.json', prefix + 'providers/' + rename.providerId + '.json']) {
      const value = JSON.parse(files[name]);
      const provider = name.endsWith('/all.json') ? value[rename.providerId] : value;
      renameProvider(provider, rename);
      files[name] = JSON.stringify(value, null, 2) + '\n';
    }
    const name = prefix + 'index.json';
    const index = JSON.parse(files[name]);
    for (const model of index.models)
      if (model.providerId === rename.providerId && model.id === rename.officialModelId)
        model.id = rename.nativeKey;
    files[name] = JSON.stringify(index, null, 2) + '\n';
  }
}
