import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

const script = resolve('scripts/sync-upstream.mjs');
function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cny-sync-test-'));
  const repo = join(root, 'source');
  mkdirSync(repo);
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.name', 'Fixture');
  git(repo, 'config', 'user.email', 'fixture@example.invalid');
  mkdirSync(join(repo, 'data'), { recursive: true });
  writeFileSync(join(repo, 'data/upstream.json'), '{"price":1}\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'upstream base');
  const base = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'switch', '-c', 'naoshengyun');
  writeFileSync(join(repo, 'data/cny-policy.json'), '{"USD":7}\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'owned policy');
  const business = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'switch', 'main');
  writeFileSync(join(repo, 'data/upstream.json'), '{"price":2}\n');
  mkdirSync(join(repo, '.github/workflows'), { recursive: true });
  writeFileSync(join(repo, '.github/workflows/new-name.yml'), 'on: [push]\njobs: {}\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'upstream update and workflow');
  const upstream = git(repo, 'rev-parse', 'HEAD');
  return { root, repo, base, business, upstream };
}
function prepare(f) {
  return spawnSync(process.execPath, [script, '--repo', f.repo, '--upstream', f.upstream,
    '--business', f.business, '--output', join(f.root, 'candidate')], { encoding: 'utf8' });
}

test('prepares a merge candidate without changing mirror or business and quarantines new upstream workflows', () => {
  const f = fixture();
  const result = prepare(f);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'candidate-ready');
  assert.equal(git(f.repo, 'rev-parse', 'main'), f.upstream);
  assert.equal(git(f.repo, 'rev-parse', 'naoshengyun'), f.business);
  assert.equal(readFileSync(join(f.root, 'candidate/data/cny-policy.json'), 'utf8'), '{"USD":7}\n');
  assert.equal(readFileSync(join(f.root, 'candidate/data/upstream.json'), 'utf8'), '{"price":2}\n');
  assert.deepEqual(report.quarantinedWorkflows, ['new-name.yml']);
  assert.equal(git(join(f.root, 'candidate'), 'merge-base', '--is-ancestor', f.upstream, 'HEAD'), '');
});

test('merge conflict leaves source branch refs and policy untouched and reports no publication', () => {
  const f = fixture();
  writeFileSync(join(f.repo, 'data/cny-policy.json'), '{"USD":8}\n');
  git(f.repo, 'add', '.');
  git(f.repo, 'commit', '-m', 'conflicting upstream policy');
  f.upstream = git(f.repo, 'rev-parse', 'HEAD');
  const result = prepare(f);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'failed');
  assert.equal(report.stage, 'merge');
  assert.equal(report.published, false);
  assert.equal(git(f.repo, 'rev-parse', 'main'), f.upstream);
  assert.equal(git(f.repo, 'rev-parse', 'naoshengyun'), f.business);
});

test('rejects a clean merge that changes an explicitly protected quote path', () => {
  const f = fixture();
  const result = spawnSync(process.execPath, [script, '--repo', f.repo, '--upstream', f.upstream,
    '--business', f.business, '--output', join(f.root, 'candidate'), '--protect', 'data/upstream.json'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.stage, 'protected-data');
  assert.match(report.error, /Protected paths changed/);
  assert.equal(report.published, false);
});

test('refuses candidate output inside the source repository', () => {
  const f = fixture();
  const result = spawnSync(process.execPath, [script, '--repo', f.repo, '--upstream', f.upstream,
    '--business', f.business, '--output', join(f.repo, 'nested-candidate')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).error, /outside the source repository/);
});

test('rejects linked workflow sources and destinations without moving external files', () => {
  for (const linkedPath of ['.github/workflows', '.github/upstream-workflows', '.github', '.github/workflows/new-name.yml', '.github/upstream-workflows/new-name.yml', 'cny-sync-report.json']) {
    const f = fixture();
    const external = join(f.root, 'external');
    mkdirSync(external);
    writeFileSync(join(external, 'sentinel.yml'), 'external sentinel\n');
    rmSync(join(f.repo, linkedPath), {recursive:true, force:true});
    mkdirSync(dirname(join(f.repo,linkedPath)),{recursive:true});
    symlinkSync(linkedPath.endsWith('.yml') || linkedPath.endsWith('.json') ? join(external,'sentinel.yml') : external, join(f.repo, linkedPath));
    git(f.repo, 'add', '.');
    git(f.repo, 'commit', '-m', 'malicious linked workflow path');
    f.upstream=git(f.repo, 'rev-parse', 'HEAD');
    const result=prepare(f);
    assert.equal(result.status, 1, linkedPath);
    assert.equal(JSON.parse(result.stdout).status, 'failed');
    assert.equal(readFileSync(join(external,'sentinel.yml'),'utf8'), 'external sentinel\n');
    assert.deepEqual(JSON.parse(result.stdout).published, false);
  }
});

const snapshotPaths = {
  'en.json': 'dist/api/all.json',
  'zh.json': 'dist/api/i18n/zh/all.json',
  'ja.json': 'dist/api/i18n/ja/all.json',
  'native.json': 'data/native-providers.json',
};
const snapshotBytes = '{"providers":[]}\n';
const policyPath = 'data/cny/unified-policy.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function put(repo, path, bytes) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), bytes);
}

