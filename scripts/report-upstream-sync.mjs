/** Bind the checked site and upstream price diff to the simulated merge. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const configPath = 'api/newapi/ratio_config.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (root, relative) => readFileSync(join(root, relative));
const json = (root, relative) => JSON.parse(read(root, relative));

function checkedCandidate(root, source, upstream) {
  const manifest = json(root, 'manifest.json');
  assert.equal(manifest.sourceSha, source, 'Candidate source SHA');
  assert.equal(manifest.upstreamSha, upstream, 'Candidate upstream SHA');
  assert.match(manifest.candidateId, /^[a-f0-9]{64}$/);
  const config = read(root, configPath);
  assert.equal(sha(config), manifest.files[configPath].sha256, 'Candidate price checksum');
  const { success, data } = JSON.parse(config);
  assert.equal(success, true);
  assert.deepEqual(Object.keys(data.billing_expr).sort(), Object.keys(data.billing_mode).sort());
  assert.equal(Object.keys(data.billing_expr).length, manifest.stats.apiModels);
  const { upstreamDirectory, ...policy } = json(root, 'policy.json');
  assert.equal(upstreamDirectory, 'data/upstream/' + upstream.slice(0, 8));
  return {
    manifest,
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
    models: { before: before.manifest.stats.models, after: after.manifest.stats.models },
    officialKeys,
  }),
);
