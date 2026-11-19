import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkOfficialPrices } from '../scripts/check-official-cny.mjs';
import { adapter } from '../scripts/official-sources/alibaba-singapore-cards.mjs';

test('Singapore Qwen cards keep regional USD, tier rules and cache identities', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'cny-bailian-singapore-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const baseline = join(directory, 'baseline');
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', baseline]);

  const attemptedAt = '2026-11-19T10:30:00Z';
  const run = (change = (body) => body) =>
    checkOfficialPrices({
      baseline,
      adapters: adapter,
      attemptedAt,
      getResponse: async ({ id, url }) => {
        const [, supplement] = id.split('--');
        const name = supplement ? 'bailian-sg-' + supplement : id;
        const bytes = readFileSync('tests/fixtures/official-check/' + name + '-2026-11-19.gz');
        return {
          url,
          body: Buffer.from(change(gunzipSync(bytes).toString('utf8'), id)),
          obtainedAt: attemptedAt,
        };
      },
    });
  const original = await run();
  const records = original.results.filter(({ sourceId }) => sourceId?.startsWith('bailian-sg-'));
  assert.equal(records.length, 19);
  assert.equal(new Set(records.map(({ nativeKey }) => nativeKey)).size, 12);
  assert.ok(records.every(({ status, selected }) => status === 'unchanged' && !selected));
  const originalQuote = (model, mode) =>
    records.find(
      ({ id }) => id === 'dashscope--' + model + '--sg-international-online-original-' + mode,
    );
  const plus = originalQuote('qwen-plus', 'explicit');
  assert.equal(plus.observed.sourcePrice.reasoning, 4);
  assert.equal(plus.observed.cnyCost.reasoning, 28);
  assert.deepEqual(plus.observed.sourcePrice.tiers[0], {
    tier: { size: 256000 },
    input: 1.2,
    output: 3.6,
    cache_read: 0.12,
    cache_write: 1.5,
    reasoning: 12,
  });
  assert.equal(plus.observed.conditions.cacheWriteTtlSeconds, 300);
  assert.deepEqual(plus.observed.conditions.thinkingToggle, {
    param: 'enable_thinking',
    value: true,
    default: false,
  });
  assert.equal(originalQuote('qwen-max', 'implicit').observed.sourcePrice.cache_read, 0.32);
  assert.equal(originalQuote('qwen3.6-flash', 'implicit'), undefined);
  const coder = originalQuote('qwen3-coder-flash', 'implicit');
  assert.deepEqual(
    coder.observed.sourcePrice.tiers.map(({ tier }) => tier.size),
    [32000, 128000, 256000],
  );

  const selection = JSON.parse(readFileSync(join(baseline, 'selection.json')));
  for (const id of new Set(records.map(({ nativeKey }) => nativeKey))) {
    assert.match(selection[id], /--cn-beijing-online-original-/);
  }

  await t.test('reports a changed Singapore cache fee in source USD', async () => {
    const changed = await run(singaporeFlash((region) => replace(region, '>0.038<', '>0.039<')));
    const change = changed.changes.find(
      ({ id }) => id === originalQuote('qwen3.7-flash', 'explicit').id,
    );
    assert.equal(change.status, 'changed');
    assert.equal(change.selected, false);
    assert.equal(change.observed.sourcePrice.cache_write, 0.039);
    assert.equal(change.observed.cnyCost.cache_write, 0.273);
  });

  const invalid = [
    [
      'unknown online charge',
      singaporeFlash((region) =>
        replace(
          region,
          '</tbody>',
          '<tr><td>Cache storage</td><td>0.5</td><td>Per hour</td></tr></tbody>',
        ),
      ),
    ],
    [
      'a tier boundary gap',
      singaporeFlash((region) => replace(region, '32k<Input<=256k', '33k<Input<=256k')),
    ],
    [
      'an unrecognized future rollout',
      (body, id) =>
        id === 'bailian-sg-qwen3-7-flash'
          ? replace(
              body,
              'for promotional offers.\n',
              'for promotional offers.\nEffective December 1, 2026 at 00:00 UTC+08.\n',
            )
          : body,
    ],
    [
      'an implicit cache creation premium',
      (body, id) =>
        id === 'bailian-sg-qwen3-7-flash--cache'
          ? replace(
              body,
              '100% of the standard input token price',
              '150% of the standard input token price',
            )
          : body,
    ],
  ];
  for (const [name, mutate] of invalid) {
    await t.test('rejects ' + name, async () => {
      const report = await run(mutate);
      const rows = report.results.filter(({ sourceId }) => sourceId === 'bailian-sg-qwen3-7-flash');
      assert.deepEqual(
        rows.map(({ status }) => status),
        ['failed', 'failed'],
      );
      assert.deepEqual(report.changes, []);
    });
  }
});

function replace(body, before, after) {
  assert.ok(body.includes(before), before);
  return body.replace(before, after);
}

function singaporeFlash(change) {
  return (body, id) => {
    if (id !== 'bailian-sg-qwen3-7-flash') return body;
    const start = body.indexOf('## Pricing ');
    assert.ok(start >= 0);
    const pricing = body.slice(start);
    const tab = pricing.match(/<Tab title="Singapore">\s*Scope: International[^]*?<\/Tab>/)[0];
    return body.slice(0, start) + pricing.replace(tab, change(tab));
  };
}