function commit(repo, message) {
  git(repo, 'add', '--all');
  git(repo, 'commit', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function reviewedFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cny-reviewed-sync-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'source');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Fixture');
  git(repo, 'config', 'user.email', 'fixture@example.invalid');
  for (const path of Object.values(snapshotPaths)) put(repo, path, snapshotBytes);
  put(repo, '.github/workflows/build.yml', 'on: [push]\n');
  put(repo, 'README.md', 'Common text\n');
  const common = commit(repo, 'common upstream and business ancestor');
  put(repo, 'upstream.txt', 'Already reflected in the business tree\n');
  const previousUpstream = commit(repo, 'reviewed upstream version');
  const directory = `data/upstream/${previousUpstream.slice(0, 8)}`;
  git(repo, 'switch', '-q', '-c', 'naoshengyun', common);
  put(repo, 'upstream.txt', 'Already reflected in the business tree\n');
  rmSync(join(repo, '.github/workflows/build.yml'));
  put(repo, '.github/workflows/review.yml', 'on: [pull_request]\n');
  const policy = `{"upstreamDirectory": ${JSON.stringify(directory)}, "asOf": "2026-11-18T00:00:00+08:00", "lifecycle": {}}\n`;
  put(repo, policyPath, policy);
  put(repo, 'data/cny/official-catalog.json', '{"official":true}\n');
  const source = {
    upstreamSha: previousUpstream,
    repository: 'https://github.com/basellm/llm-metadata',
    files: Object.fromEntries(Object.entries(snapshotPaths).map(([file, path]) => [file, { path, sha256: sha256(snapshotBytes) }])),
    snapshotAt: '2026-11-18T05:58:22Z',
  };
  put(repo, 'data/upstream/24d3f35c/source.json', JSON.stringify(source));
  for (const name of Object.keys(snapshotPaths)) put(repo, `${directory}/${name}`, snapshotBytes);
  put(repo, `${directory}/source.json`, JSON.stringify(source));
  const business = commit(repo, 'business policy and controlled workflow');
  git(repo, 'switch', '-q', 'main');
  return { root, repo, common, previousUpstream, directory, business, policy };
}

function prepareReviewed(f, upstream, output = join(f.root, 'candidate')) {
  const result = spawnSync(process.execPath, [script, '--reviewed', '--repo', f.repo,
    '--upstream', upstream, '--business', f.business, '--output', output], { encoding: 'utf8' });
  return { ...result, report: JSON.parse(result.stdout) };
}

test('reviewed sync reports the already pinned upstream without cloning a candidate', t => {
  const f = reviewedFixture(t);
  const { status, report } = prepareReviewed(f, f.previousUpstream);
  assert.equal(status, 0, JSON.stringify(report));
  assert.equal(report.status, 'unchanged');
  assert.equal(report.upstream, f.previousUpstream);
  assert.equal(report.previousUpstream, f.previousUpstream);
  assert.equal(report.business, f.business);
  assert.equal(existsSync(join(f.root, 'candidate')), false);
});

