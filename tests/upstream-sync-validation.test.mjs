import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

test('upstream validation binds the generated site, checks actual pricing, and rejects a repriced official key', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cny-upstream-validation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const business = 'a'.repeat(40);
  const candidate = 'b'.repeat(40);
  const previousUpstream = 'c'.repeat(40);
  const upstream = 'd'.repeat(40);
  const beforeId = 'e'.repeat(64);
  const afterId = 'f'.repeat(64);
  const fixed = 'versions/' + afterId + '/';
  const api = 'api/newapi/ratio_config.json';
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const encode = (value) => JSON.stringify(value) + '\n';
  function write(path, value) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, encode(value));
  }
  function config(official, upstreamPrice) {
    return {
      success: true,
      message: '',
      data: {
        billing_mode: { local: 'tiered_expr', remote: 'tiered_expr' },
        billing_expr: { local: official, remote: upstreamPrice },
      },
    };
  }
  function make(dir, sourceSha, upstreamSha, candidateId, config, models) {
    write(dir + '/' + api, config);
    write(dir + '/manifest.json', {
      sourceSha,
      upstreamSha,
      candidateId,
      stats: { apiModels: 2, models },
      files: { [api]: { sha256: digest(encode(config)) } },
    });
    write(dir + '/official-selection.json', { local: 'official' });
    write(dir + '/selection.json', { local: 'official', remote: 'upstream' });
    write(dir + '/policy.json', {
      upstreamDirectory: 'data/upstream/' + upstreamSha.slice(0, 8),
      lifecycle: {},
      upstreamSelection: {},
    });
  }
  write('preparation.json', {
    status: 'candidate-ready',
    business,
    candidate,
    upstream,
    previousUpstream,
  });
  make('before', business, previousUpstream, beforeId, config('p * 12', 'p * 2'), 7);
  function publish(official) {
    const afterConfig = config(official, 'p * 3');
    make('after', candidate, upstream, afterId, afterConfig, 8);
    write('after/price-diff.json', {
      baseline: { candidateId: beforeId },
      changes: [{ nativeKey: 'remote', type: 'changed' }],
    });
    write('site/current.json', {
      schemaVersion: 3,
      sourceSha: candidate,
      releaseId: afterId,
      fixedBase: fixed,
      modelSource: fixed + api,
      modelSourceSha256: digest(encode(afterConfig)),
    });
    write('site/' + api, afterConfig);
    write('site/' + fixed + api, afterConfig);
    return spawnSync(
      process.execPath,
      [
        'scripts/report-upstream-sync.mjs',
        ...['preparation.json', 'before', 'after', 'site'].map((part) => join(root, part)),
      ],
      { encoding: 'utf8' },
    );
  }
  const successful = publish('p * 12');
  assert.equal(successful.status, 0, successful.stderr);
  assert.deepEqual(JSON.parse(successful.stdout), {
    candidate,
    upstream,
    business,
    candidateId: afterId,
    priceDiff: { added: 0, changed: 1, removed: 0 },
    models: { before: 7, after: 8 },
    officialKeys: 1,
    priceChanges: [{ nativeKey: 'remote', type: 'changed' }],
    omittedPriceChanges: 0,
  });
  const overwritten = publish('p * 99');
  assert.equal(overwritten.status, 1);
  assert.match(overwritten.stderr, /Selected official price changed: local/);
});
