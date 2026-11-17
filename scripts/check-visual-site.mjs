/** Run against a built site: proves the UI catalog is exactly the immutable selection. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const out = process.argv[2];
const read = (p) => JSON.parse(readFileSync(join(out, p)));
const request = JSON.parse(readFileSync('data/cny/publication/first-release.json'));
const artifact = JSON.parse(readFileSync(request.artifactPath));
const api = read('api/newapi/ratio_config.json');
assert.equal(
  createHash('sha256')
    .update(readFileSync(join(out, 'api/newapi/ratio_config.json')))
    .digest('hex'),
  '951840fcad1e39ddf8d43d8a0f215d185c7d0cf91769044d68c3980ff7b8c501',
);
const all = read('api/all.json');
const ids = Object.values(all)
  .flatMap((p) => Object.keys(p.models))
  .sort();
assert.deepEqual(ids, [...request.selection.models].sort());
assert.equal(ids.length, 43);
for (const locale of ['', 'i18n/zh/', 'i18n/ja/']) {
  const providers = read('api/' + locale + 'providers.json').providers;
  assert.equal(
    providers.reduce((n, p) => n + p.modelCount, 0),
    43,
  );
  for (const p of providers) {
    const detail = read('api/' + locale + 'providers/' + p.id + '.json');
    assert.equal(Object.keys(detail.models).length, p.modelCount);
    for (const [id, m] of Object.entries(detail.models)) {
      assert.equal(m.cost.publication_expr, api.data.billing_expr[id]);
      assert.equal(api.data.billing_mode[id], 'tiered_expr');
      assert.equal(m.cost.currency, 'CNY');
      const q = artifact.quotes.records.find((q) => q.id === artifact.selection[id]);
      for (const key of Object.keys(q.cost).filter((k) => typeof q.cost[k] === 'number'))
        assert.equal(m.cost[key], q.cost[key] * (q.currency === 'USD' ? 7 : 1));
    }
  }
}
const manifest = read('site-manifest.json');
for (const [path, v] of Object.entries(manifest.files))
  assert.equal(
    createHash('sha256')
      .update(readFileSync(join(out, path)))
      .digest('hex'),
    v.sha256,
    path,
  );
assert.equal(read('current.json').releaseId, request.releaseId);
assert.equal(
  createHash('sha256')
    .update(readFileSync(join(out, 'versions', request.releaseId, 'manifest.json')))
    .digest('hex'),
  request.manifestSha256,
);
console.log(
  'PASS: 43 exact models; locale/provider counts; fixed expr/mode; original CNY/USD×7; current/fixed hashes; site inventory',
);
