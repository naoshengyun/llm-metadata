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
import { verifyArtifact } from '../.cache/cny-build/cny/artifact.js';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
  const artifact = JSON.parse(readFileSync(join(artifactDir, 'artifact.json'), 'utf8'));
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
    const receipt = JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8'));
    const sums = readFileSync(join(directory, 'SHA256SUMS'), 'utf8').trim().split('\n');
    for (const line of sums) {
      const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
      if (!match || ['.', '..'].includes(match[2])) throw new Error('Invalid checksum entry');
      if (digest(readFileSync(join(directory, match[2]))) !== match[1])
        throw new Error('Artifact checksum mismatch');
    }
    for (const f of receipt.files) {
      if (
        !/^[^/\\]+$/.test(f.name) ||
        ['.', '..'].includes(f.name) ||
        digest(readFileSync(join(directory, f.name))) !== f.sha256
      )
        throw new Error('Receipt checksum mismatch');
    }
    const artifact = JSON.parse(readFileSync(join(directory, 'artifact.json'), 'utf8'));
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
