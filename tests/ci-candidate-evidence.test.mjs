import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildOfficialSnapshot } from '../scripts/build-official-cny.mjs';
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
  const quote = {
    id: 'q',
    provider: 'fixture',
    model: 'm',
    priceList: 'synthetic',
    origin: 'domestic',
    currency: 'CNY',
    source: { url: 'https://example.org/synthetic', checkedAt: '2026-11-16' },
    required: ['input', 'output'],
    cost: { input: 21, output: 0 },
  };
  const result = buildOfficialSnapshot({
    sourceSha: sha,
    catalog: {
      checkedAt: '2026-11-16',
      records: [quote],
      coverage: [{ platform: 'fixture', model: 'm', status: 'ready', quoteIds: ['q'] }],
      excludedQuotes: [],
    },
    reference: {
      providedCount: 1,
      reportedCount: 1,
      unexplainedDifference: 0,
      platforms: [{ platform: 'fixture', protocol: 'synthetic', models: ['m'] }],
    },
    selection: { m: 'q' },
  });
  const artifact = result.artifact;
  const changes = Object.entries(artifact.models).map(([key, value]) => ({
    partition: 'models',
    key,
    type: 'candidate-addition',
    after: value,
  }));
  const files = {
    artifact,
    catalog: result.catalog,
    coverage: result.coverage,
    diagnostics: result.diagnostics,
    status: result.status,
    'semantic-diff': {
      baseline: null,
      scope: 'first official candidate; no production baseline',
      changes,
    },
    ratio_config: {
      data: {
        billing_mode: { m: 'tiered_expr' },
        billing_expr: { m: artifact.models.m.billing_expr },
      },
    },
    plugin_prices: {},
    tool_prices: { 'tool_price_setting.prices': {} },
  };
  for (const [name, value] of Object.entries(files))
    writeFileSync(join(artifactDir, name + '.json'), JSON.stringify(value) + '\n');
  writeFileSync(join(artifactDir, 'coverage-report.md'), `Source ${sha} artifact ${artifact.id}\n`);
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
    assert.equal(
      readFileSync(join(f.destination, 'catalog.json'), 'utf8'),
      readFileSync(join(f.artifactDir, 'catalog.json'), 'utf8'),
    );
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
test('S: download verification rejects internally inconsistent workflow identity', () => {
  const f = fixture();
  try {
    stageCandidateEvidence({
      ...f,
      sourceDir: f.source,
      identity: { expectedSha: f.sha, workflowSha: f.sha, runId: 'fixture' },
    });
    const path = join(f.destination, 'receipt.json');
    const receipt = JSON.parse(readFileSync(path, 'utf8'));
    receipt.identity.workflowSha = '0'.repeat(40);
    writeFileSync(path, JSON.stringify(receipt));
    const digest = execFileSync('shasum', ['-a', '256', path], { encoding: 'utf8' }).split(' ')[0];
    const sums = readFileSync(join(f.destination, 'SHA256SUMS'), 'utf8').replace(
      /^[a-f0-9]{64}  receipt.json$/m,
      `${digest}  receipt.json`,
    );
    writeFileSync(join(f.destination, 'SHA256SUMS'), sums);
    assert.equal(verifyCandidateEvidence(f.destination).valid, false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test('S: a truncated checksum index cannot turn a partial download into success', () => {
  const f = fixture();
  try {
    stageCandidateEvidence({
      ...f,
      sourceDir: f.source,
      identity: { expectedSha: f.sha, workflowSha: f.sha, runId: 'fixture' },
    });
    const index = join(f.destination, 'SHA256SUMS');
    const sums = readFileSync(index, 'utf8')
      .split('\n')
      .filter((line) => !line.endsWith('  receipt.json'))
      .join('\n');
    writeFileSync(index, sums);
    assert.equal(verifyCandidateEvidence(f.destination).valid, false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test('S: CI staging rejects missing or malformed/inconsistent native price exports', () => {
  for (const mutation of ['missing-diff', 'malformed-prices', 'wrong-prices']) {
    const f = fixture();
    try {
      if (mutation === 'missing-diff') rmSync(join(f.artifactDir, 'semantic-diff.json'));
      if (mutation === 'malformed-prices')
        writeFileSync(join(f.artifactDir, 'ratio_config.json'), 'CORRUPTED JSON');
      if (mutation === 'wrong-prices')
        writeFileSync(
          join(f.artifactDir, 'ratio_config.json'),
          JSON.stringify({
            data: { billing_mode: { m: 'tiered_expr' }, billing_expr: { m: 'p * 999' } },
          }),
        );
      assert.throws(
        () =>
          stageCandidateEvidence({
            ...f,
            sourceDir: f.source,
            identity: { expectedSha: f.sha, workflowSha: f.sha, runId: 'fixture' },
          }),
        mutation,
      );
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  }
});
test('S: rehashed evidence still rejects contradictory completeness or exported prices', () => {
  for (const mutation of ['completeness', 'price-export']) {
    const f = fixture();
    try {
      stageCandidateEvidence({
        ...f,
        sourceDir: f.source,
        identity: { expectedSha: f.sha, workflowSha: f.sha, runId: 'fixture' },
      });
      const path = join(f.destination, 'receipt.json'),
        receipt = JSON.parse(readFileSync(path, 'utf8'));
      if (mutation === 'completeness') receipt.packageComplete = !f.artifact.manifest.complete;
      else
        writeFileSync(
          join(f.destination, 'ratio_config.json'),
          JSON.stringify({
            data: { billing_mode: { m: 'tiered_expr' }, billing_expr: { m: 'p * 999' } },
          }),
        );
      const checksum = (name) =>
        execFileSync('shasum', ['-a', '256', join(f.destination, name)], {
          encoding: 'utf8',
        }).split(' ')[0];
      for (const file of receipt.files) file.sha256 = checksum(file.name);
      writeFileSync(path, JSON.stringify(receipt));
      const sums =
        [...receipt.files, { name: 'receipt.json', sha256: checksum('receipt.json') }]
          .map((x) => `${x.sha256}  ${x.name}`)
          .join('\n') + '\n';
      writeFileSync(join(f.destination, 'SHA256SUMS'), sums);
      assert.equal(verifyCandidateEvidence(f.destination).valid, false, mutation);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  }
});
