/** Read and verify the published Pages snapshot and retain its immutable files. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const bootstrap = {
  sourceSha: '19af68518c9bbe5551093e961f081d6c411dacf4',
  releaseId: 'a4776c8de605e06c980dd11031d5f9827cf650a8d3d490f89c655f2592417e3f',
  manifestSha256: 'e375efa1357b42fc898d5078816d00ab2e40dd9261a201dbe1be2e3b99ea2853',
  siteManifestSha256: 'defa7176f40b9bef26463d5b0ba4579d2725305eaf049406dddf6e0f1ce9fd1d',
};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const digest = /^[0-9a-f]{64}$/;
const read = (root, path) => readFileSync(join(root, path));
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const validPath = (path) =>
  /^(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/.test(path) &&
  !path.split('/').some((part) => part === '.' || part === '..');
const decode = (bytes) => JSON.parse(bytes);
const requestTimeoutMs = Number(process.env.CNY_PAGES_REQUEST_TIMEOUT_MS ?? 30_000);
assert.ok(
  Number.isSafeInteger(requestTimeoutMs) && requestTimeoutMs >= 1 && requestTimeoutMs <= 30_000,
  'Invalid Pages request timeout',
);

async function remote(origin, path) {
  assert.ok(validPath(path), 'Invalid site path: ' + path);
  const url = new URL(path, origin);
  assert.ok(url.protocol === 'https:' || url.hostname === '127.0.0.1', 'Use HTTPS for Pages');
  for (let attempt = 1; ; attempt++) {
    url.searchParams.set('cny-release-check', randomUUID());
    let response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      console.error(
        JSON.stringify({ kind: 'cny-pages-verify-error', path, attempt, error: error.message }),
      );
      throw error;
    }
    if ([429, 503].includes(response.status) && attempt < 3) {
      await response.body?.cancel();
      const retryAfter = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfter === null ? NaN : Number(retryAfter);
      const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
        ? Math.min(retryAfterSeconds * 1000, 2000)
        : attempt * 500;
      console.error(
        JSON.stringify({
          kind: 'cny-pages-verify-error',
          path,
          attempt,
          error: `HTTP ${response.status}; retrying in ${waitMs}ms`,
        }),
      );
      await delay(waitMs);
      continue;
    }
    if (!response.ok)
      console.error(
        JSON.stringify({
          kind: 'cny-pages-verify-error',
          path,
          attempt,
          error: `HTTP ${response.status}`,
        }),
      );
    assert.ok(response.ok, `HTTP ${response.status} for ${path}`);
    try {
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error(
        JSON.stringify({ kind: 'cny-pages-verify-error', path, attempt, error: error.message }),
      );
      throw error;
    }
  }
}

function checked(bytes, entry, path) {
  try {
    assert.equal(bytes.length, entry?.bytes, path + ' byte length');
    assert.equal(sha(bytes), entry?.sha256, path + ' hash');
    return bytes;
  } catch (error) {
    console.error(JSON.stringify({ kind: 'cny-pages-verify-error', path, error: error.message }));
    throw error;
  }
}

async function collect(paths, readPath) {
  const entries = Object.entries(paths);
  for (let i = 0; i < entries.length; i += 16) {
    const batch = entries.slice(i, i + 16);
    await Promise.all(batch.map(([path, entry]) => readPath(path, entry)));
    console.error(
      JSON.stringify({
        kind: 'cny-pages-verify-progress',
        completed: Math.min(i + 16, entries.length),
        total: entries.length,
        lastPath: batch.at(-1)[0],
      }),
    );
  }
}

function write(root, path, bytes, flag = 'wx') {
  assert.ok(validPath(path), path);
  const dest = join(root, path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes, { flag });
}

function validatePointer(current) {
  assert.match(current.releaseId, digest);
  assert.match(current.manifestSha256, digest);
  assert.match(current.modelSourceSha256, digest);
  assert.equal(current.fixedBase, 'versions/' + current.releaseId + '/');
  assert.equal(
    current.modelSource,
    current.fixedBase +
      (current.schemaVersion === 3 ? 'api/newapi/ratio_config.json' : 'ratio_config.json'),
  );
}

function verifyPredecessor(pointer, source, releaseId) {
  const sameRelease = !releaseId || pointer.releaseId === releaseId;
  assert.ok(
    sameRelease &&
      ((pointer.schemaVersion === 3 && pointer.sourceSha === source) ||
        (pointer.schemaVersion === 2 &&
          source === bootstrap.sourceSha &&
          pointer.releaseId === bootstrap.releaseId &&
          pointer.manifestSha256 === bootstrap.manifestSha256)),
    'Public pointer does not identify the expected preceding deployment',
  );
}

async function siteSnapshot(readPath, expectedSource) {
  const manifestBytes = await readPath('site-manifest.json');
  const manifest = decode(manifestBytes);
  const load = async (path) => {
    assert.ok(validPath(path), 'Invalid site path: ' + path);
    return checked(await readPath(path), manifest.files[path], path);
  };
  const pointerBytes = await load('current.json');
  const pointer = decode(pointerBytes);
  validatePointer(pointer);
  if (expectedSource) verifyPredecessor(pointer, expectedSource);
  if (pointer.schemaVersion === 2) verifyPredecessor(pointer, bootstrap.sourceSha);
  else {
    assert.equal(pointer.schemaVersion, 3);
    assert.match(pointer.sourceSha, /^[0-9a-f]{40}$/);
  }
  assert.equal(manifest.sourceSha, pointer.sourceSha);
  assert.equal(manifest.releaseId, pointer.releaseId);
  assert.equal(manifest.manifestSha256, pointer.manifestSha256);
  const fixedBytes = await load(pointer.fixedBase + 'manifest.json');
  assert.equal(sha(fixedBytes), pointer.manifestSha256);
  const fixedManifest = decode(fixedBytes);
  assert.equal(fixedManifest.candidateId ?? fixedManifest.releaseId, pointer.releaseId);
  assert.equal(sha(await load('api/newapi/ratio_config.json')), pointer.modelSourceSha256);
  assert.equal(sha(await load(pointer.modelSource)), pointer.modelSourceSha256);
  if (pointer.schemaVersion === 3) assert.equal(fixedManifest.sourceSha, pointer.sourceSha);
  assert.ok(pointer.complete === undefined || typeof pointer.complete === 'boolean');
  assert.equal(manifest.complete === true, pointer.complete === true);
  let completionReceipt;
  if (pointer.complete === true) {
    const receiptBytes = await load('completion-receipt.json');
    const receiptHash = sha(receiptBytes);
    assert.equal(pointer.completionReceiptSha256, receiptHash);
    assert.equal(manifest.completionReceiptSha256, receiptHash);
    completionReceipt = decode(receiptBytes);
    assert.equal(completionReceipt.schemaVersion, 1);
    assert.equal(completionReceipt.sourceSha, pointer.sourceSha);
    assert.equal(completionReceipt.releaseId, pointer.releaseId);
    assert.match(completionReceipt.initialSiteManifestSha256, digest);
    assert.match(completionReceipt.initialPublicationReceiptSha256, digest);
    assert.match(completionReceipt.initialPointerSha256, digest);
    assert.match(completionReceipt.runId, /^[1-9][0-9]*$/);
    assert.match(completionReceipt.runAttempt, /^[1-9][0-9]*$/);
  } else {
    assert.equal(pointer.completionReceiptSha256, undefined);
    assert.equal(manifest.completionReceiptSha256, undefined);
  }
  return { manifest, manifestBytes, pointer, pointerBytes, load, completionReceipt };
}

const publicSnapshot = (origin, source) => siteSnapshot((path) => remote(origin, path), source);

async function snapshot(origin, destination, source, mode, expectedHash) {
  assert.ok(['review', 'retain', 'backup'].includes(mode));
  const { pointer, pointerBytes, manifest, manifestBytes, load } = await publicSnapshot(
    origin,
    source,
  );
  if (mode === 'backup') {
    assert.match(expectedHash, digest);
    assert.equal(sha(manifestBytes), expectedHash, 'Public site inventory hash');
  }
  mkdirSync(destination);
  if (mode === 'backup') {
    await collect(manifest.files, async (path) => write(destination, path, await load(path)));
    write(destination, 'site-manifest.json', manifestBytes);
    console.log(JSON.stringify(pointer));
    return;
  }
  if (mode === 'retain') {
    const versions = Object.fromEntries(
      Object.entries(manifest.files).filter(([path]) => /^versions\/[0-9a-f]{64}\//.test(path)),
    );
    await collect(versions, async (path) => write(destination, path, await load(path)));
  } else if (pointer.schemaVersion === 3) {
    for (const file of [
      'manifest.json',
      'official-selection.json',
      'policy.json',
      'coverage.json',
      'selection.json',
      'api/newapi/ratio_config.json',
    ]) {
      const path = pointer.fixedBase + file;
      write(destination, path, await load(path));
    }
  }
  write(destination, 'current.json', pointerBytes);
  console.log(JSON.stringify(pointer));
}

function seal(site, previous) {
  const manifest = decode(read(site, 'site-manifest.json'));
  const pointer = decode(read(site, 'current.json'));
  assert.equal(pointer.complete, false, 'Initial publication pointer must be incomplete');
  assert.equal(manifest.complete, false, 'Initial site inventory must be incomplete');
  const oldPointerBytes = read(previous, 'current.json');
  const old = decode(oldPointerBytes);
  const walk = (path) =>
    readdirSync(join(previous, path), { withFileTypes: true }).flatMap((entry) => {
      const relative = path + '/' + entry.name;
      return entry.isDirectory() ? walk(relative) : [relative];
    });
  // Compare bytes even when the initial site generator already recreated the old directory.
  for (const path of walk('versions')) {
    const bytes = read(previous, path);
    if (existsSync(join(site, path)))
      assert.ok(read(site, path).equals(bytes), 'Immutable Pages file changed: ' + path);
    else write(site, path, bytes);
    manifest.files[path] = { sha256: sha(bytes), bytes: bytes.length };
  }
  pointer.previousRelease = old.releaseId;
  const pointerBytes = Buffer.from(json(pointer));
  write(site, 'current.json', pointerBytes, 'w');
  manifest.files['current.json'] = { sha256: sha(pointerBytes), bytes: pointerBytes.length };
  const manifestBytes = Buffer.from(json(manifest));
  write(site, 'site-manifest.json', manifestBytes, 'w');
  console.log(
    JSON.stringify({
      sourceSha: pointer.sourceSha,
      releaseId: pointer.releaseId,
      manifestSha256: pointer.manifestSha256,
      siteManifestSha256: sha(manifestBytes),
      previousRelease: old.releaseId,
      previousPointerSha256: sha(oldPointerBytes),
      pointerSha256: sha(pointerBytes),
    }),
  );
}

async function verify(readPath, source, expectedHash) {
  assert.match(expectedHash, digest);
  const { manifest, manifestBytes, pointer, pointerBytes, load, completionReceipt } = await siteSnapshot(
    readPath,
    source,
  );
  assert.equal(sha(manifestBytes), expectedHash, 'Public site inventory hash');
  await collect(manifest.files, load);
  assert.ok(
    (await load('current.json')).equals(pointerBytes),
    'Site pointer changed during verification',
  );
  return {
    sourceSha: source,
    releaseId: pointer.releaseId,
    siteManifestSha256: expectedHash,
    pointerSha256: sha(pointerBytes),
    complete: pointer.complete,
    ...(completionReceipt && { completionReceipt }),
  };
}

async function verifyCandidate(readPath, source, expectedHash, runId, runAttempt) {
  assert.match(runId, /^[1-9][0-9]*$/, 'Candidate proof runId');
  assert.match(runAttempt, /^[1-9][0-9]*$/, 'Candidate proof runAttempt');
  const result = await verify(readPath, source, expectedHash);
  assert.equal(result.complete, false, 'Candidate verification requires complete=false');
  return { ...result, runId, runAttempt };
}

async function verifyComplete(readPath, source, expectedHash, runId, runAttempt) {
  const result = await verify(readPath, source, expectedHash);
  assert.equal(result.complete, true, 'Final verification requires complete=true');
  assert.equal(result.completionReceipt.runId, runId, 'Completion run ID');
  assert.equal(result.completionReceipt.runAttempt, runAttempt, 'Completion run attempt');
  return result;
}

async function promote(site, sealedReceiptPath, publicProofPath, runId, runAttempt) {
  assert.match(runId, /^[1-9][0-9]*$/, 'Completion run ID');
  assert.match(runAttempt, /^[1-9][0-9]*$/, 'Completion run attempt');
  const sealedBytes = readFileSync(sealedReceiptPath);
  const sealed = decode(sealedBytes);
  const publicProof = decode(readFileSync(publicProofPath));
  assert.equal(publicProof.complete, false, 'Initial public proof complete');
  assert.equal(publicProof.runId, runId, 'Initial public proof runId');
  assert.equal(publicProof.runAttempt, runAttempt, 'Initial public proof runAttempt');
  const initial = await verifyCandidate(
    (path) => read(site, path),
    sealed.sourceSha,
    sealed.siteManifestSha256,
    runId,
    runAttempt,
  );
  for (const field of ['sourceSha', 'releaseId', 'siteManifestSha256', 'pointerSha256']) {
    assert.equal(publicProof[field], initial[field], 'Initial public proof ' + field);
    assert.equal(sealed[field], initial[field], 'Sealed publication receipt ' + field);
  }
  const receiptBytes = Buffer.from(
    json({
      schemaVersion: 1,
      sourceSha: initial.sourceSha,
      releaseId: initial.releaseId,
      initialSiteManifestSha256: initial.siteManifestSha256,
      initialPublicationReceiptSha256: sha(sealedBytes),
      initialPointerSha256: initial.pointerSha256,
      runId,
      runAttempt,
    }),
  );
  const receiptHash = sha(receiptBytes);
  const manifest = decode(read(site, 'site-manifest.json'));
  const pointer = decode(read(site, 'current.json'));
  pointer.complete = true;
  pointer.completionReceiptSha256 = receiptHash;
  manifest.complete = true;
  manifest.completionReceiptSha256 = receiptHash;
  const pointerBytes = Buffer.from(json(pointer));
  manifest.files['current.json'] = { sha256: sha(pointerBytes), bytes: pointerBytes.length };
  manifest.files['completion-receipt.json'] = {
    sha256: receiptHash,
    bytes: receiptBytes.length,
  };
  const manifestBytes = Buffer.from(json(manifest));
  write(site, 'current.json', pointerBytes, 'w');
  write(site, 'completion-receipt.json', receiptBytes);
  write(site, 'site-manifest.json', manifestBytes, 'w');
  console.log(
    JSON.stringify({
      sourceSha: initial.sourceSha,
      releaseId: initial.releaseId,
      siteManifestSha256: sha(manifestBytes),
      pointerSha256: sha(pointerBytes),
      completionReceiptSha256: receiptHash,
    }),
  );
}

async function guardCandidate(origin, source, expectedPointerHash) {
  assert.match(source, /^[0-9a-f]{40}$/);
  assert.match(expectedPointerHash, digest);
  const bytes = await remote(origin, 'current.json');
  assert.equal(sha(bytes), expectedPointerHash, 'Candidate pointer changed before promotion');
  const pointer = decode(bytes);
  validatePointer(pointer);
  assert.equal(pointer.sourceSha, source, 'Candidate source changed before promotion');
  assert.equal(pointer.complete, false, 'Promotion requires the initial incomplete pointer');
  assert.equal(
    sha(await remote(origin, 'current.json')),
    expectedPointerHash,
    'Candidate pointer changed during promotion guard',
  );
  return { sourceSha: source, releaseId: pointer.releaseId, pointerSha256: expectedPointerHash };
}

async function guardRestore(
  origin,
  source,
  siteHash,
  previousPointerHash,
  initialFailedPointerHash,
  promotedFailedPointerHash,
) {
  assert.match(previousPointerHash, digest);
  assert.match(initialFailedPointerHash, digest);
  if (promotedFailedPointerHash) assert.match(promotedFailedPointerHash, digest);
  const knownFailedPointers = [initialFailedPointerHash, promotedFailedPointerHash].filter(Boolean);
  const readPath = (path) => remote(origin, path);
  const pointerHash = sha(await readPath('current.json'));
  assert.ok(
    pointerHash === previousPointerHash || knownFailedPointers.includes(pointerHash),
    'Refusing to restore over a newer or unknown publication',
  );
  if (pointerHash === previousPointerHash) {
    try {
      await verify(readPath, source, siteHash);
      return 'already-verified';
    } catch (error) {
      console.error('Previous pointer is present but its site did not verify:', error.message);
    }
  }
  assert.equal(
    sha(await readPath('current.json')),
    pointerHash,
    'Public pointer changed during recovery check',
  );
  return 'restore';
}

const [command, ...args] = process.argv.slice(2);
if (command === 'snapshot') await snapshot(...args);
else if (command === 'seal') seal(...args);
else if (command === 'promote') await promote(...args);
else if (command === 'bootstrap') console.log(JSON.stringify(bootstrap));
else if (command === 'guard') {
  const [origin, source, release] = args;
  verifyPredecessor(decode(await remote(origin, 'current.json')), source, release);
} else if (command === 'guard-candidate') {
  console.log(JSON.stringify(await guardCandidate(...args)));
} else if (command === 'guard-restore') {
  console.log(await guardRestore(...args));
} else if (
  ['verify', 'verify-local', 'verify-candidate', 'verify-complete'].includes(command)
) {
  const [location, source, siteHash, runId, runAttempt] = args;
  const readPath = command === 'verify-local' ? (path) => read(location, path) : (path) => remote(location, path);
  const result =
    command === 'verify-candidate'
      ? await verifyCandidate(readPath, source, siteHash, runId, runAttempt)
      : command === 'verify-complete'
        ? await verifyComplete(readPath, source, siteHash, runId, runAttempt)
        : await verify(readPath, source, siteHash);
  console.log(JSON.stringify(result));
} else
  throw Error(
    'Use snapshot, seal, promote, bootstrap, guard, guard-candidate, guard-restore, verify, verify-local, verify-candidate, or verify-complete',
  );
