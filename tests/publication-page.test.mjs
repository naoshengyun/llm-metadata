import { readHistoricalOfficialInputs } from './fixtures/november-2026-cny.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialSnapshot } from '../scripts/build-official-cny.mjs';
import {
  buildPublicationPackage,
  verifyPublicationPackage,
} from '../.cache/cny-build/cny/publication-package.js';
import { preparePublicationTransition } from '../.cache/cny-build/cny/publication-promotion.js';
import { buildPublicationSite } from '../.cache/cny-build/cny/publication-page.js';
test('published page and static APIs bind one candidate and v2 explains zero tool surcharge without rewriting v1', () => {
  const a = buildOfficialSnapshot({
    sourceSha: 'd5a84ca10d8599343370c1541828439a56b8dd1b',
    ...readHistoricalOfficialInputs(),
  }).artifact;
  const selection = {
    models: ['kimi-k3.1-pro'],
    plugins: {},
    tools: [],
    purpose: 'candidate',
    mode: 'partial',
  };
  const bytes = Buffer.from(JSON.stringify(a)),
    legacy = buildPublicationPackage(bytes, selection),
    p = buildPublicationPackage(bytes, selection, 'v2');
  assert.equal(p.manifest.adapterVersion, 'cny-package/v2');
  assert.notEqual(p.releaseId, legacy.releaseId);
  assert.match(p.files['OPERATIONS.md'], /显式.*0/);
  assert.match(p.files['OPERATIONS.md'], /官方报价参考/);
  assert.equal(verifyPublicationPackage(legacy.files, legacy).releaseId, legacy.releaseId);
  assert.equal(verifyPublicationPackage(p.files, p).releaseId, p.releaseId);
  const snapshot = preparePublicationTransition(null, p.files, p, 'promote').snapshot,
    site = buildPublicationSite(snapshot);
  assert.match(site.files['index.html'], new RegExp(p.releaseId));
  assert.match(site.files['index.html'], /\.\/api\/newapi\/ratio_config.json/);
  assert.doesNotMatch(site.files['index.html'], /(?:src|href)="\//);
  assert.equal(site.files['api/newapi/ratio_config.json'], p.files['ratio_config.json']);
  assert.equal(site.manifest.releaseId, p.releaseId);
  assert.equal(site.manifest.snapshotRevision, snapshot.revision);
  assert.equal(
    site.manifest.files['index.html'].bytes,
    Buffer.byteLength(site.files['index.html']),
  );
});
