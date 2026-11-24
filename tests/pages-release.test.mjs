import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value) + '\n';
const run = (...args) =>
  promisify(execFile)(process.execPath, ['scripts/cny-pages-release.mjs', ...args]);
const runRetry = (...args) =>
  promisify(execFile)(process.execPath, ['scripts/cny-pages-verify-with-retry.mjs', ...args]);
const runRetryWithEnv = (env, ...args) =>
  promisify(execFile)(
    process.execPath,
    ['scripts/cny-pages-verify-with-retry.mjs', ...args],
    { env: { ...process.env, ...env } },
  );

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
      complete: false,
    }),
  };
  files['site-manifest.json'] = json({
    sourceSha,
    releaseId,
    manifestSha256,
    complete: false,
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
    releaseId,
    manifestHash: sha(files['site-manifest.json']),
    pointerHash: sha(files['current.json']),
  };
}

async function waitFor(check, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(20);
  }
  assert.ok(check(), 'condition was not met before the test deadline');
}

function writeFiles(root, files) {
  mkdirSync(root, { recursive: true });
  for (const [path, body] of Object.entries(files)) {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, body);
  }
}

async function serve(t, initial) {
  let files = initial;
  const server = createServer(({ url }, response) => {
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    const bytes = files[path];
    response.writeHead(bytes === undefined ? 404 : 200).end(bytes);
  });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: 'http://127.0.0.1:' + server.address().port + '/',
    update(next) { files = next; },
  };
}

async function sealedCandidate(t, marker = 'b') {
  const dir = mkdtempSync(join(tmpdir(), 'pages-two-phase-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const previous = release('a');
  const candidate = release(marker);
  const site = join(dir, 'site');
  writeFiles(site, candidate.files);
  writeFiles(join(dir, 'previous'), previous.files);
  const sealedPath = join(dir, 'sealed.json');
  writeFileSync(
    sealedPath,
    (await run('seal', site, join(dir, 'previous'))).stdout,
  );
  const sealed = JSON.parse(readFileSync(sealedPath));
  return { dir, previous, candidate, site, sealedPath, sealed };
}

function rootFiles(site) {
  return Object.fromEntries(
    readdirSync(site)
      .filter((path) => !['versions', 'api', 'app'].includes(path))
      .map((path) => [path, readFileSync(join(site, path), 'utf8')]),
  );
}

test('retaining the verified Pages archive retries a transient 503', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-retain-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const previous = release('a');
  const current = JSON.parse(previous.files['current.json']);
  const archivePath = current.fixedBase + 'manifest.json';
  const precedingPath = 'versions/' + 'b'.repeat(64) + '/manifest.json';
  const preceding = release('b').files[precedingPath];
  const manifest = JSON.parse(previous.files['site-manifest.json']);
  manifest.files[precedingPath] = { sha256: sha(preceding), bytes: Buffer.byteLength(preceding) };
  const files = {
    ...previous.files,
    [precedingPath]: preceding,
    'site-manifest.json': json(manifest),
  };
  let attempts = 0;
  const server = createServer(({ url }, response) => {
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    if (path === precedingPath && ++attempts <= 2) {
      response.writeHead(503).end();
      return;
    }
    response.writeHead(files[path] === undefined ? 404 : 200).end(files[path]);
  });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/';
  const backup = join(dir, 'retain');
  await run('snapshot', origin, backup, previous.sourceSha, 'retain');
  assert.equal(attempts, 3);
  assert.equal(readFileSync(join(backup, archivePath), 'utf8'), previous.files[archivePath]);
  assert.equal(readFileSync(join(backup, precedingPath), 'utf8'), preceding);
});

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
    pointerSha256: candidate.pointerHash,
    complete: false,
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

function diskFiles(root, prefix = '') {
  return Object.fromEntries(
    readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
      const path = prefix + entry.name;
      return entry.isDirectory()
        ? Object.entries(diskFiles(root, path + '/'))
        : [[path, readFileSync(join(root, path))]];
    }),
  );
}

