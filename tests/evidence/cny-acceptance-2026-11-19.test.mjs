import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../../scripts/check-official-cny.mjs';

const fixtures = new URL('../fixtures/official-check/', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('acceptance-2026-11-19/responses.json', fixtures)),
);
const sha256 = (body) => createHash('sha256').update(body).digest('hex');

test('the fixed acceptance responses account for every selected New API price', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'cny-acceptance-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const baseline = join(directory, 'candidate');
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);
  const seen = new Set();
  const result = await checkOfficialPrices({
    baseline,
    attemptedAt: manifest.attemptedAt,
    getResponse: async ({ id, url }) => {
      const response = manifest.responses[id];
      assert.ok(response, id);
      assert.equal(response.requestedUrl, url, id);
      const body = gunzipSync(readFileSync(new URL(response.fixture, fixtures)));
      assert.equal(sha256(body), response.sha256, id);
      seen.add(id);
      return {
        body,
        url: response.finalUrl,
        status: response.status,
        obtainedAt: response.obtainedAt,
      };
    },
  });
  assert.deepEqual([...seen].sort(), Object.keys(manifest.responses).sort());
  const { billing_expr } = JSON.parse(
    readFileSync(join(baseline, 'api/newapi/ratio_config.json')),
  ).data;
  const selected = result.results.filter(({ selected }) => selected);
  assert.deepEqual(
    selected.map(({ nativeKey }) => nativeKey).sort(),
    Object.keys(billing_expr).sort(),
  );
  const pending = selected.filter(({ status }) => status !== 'unchanged');
  assert.deepEqual(
    pending.map(({ nativeKey, status, observed }) => ({
      nativeKey,
      status,
      effectiveAt: observed?.effectiveAt,
    })),
    [
      {
        nativeKey: 'sakana-namazu',
        status: 'future-effective',
        effectiveAt: '2026-12-01T10:00:00+09:00',
      },
    ],
  );

  const policy = JSON.parse(readFileSync('data/cny/unified-policy.json'));
  for (const [model, file, notice] of [
    ['gemini-2.5-pro', 'google-lifecycle-2026-11-19.gz', /`gemini-2\.5-pro` is deprecated/],
    [
      'gpt-image-1.5',
      'openai-lifecycle-2026-11-19.gz',
      /Dec 1, 2026[^\n]*`gpt-image-1\.5`[^\n]*Deprecated/,
    ],
    [
      'chatgpt-image-latest',
      'openai-lifecycle-2026-11-19.gz',
      /Dec 1, 2026[^\n]*`chatgpt-image-latest`[^\n]*Deprecated/,
    ],
  ]) {
    const body = gunzipSync(readFileSync(new URL(file, fixtures)));
    const event = policy.lifecycle[model].at(-1);
    assert.equal(sha256(body), event.evidence.sha256, model);
    assert.match(body.toString('utf8'), notice);
    assert.ok(!Object.hasOwn(billing_expr, model));
    assert.equal(result.results.find(({ id }) => id === event.quoteId)?.status, 'deprecated');
  }
});
