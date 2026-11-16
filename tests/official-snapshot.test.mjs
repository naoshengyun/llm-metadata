import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialSnapshot } from '../scripts/build-official-cny.mjs';
const quote = {
  id: 'q',
  provider: 'domestic',
  model: 'm',
  priceList: 'standard',
  origin: 'domestic',
  currency: 'CNY',
  source: { url: 'https://example.org/synthetic', checkedAt: '2026-11-16' },
  required: ['input', 'output'],
  cost: { input: 20, output: 100 },
};
const reference = {
  reportedCount: 4,
  providedCount: 3,
  unexplainedDifference: 1,
  platforms: [
    { platform: 'domestic', protocol: 'openai_compatible', models: ['m'] },
    { platform: 'domestic-anthropic', protocol: 'anthropic', models: ['m', 'unknown'] },
    { platform: 'empty', protocol: 'x', models: [] },
  ],
};
const catalog = {
  checkedAt: '2026-11-16',
  synthetic: true,
  records: [quote],
  excludedQuotes: [],
  coverage: [
    { platform: 'domestic', model: 'm', status: 'ready', quoteIds: ['q'] },
    { platform: 'domestic-anthropic', model: 'm', status: 'ready', quoteIds: ['q'] },
  ],
};
test('S: official snapshot retains every reference triple and missing quote exclusions', () => {
  const r = buildOfficialSnapshot({
    sourceSha: 'a'.repeat(40),
    catalog,
    reference,
    selection: { m: 'q' },
  });
  assert.deepEqual(
    r.coverage.map((x) => [x.platform, x.protocol, x.model]),
    [
      ['domestic', 'openai_compatible', 'm'],
      ['domestic-anthropic', 'anthropic', 'm'],
      ['domestic-anthropic', 'anthropic', 'unknown'],
    ],
  );
  assert.equal(r.coverage[2].status, 'missing-source');
  assert.equal(r.artifact.manifest.complete, false);
  assert.equal(r.artifact.models.m.billing_expr, 'tier("standard", p * 20 + c * 100)');
  assert.deepEqual(r.artifact.data.reference, reference);
  assert.equal(r.status.application, 'not-applied');
});
test('S: declared ready coverage cannot override missing fields or rewrite reference identity', () => {
  const r = buildOfficialSnapshot({
    sourceSha: 'a'.repeat(40),
    catalog: {
      ...catalog,
      records: [{ ...quote, cost: { input: 20 } }],
      coverage: [{ ...catalog.coverage[0], protocol: 'fake', rowId: 'fake' }],
    },
    reference,
    selection: { m: 'q' },
  });
  assert.equal(r.coverage[0].status, 'incomplete');
  assert.equal(r.coverage[0].rowId, 'R001');
  assert.equal(r.coverage[0].protocol, 'openai_compatible');
  assert.deepEqual(r.artifact.models, {});
});
test('S: separately observed optional tool fees remain explicit exclusions, not silently included', () => {
  const raw = {
    provider: 'domestic',
    currency: 'CNY',
    unit: 'per_thousand_calls',
    fees: { search: 3 },
    source: 'https://example.org/synthetic-tools',
  };
  const r = buildOfficialSnapshot({
    sourceSha: 'a'.repeat(40),
    catalog: { ...catalog, optionalToolFees: [raw] },
    reference,
    selection: { m: 'q' },
  });
  assert.ok(
    r.artifact.exclusions.some(
      (x) =>
        x.kind === 'optional-tool-fees' && x.raw.fees.search === 3 && x.status === 'not-selected',
    ),
  );
  assert.deepEqual(r.artifact.tools, {});
});

test('S: maintained first-party snapshot keeps original CNY, single USD conversion and direct-image output meter', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = async (name) =>
    JSON.parse(await readFile(new URL('../data/cny/' + name, import.meta.url), 'utf8'));
  const catalog = await read('official-catalog.json'),
    reference = await read('coverage-reference.json');
  const selection = (await read('proposed-selection.json')).selection;
  const r = buildOfficialSnapshot({ sourceSha: 'a'.repeat(40), catalog, reference, selection });
  assert.equal(r.coverage.length, 136);
  assert.deepEqual(
    r.coverage.map((x) => [x.platform, x.protocol, x.model]),
    reference.platforms.flatMap((p) => p.models.map((model) => [p.platform, p.protocol, model])),
  );
  assert.deepEqual(
    r.diagnostics.filter((d) => d.status !== 'ready'),
    [],
  );
  // Original Kimi China /chat table: 20/100/2, 5m write20 and1h write40 CNY/M.
  assert.equal(
    r.artifact.models['kimi-k3'].billing_expr,
    'tier("standard", p * 20 + cr * 2 + cc * 20 + cc1h * 40 + c * 100)',
  );
  // OpenAI Standard raw USD2/10/M -> CNY14/70; >272000 full-request high band.
  assert.match(r.artifact.models['gpt-6.1-sol'].billing_expr, /len <= 272000/);
  assert.match(r.artifact.models['gpt-6.1-sol'].billing_expr, /p \* 14.*c \* 70/);
  assert.match(r.artifact.models['gpt-6.1-sol'].billing_expr, /p \* 28.*c \* 105/);
  // Direct Images API exposes image output_tokens via c, with no cache discount.
  assert.equal(
    r.artifact.models['gpt-image-2'].billing_expr,
    'tier("standard", p * 35 + img * 56 + c * 210)',
  );
  assert.equal(r.artifact.tools.search_std, 10);
  assert.equal(r.artifact.manifest.complete, false);
});
