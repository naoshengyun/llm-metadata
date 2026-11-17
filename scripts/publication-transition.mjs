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
import { join, resolve, dirname } from 'node:path';
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
  if (requireCandidate && verified.target.manifest.selection.purpose !== 'candidate')
    throw new Error('test selection is not a publication candidate');
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
    const result = await executePublicationTransition(
      new LocalPublicationPlatform(paths[0]),
      json(paths[1]),
      json(paths[2]),
    );
    save(paths[3], result);
    return result;
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
    console.error(error.message);
    process.exitCode = 1;
  }
}
