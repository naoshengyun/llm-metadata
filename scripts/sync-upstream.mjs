#!/usr/bin/env node
// Local-only candidate preparation: never fetch, push, update source refs or publish.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const report = { status: 'failed', published: false, applied: false, hostedActions: 'not-enabled' };
try {
  const { values } = parseArgs({ options: {
    protect: { type: 'string', multiple: true, default: ['data/naoshengyun', 'data/cny', 'src/cny'] },
    repo: { type: 'string' }, upstream: { type: 'string' }, business: { type: 'string' }, output: { type: 'string' },
  } });
  for (const key of ['repo', 'upstream', 'business', 'output']) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  const repo = realpathSync(resolve(values.repo));
  const requestedOutput = resolve(values.output);
  const output = join(realpathSync(dirname(requestedOutput)), basename(requestedOutput));
  if (output === repo || output.startsWith(`${repo}${sep}`)) throw new Error('Output must be outside the source repository');
  if (existsSync(output)) throw new Error('Output must not exist; existing work is never overwritten');
  // Resolve immutable commits before copying. Neither source branch is moved.
  const upstream = git(repo, 'rev-parse', '--verify', `${values.upstream}^{commit}`);
  const business = git(repo, 'rev-parse', '--verify', `${values.business}^{commit}`);
  Object.assign(report, { upstream, business, output, stage: 'clone' });
  execFileSync('git', ['clone', '--no-hardlinks', '--no-checkout', '--', repo, output], { stdio: 'pipe' });
  git(output, 'config', 'user.name', 'Local CNY sync candidate');
  git(output, 'config', 'user.email', 'cny-sync@example.invalid');
  git(output, 'switch', '-c', 'naoshengyun-sync-candidate', business);
  report.stage = 'merge';
  git(output, 'merge', '--no-ff', '--no-edit', upstream);
  report.mergeCommit = git(output, 'rev-parse', 'HEAD');
  report.stage = 'protected-data';
  const protectedPaths = values.protect;
  if (protectedPaths.some(path => path.startsWith('/') || path.split('/').includes('..') || path.startsWith(':'))) {
    throw new Error('Protected paths must be plain relative repository paths');
  }
  const changes = git(output, 'diff', '--name-only', business, 'HEAD', '--', ...protectedPaths);
  if (changes) throw new Error(`Protected paths changed: ${changes}`);
  report.protectedPaths = protectedPaths;
  // No upstream workflow is trusted, including new or renamed ones. Preserve it as data.
  const workflows = join(output, '.github/workflows');
  const quarantine = join(output, '.github/upstream-workflows');
  const names = existsSync(workflows) ? readdirSync(workflows).filter(name => /\.ya?ml$/i.test(name)).sort() : [];
  if (names.length) mkdirSync(quarantine, { recursive: true });
  for (const name of names) {
    const target = join(quarantine, name);
    // A previous quarantine is historical data; the just-merged workflow is authoritative here.
    renameSync(join(workflows, name), target);
  }
  report.quarantinedWorkflows = names;
  if (names.length) {
    git(output, 'add', '--', '.github/workflows', '.github/upstream-workflows');
    git(output, 'commit', '-m', 'Quarantine inherited workflows in sync candidate');
  }
  Object.assign(report, { status: 'candidate-ready', stage: 'review', candidate: git(output, 'rev-parse', 'HEAD') });
  writeFileSync(join(output, 'cny-sync-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = 1;
}