test('two-phase promotion binds the exact candidate and changes only three mutable root files', async (t) => {
  const staged = await sealedCandidate(t);
  const initialFiles = diskFiles(staged.site);
  const server = await serve(t, initialFiles);
  await run(
    'guard-candidate',
    server.origin,
    staged.candidate.sourceSha,
    staged.sealed.pointerSha256,
  );
  const proof = await run(
    'verify-candidate',
    server.origin,
    staged.candidate.sourceSha,
    staged.sealed.siteManifestSha256,
    '12345',
    '2',
  );
  const candidateProof = JSON.parse(proof.stdout);
  assert.equal(candidateProof.complete, false);
  assert.equal(candidateProof.runId, '12345');
  assert.equal(candidateProof.runAttempt, '2');
  await assert.rejects(
    run(
      'verify-complete',
      server.origin,
      staged.candidate.sourceSha,
      staged.sealed.siteManifestSha256,
      '12345',
      '2',
    ),
    /requires complete=true/,
  );
  const proofPath = join(staged.dir, 'public-proof.json');
  writeFileSync(proofPath, proof.stdout);
  const beforeRoot = rootFiles(staged.site);
  const promoted = JSON.parse(
    (await run('promote', staged.site, staged.sealedPath, proofPath, '12345', '2')).stdout,
  );
  const afterRoot = rootFiles(staged.site);
  assert.deepEqual(
    [...new Set([...Object.keys(beforeRoot), ...Object.keys(afterRoot)])]
      .filter((path) => beforeRoot[path] !== afterRoot[path])
      .sort(),
    ['completion-receipt.json', 'current.json', 'site-manifest.json'],
  );
  for (const path of Object.keys(staged.candidate.files).filter((path) => path.startsWith('versions/'))) {
    assert.ok(readFileSync(join(staged.site, path)).equals(initialFiles[path]), path);
  }
  for (const path of [
    'api/newapi/ratio_config.json',
    JSON.parse(staged.candidate.files['current.json']).modelSource,
  ]) {
    assert.ok(readFileSync(join(staged.site, path)).equals(initialFiles[path]), path);
  }
  const receipt = JSON.parse(afterRoot['completion-receipt.json']);
  assert.deepEqual(receipt, {
    schemaVersion: 1,
    sourceSha: staged.candidate.sourceSha,
    releaseId: staged.candidate.releaseId,
    initialSiteManifestSha256: staged.sealed.siteManifestSha256,
    initialPublicationReceiptSha256: sha(readFileSync(staged.sealedPath)),
    initialPointerSha256: staged.sealed.pointerSha256,
    runId: '12345',
    runAttempt: '2',
  });
  assert.equal(receipt.finalSiteManifestSha256, undefined);
  assert.equal(receipt.finalPointerSha256, undefined);
  server.update(diskFiles(staged.site));
  const final = JSON.parse(
    (
      await run(
        'verify-complete',
        server.origin,
        staged.candidate.sourceSha,
        promoted.siteManifestSha256,
        '12345',
        '2',
      )
    ).stdout,
  );
  assert.equal(final.complete, true);
  assert.equal(final.pointerSha256, promoted.pointerSha256);
  await assert.rejects(
    run(
      'verify-complete',
      server.origin,
      staged.candidate.sourceSha,
      promoted.siteManifestSha256,
      '12345',
      '3',
    ),
    /Completion run attempt/,
  );
  await assert.rejects(
    run('verify-candidate', server.origin, staged.candidate.sourceSha, promoted.siteManifestSha256, '12345', '2'),
    /requires complete=false/,
  );
  server.update({
    ...diskFiles(staged.site),
    'completion-receipt.json': json({ ...receipt, runId: '99999' }),
  });
  await assert.rejects(
    run(
      'verify-complete',
      server.origin,
      staged.candidate.sourceSha,
      promoted.siteManifestSha256,
      '12345',
      '2',
    ),
    /completion-receipt.json (byte length|hash)/,
  );
});

