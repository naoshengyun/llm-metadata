/** Local entry point shared by the PR check and the Pages build. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [output, option] = process.argv.slice(2);
assert.ok(!option || option === '--check-base', 'Unknown reviewed build option');
assert.ok(output, 'Pass an existing workspace for exclusive site and candidate outputs');
const work = resolve(output);
const priorPointer = resolve(work, 'prior/current.json');
const prior = existsSync(priorPointer) ? JSON.parse(readFileSync(priorPointer)) : null;
const previous = prior?.schemaVersion === 3 ? resolve(work, 'prior', prior.fixedBase) : null;
const run = (script, args = []) =>
  execFileSync(process.execPath, [script, ...args], { stdio: 'inherit' });

run('scripts/check-cny-effective-time.mjs');
const policyPath = 'data/cny/unified-policy.json';
const candidateArgs = (directory, baseline, repository = '.') => [
  directory,
  policyPath,
  'data/cny/official-catalog.json',
  'data/cny/proposed-selection.json',
  JSON.parse(readFileSync(resolve(repository, policyPath))).upstreamDirectory,
  ...(baseline ? [baseline] : []),
];
if (option === '--check-base') {
  const base = execFileSync('git', ['rev-parse', 'HEAD^1'], { encoding: 'utf8' }).trim();
  const hasUnifiedInputs =
    spawnSync('git', ['cat-file', '-e', base + ':' + policyPath]).status === 0;
  if (hasUnifiedInputs && prior?.sourceSha !== base) {
    // The protected branch may be ahead of Pages after a suspended or failed deployment.
    const baseRoot = resolve(work, 'base-source');
    const baseCandidate = resolve(work, 'base-candidate');
    execFileSync('git', ['worktree', 'add', '--detach', baseRoot, base], { stdio: 'inherit' });
    try {
      const fromBase = { cwd: baseRoot, stdio: 'inherit' };
      execFileSync('npm', ['ci', '--ignore-scripts'], fromBase);
      execFileSync(
        'npm',
        ['run', 'cny:unified:build', '--', ...candidateArgs(baseCandidate, previous, baseRoot)],
        fromBase,
      );
      run(
        'scripts/build-unified-cny.mjs',
        candidateArgs(resolve(work, 'base-validation'), baseCandidate),
      );
    } finally {
      execFileSync('git', ['worktree', 'remove', '--force', baseRoot], { stdio: 'inherit' });
    }
  }
}
run('scripts/build-unified-cny.mjs', candidateArgs(resolve(work, 'candidate'), previous));
run('scripts/build-visual-site.mjs', [
  'data/cny/publication/upstream-release.json',
  resolve(work, 'site'),
  resolve(work, 'candidate'),
]);
