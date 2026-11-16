import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildArtifact } from '../.cache/cny-build/cny/artifact.js';
import {
  stageCandidateEvidence,
  verifyCandidateEvidence,
} from '../scripts/ci-candidate-evidence.mjs';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cny-ci-evidence-')),
    source = join(root, 'source'),
    artifactDir = join(root, 'candidate');
  mkdirSync(source);
  mkdirSync(artifactDir);
  const git = (...args) =>
    execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
  git('init', '-b', 'naoshengyun');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(source, 'data.txt'), 'committed\n');
  git('add', '.');
  git('commit', '-m', 'fixture');
  const sha = git('rev-parse', 'HEAD');
  const artifact = buildArtifact(
    {
      sourceSha: sha,
      data: {},
      quotes: [],
      selection: {},
      models: { m: { billing_mode: 'tiered_expr', billing_expr: 'p * 21' } },
      plugins: {},
      tools: {},
      exclusions: [],
    },
    '2026-11-16',
  );
  writeFileSync(join(artifactDir, 'artifact.json'), JSON.stringify(artifact) + '\n');
  writeFileSync(join(artifactDir, 'catalog.json'), '[]\n');
  return { root, source, artifactDir, sha, destination: join(root, 'evidence'), artifact };
}
test('S: CI evidence binds source and candidate, preserves bytes and exposes corruption', () => {
  const f = fixture();
  try {
    const receipt = stageCandidateEvidence({
      ...f,
      sourceDir: f.source,
      identity: { expectedSha: f.sha, workflowSha: f.sha, runId: 'fixture' },
    });
    assert.equal(receipt.sourceSha, f.sha);
    assert.equal(receipt.artifactId, f.artifact.id);
    assert.equal(verifyCandidateEvidence(f.destination).valid, true);
    assert.equal(readFileSync(join(f.destination, 'catalog.json'), 'utf8'), '[]\n');
    writeFileSync(join(f.destination, 'catalog.json'), '[1]\n');
    assert.equal(verifyCandidateEvidence(f.destination).valid, false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test('S: CI rejects stale source confirmation and repository mutations before staging', () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        stageCandidateEvidence({
          ...f,
          sourceDir: f.source,
          identity: { expectedSha: '0'.repeat(40), workflowSha: f.sha },
        }),
      /SHA/,
    );
    writeFileSync(join(f.source, 'data.txt'), 'modified\n');
    assert.throws(
      () =>
        stageCandidateEvidence({
          ...f,
          sourceDir: f.source,
          identity: { expectedSha: f.sha, workflowSha: f.sha },
        }),
      /modify/,
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
