/** Local entry point shared by the PR check and the Pages build. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [output] = process.argv.slice(2);
assert.ok(output, 'Pass an existing workspace for exclusive site and candidate outputs');
const work = resolve(output);
const priorPointer = resolve(work, 'prior/current.json');
const prior = existsSync(priorPointer) ? JSON.parse(readFileSync(priorPointer)) : null;
const previous = prior?.schemaVersion === 3 ? resolve(work, 'prior', prior.fixedBase) : null;
const run = (script, args = []) =>
  execFileSync(process.execPath, [script, ...args], { stdio: 'inherit' });

run('scripts/check-cny-effective-time.mjs');
run('scripts/build-unified-cny.mjs', [
  resolve(work, 'candidate'),
  'data/cny/unified-policy.json',
  'data/cny/official-catalog.json',
  'data/cny/proposed-selection.json',
  '',
  ...(previous ? [resolve(previous)] : []),
]);
run('scripts/build-visual-site.mjs', [
  'data/cny/publication/upstream-release.json',
  resolve(work, 'site'),
  resolve(work, 'candidate'),
]);