test('a changed immutable historical manifest blocks promotion before any root write', async (t) => {
  const staged = await sealedCandidate(t);
  const server = await serve(t, diskFiles(staged.site));
  const proofPath = join(staged.dir, 'proof.json');
  writeFileSync(
    proofPath,
    (
      await run(
        'verify-candidate',
        server.origin,
        staged.candidate.sourceSha,
        staged.sealed.siteManifestSha256,
        '123',
        '1',
      )
    ).stdout,
  );
  const fixedManifest = JSON.parse(staged.candidate.files['current.json']).fixedBase + 'manifest.json';
  const before = rootFiles(staged.site);
  writeFileSync(join(staged.site, fixedManifest), '{"candidateId":"rewritten"}\n');
  await assert.rejects(
    run('promote', staged.site, staged.sealedPath, proofPath, '123', '1'),
    /manifest.json (byte length|hash)/,
  );
  assert.deepEqual(rootFiles(staged.site), before);
});

test('candidate proof completion and run identity are mandatory before any promotion write', async (t) => {
  for (const [name, mutate] of [
    ['missing complete', (proof) => delete proof.complete],
    ['complete true', (proof) => { proof.complete = true; }],
    ['cross-run proof', (proof) => { proof.runId = '111'; proof.runAttempt = '1'; }],
    ['cross-attempt proof', (proof) => { proof.runId = '222'; proof.runAttempt = '1'; }],
    ['missing run ID', (proof) => { delete proof.runId; }],
    ['missing run attempt', (proof) => { proof.runId = '222'; delete proof.runAttempt; }],
    ['numeric run ID', (proof) => { proof.runId = 222; proof.runAttempt = '2'; }],
    ['numeric run attempt', (proof) => { proof.runId = '222'; proof.runAttempt = 2; }],
  ]) {
    await t.test(name, async (t) => {
      const staged = await sealedCandidate(t);
      const server = await serve(t, diskFiles(staged.site));
      const proof = JSON.parse(
        (
          await run(
            'verify-candidate',
            server.origin,
            staged.candidate.sourceSha,
            staged.sealed.siteManifestSha256,
            '111',
            '1',
          )
        ).stdout,
      );
      proof.runId = '222';
      proof.runAttempt = '2';
      mutate(proof);
      const proofPath = join(staged.dir, 'proof.json');
      writeFileSync(proofPath, JSON.stringify(proof));
      const before = diskFiles(staged.site);
      await assert.rejects(
        run('promote', staged.site, staged.sealedPath, proofPath, '222', '2'),
        /proof complete|proof runId|proof runAttempt/,
      );
      assert.deepEqual(diskFiles(staged.site), before, 'rejection must not partially write any file');
    });
  }
});

test('premature true and mismatched public or sealed receipts cannot promote', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-premature-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const premature = release('b');
  const prematurePointer = JSON.parse(premature.files['current.json']);
  prematurePointer.complete = true;
  premature.files['current.json'] = json(prematurePointer);
  const prematureManifest = JSON.parse(premature.files['site-manifest.json']);
  prematureManifest.complete = true;
  premature.files['site-manifest.json'] = json(prematureManifest);
  writeFiles(join(dir, 'site'), premature.files);
  writeFiles(join(dir, 'previous'), release('a').files);
  await assert.rejects(run('seal', join(dir, 'site'), join(dir, 'previous')), /must be incomplete/);

  const staged = await sealedCandidate(t, 'c');
  const server = await serve(t, diskFiles(staged.site));
  const proofPath = join(staged.dir, 'proof.json');
  const proof = JSON.parse(
    (
      await run(
        'verify-candidate',
        server.origin,
        staged.candidate.sourceSha,
        staged.sealed.siteManifestSha256,
        '123',
        '1',
      )
    ).stdout,
  );
  proof.siteManifestSha256 = '0'.repeat(64);
  writeFileSync(proofPath, JSON.stringify(proof));
  const before = rootFiles(staged.site);
  await assert.rejects(
    run('promote', staged.site, staged.sealedPath, proofPath, '123', '1'),
    /Initial public proof siteManifestSha256/,
  );
  assert.deepEqual(rootFiles(staged.site), before);
  proof.siteManifestSha256 = staged.sealed.siteManifestSha256;
  writeFileSync(proofPath, JSON.stringify(proof));
  const sealed = JSON.parse(readFileSync(staged.sealedPath));
  sealed.releaseId = '0'.repeat(64);
  writeFileSync(staged.sealedPath, JSON.stringify(sealed));
  await assert.rejects(
    run('promote', staged.site, staged.sealedPath, proofPath, '123', '1'),
    /Sealed publication receipt releaseId/,
  );
  assert.deepEqual(rootFiles(staged.site), before);
});

