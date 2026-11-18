import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('the reviewed build refuses a cutoff in the future before creating a candidate', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'reviewed-cny-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json'));
  policy.asOf = '2999-01-01T00:00:00Z';
  const policyPath = join(temp, 'policy.json');
  writeFileSync(policyPath, JSON.stringify(policy));
  const result = spawnSync(
    process.execPath,
    ['scripts/check-cny-effective-time.mjs', policyPath],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Review cutoff is in the future/);
});
