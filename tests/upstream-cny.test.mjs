import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptPrice, adaptCatalog, convertSheet } from '../scripts/upstream-cny.mjs';
import { makeSnapshot } from '../scripts/upstream-snapshot.mjs';
const read = (l) =>
  JSON.parse(readFileSync(new URL(`../data/upstream/b755761bf/${l}.json`, import.meta.url)));
test('all frozen upstream metadata and localized model/provider identities survive', () => {
  for (const l of ['en', 'zh', 'ja']) {
    const source = read(l),
      a = adaptCatalog(source);
    assert.equal(a.stats.providers, 50);
    assert.equal(a.stats.models, 616);
    for (const [id, p] of Object.entries(source)) {
      const { models, ...metadata } = p;
      const { models: out, ...outMetadata } = a.providers[id];
      assert.deepEqual(outMetadata, metadata);
      for (const [mid, m] of Object.entries(models)) {
        const { cost, ...rest } = m;
        const { cost: normalized, sourceCost, cnyPrice, ...after } = out[mid];
        assert.deepEqual(after, rest, `${l}/${id}/${mid}`);
        assert.deepEqual(sourceCost, cost);
      }
    }
  }
});
test('only monetary whitelist changes, nested tiers/windows retain thresholds/TTL/time/count', () => {
  const source = {
    input: 2,
    output: 10,
    tiers: [{ tier: { size: 272000, type: 'context' }, input: 4, output: 15 }],
    schedule: {
      timezone: 'UTC',
      windows: [
        {
          weekdays: [1, 2],
          hours: ['01:00-04:00'],
          input: 3,
          tiers: [{ tier: { size: 400000 }, input: 6 }],
        },
      ],
    },
    per_image: 0.2,
    unknown_number: 123,
  };
  const c = convertSheet(source, 7);
  assert.equal(c.input, 14);
  assert.equal(c.tiers[0].input, 28);
  assert.equal(c.schedule.windows[0].tiers[0].input, 42);
  assert.equal(c.per_image, 1.4);
  assert.deepEqual(c.tiers[0].tier, source.tiers[0].tier);
  assert.deepEqual(c.schedule.windows[0].weekdays, [1, 2]);
  assert.equal(c.unknown_number, 123);
  assert.equal(source.input, 2);
});
test('domestic USD estimate cannot become CNY, but explicit zero stays zero', () => {
  assert.equal(
    adaptPrice({ id: 'alibaba-cn', currency: 'CNY' }, { cost: { input: 0.02962, output: 0.1185 } })
      .reason,
    'missing-original-CNY',
  );
  const p = adaptPrice(
    { id: 'zhipuai' },
    { cost: { currency: 'CNY', input: 8, output: 28, cache_write: 0 } },
  );
  assert.equal(p.cost.cache_write, 0);
  assert.match(p.expr, /cc \* 0/);
  assert.equal(adaptPrice({ id: 'openai' }, { cost: undefined }).status, 'missing');
  assert.equal(adaptPrice({ id: 'openai' }, { cost: { input: 1 } }).reason, 'missing-output-price');
});
test('CNY alternate is preferred without USD inversion; original remains unmodified', () => {
  const original = read('en').deepseek.models['deepseek-v4-pro'];
  const p = adaptPrice({ id: 'deepseek' }, original);
  assert.equal(p.cost.input, 4.5);
  assert.equal(p.cost.schedule.windows[0].input, 9);
  assert.equal(original.cost.input, 0.66);
});
test('subscription and unsupported units never enter ordinary model expressions', () => {
  assert.equal(
    adaptPrice({ id: 'openai', subscription: true }, { cost: { input: 0, output: 0 } }).status,
    'subscription',
  );
  assert.equal(
    adaptPrice({ id: 'openai' }, { cost: { per_second_480p: 1 } }).status,
    'unsupported',
  );
  assert.equal(
    adaptPrice({ id: 'openai' }, { cost: { input: 1, output: 1, unknown_charge: 5 } }).status,
    'unsupported',
  );
});
test('domestic collision wins independently of international priority; missing domestic never falls back', () => {
  const source = {
    alibaba: {
      id: 'alibaba',
      billing: { priority: 99 },
      models: { same: { id: 'same', cost: { input: 1, output: 2 } } },
    },
    'alibaba-cn': {
      id: 'alibaba-cn',
      currency: 'CNY',
      models: { same: { id: 'same', cost: { currency: 'CNY', input: 2, output: 8 } } },
    },
  };
  let a = adaptCatalog(source);
  assert.equal(a.selected.same.providerId, 'alibaba-cn');
  assert.equal(
    a.config.data.billing_expr.same,
    a.providers['alibaba-cn'].models.same.cost.publication_expr,
  );
  assert.equal(a.providers.alibaba.models.same.cost.publication_expr, undefined);
  source['alibaba-cn'].models.same.cost = { input: 0.2, output: 0.8 };
  a = adaptCatalog(source);
  assert.equal(a.selected.same, undefined);
  assert.equal(a.config.data.billing_expr.same, undefined);
});
test('all eligible regional winners, every exclusion, and all locales bind one deterministic snapshot', () => {
  const s = makeSnapshot(),
    a = s.datasets.en;
  assert.equal(a.stats.apiModels, 294);
  for (const r of a.records) {
    const selected = a.selected[r.modelId]?.providerId === r.providerId;
    if (selected) assert.equal(r.status, 'eligible');
    else
      assert.ok(a.exclusions.some((x) => x.modelId === r.modelId && x.providerId === r.providerId));
  }
  assert.equal(a.records.length, Object.keys(a.selected).length + a.exclusions.length);
  for (const l of ['zh', 'ja']) assert.deepEqual(s.datasets[l].config, a.config);
  assert.equal(makeSnapshot().releaseId, s.releaseId);
});
test('unknown object/string charges and ambiguous domestic prices fail closed', () => {
  for (const charge of ['variable', { amount: 2 }])
    assert.equal(
      adaptPrice({ id: 'openai' }, { cost: { input: 1, output: 2, unknown_charge: charge } })
        .reason,
      'unknown-price-field:unknown_charge',
    );
  const source = Object.fromEntries(
    ['xiaomi', 'longcat'].map((id, i) => [
      id,
      {
        id,
        models: {
          collision: { id: 'collision', cost: { currency: 'CNY', input: i + 1, output: 3 } },
        },
      },
    ]),
  );
  const a = adaptCatalog(source);
  assert.equal(a.selected.collision, undefined);
  assert.ok(a.exclusions.every((r) => r.reason === 'ambiguous-regional-prices'));
});
test('native generator diagnostics describe normalized money as CNY, not dollars', () => {
  const p = adaptPrice({ id: 'perplexity' }, { cost: { input: 1, output: 8, reasoning: 3 } });
  assert.equal(p.status, 'unsupported');
  assert.match(p.reason, /CNY 21/);
  assert.match(p.reason, /CNY 56/);
  assert.doesNotMatch(p.reason, /\$/);
});