test('reviewed sync pins upstream bytes while preserving controlled workflows and business ancestry', t => {
  const f = reviewedFixture(t);
  const changedBytes = '{"providers":[{"id":"changed"}]}\n';
  put(f.repo, snapshotPaths['en.json'], changedBytes);
  put(f.repo, '.github/workflows/build.yml', 'on: [push, schedule]\n');
  put(f.repo, '.github/workflows/review.yml', 'on: [push]\n');
  put(f.repo, 'README.md', 'New upstream text\n');
  const upstream = commit(f.repo, 'changed upstream catalog, docs and workflow names');
  const { status, report } = prepareReviewed(f, upstream);
  assert.equal(status, 0, JSON.stringify(report));
  assert.equal(report.status, 'candidate-ready');
  assert.equal(report.upstream, upstream);
  assert.equal(report.previousUpstream, f.previousUpstream);
  assert.equal(report.business, f.business);
  assert.equal(git(report.output, 'rev-parse', 'HEAD'), report.candidate);
  assert.equal(git(report.output, 'show', '-s', '--format=%P', 'HEAD'), f.business);
  assert.equal(git(report.output, 'rev-parse', 'HEAD:.github/workflows'),
    git(f.repo, 'rev-parse', `${f.business}:.github/workflows`));
  assert.deepEqual(report.quarantinedWorkflows, ['build.yml', 'review.yml']);
  assert.equal(readFileSync(join(report.output, '.github/upstream-workflows/build.yml'), 'utf8'), 'on: [push, schedule]\n');
  assert.equal(readFileSync(join(report.output, '.github/upstream-workflows/review.yml'), 'utf8'), 'on: [push]\n');
  const newDirectory = `data/upstream/${upstream.slice(0, 8)}`;
  assert.equal(readFileSync(join(report.output, policyPath), 'utf8'), f.policy.replace(f.directory, newDirectory));
  assert.equal(readFileSync(join(report.output, 'data/cny/official-catalog.json'), 'utf8'), '{"official":true}\n');
  assert.equal(readFileSync(join(report.output, 'README.md'), 'utf8'), 'New upstream text\n');
  const source = JSON.parse(readFileSync(join(report.output, newDirectory, 'source.json'), 'utf8'));
  assert.equal(source.upstreamSha, upstream);
  assert.equal(source.repository, 'https://github.com/basellm/llm-metadata');
  for (const [name, path] of Object.entries(snapshotPaths)) {
    const expected = name === 'en.json' ? changedBytes : snapshotBytes;
    assert.equal(readFileSync(join(report.output, newDirectory, name), 'utf8'), expected);
    assert.deepEqual(source.files[name], { path, sha256: sha256(expected) });
    assert.equal(readFileSync(join(report.output, f.directory, name), 'utf8'), snapshotBytes);
  }
  assert.equal(git(f.repo, 'rev-parse', 'main'), upstream);
  assert.equal(git(f.repo, 'rev-parse', 'naoshengyun'), f.business);
  assert.equal(git(report.output, 'status', '--porcelain'), '');
  const rerun = prepareReviewed(f, upstream, join(f.root, 'rerun'));
  assert.equal(rerun.status, 0, JSON.stringify(rerun.report));
  assert.equal(rerun.report.candidate, report.candidate);
});

test('reviewed sync reports conflicts against the pinned tree and removes the failed checkout', t => {
  const f = reviewedFixture(t);
  git(f.repo, 'switch', '-q', 'naoshengyun');
  put(f.repo, 'README.md', 'Owned text\n');
  f.business = commit(f.repo, 'edit README on the business branch');
  git(f.repo, 'switch', '-q', 'main');
  put(f.repo, 'README.md', 'New upstream text\n');
  const upstream = commit(f.repo, 'edit the same README line upstream');
  const { status, report } = prepareReviewed(f, upstream);
  assert.equal(status, 1, JSON.stringify(report));
  assert.equal(report.stage, 'merge');
  assert.match(report.error, /Upstream merge conflicts:.*README\.md/);
  assert.equal(report.published, false);
  assert.equal(existsSync(join(f.root, 'candidate')), false);
  assert.equal(git(f.repo, 'rev-parse', 'naoshengyun'), f.business);
});

test('reviewed sync refuses upstream edits to owned policy and Git checkout configuration', t => {
  const f = reviewedFixture(t);
  put(f.repo, 'data/cny/official-catalog.json', '{"official":false}\n');
  let upstream = commit(f.repo, 'upstream tries to add owned official quotes');
  let result = prepareReviewed(f, upstream);
  assert.equal(result.status, 1);
  assert.equal(result.report.stage, 'protected-data');
  assert.match(result.report.error, /Protected paths changed: data\/cny\/official-catalog\.json/);
  rmSync(join(f.repo, 'data/cny/official-catalog.json'));
  put(f.repo, 'dist/.gitattributes', '*.json filter=example\n');
  upstream = commit(f.repo, 'upstream tries to configure a checkout filter');
  result = prepareReviewed(f, upstream);
  assert.equal(result.status, 1);
  assert.equal(result.report.stage, 'protected-data');
  assert.match(result.report.error, /Unsupported Git entry.*dist\/\.gitattributes/);
  assert.equal(existsSync(join(f.root, 'candidate')), false);
});

test('reviewed sync rejects malformed snapshot inputs and commits outside the pinned lineage', t => {
  const f = reviewedFixture(t);
  let result = prepareReviewed(f, f.common);
  assert.equal(result.status, 1);
  assert.match(result.report.error, /does not descend from reviewed pin/);
  put(f.repo, snapshotPaths['zh.json'], 'broken JSON\n');
  const upstream = commit(f.repo, 'invalid catalog bytes');
  result = prepareReviewed(f, upstream);
  assert.equal(result.status, 1);
  assert.equal(result.report.stage, 'snapshot');
  assert.match(result.report.error, /Expected JSON object in dist\/api\/i18n\/zh\/all\.json/);
  assert.equal(existsSync(join(f.root, 'candidate')), false);
});