test('promotion guards reject stale sources, unknown pointers, and concurrent replacement', async (t) => {
  const staged = await sealedCandidate(t);
  const files = diskFiles(staged.site);
  const server = await serve(t, files);
  await assert.rejects(
    run('guard-candidate', server.origin, 'c'.repeat(40), staged.sealed.pointerSha256),
    /Candidate source changed/,
  );
  server.update({ ...files, 'current.json': release('c').files['current.json'] });
  await assert.rejects(
    run('guard-candidate', server.origin, staged.candidate.sourceSha, staged.sealed.pointerSha256),
    /Candidate pointer changed before promotion/,
  );
  let reads = 0;
  const concurrent = createServer(({ url }, response) => {
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    const body = path === 'current.json' && ++reads > 1 ? release('a').files[path] : files[path];
    response.writeHead(body === undefined ? 404 : 200).end(body);
  });
  t.after(() => concurrent.close());
  await new Promise((resolve) => concurrent.listen(0, '127.0.0.1', resolve));
  await assert.rejects(
    run(
      'guard-candidate',
      'http://127.0.0.1:' + concurrent.address().port + '/',
      staged.candidate.sourceSha,
      staged.sealed.pointerSha256,
    ),
    /Candidate pointer changed during promotion guard/,
  );
});

test('recovery accepts initial and promoted failure pointers but never an unknown pointer', async (t) => {
  const staged = await sealedCandidate(t);
  const server = await serve(t, diskFiles(staged.site));
  const promotedPointer = JSON.parse(readFileSync(join(staged.site, 'current.json'), 'utf8'));
  promotedPointer.complete = true;
  promotedPointer.completionReceiptSha256 = 'd'.repeat(64);
  const promotedBytes = json(promotedPointer);
  const promotedHash = sha(promotedBytes);
  const restore = () =>
    run(
      'guard-restore',
      server.origin,
      staged.previous.sourceSha,
      staged.previous.manifestHash,
      staged.previous.pointerHash,
      staged.sealed.pointerSha256,
      promotedHash,
    );
  assert.equal((await restore()).stdout.trim(), 'restore');
  server.update({ ...diskFiles(staged.site), 'current.json': promotedBytes });
  assert.equal((await restore()).stdout.trim(), 'restore');
  server.update(release('c').files);
  await assert.rejects(restore(), /newer or unknown publication/);
  server.update(diskFiles(join(staged.dir, 'previous')));
  assert.equal((await restore()).stdout.trim(), 'already-verified');
});

