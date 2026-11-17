import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOfficialSnapshot } from '../scripts/build-official-cny.mjs';
import {
  buildPublicationPackage,
  verifyPublicationPackage,
  downloadPublicationPackage,
  writePublicationPackage,
} from '../.cache/cny-build/cny/publication-package.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { buildArtifact } from '../.cache/cny-build/cny/artifact.js';

function candidate() {
  const read = (name) => JSON.parse(readFileSync(new URL('../data/cny/' + name, import.meta.url)));
  return Buffer.from(
    JSON.stringify(
      buildOfficialSnapshot({
        sourceSha: 'd5a84ca10d8599343370c1541828439a56b8dd1b',
        catalog: read('official-catalog.json'),
        reference: read('coverage-reference.json'),
        selection: read('proposed-selection.json').selection,
      }).artifact,
    ),
  );
}
const selection = {
  models: ['kimi-k3.1-pro'],
  plugins: { 'doubao-seedance-2-0-fast-260128': ['doubao'] },
  tools: ['search_std'],
  mode: 'partial',
  purpose: 'test',
};
test('S: a fixed package delivers explicitly selected model/plugin/tool prices from one candidate', () => {
  const bytes = candidate(),
    p = buildPublicationPackage(bytes, selection);
  assert.equal(
    JSON.parse(p.files['ratio_config.json']).data.billing_expr['kimi-k3.1-pro'],
    'tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)',
  );
  assert.match(
    JSON.parse(p.files['plugin_prices.json'])['doubao-seedance-2-0-fast-260128'].doubao,
    /1000000/,
  );
  assert.deepEqual(JSON.parse(p.files['tool_prices.json']), {
    'tool_price_setting.prices': { search_std: 10 },
  });
  assert.equal(p.files['artifact.json'], bytes.toString('utf8'));
  assert.equal(p.manifest.complete, false);
  assert.equal(p.manifest.selection.purpose, 'test');
  assert.deepEqual(buildPublicationPackage(bytes, selection), p);
});
test('S: selected plugin/tool keys, source eligibility and prices must all match the candidate', () => {
  for (const bad of [
    { ...selection, plugins: { 'doubao-seedance-2-0-fast-260128': ['missing'] } },
    { ...selection, tools: ['missing'] },
    { ...selection, tools: ['search_std', 'search_std'] },
    { ...selection, plugins: { 'doubao-seedance-2-0-fast-260128': ['doubao', 'doubao'] } },
  ])
    assert.throws(() => buildPublicationPackage(candidate(), bad));
  const a = JSON.parse(candidate());
  a.tools.search_std = 0;
  const { sourceSha, data, quotes, selection: chosen, models, plugins, tools, exclusions } = a;
  const changed = buildArtifact(
    { sourceSha, data, quotes, selection: chosen, models, plugins, tools, exclusions },
    a.generatedAt,
  );
  assert.throws(
    () => buildPublicationPackage(Buffer.from(JSON.stringify(changed)), selection),
    /eligible|source|price/,
  );
});
test('S: a plugin-only explicit subset is visible as not selecting a model source, never a default model', () => {
  const p = buildPublicationPackage(candidate(), { ...selection, models: [], tools: [] });
  assert.deepEqual(JSON.parse(p.files['ratio_config.json']), {
    success: true,
    data: { billing_mode: {}, billing_expr: {} },
  });
  assert.equal(p.manifest.partitionStatus.models, 'not-selected');
  assert.equal(p.manifest.modelSourceReleaseId, null);
  assert.throws(() =>
    buildPublicationPackage(candidate(), { ...selection, models: [], plugins: {}, tools: [] }),
  );
});
test('S: trusted external manifest identity verifies complete package and rejects missing/corrupt/mixed/extra payloads', () => {
  const bytes = candidate(),
    p = buildPublicationPackage(bytes, selection),
    identity = { releaseId: p.releaseId, manifestSha256: p.manifestSha256 };
  assert.equal(verifyPublicationPackage(p.files, identity).releaseId, p.releaseId);
  for (const name of Object.keys(p.files)) {
    const missing = { ...p.files };
    delete missing[name];
    assert.throws(() => verifyPublicationPackage(missing, identity));
    assert.throws(() =>
      verifyPublicationPackage({ ...p.files, [name]: p.files[name] + ' ' }, identity),
    );
  }
  const other = buildPublicationPackage(bytes, { ...selection, tools: [] });
  assert.throws(() =>
    verifyPublicationPackage(
      { ...p.files, 'tool_prices.json': other.files['tool_prices.json'] },
      identity,
    ),
  );
  assert.throws(() => verifyPublicationPackage({ ...p.files, 'extra.json': '{}' }, identity));
  assert.throws(() =>
    verifyPublicationPackage(p.files, { ...identity, manifestSha256: '0'.repeat(64) }),
  );
});
test('H: a fixed local HTTP URL delivers a verified package and rejects a corrupted partition', async () => {
  const p = buildPublicationPackage(candidate(), selection);
  let corrupt = false;
  const server = createServer((req, res) => {
    const name = req.url.slice('/fixed/'.length);
    const body = p.files[name];
    if (!req.url.startsWith('/fixed/') || body === undefined) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(corrupt && name === 'plugin_prices.json' ? '{}' : body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const base = 'http://127.0.0.1:' + server.address().port + '/fixed/';
    const id = { releaseId: p.releaseId, manifestSha256: p.manifestSha256 };
    assert.equal((await downloadPublicationPackage(base, id)).releaseId, p.releaseId);
    corrupt = true;
    await assert.rejects(() => downloadPublicationPackage(base, id));
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test('S: full mode cannot omit an available plugin or tool even when the source candidate is complete', () => {
  const original = JSON.parse(candidate());
  const records = ['kimi-k3.1-pro', 'doubao-seedance-2-0-fast-260128', 'search_std'].map((name) =>
    original.quotes.records.find((q) => q.id === original.selection[name]),
  );
  const ref = {
    providedCount: 1,
    reportedCount: 1,
    unexplainedDifference: 0,
    platforms: [{ platform: 'synthetic', protocol: 'chat', models: ['kimi-k3.1-pro'] }],
  };
  const a = buildOfficialSnapshot({
    sourceSha: original.sourceSha,
    catalog: {
      checkedAt: '2026-11-16',
      records,
      excludedQuotes: [],
      coverage: [
        {
          platform: 'synthetic',
          model: 'kimi-k3.1-pro',
          status: 'ready',
          quoteIds: [records.find((q) => q.model === 'kimi-k3.1-pro').id],
        },
      ],
    },
    reference: ref,
    selection: Object.fromEntries(records.map((q) => [q.model, q.id])),
  }).artifact;
  assert.equal(a.manifest.complete, true);
  const bytes = Buffer.from(JSON.stringify(a));
  assert.throws(
    () => buildPublicationPackage(bytes, { ...selection, mode: 'full', plugins: {}, tools: [] }),
    /full|complete/,
  );
  assert.equal(
    buildPublicationPackage(bytes, { ...selection, mode: 'full' }).manifest.partial,
    false,
  );
});
test('S: operator handoff preserves original units/dates, per-partition selections and unresolved operating states', () => {
  const p = buildPublicationPackage(candidate(), selection),
    record = JSON.parse(p.files['publication-record.json']);
  assert.equal(record.selected.models[0].quote.model, 'kimi-k3.1-pro');
  assert.equal(record.selected.tools[0].normalized.unit, 'per_thousand_calls');
  assert.equal(record.selected.tools[0].normalized.amount, 10);
  assert.equal(record.selected.tools[0].quotes[0].tools[0].unit, 'per_call');
  assert.equal(record.selected.tools[0].quotes[0].source.checkedAt, '2026-11-16');
  assert.ok(record.notSelected.models.includes('claude-sonnet-4-5'));
  assert.equal(record.operatingState.calls, 'not-tested');
  assert.equal(record.operatingState.sale, 'not-approved');
  assert.match(p.files['OPERATIONS.md'], /Upstream price sync/);
  assert.match(p.files['OPERATIONS.md'], /Tool prices/);
  assert.match(p.files['OPERATIONS.md'], /USDExchangeRate=1/);
  assert.match(p.files['OPERATIONS.md'], /源回退不恢复实例/);
});
test('S: complete fixed package is written once; overwrite and incomplete package never become a new version', () => {
  const root = mkdtempSync(join(tmpdir(), 'cny-package-write-'));
  try {
    const p = buildPublicationPackage(candidate(), selection),
      id = { releaseId: p.releaseId, manifestSha256: p.manifestSha256 };
    const dir = writePublicationPackage(root, p.files, id);
    assert.equal(readFileSync(join(dir, 'artifact.json'), 'utf8'), p.files['artifact.json']);
    assert.throws(() => writePublicationPackage(root, p.files, id), /EEXIST/);
    const missing = { ...p.files };
    delete missing['plugin_prices.json'];
    assert.throws(() => writePublicationPackage(root, missing, id));
    assert.equal(readFileSync(join(dir, 'manifest.json'), 'utf8'), p.files['manifest.json']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('S: clearing exclusions and recomputing identity cannot disguise incomplete raw coverage as complete', () => {
  const a = JSON.parse(candidate());
  const { sourceSha, data, quotes, selection: chosen, models, plugins, tools } = a;
  const forged = buildArtifact(
    { sourceSha, data, quotes, selection: chosen, models, plugins, tools, exclusions: [] },
    a.generatedAt,
  );
  const all = {
    ...selection,
    models: Object.keys(models),
    plugins: Object.fromEntries(Object.entries(plugins).map(([m, p]) => [m, Object.keys(p)])),
    tools: Object.keys(tools),
    mode: 'full',
  };
  assert.throws(
    () => buildPublicationPackage(Buffer.from(JSON.stringify(forged)), all),
    /complete/,
  );
});

test('H: transport bytes are hashed without silently dropping an injected UTF-8 BOM', async () => {
  const p = buildPublicationPackage(candidate(), selection);
  const fetcher = async (url) => {
    const name = new URL(url).pathname.split('/').at(-1);
    const bytes = Buffer.from(p.files[name]);
    return new Response(
      name === 'manifest.json' ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]) : bytes,
    );
  };
  await assert.rejects(
    () =>
      downloadPublicationPackage(
        'https://fixture.invalid/fixed/',
        { releaseId: p.releaseId, manifestSha256: p.manifestSha256 },
        fetcher,
      ),
    /hash/,
  );
});

test('S: invalid UTF-8 cannot be silently normalized while claiming original candidate bytes', () => {
  const bytes = candidate(),
    needle = Buffer.from('"generatedAt":"');
  const index = bytes.indexOf(needle) + needle.length;
  assert.ok(index >= needle.length);
  const bad = Buffer.from(bytes);
  bad[index] = 0xff;
  assert.throws(() => buildPublicationPackage(bad, selection), /UTF-8/);
});

test('S: rejected tool quotes remain excluded provenance, not selected contributors to a valid partial tool price', () => {
  const seed = JSON.parse(candidate());
  const valid = seed.quotes.records.find((q) => q.id === seed.selection.search_std);
  const rejected = structuredClone(valid);
  rejected.id = 'rejected-search-quote';
  rejected.source.url = '';
  rejected.tools[0].amount = 999;
  const catalog = { ...seed.quotes, records: [...seed.quotes.records, rejected] };
  const artifact = buildOfficialSnapshot({
    sourceSha: seed.sourceSha,
    catalog,
    reference: seed.data.reference,
    selection: { ...seed.selection, 'rejected-search-alias': rejected.id },
  }).artifact;
  assert.equal(artifact.tools.search_std, 10);
  const bytes = Buffer.from(JSON.stringify(artifact));
  const p = buildPublicationPackage(bytes, { ...selection, models: [], plugins: {} });
  const record = JSON.parse(p.files['publication-record.json']);
  assert.deepEqual(
    record.selected.tools[0].quotes.map((q) => q.id),
    [valid.id],
  );
  assert.equal(
    record.notSelected.officialQuotes.find((q) => q.quoteId === rejected.id).reason,
    'missing-source',
  );
  assert.ok(
    JSON.parse(p.files['exclusions.json']).some(
      (q) => q.id === rejected.id && q.status === 'missing-source',
    ),
  );
  assert.equal(
    verifyPublicationPackage(p.files, { releaseId: p.releaseId, manifestSha256: p.manifestSha256 })
      .releaseId,
    p.releaseId,
  );
});

test('S: tool provenance uses actual candidate bindings, not a rejected task alias regenerated under its official name', () => {
  const seed = JSON.parse(candidate());
  const q = structuredClone(
    seed.quotes.records.find((q) => q.id === seed.selection['doubao-seedance-2-0-fast-260128']),
  );
  q.id = 'task-with-rejected-binding';
  q.tools = [{ key: 'search_std', amount: 0.01, unit: 'per_call', currency: 'CNY' }];
  const artifact = buildOfficialSnapshot({
    sourceSha: seed.sourceSha,
    catalog: { ...seed.quotes, records: [...seed.quotes.records, q] },
    reference: seed.data.reference,
    selection: { ...seed.selection, 'unsupported-task-alias': q.id },
  }).artifact;
  assert.equal(artifact.tools.search_std, 10);
  const p = buildPublicationPackage(Buffer.from(JSON.stringify(artifact)), {
    ...selection,
    models: [],
    plugins: {},
  });
  const record = JSON.parse(p.files['publication-record.json']);
  assert.deepEqual(
    record.selected.tools[0].quotes.map((q) => q.id),
    [seed.selection.search_std],
  );
});
