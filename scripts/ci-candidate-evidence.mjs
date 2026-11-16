import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  lstatSync,
  mkdirSync,
  realpathSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOfficialSnapshot } from './build-official-cny.mjs';
import { hash } from '../.cache/cny-build/cny/generate.js';
import { verifyArtifact } from '../.cache/cny-build/cny/artifact.js';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const CANDIDATE_FILES = [
  'artifact.json',
  'catalog.json',
  'coverage.json',
  'coverage-report.md',
  'diagnostics.json',
  'plugin_prices.json',
  'ratio_config.json',
  'semantic-diff.json',
  'status.json',
  'tool_prices.json',
];
function readCandidatePackage(directory, evidence = false) {
  const names = readdirSync(directory).sort();
  const expected = [...CANDIDATE_FILES, ...(evidence ? ['receipt.json', 'SHA256SUMS'] : [])].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected))
    throw new Error('Candidate file inventory is incomplete or unexpected');
  for (const name of names)
    if (
      lstatSync(join(directory, name)).isSymbolicLink() ||
      !lstatSync(join(directory, name)).isFile()
    )
      throw new Error('Candidate files must be regular');
  const read = (name) => JSON.parse(readFileSync(join(directory, name), 'utf8'));
  const artifact = read('artifact.json');
  if (!verifyArtifact(artifact)) throw new Error('Invalid candidate identity');
  const rebuilt = buildOfficialSnapshot({
    sourceSha: artifact.sourceSha,
    catalog: artifact.quotes,
    reference: artifact.data.reference,
    selection: artifact.selection,
  });
  if (rebuilt.artifact.id !== artifact.id)
    throw new Error('Candidate source/partition/exclusion mismatch');
  const mode = Object.fromEntries(
    Object.entries(artifact.models).map(([key, value]) => [key, value.billing_mode]),
  );
  const expr = Object.fromEntries(
    Object.entries(artifact.models).map(([key, value]) => [key, value.billing_expr]),
  );
  const expectedJSON = {
    'catalog.json': rebuilt.catalog,
    'coverage.json': rebuilt.coverage,
    'diagnostics.json': rebuilt.diagnostics,
    'status.json': rebuilt.status,
    'ratio_config.json': { data: { billing_mode: mode, billing_expr: expr } },
    'plugin_prices.json': artifact.plugins,
    'tool_prices.json': { 'tool_price_setting.prices': artifact.tools },
  };
  for (const [name, value] of Object.entries(expectedJSON))
    if (hash(read(name)) !== hash(value)) throw new Error('Inconsistent candidate export: ' + name);
  const diff = read('semantic-diff.json'),
    changes = [];
  for (const partition of ['models', 'plugins', 'tools'])
    for (const [key, after] of Object.entries(artifact[partition]))
      changes.push({ partition, key, type: 'candidate-addition', after });
  if (
    diff.baseline !== null ||
    diff.scope !== 'first official candidate; no production baseline' ||
    hash(diff.changes) !== hash(changes)
  )
    throw new Error('CI candidate must contain a coherent first-candidate diff');
  const report = readFileSync(join(directory, 'coverage-report.md'), 'utf8');
  if (!report.includes(artifact.id) || !report.includes(artifact.sourceSha))
    throw new Error('Candidate report identity mismatch');
  return artifact;
}
export function stageCandidateEvidence({ sourceDir, artifactDir, destination, identity }) {
  const sourceSha = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (identity.expectedSha !== sourceSha || identity.workflowSha !== sourceSha)
    throw new Error('Expected source/workflow SHA must match checkout');
  if (
    execFileSync('git', ['-C', sourceDir, 'status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim()
  )
    throw new Error('CI must not modify tracked sources or create untracked repository outputs');
  if (lstatSync(artifactDir).isSymbolicLink())
    throw new Error('Candidate directory must not be a symlink');
  const names = readdirSync(artifactDir).sort();
  if (
    names.some(
      (name) => !/^[A-Za-z0-9][A-Za-z0-9._-]*\.(json|md)$/.test(name) || name === 'receipt.json',
    )
  )
    throw new Error('Unexpected candidate filename');
  const artifact = readCandidatePackage(artifactDir);
  if (!verifyArtifact(artifact) || artifact.sourceSha !== sourceSha)
    throw new Error('Candidate identity/source mismatch');
  const payload = names.map((name) => {
    const file = join(artifactDir, name);
    if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())
      throw new Error('Only regular candidate files are accepted');
    return { name, bytes: readFileSync(file) };
  });
  const receipt = {
    version: 1,
    sourceSha,
    artifactId: artifact.id,
    identity,
    packageComplete: artifact.manifest.complete,
    publication: 'not-published',
    application: 'not-applied',
    files: payload.map(({ name, bytes }) => ({ name, sha256: digest(bytes) })),
  };
  mkdirSync(destination);
  for (const { name, bytes } of payload)
    writeFileSync(join(destination, name), bytes, { flag: 'wx' });
  writeFileSync(join(destination, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {
    flag: 'wx',
  });
  const sums =
    [
      ...receipt.files,
      { name: 'receipt.json', sha256: digest(readFileSync(join(destination, 'receipt.json'))) },
    ]
      .map((f) => `${f.sha256}  ${f.name}`)
      .join('\n') + '\n';
  writeFileSync(join(destination, 'SHA256SUMS'), sums, { flag: 'wx' });
  return receipt;
}
export function verifyCandidateEvidence(directory) {
  try {
    if (lstatSync(directory).isSymbolicLink())
      throw new Error('Evidence directory must not be a symlink');
    const actualNames = readdirSync(directory).sort();
    if (
      actualNames.some(
        (name) =>
          !lstatSync(join(directory, name)).isFile() ||
          lstatSync(join(directory, name)).isSymbolicLink(),
      )
    )
      throw new Error('Evidence must contain only regular files');
    const receipt = JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8'));
    if (
      receipt.version !== 1 ||
      !/^[a-f0-9]{40}$/.test(receipt.sourceSha) ||
      receipt.identity?.expectedSha !== receipt.sourceSha ||
      receipt.identity?.workflowSha !== receipt.sourceSha
    )
      throw new Error('Receipt source/workflow identity mismatch');
    if (
      !Array.isArray(receipt.files) ||
      !receipt.files.length ||
      receipt.files.some(
        (f) =>
          !f ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]*\.(json|md)$/.test(f.name) ||
          f.name === 'receipt.json' ||
          !/^[a-f0-9]{64}$/.test(f.sha256),
      )
    )
      throw new Error('Invalid receipt file index');
    const expectedNames = new Set([...receipt.files.map((f) => f.name), 'receipt.json']);
    if (
      expectedNames.size !== receipt.files.length + 1 ||
      JSON.stringify(actualNames) !== JSON.stringify([...expectedNames, 'SHA256SUMS'].sort())
    )
      throw new Error('Incomplete or unexpected evidence file set');
    const indexedNames = new Set();
    const sums = readFileSync(join(directory, 'SHA256SUMS'), 'utf8').trim().split('\n');
    for (const line of sums) {
      const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
      if (!match || ['.', '..'].includes(match[2])) throw new Error('Invalid checksum entry');
      if (!expectedNames.has(match[2]) || indexedNames.has(match[2]))
        throw new Error('Unexpected or duplicate checksum entry');
      indexedNames.add(match[2]);
      if (digest(readFileSync(join(directory, match[2]))) !== match[1])
        throw new Error('Artifact checksum mismatch');
    }
    if (indexedNames.size !== expectedNames.size) throw new Error('Incomplete checksum index');
    for (const f of receipt.files) {
      if (
        !/^[^/\\]+$/.test(f.name) ||
        ['.', '..'].includes(f.name) ||
        digest(readFileSync(join(directory, f.name))) !== f.sha256
      )
        throw new Error('Receipt checksum mismatch');
    }
    const artifact = readCandidatePackage(directory, true);
    if (
      receipt.packageComplete !== artifact.manifest.complete ||
      receipt.publication !== 'not-published' ||
      receipt.application !== 'not-applied'
    )
      throw new Error('Receipt completeness/status contradicts artifact');
    if (
      !verifyArtifact(artifact) ||
      artifact.id !== receipt.artifactId ||
      artifact.sourceSha !== receipt.sourceSha
    )
      throw new Error('Artifact identity mismatch');
    return {
      valid: true,
      sourceSha: receipt.sourceSha,
      artifactId: receipt.artifactId,
      files: receipt.files.length,
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'verify') {
    const result = verifyCandidateEvidence(process.argv[3]);
    console.log(JSON.stringify(result));
    if (!result.valid) process.exitCode = 1;
  } else {
    const sourceDir = execFileSync(
      'git',
      ['-C', dirname(fileURLToPath(import.meta.url)), 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8' },
    ).trim();
    const sourceSha = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const destination = process.env.CI_ARTIFACT_DIR;
    if (!destination) throw new Error('CI_ARTIFACT_DIR is required');
    const identity = {
      expectedSha: process.env.EXPECTED_SHA,
      workflowSha: process.env.GITHUB_WORKFLOW_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      event: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      repository: process.env.GITHUB_REPOSITORY,
    };
    const receipt = stageCandidateEvidence({
      sourceDir: realpathSync(sourceDir),
      artifactDir: join(sourceDir, '.cache', 'official-cny', sourceSha),
      destination,
      identity,
    });
    console.log(JSON.stringify(receipt));
  }
}
