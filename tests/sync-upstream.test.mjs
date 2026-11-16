import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
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
