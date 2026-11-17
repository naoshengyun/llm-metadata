/** Local publication rehearsal only. No GitHub, gateway, credentials or network writes. */
import {
  accessSync,
  constants,
  readFileSync,
  writeFileSync,
  lstatSync,
  readdirSync,
  realpathSync,
  mkdirSync,
  openSync,
  closeSync,
  renameSync,
  unlinkSync,
  existsSync,
} from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import {
  preparePublicationTransition,
  executePublicationTransition,
  verifyPublicationSnapshot,
  PublicationNotSubmittedError,
} from '../.cache/cny-build/cny/publication-promotion.js';

function directory(path) {
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory())
    throw new Error('regular directory required');
  return realpathSync(path);
}
function read(path) {
  const s = lstatSync(path);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1)
    throw new Error('single regular file required');
  return readFileSync(path, 'utf8');
}
function json(path) {
  return JSON.parse(read(path));
}
function save(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function packageFiles(path) {
  const root = directory(path);
  return Object.fromEntries(readdirSync(root).map((name) => [name, read(join(root, name))]));
}

export class LocalPublicationPlatform {
  constructor(path) {
    this.root = directory(path);
  }
  async read() {
    const file = join(this.root, 'publication-state.json');
    if (!existsSync(file)) return null;
    const snapshot = json(file);
    verifyPublicationSnapshot(snapshot);
    return snapshot;
  }
  async canSubmit() {
    try {
      accessSync(this.root, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
  async claim(operationId) {
    if (!/^[a-f0-9]{64}$/.test(operationId)) throw new Error('invalid operation identity');
    try {
      save(join(this.root, '.publication-attempt-' + operationId + '.json'), { operationId });
      return true;
    } catch (error) {
      if (error.code === 'EEXIST') return false;
      throw error;
    }
  }
  async hasAttempt(operationId) {
    if (!/^[a-f0-9]{64}$/.test(operationId)) throw new Error('invalid operation identity');
    try {
      const record = json(join(this.root, '.publication-attempt-' + operationId + '.json'));
      if (record.operationId !== operationId) throw new Error('invalid durable operation record');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
  async submit(snapshot, expectedRevision) {
    const lock = join(this.root, '.publication.lock'),
      temp = join(this.root, '.publication-' + randomBytes(12).toString('hex') + '.json');
    let fd,
      committed = false;
    try {
      fd = openSync(lock, 'wx', 0o600);
      const current = await this.read();
      if ((current?.revision ?? null) !== expectedRevision)
        throw new Error('previous revision changed');
      verifyPublicationSnapshot(snapshot);
      save(temp, snapshot);
      renameSync(temp, join(this.root, 'publication-state.json'));
      committed = true;
    } catch (error) {
      if (!committed)
        throw new PublicationNotSubmittedError('local snapshot not submitted: ' + error.message);
      throw error;
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
      if (fd !== undefined) {
        closeSync(fd);
        unlinkSync(lock);
      }
    }
  }
}

export async function verifyLocalPublication(stateDir, expectedRevision, requireCandidate = false) {
  const snapshot = await new LocalPublicationPlatform(stateDir).read();
  if (!snapshot || snapshot.revision !== expectedRevision)
    throw new Error('reviewed snapshot revision mismatch');
  const verified = verifyPublicationSnapshot(snapshot);
  if (
    requireCandidate &&
    Object.values(verified.versions).some(
      (version) => version.manifest.selection.purpose !== 'candidate',
    )
  )
    throw new Error('current or retained test selection is not a publication candidate');
  return { snapshot, ...verified };
}
export async function runPublicationCommand(args) {
  const [command, ...paths] = args;
  if (command === 'prepare' && paths.length === 2) {
    const request = json(paths[0]),
      platform = new LocalPublicationPlatform(request.stateDir);
    const plan = preparePublicationTransition(
      await platform.read(),
      packageFiles(request.packageDir),
      request.identity,
      request.action,
    );
    save(paths[1], plan);
    return {
      planId: plan.id,
      snapshotRevision: plan.snapshot.revision,
      publication: 'not-submitted',
    };
  }
  if (command === 'apply' && paths.length === 4) {
    if (existsSync(paths[3]))
      throw new Error('receipt output already exists; read it before retrying');
    const platform = new LocalPublicationPlatform(paths[0]),
      plan = json(paths[1]),
      confirmation = json(paths[2]);
    const requested = resolve(paths[3]),
      receiptPath = join(directory(dirname(requested)), basename(requested));
    if (receiptPath === platform.root || receiptPath.startsWith(platform.root + '/'))
      throw new Error('receipt must be outside the publication state directory');
    const fd = openSync(receiptPath, 'wx', 0o600);
    let result;
    try {
      result = await executePublicationTransition(platform, plan, confirmation);
      writeFileSync(fd, JSON.stringify(result, null, 2) + '\n');
      return result;
    } catch (error) {
      if (result) error.publicationResult = { ...result, receiptPersisted: false };
      else {
        try {
          writeFileSync(
            fd,
            JSON.stringify({
              schema: 'publication-cli-preflight-error/v1',
              status: 'failed',
              submission: 'not-attempted',
              planId: plan.id,
              reason: error.message,
            }) + '\n',
          );
        } catch {
          /* Retain the original error; never retry publication to repair a receipt. */
        }
      }
      throw error;
    } finally {
      try {
        closeSync(fd);
      } catch (error) {
        if (result) error.publicationResult = { ...result, receiptPersisted: false };
        throw error;
      }
    }
  }
  if (['verify', 'export'].includes(command)) {
    const required = command === 'verify' ? 2 : 3;
    if (
      paths.length !== required &&
      !(paths.length === required + 1 && paths.at(-1) === 'candidate')
    )
      throw new Error('explicit state, output (export) and revision required');
    const expected = paths[required - 1],
      verified = await verifyLocalPublication(paths[0], expected, paths.at(-1) === 'candidate');
    if (command === 'export') {
      const output = resolve(paths[1]);
      directory(dirname(output));
      mkdirSync(output);
      for (const [path, body] of Object.entries(verified.snapshot.files)) {
        const file = join(output, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, body, { flag: 'wx' });
      }
    }
    return {
      valid: true,
      revision: expected,
      releaseId: verified.pointer.releaseId,
      manifestSha256: verified.pointer.manifestSha256,
      publication: 'local-only',
      instanceConfiguration: 'not-written',
    };
  }
  throw new Error(
    'use prepare request.json plan.json | apply state-dir plan.json confirmation.json receipt.json | verify state-dir revision [candidate] | export state-dir output-dir revision [candidate]',
  );
}
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    const result = await runPublicationCommand(process.argv.slice(2));
    console.log(JSON.stringify(result));
    if (result.status === 'failed' || result.status === 'unknown') process.exitCode = 1;
  } catch (error) {
    if (error.publicationResult) console.log(JSON.stringify(error.publicationResult));
    console.error(error.message);
    process.exitCode = 1;
  }
}