test('legacy false or missing complete pointers remain compatible but are not final completions', async (t) => {
  for (const missing of [false, true]) {
    const candidate = release(missing ? 'c' : 'b');
    if (missing) {
      const pointer = JSON.parse(candidate.files['current.json']);
      const manifest = JSON.parse(candidate.files['site-manifest.json']);
      delete pointer.complete;
      delete manifest.complete;
      candidate.files['current.json'] = json(pointer);
      manifest.files['current.json'] = {
        sha256: sha(candidate.files['current.json']),
        bytes: Buffer.byteLength(candidate.files['current.json']),
      };
      candidate.files['site-manifest.json'] = json(manifest);
      candidate.manifestHash = sha(candidate.files['site-manifest.json']);
    }
    const dir = mkdtempSync(join(tmpdir(), 'pages-legacy-current-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const server = await serve(t, candidate.files);
    const ordinary = JSON.parse(
      (await run('verify', server.origin, candidate.sourceSha, candidate.manifestHash)).stdout,
    );
    assert.equal(ordinary.complete, missing ? undefined : false);
    await run('snapshot', server.origin, join(dir, 'backup'), candidate.sourceSha, 'backup', candidate.manifestHash);
    await assert.rejects(
      run('verify-complete', server.origin, candidate.sourceSha, candidate.manifestHash, '1', '1'),
      /requires complete=true/,
    );
    if (missing)
      await assert.rejects(
        run('verify-candidate', server.origin, candidate.sourceSha, candidate.manifestHash, '1', '1'),
        /requires complete=false/,
      );
  }
});

test('verification retry records slow timeouts and passes the same valid inventory with a sufficient budget', async (t) => {
  const candidate = release('b');
  const server = createServer(({ url }, response) => {
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    setTimeout(() => response.writeHead(candidate.files[path] === undefined ? 404 : 200).end(candidate.files[path]), 50);
  });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/';
  const dir = mkdtempSync(join(tmpdir(), 'pages-retry-slow-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const args = [
    'verify-candidate', origin, candidate.sourceSha, candidate.manifestHash, '123', '1',
    '--attempts=2', '--attempt-timeout-ms=100', '--sleep-ms=0', '--log=' + join(dir, 'slow'),
  ];
  await assert.rejects(runRetry(...args), /Verification failed after 2 attempts/);
  const attempts = readFileSync(join(dir, 'slow', 'attempts.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(attempts.length, 2);
  for (const [index, attempt] of attempts.entries()) {
    assert.equal(attempt.attempt, index + 1);
    assert.equal(attempt.exitCode, null);
    assert.equal(attempt.signal, 'SIGTERM');
    assert.equal(attempt.timedOut, true);
    assert.ok(attempt.durationMs >= 90);
    assert.ok(attempt.progress);
    assert.ok(attempt.lastDiagnostic);
    assert.ok(readFileSync(join(dir, 'slow', `attempt-${index + 1}.stderr.log`), 'utf8').length > 0);
  }
  const direct = await run('verify-candidate', origin, candidate.sourceSha, candidate.manifestHash, '123', '1');
  assert.equal(JSON.parse(direct.stdout).complete, false);
  const verified = await runRetry(
    'verify-candidate', origin, candidate.sourceSha, candidate.manifestHash, '123', '1',
    '--attempts=1', '--attempt-timeout-ms=2000', '--sleep-ms=0', '--log=' + join(dir, 'valid'),
  );
  assert.equal(JSON.parse(verified.stdout).complete, false);
});

test('verification retry recovers from CDN inconsistency but exhausts on a real hash mismatch', async (t) => {
  const candidate = release('b');
  const previous = release('a');
  let currentReads = 0;
  let corrupt = false;
  const server = createServer(({ url }, response) => {
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    let body = candidate.files[path];
    if (path === 'current.json' && ++currentReads === 1) body = previous.files[path];
    if (path === 'app/js/site.js' && corrupt) body = 'corrupt';
    response.writeHead(body === undefined ? 404 : 200).end(body);
  });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/';
  const dir = mkdtempSync(join(tmpdir(), 'pages-retry-mismatch-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const recovered = await runRetry(
    'verify-candidate', origin, candidate.sourceSha, candidate.manifestHash, '123', '1',
    '--attempts=2', '--attempt-timeout-ms=2000', '--sleep-ms=0', '--log=' + join(dir, 'recovered'),
  );
  assert.equal(JSON.parse(recovered.stdout).complete, false);
  const recoveryAttempts = readFileSync(join(dir, 'recovered', 'attempts.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(recoveryAttempts.map((attempt) => attempt.exitCode), [1, 0]);
  assert.match(recoveryAttempts[0].lastDiagnostic, /current.json|preceding deployment/);
  corrupt = true;
  await assert.rejects(
    runRetry(
      'verify-candidate', origin, candidate.sourceSha, candidate.manifestHash, '123', '1',
      '--attempts=2', '--attempt-timeout-ms=2000', '--sleep-ms=0', '--log=' + join(dir, 'corrupt'),
    ),
    /Verification failed after 2 attempts/,
  );
  const corruptAttempts = readFileSync(join(dir, 'corrupt', 'attempts.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(corruptAttempts.map((attempt) => attempt.exitCode), [1, 1]);
  assert.match(corruptAttempts.at(-1).lastDiagnostic, /site.js/);
  assert.equal(corruptAttempts.at(-1).timedOut, false);
});

test('remote verification retries HTTP 429 and still verifies the exact bytes', async (t) => {
  const candidate = release('b');
  let attempts = 0;
  const server = createServer(({ url }, response) => {
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    if (path === 'app/js/site.js' && ++attempts < 3) {
      response.writeHead(429, { 'Retry-After': '0' }).end();
      return;
    }
    response.writeHead(candidate.files[path] === undefined ? 404 : 200).end(candidate.files[path]);
  });
  t.after(() => server.close());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/';
  const result = await run('verify-candidate', origin, candidate.sourceSha, candidate.manifestHash, '123', '1');
  assert.equal(JSON.parse(result.stdout).complete, false);
  assert.equal(attempts, 3);
});

test('response-body disconnects and read timeouts retain the failing path', async (t) => {
  for (const mode of ['disconnect', 'timeout']) {
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '200' });
      response.write('{');
      if (mode === 'disconnect') setTimeout(() => response.destroy(), 20);
    });
    t.after(() => {
      server.closeAllConnections();
      server.close();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port + '/';
    const dir = mkdtempSync(join(tmpdir(), 'pages-body-' + mode + '-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    await assert.rejects(
      runRetryWithEnv(
        { CNY_PAGES_REQUEST_TIMEOUT_MS: '100' },
        'verify', origin, 'b'.repeat(40), 'a'.repeat(64),
        '--attempts=1', '--attempt-timeout-ms=2000', '--sleep-ms=0', '--log=' + dir,
      ),
      /Verification failed after 1 attempts/,
    );
    const [attempt] = readFileSync(join(dir, 'attempts.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.match(attempt.lastDiagnostic, /site-manifest\.json/);
    assert.match(attempt.lastDiagnostic, mode === 'timeout' ? /timeout/i : /terminated|aborted/i);
  }
});

test('wrapper cancellation persists running diagnostics and reaps an unresponsive child', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-wrapper-sigterm-'));
  const ignore = join(dir, 'ignore-sigterm.cjs');
  writeFileSync(
    ignore,
    "if (process.argv[1]?.endsWith('cny-pages-release.mjs')) process.on('SIGTERM', () => {});\n",
  );
  const candidate = release('b');
  let announceRequest;
  const requested = new Promise((resolve) => { announceRequest = resolve; });
  const server = createServer(({ url }, response) => {
    announceRequest();
    const path = new URL(url, 'http://localhost').pathname.slice(1);
    const body = candidate.files[path];
    setTimeout(() => {
      if (!response.destroyed) response.writeHead(body === undefined ? 404 : 200).end(body);
    }, 200);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const log = join(dir, 'diagnostics');
  const wrapper = spawn(
    process.execPath,
    [
      'scripts/cny-pages-verify-with-retry.mjs', 'verify-candidate',
      'http://127.0.0.1:' + server.address().port + '/', candidate.sourceSha, candidate.manifestHash, '123', '1',
      '--attempts=2', '--attempt-timeout-ms=10000', '--kill-grace-ms=50', '--log=' + log,
    ],
    {
      env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require=${ignore}`.trim() },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let children = [];
  t.after(() => {
    if (wrapper.exitCode === null && wrapper.signalCode === null) wrapper.kill('SIGKILL');
    for (const pid of children) {
      try { process.kill(Number(pid), 'SIGKILL'); } catch {}
    }
    server.closeAllConnections();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await requested;
  children = execFileSync('pgrep', ['-P', String(wrapper.pid)], { encoding: 'utf8' }).trim().split('\n');
  assert.equal(children.length, 1);
  await waitFor(() => {
    if (!existsSync(join(log, 'attempt-1.json')) || !existsSync(join(log, 'attempt-1.stderr.log')))
      return false;
    const current = JSON.parse(readFileSync(join(log, 'attempt-1.json'), 'utf8'));
    return current.status === 'running' && current.progress.completed > 0;
  }, 4000);
  const running = JSON.parse(readFileSync(join(log, 'attempt-1.json'), 'utf8'));
  assert.equal(running.status, 'running');
  assert.ok(running.progress.completed > 0);
  assert.equal(running.childPid, Number(children[0]));
  wrapper.kill('SIGTERM');
  const [exitCode, signal] = await Promise.race([
    new Promise((resolve) => wrapper.on('close', (...args) => resolve(args))),
    delay(5000).then(() => { throw new Error('wrapper did not exit after SIGTERM'); }),
  ]);
  assert.equal(exitCode, null);
  assert.equal(signal, 'SIGTERM');
  await delay(100);
  for (const pid of children)
    assert.throws(() => process.kill(Number(pid), 0), { code: 'ESRCH' });
  const attempts = readFileSync(join(log, 'attempts.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].interruptedBy, 'SIGTERM');
  assert.equal(attempts[0].signal, 'SIGKILL');
  assert.equal(attempts[0].escalated, true);
  assert.equal(attempts[0].status, 'finished');
  assert.match(attempts[0].lastDiagnostic, /SIGTERM/);
  assert.ok(existsSync(join(log, 'attempt-1.stdout.log')));
  assert.ok(existsSync(join(log, 'attempt-1.stderr.log')));
});

test('attempt timeouts escalate after a bounded grace period and retain every retry', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-timeout-escalation-'));
  const ignore = join(dir, 'ignore-sigterm.cjs');
  writeFileSync(
    ignore,
    "if (process.argv[1]?.endsWith('cny-pages-release.mjs')) process.on('SIGTERM', () => {});\n",
  );
  const server = createServer((request, response) => {
    setTimeout(() => {
      if (!response.destroyed) response.writeHead(200).end('{}');
    }, 5000);
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  await assert.rejects(
    runRetryWithEnv(
      { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require=${ignore}`.trim() },
      'verify', 'http://127.0.0.1:' + server.address().port + '/', 'b'.repeat(40), 'b'.repeat(64),
      '--attempts=2', '--attempt-timeout-ms=100', '--kill-grace-ms=50', '--sleep-ms=0', '--log=' + dir,
    ),
    /Verification failed after 2 attempts/,
  );
  const attempts = readFileSync(join(dir, 'attempts.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(attempts.length, 2);
  for (const attempt of attempts) {
    assert.equal(attempt.timedOut, true);
    assert.equal(attempt.signal, 'SIGKILL');
    assert.equal(attempt.escalated, true);
    assert.match(attempt.lastDiagnostic, /exceeded 100ms/);
    assert.throws(() => process.kill(attempt.childPid, 0), { code: 'ESRCH' });
  }
});

test('retry backoff exits promptly on SIGTERM and SIGINT without another attempt', async (t) => {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const dir = mkdtempSync(join(tmpdir(), 'pages-backoff-' + signal.toLowerCase() + '-'));
    const server = createServer((request, response) => response.writeHead(404).end('missing'));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const wrapper = spawn(
      process.execPath,
      [
        'scripts/cny-pages-verify-with-retry.mjs', 'verify',
        'http://127.0.0.1:' + server.address().port + '/', 'b'.repeat(40), 'a'.repeat(64),
        '--attempts=2', '--attempt-timeout-ms=2000', '--sleep-ms=2000', '--log=' + dir,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    t.after(() => {
      if (wrapper.exitCode === null && wrapper.signalCode === null) wrapper.kill('SIGKILL');
      server.closeAllConnections();
      server.close();
      rmSync(dir, { recursive: true, force: true });
    });
    let stderr = '';
    let announceFinished;
    const firstFinished = new Promise((resolve) => { announceFinished = resolve; });
    wrapper.stderr.on('data', (bytes) => {
      stderr += bytes;
      if (stderr.includes('"status":"finished"')) announceFinished();
    });
    const closed = new Promise((resolve) => {
      wrapper.on('close', (exitCode, exitSignal) =>
        resolve({ exitCode, exitSignal, closedAt: Date.now() }),
      );
    });
    await firstFinished;
    await delay(50);
    const signalledAt = Date.now();
    wrapper.kill(signal);
    await delay(500);
    const aliveAfter500ms = wrapper.exitCode === null && wrapper.signalCode === null;
    const result = await closed;
    const exitAfterSignalMs = result.closedAt - signalledAt;
    const attempts = readFileSync(join(dir, 'attempts.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(result.exitCode, null);
    assert.equal(result.exitSignal, signal);
    assert.equal(aliveAfter500ms, false);
    assert.ok(exitAfterSignalMs < 1000, `wrapper waited ${exitAfterSignalMs}ms after ${signal}`);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].exitCode, 1);
    assert.ok(existsSync(join(dir, 'attempt-1.json')));
    assert.ok(existsSync(join(dir, 'attempt-1.stdout.log')));
    assert.ok(existsSync(join(dir, 'attempt-1.stderr.log')));
  }
});

test('workflow retry budgets fit job deadlines and upload per-attempt diagnostics', () => {
  const workflow = readFileSync('.github/workflows/naoshengyun-pages.yml', 'utf8');
  const retry = readFileSync('scripts/cny-pages-verify-with-retry.mjs', 'utf8');
  assert.match(retry, /DEFAULT_ATTEMPTS = 3/);
  assert.match(retry, /DEFAULT_ATTEMPT_TIMEOUT_MS = 480_000/);
  assert.match(retry, /DEFAULT_SLEEP_MS = 45_000/);
  assert.match(retry, /DEFAULT_KILL_GRACE_MS = 5000/);
  const measuredFiles = 4805;
  const measuredMs = 249_007;
  const candidateFiles = 4924;
  const candidateProjectionMs = measuredMs * candidateFiles / measuredFiles;
  const growthAndNetworkBudgetMs = candidateProjectionMs * 1.5 * 1.2;
  assert.ok(growthAndNetworkBudgetMs < 480_000, '480 seconds covers the measured full inventory, 50% growth, and 20% network margin');
  const retryBudgetMs = 3 * (480_000 + 5000) + 2 * 45_000;
  assert.equal(retryBudgetMs, 1_545_000);
  assert.ok(retryBudgetMs + 9 * 60_000 < 35 * 60_000, 'candidate/final retries and setup fit 35-minute jobs');
  assert.ok(retryBudgetMs + 20 * 60_000 < 50 * 60_000, 'recovery retries, deployment, and setup fit its 50-minute job');
  const job = (name) => workflow.split('\n  ' + name + ':\n')[1].split(/\n  [a-z][a-z0-9-]*:\n/)[0];
  assert.match(job('verify-candidate'), /timeout-minutes: 35/);
  assert.match(job('verify-publication'), /timeout-minutes: 35/);
  assert.match(job('restore'), /timeout-minutes: 50/);
  assert.equal((workflow.match(/cny-pages-verify-with-retry\.mjs/g) ?? []).length, 3);
  assert.equal((workflow.match(/attempts\.ndjson/g) ?? []).length, 3);
  assert.equal((workflow.match(/attempt-\*\.json/g) ?? []).length, 3);
  assert.doesNotMatch(workflow, /timeout 60s/);
});

test('workflow separates candidate proof from final verified status and keeps pinned Actions', () => {
  const workflow = readFileSync('.github/workflows/naoshengyun-pages.yml', 'utf8');
  assert.equal((workflow.match(/context=cny-pages\/candidate-verified/g) ?? []).length, 1);
  assert.equal((workflow.match(/context=cny-pages\/verified/g) ?? []).length, 1);
  assert.deepEqual(
    [...workflow.matchAll(/\.context == "([^"]+)"/g)].map((match) => match[1]),
    ['cny-pages/verified'],
    'only final verified releases can become publication predecessors',
  );
  assert.match(workflow, /needs: \[build, deploy, verify-candidate, promote, deploy-promoted\]/);
  assert.match(
    workflow,
    /verify-candidate "\$PAGES_ORIGIN" "\$GITHUB_SHA" "\$SITE_HASH" "\$GITHUB_RUN_ID" "\$GITHUB_RUN_ATTEMPT"/,
  );
  assert.equal((workflow.match(/guard-candidate/g) ?? []).length, 2);
  const allowed = new Set([
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093',
    'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e',
  ]);
  for (const match of workflow.matchAll(/(?:^|\n)\s*(?:-\s*)?uses:\s*([^\s#]+)/g)) {
    assert.ok(allowed.has(match[1]), 'Unpinned or unauthorized Action: ' + match[1]);
  }
});
