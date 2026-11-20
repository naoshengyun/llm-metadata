import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../../scripts/check-official-cny.mjs';

const fixtures = new URL('../fixtures/official-check/', import.meta.url);
const captures = ['acceptance-2026-11-19', 'closeout-2026-11-19'].map((capture) =>
  JSON.parse(readFileSync(new URL(capture + '/responses.json', fixtures))),
);
const sha256 = (body) => createHash('sha256').update(body).digest('hex');
// Replay only the price set through #74 (a5df64501e8709ed536c051d66a2ff33a778aae6).
const replayInputs = new URL('replay-baseline-2026-11-19/', fixtures);
const upstream = 'data/upstream/24d3f35c';
const expectedRatio = '9dbd380de9c75eb7f18a1b4d930a6a4fe8510093546726eab50b3fba27f6f612';
const adaptersDirectory = new URL('../../scripts/official-sources/', import.meta.url);

function writeReplayInputs(directory) {
  return ['unified-policy', 'official-catalog', 'proposed-selection'].map((name) => {
    const path = join(directory, name + '.json');
    writeFileSync(path, gunzipSync(readFileSync(new URL(name + '.json.gz', replayInputs))));
    return path;
  });
}

async function capturedAdapters(manifest) {
  const primaryIds = Object.keys(manifest.responses)
    .filter((id) => !id.includes('--'))
    .sort();
  const modules = await Promise.all(
    readdirSync(adaptersDirectory)
      .filter((name) => name.endsWith('.mjs'))
      .map((name) => import(new URL(name, adaptersDirectory))),
  );
  const adapters = modules
    .flatMap(({ adapter }) => adapter)
    .filter(({ id }) => primaryIds.includes(id));
  assert.deepEqual(adapters.map(({ id }) => id).sort(), primaryIds);
  return adapters;
}

for (const manifest of captures) {
  test(
    'replays every selected price through #74 against the capture from ' + manifest.attemptedAt,
    async (t) => {
      const directory = mkdtempSync(join(tmpdir(), 'cny-acceptance-'));
      t.after(() => rmSync(directory, { recursive: true, force: true }));
      const baseline = join(directory, 'candidate');
      const [policyPath, catalogPath, selectionPath] = writeReplayInputs(directory);
      execFileSync(process.execPath, [
        'scripts/build-unified-cny.mjs',
        baseline,
        policyPath,
        catalogPath,
        selectionPath,
        upstream,
      ]);
      const seen = new Set();
      const result = await checkOfficialPrices({
        baseline,
        adapters: await capturedAdapters(manifest),
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
      const ratio = readFileSync(join(baseline, 'api/newapi/ratio_config.json'));
      assert.equal(sha256(ratio), expectedRatio);
      const { billing_expr } = JSON.parse(ratio).data;
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

      const policy = JSON.parse(readFileSync(policyPath));
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
    },
  );
}
