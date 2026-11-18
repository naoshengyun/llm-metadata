import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value) + '\n';
const run = (...args) =>
  promisify(execFile)(process.execPath, ['scripts/cny-pages-release.mjs', ...args]);

function release(marker) {
  const sourceSha = marker.repeat(40);
  const releaseId = marker.repeat(64);
  const fixedBase = `versions/${releaseId}/`;
  const modelSource = fixedBase + 'api/newapi/ratio_config.json';
  const prices = json({ success: true, message: '', data: {} });
  const fixed = json({ candidateId: releaseId, sourceSha });
  const manifestSha256 = sha(fixed);
  const files = {
    'index.html': '<p>Verified prices</p>',
    'app/js/site.js': 'window.site = true;',
    'api/newapi/ratio_config.json': prices,
    [modelSource]: prices,
    [fixedBase + 'manifest.json']: fixed,
    'current.json': json({
      schemaVersion: 3,
      sourceSha,
      releaseId,
      manifestSha256,
      fixedBase,
      modelSource,
      modelSourceSha256: sha(prices),
    }),
  };
  files['site-manifest.json'] = json({
    sourceSha,
    releaseId,
    manifestSha256,
    files: Object.fromEntries(
      Object.entries(files).map(([path, body]) => [
        path,
        { sha256: sha(body), bytes: Buffer.byteLength(body) },
      ]),
    ),
  });
  return {
    files,
    sourceSha,
    manifestHash: sha(files['site-manifest.json']),
    pointerHash: sha(files['current.json']),
  };
}

test('a verified Pages backup can recover a failed publication without replacing a newer pointer', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-recovery-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const previous = release('a');
  const candidate = release('b');
  const newer = release('c');
  let served = previous.files;
  const server = createServer(({ url }, response) => {
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    const bytes = served[path];
    response.writeHead(bytes === undefined ? 404 : 200).end(bytes);
  });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/';
  const backup = join(dir, 'backup');
  const canRestore = () =>
    run(
      'guard-restore',
      origin,
      previous.sourceSha,
      previous.manifestHash,
      previous.pointerHash,
      candidate.pointerHash,
    );
  await assert.rejects(
    run('snapshot', origin, backup, previous.sourceSha, 'backup', candidate.manifestHash),
    /Public site inventory hash/,
  );
  await run('snapshot', origin, backup, previous.sourceSha, 'backup', previous.manifestHash);
  assert.equal(
    readFileSync(join(backup, 'app/js/site.js'), 'utf8'),
    previous.files['app/js/site.js'],
  );
  await run('verify-local', backup, previous.sourceSha, previous.manifestHash);

  // A deployment can become visible after the deploy action times out; HTTP determines the result.
  await assert.rejects(run('verify', origin, candidate.sourceSha, candidate.manifestHash));
  assert.equal((await canRestore()).stdout.trim(), 'already-verified');
  served = candidate.files;
  const receipt = JSON.parse(
    (await run('verify', origin, candidate.sourceSha, candidate.manifestHash)).stdout,
  );
  assert.deepEqual(receipt, {
    sourceSha: candidate.sourceSha,
    releaseId: 'b'.repeat(64),
    siteManifestSha256: candidate.manifestHash,
  });

  served = { ...candidate.files, 'app/js/site.js': 'corrupt' };
  await assert.rejects(
    run('verify', origin, candidate.sourceSha, candidate.manifestHash),
    /site.js/,
  );
  assert.equal((await canRestore()).stdout.trim(), 'restore');
  served = newer.files;
  await assert.rejects(canRestore(), /newer or unknown publication/);
  served = Object.fromEntries(
    Object.keys(previous.files).map((path) => [path, readFileSync(join(backup, path))]),
  );
  assert.equal((await canRestore()).stdout.trim(), 'already-verified');
  await run('verify', origin, previous.sourceSha, previous.manifestHash);

  writeFileSync(join(backup, 'app/js/site.js'), 'corrupt');
  await assert.rejects(
    run('verify-local', backup, previous.sourceSha, previous.manifestHash),
    /site.js/,
  );
});
