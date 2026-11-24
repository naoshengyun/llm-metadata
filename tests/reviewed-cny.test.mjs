import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('the reviewed build refuses a cutoff in the future before creating a candidate', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'reviewed-cny-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json'));
  policy.asOf = '2999-01-01T00:00:00Z';
  const policyPath = join(temp, 'policy.json');
  writeFileSync(policyPath, JSON.stringify(policy));
  const result = spawnSync(process.execPath, ['scripts/check-cny-effective-time.mjs', policyPath], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Review cutoff is in the future/);
});

test('Pages dependency checks reject a public pointer from an older deployment', async (t) => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  const older = 'a'.repeat(40);
  const newer = 'b'.repeat(40);
  const releaseId = 'f'.repeat(64);
  const server = createServer((_req, res) =>
    res.end(JSON.stringify({ schemaVersion: 3, sourceSha: older, releaseId })),
  );
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const child = spawn(process.execPath, [
    'scripts/cny-pages-release.mjs',
    'guard',
    'http://127.0.0.1:' + server.address().port + '/',
    newer,
    releaseId,
  ]);
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (text) => (stderr += text));
  const status = await new Promise((resolve) => child.on('close', resolve));
  assert.notEqual(status, 0);
  assert.match(stderr, /Public pointer does not identify the expected preceding deployment/);
});

test('branch rule readback rejects a bypass actor', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'reviewed-cny-rules-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const readback = JSON.parse(readFileSync('.github/cny-branch-rules.json'));
  readback.bypass_actors.push({ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' });
  const path = join(temp, 'rules.json');
  writeFileSync(path, JSON.stringify(readback));
  const result = spawnSync(process.execPath, ['scripts/check-cny-rules.mjs', path], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Ruleset bypass actors are forbidden/);
});

test('site sealing refuses to replace an already published fixed URL', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'reviewed-cny-history-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const site = join(temp, 'site');
  const previous = join(temp, 'previous');
  const path = join('versions', 'f'.repeat(64), 'ratio_config.json');
  for (const root of [site, previous]) {
    mkdirSync(join(root, 'versions', 'f'.repeat(64)), { recursive: true });
    writeFileSync(join(root, 'current.json'), '{"complete":false}');
  }
  writeFileSync(join(site, 'site-manifest.json'), '{"complete":false,"files":{}}');
  writeFileSync(join(site, path), 'rewritten');
  writeFileSync(join(previous, path), 'published');

  const result = spawnSync(
    process.execPath,
    ['scripts/cny-pages-release.mjs', 'seal', site, previous],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Immutable Pages file changed/);
  assert.equal(readFileSync(join(site, path), 'utf8'), 'rewritten');
});
