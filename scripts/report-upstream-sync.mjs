/** Bind the checked site and upstream price diff to the simulated merge. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from '../.cache/cny-build/cny/generate.js';

const configPath = 'api/newapi/ratio_config.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (root, relative) => readFileSync(join(root, relative));
const json = (root, relative) => JSON.parse(read(root, relative));

function checkedCandidate(root, source, upstream) {
  const manifestBytes = read(root, 'manifest.json');
  const { candidateId, ...payload } = JSON.parse(manifestBytes);
  const manifest = { ...payload, candidateId };
  assert.equal(manifest.sourceSha, source, 'Candidate source SHA');
  assert.equal(manifest.upstreamSha, upstream, 'Candidate upstream SHA');
  assert.equal(candidateId, hash(payload), 'Candidate manifest identity');
  assert.match(manifest.codeSha256, /^[a-f0-9]{64}$/);
  for (const [path, { bytes, sha256 }] of Object.entries(manifest.files)) {
    assert.match(path, /^(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.json$/);
    assert.ok(!path.split('/').some((part) => part === '.' || part === '..'));
    const file = read(root, path);
    assert.equal(sha(file), sha256, 'Candidate file checksum: ' + path);
    assert.equal(file.length, bytes, 'Candidate file size: ' + path);
  }
  const config = read(root, configPath);
  assert.equal(sha(config), manifest.files[configPath].sha256, 'Candidate price checksum');
  const { success, data } = JSON.parse(config);
  assert.equal(success, true);
  assert.deepEqual(Object.keys(data.billing_expr).sort(), Object.keys(data.billing_mode).sort());
  assert.equal(Object.keys(data.billing_expr).length, manifest.stats.apiModels);
  const { upstreamDirectory, ...policy } = json(root, 'policy.json');
  assert.equal(upstreamDirectory, 'data/upstream/' + upstream.slice(0, 8));
  const { models } = json(root, 'coverage.json');
  assert.ok(Array.isArray(models), 'Candidate coverage models');
  assert.equal(models.length, manifest.stats.models, 'Candidate model count');
  return {
    manifest,
    manifestBytes,
    modelCount: models.length,
    config,
    data,
    policy,
    selected: json(root, 'selection.json'),
    official: json(root, 'official-selection.json'),
  };
}

const [preparationFile, baseline, candidateRoot, site] = process.argv.slice(2);
assert.ok(
  preparationFile && baseline && candidateRoot && site,
  'Usage: report-upstream-sync.mjs <preparation.json> <baseline> <candidate> <site>',
);
const preparation = JSON.parse(readFileSync(preparationFile));
const { status, candidate, business, previousUpstream, upstream } = preparation;
assert.equal(status, 'candidate-ready');
for (const commit of [candidate, business, previousUpstream, upstream]) {
  assert.match(commit, /^[a-f0-9]{40}$/);
}
const before = checkedCandidate(baseline, business, previousUpstream);
const after = checkedCandidate(candidateRoot, candidate, upstream);
assert.deepEqual(after.policy, before.policy, 'Reviewed CNY policy changed');
assert.deepEqual(after.official, before.official, 'Reviewed official selection changed');

let officialKeys = 0;
for (const [key, id] of Object.entries(before.official)) {
  if (before.selected[key] !== id) continue;
  assert.equal(after.selected[key], id, 'Selected official identity changed: ' + key);
  assert.equal(
    after.data.billing_expr[key],
    before.data.billing_expr[key],
    'Selected official price changed: ' + key,
  );
  assert.equal(
    after.data.billing_mode[key],
    before.data.billing_mode[key],
    'Selected official billing mode changed: ' + key,
  );
  officialKeys++;
}

const candidateId = after.manifest.candidateId;
const fixedBase = 'versions/' + candidateId + '/';
const pointer = json(site, 'current.json');
assert.equal(pointer.schemaVersion, 3);
assert.equal(pointer.sourceSha, candidate, 'Site source differs from the checked candidate');
assert.equal(pointer.releaseId, candidateId);
assert.equal(pointer.fixedBase, fixedBase);
assert.equal(pointer.modelSource, fixedBase + configPath);
assert.equal(pointer.modelSourceSha256, sha(after.config));
assert.equal(pointer.manifestSha256, sha(after.manifestBytes));
assert.ok(read(site, fixedBase + 'manifest.json').equals(after.manifestBytes));
assert.ok(
  read(site, configPath).equals(after.config),
  'Stable site JSON differs from the candidate',
);
assert.ok(
  read(site, pointer.modelSource).equals(after.config),
  'Fixed site JSON differs from the candidate',
);

const diff = json(candidateRoot, 'price-diff.json');
assert.equal(diff.baseline.candidateId, before.manifest.candidateId);
const priceDiff = { added: 0, changed: 0, removed: 0 };
const priceChanges = [];
let includedBytes = 0;
for (const change of diff.changes) {
  const { nativeKey, type, reason, before, after } = change;
  assert.ok(Object.hasOwn(priceDiff, type), 'Unknown price diff type: ' + type);
  priceDiff[type]++;
  const entry = { nativeKey, type, reason, before, after };
  const entryBytes = Buffer.byteLength(JSON.stringify(entry));
  if (includedBytes + entryBytes <= 20_000) {
    includedBytes += entryBytes;
    priceChanges.push(entry);
  }
}
console.log(
  JSON.stringify({
    candidate,
    upstream,
    business,
    candidateId,
    priceDiff,
    priceChanges,
    omittedPriceChanges: diff.changes.length - priceChanges.length,
    models: { before: before.modelCount, after: after.modelCount },
    officialKeys,
  }),
);
