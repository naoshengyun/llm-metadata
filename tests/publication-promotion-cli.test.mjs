import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildOfficialSnapshot } from '../scripts/build-official-cny.mjs';
import {
  buildPublicationPackage,
  writePublicationPackage,
} from '../.cache/cny-build/cny/publication-package.js';

test('S: an operator can prepare, confirm, locally apply and export a bound publication snapshot', () => {
  const root = mkdtempSync(join(tmpdir(), 'cny-publication-cli-'));
  const read = (n) => JSON.parse(readFileSync(new URL('../data/cny/' + n, import.meta.url)));
  const artifact = buildOfficialSnapshot({
    sourceSha: 'd5a84ca10d8599343370c1541828439a56b8dd1b',
    catalog: read('official-catalog.json'),
    reference: read('coverage-reference.json'),
    selection: read('proposed-selection.json').selection,
  }).artifact;
  const p = buildPublicationPackage(Buffer.from(JSON.stringify(artifact)), {
    models: ['kimi-k3.1-pro'],
    plugins: {},
    tools: [],
    mode: 'partial',
    purpose: 'test',
  });
  const state = join(root, 'state'),
    packages = join(root, 'packages');
  mkdirSync(state);
  mkdirSync(packages);
  const packageDir = writePublicationPackage(packages, p.files, p);
  const save = (name, value) => {
    const path = join(root, name);
    writeFileSync(path, JSON.stringify(value));
    return path;
  };
  const cli = (...args) =>
    spawnSync(process.execPath, ['scripts/publication-transition.mjs', ...args], {
      encoding: 'utf8',
    });
  try {
    const planFile = join(root, 'plan.json'),
      request = save('request.json', {
        stateDir: state,
        packageDir,
        identity: { releaseId: p.releaseId, manifestSha256: p.manifestSha256 },
        action: 'promote',
      });
    let run = cli('prepare', request, planFile);
    assert.equal(run.status, 0, run.stderr);
    const plan = JSON.parse(readFileSync(planFile));
    const outputFailureConfirmation = save('output-failure-confirmation.json', {
      confirmed: true,
      actor: 'local-test-operator',
      approvalRef: 'test-output-preflight',
      planId: plan.id,
    });
    run = cli(
      'apply',
      state,
      planFile,
      outputFailureConfirmation,
      join(root, 'absent-directory/receipt.json'),
    );
    assert.notEqual(run.status, 0);
    const afterOutputFailure = cli('verify', state, plan.snapshot.revision);
    assert.notEqual(
      afterOutputFailure.status,
      0,
      'an unusable receipt output must be rejected before changing the stable state',
    );
    run = cli(
      'apply',
      state,
      planFile,
      outputFailureConfirmation,
      join(state, 'publication-state.json'),
    );
    assert.notEqual(run.status, 0);
    const prepareAfterInternalOutput = cli(
      'prepare',
      request,
      join(root, 'after-internal-output-plan.json'),
    );
    assert.equal(
      prepareAfterInternalOutput.status,
      0,
      'receipt reservation must not corrupt publication state or internal journals',
    );
    const rejectedConfirmation = save('rejected-confirmation.json', {
      confirmed: true,
      actor: 'local-test-operator',
      approvalRef: 'test-only-rejected-review',
      planId: plan.id,
    });
    writeFileSync(join(state, '.publication.lock'), 'another local process');
    const rejectedReceipt = join(root, 'rejected-receipt.json');
    run = cli('apply', state, planFile, rejectedConfirmation, rejectedReceipt);
    assert.notEqual(run.status, 0, 'a known rejected operation must not exit successfully');
    assert.equal(JSON.parse(readFileSync(rejectedReceipt)).status, 'failed');
    rmSync(join(state, '.publication.lock'));
    const confirmation = save('confirmation.json', {
      confirmed: true,
      actor: 'local-test-operator',
      approvalRef: 'test-only-review',
      planId: plan.id,
    });
    const receiptFile = join(root, 'receipt.json');
    run = cli('apply', state, planFile, confirmation, receiptFile);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(readFileSync(receiptFile)).status, 'applied');
    run = cli('verify', state, plan.snapshot.revision, 'candidate');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /test selection/);
    run = cli('apply', state, planFile, confirmation, receiptFile);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /read it before retrying/);
    run = cli('export', state, join(root, 'site'), plan.snapshot.revision);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(
      JSON.parse(readFileSync(join(root, 'site', 'current.json'))).releaseId,
      p.releaseId,
    );
    assert.equal(
      JSON.parse(readFileSync(join(root, 'site', 'api/newapi/ratio_config.json'))).data
        .billing_expr['kimi-k3.1-pro'],
      'tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
