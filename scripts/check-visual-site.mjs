import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeSnapshot } from './upstream-snapshot.mjs';
import { sha } from './upstream-cny.mjs';
const out = process.argv[2],
  s = makeSnapshot(),
  read = (p) => JSON.parse(readFileSync(join(out, p)));
const current = read('current.json');
assert.equal(current.releaseId, s.releaseId);
assert.equal(current.manifestSha256, s.manifestSha256);
assert.deepEqual(read('api/newapi/ratio_config.json'), s.datasets.en.config);
for (const l of ['en', 'zh', 'ja']) {
  const prefix = 'api/' + (l === 'en' ? '' : `i18n/${l}/`);
  assert.deepEqual(read(prefix + 'all.json'), JSON.parse(JSON.stringify(s.datasets[l].providers)));
  for (const p of Object.values(JSON.parse(JSON.stringify(s.datasets[l].providers))))
    assert.deepEqual(read(prefix + 'providers/' + p.id + '.json'), JSON.parse(JSON.stringify(p)));
}
for (const [p, b] of Object.entries(s.files))
  assert.equal(readFileSync(join(out, 'versions', s.releaseId, p), 'utf8'), b);
for (const [p, v] of Object.entries(read('site-manifest.json').files)) {
  const b = readFileSync(join(out, p));
  assert.equal(sha(b), v.sha256, p);
  assert.equal(b.length, v.bytes, p);
}
const old = 'versions/74e69aea7269e8b0c2ac216cb13d332b23324c9adc6fb9f6e9ceeefb5bd91c1b/';
assert.equal(
  sha(readFileSync(join(out, old + 'manifest.json'))),
  'b13bb57933d8083b7d3cc64fdaf49524f5c6ce09ada202629c12a1faf47c7a81',
);
assert.equal(
  sha(readFileSync(join(out, old + 'ratio_config.json'))),
  '951840fcad1e39ddf8d43d8a0f215d185c7d0cf91769044d68c3980ff7b8c501',
);
console.log(
  'PASS full frozen catalog/locales, selected CNY API, exclusions, release/inventory and immutable legacy files',
  s.manifest.stats,
);
