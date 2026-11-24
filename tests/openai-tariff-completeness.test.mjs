import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const fixture = readFileSync('tests/fixtures/openai-pricing-2026-11-24.md', 'utf8');
const source = {
  url: /<!-- source-url: (.+) -->/.exec(fixture)?.[1],
  sha256: /<!-- response-sha256: (.+) -->/.exec(fixture)?.[1],
  checkedAt: /<!-- checked-at: (.+) -->/.exec(fixture)?.[1],
  supplemental: [
    {
      url: /<!-- cache-guide-url: (.+) -->/.exec(fixture)?.[1],
      sha256: /<!-- cache-guide-sha256: (.+) -->/.exec(fixture)?.[1],
      checkedAt: '2026-11-24',
    },
  ],
};
assert.deepEqual(source, {
  url: 'https://developers.openai.com/api/docs/pricing.md',
  sha256: '88f7825ffddb006fefea4d3838831bd3deaed6f72df6914ad79aefa021d51355',
  checkedAt: '2026-11-24',
  supplemental: [
    {
      url: 'https://developers.openai.com/api/docs/guides/prompt-caching.md',
      sha256: '41fd5ad72dc74045ffb0fbe33e8213a879cc018a473b1e022b7be8fa04057625',
      checkedAt: '2026-11-24',
    },
  ],
});
assert.match(
  fixture,
  /For GPT-5\.6 and later, cache writes cost 1\.25×[\s\S]*In the Responses API,[\s\S]*12-hour minimum lifetime/,
);

// Keep this extraction independent from the browser-side parser as a cross-check.
const usages = ['input', 'output', 'cache_read', 'cache_write', 'cache_write_12h'];
const sectionIdentity = {
  Batch: { service: 'Batch', qualifier: '', priceRole: 'service-reference' },
  Fast: { service: 'Fast', qualifier: '', priceRole: 'service-reference' },
  'Ultrafast promotion': {
    service: 'Ultrafast',
    qualifier: 'promotion',
    priceRole: 'promotion-reference',
  },
  'Ultrafast list': { service: 'Ultrafast', qualifier: 'list', priceRole: 'official-list' },
};

function officialRows() {
  const rows = [];
  for (const [heading, identity] of Object.entries(sectionIdentity)) {
    const start = fixture.indexOf(`### ${heading} pricing data`);
    assert.ok(start >= 0, heading);
    const next = fixture.indexOf('\n### ', start + 4);
    const body = fixture.slice(start, next < 0 ? fixture.length : next);
    for (const line of body.split('\n')) {
      if (!/^\| gpt-6\.2-(?:astra|sol) \|/.test(line)) continue;
      const cells = line.split('|').map((cell) => cell.trim());
      const amounts = cells.slice(2, 12).map((value) => Number(value.replace(/[$,]/g, '')));
      const cost = Object.fromEntries(usages.map((usage, index) => [usage, amounts[index]]));
      cost.tiers = [
        {
          tier: { size: 272000, type: 'input' },
          ...Object.fromEntries(usages.map((usage, index) => [usage, amounts[index + 5]])),
        },
      ];
      const model = cells[1];
      rows.push({
        id: `openai-${model}-${identity.service.toLowerCase()}${identity.qualifier ? `-${identity.qualifier}` : ''}-global-reference`,
        officialModel: model,
        priceList: `OpenAI API / ${identity.service} / global${identity.qualifier ? ` / ${identity.qualifier}` : ''}`,
        priceRole: identity.priceRole,
        cost,
      });
    }
  }
  assert.equal(rows.length, 8);
  const flexStart = fixture.indexOf('### Flex pricing data');
  const flexEnd = fixture.indexOf('\n### ', flexStart + 4);
  assert.doesNotMatch(fixture.slice(flexStart, flexEnd), /gpt-6\.2-(?:astra|sol)/);
  return rows;
}

function assertOfficialMatrix(catalog) {
  for (const expected of officialRows()) {
    const actual = catalog.excludedQuotes.find(({ id }) => id === expected.id);
    assert.ok(actual, `Missing ${expected.officialModel} ${expected.priceList}`);
    assert.equal(actual.provider, 'openai');
    assert.equal(actual.officialModel, expected.officialModel);
    assert.equal(actual.priceList, expected.priceList);
    assert.equal(actual.priceRole, expected.priceRole);
    assert.equal(actual.endpoint, 'https://api.openai.com/v1');
    assert.equal(actual.officialRegion, 'global');
    assert.equal(actual.currency, 'USD');
    assert.equal(actual.unit, 'per_million_tokens');
    assert.deepEqual(actual.cost, expected.cost);
    assert.deepEqual(actual.source, source);
    assert.equal(actual.effectiveAt, undefined, 'List prices are not deferred base prices');
    assert.equal(actual.status, 'reference-only');
    assert.deepEqual(actual.feeDeclarations, [
      { field: 'cache_write', retention: '30m' },
      { field: 'cache_write_12h', condition: 'Responses API' },
    ]);
    if (expected.priceRole === 'official-list')
      assert.deepEqual(actual.conditions, {
        listChargingStarts: '2027-03-01T00:00:00-08:00',
      });
    if (expected.priceRole === 'promotion-reference')
      assert.deepEqual(actual.conditions, {
        promotionThrough: '2027-02-28T23:59:59-08:00',
      });
  }
  assert.equal(
    catalog.excludedQuotes.filter(
      (quote) =>
        ['gpt-6.2-astra', 'gpt-6.2-sol'].includes(quote.officialModel) &&
        quote.priceList === 'Flex',
    ).length,
    0,
    'Flex is N/A for GPT-6.2 Astra/Sol and must not be invented',
  );
}

function buildCandidate(t, editOfficial) {
  const directory = mkdtempSync(join(tmpdir(), 'openai-matrix-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'candidate');
  const args = [];
  if (editOfficial) {
    const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
    editOfficial(official);
    const path = join(directory, 'official.json');
    writeFileSync(path, JSON.stringify(official));
    args.push('data/cny/unified-policy.json', path);
  }
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', output, ...args], {
    encoding: 'utf8',
  });
  const read = (name) => JSON.parse(readFileSync(join(output, name), 'utf8'));
  read.bytes = (name) => readFileSync(join(output, name));
  return read;
}

test('independent OpenAI evidence rejects all eight omitted tariffs and cache-write omissions', () => {
  const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
  assertOfficialMatrix(official);

  const missingTier = structuredClone(official);
  missingTier.excludedQuotes = missingTier.excludedQuotes.filter(
    ({ id }) => id !== 'openai-gpt-6.2-astra-fast-global-reference',
  );
  assert.throws(() => assertOfficialMatrix(missingTier), /Missing gpt-6\.2-astra .*Fast/);

  const missingWrite = structuredClone(official);
  delete missingWrite.excludedQuotes.find(
    ({ id }) => id === 'openai-gpt-6.2-sol-batch-global-reference',
  ).cost.cache_write;
  assert.throws(() => assertOfficialMatrix(missingWrite), /cache_write/);
});

test('all eight references reach fixed display data without changing selection or native JSON', (t) => {
  const read = buildCandidate(t);
  const catalog = read('api/all.json');
  for (const expected of officialRows()) {
    const quoteId = `reviewed-reference:${expected.id}`;
    const quote = catalog.openai.models[expected.officialModel].pricing_view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ quoteId: id }) => id === quoteId);
    assert.ok(quote, quoteId);
    assert.equal(quote.selected, false);
    assert.equal(quote.syncable, false);
    assert.equal(quote.status, 'reference-only');
    assert.equal(quote.endpoint, 'https://api.openai.com/v1');
    assert.deepEqual(quote.sourcePrice, expected.cost);
    assert.equal(quote.cnyCost.input, expected.cost.input * 7);
    assert.equal(quote.cnyCost.tiers[0].cache_write_12h, expected.cost.tiers[0].cache_write_12h * 7);
    assert.equal(quote.displayRows.length, 10);
    for (const [band, prefix] of [
      [expected.cost, 'cost'],
      [expected.cost.tiers[0], 'cost:tier-0'],
    ])
      for (const usage of usages)
        assert.equal(
          quote.displayRows.find(({ rowId }) => rowId === `${prefix}:${usage}`)?.amount,
          band[usage],
          `${quoteId} ${prefix}:${usage}`,
        );
    assert.deepEqual(quote.displayFeeTerms, [
      { usageKey: 'cache_write', retentionMinutes: 30 },
      { usageKey: 'cache_write_12h', condition: 'Responses API' },
    ]);
  }
  for (const [model, id, input] of [
    ['gpt-6.2-astra', 'us-openai-gpt-6.2-astra-global-standard', 8],
    ['gpt-6.2-sol', 'us-openai-gpt-6.2-sol-global-standard', 2],
    ['gpt-6.1-sol', 'us-openai-gpt-6.1-sol-standard', 2],
  ]) {
    const view = catalog.openai.models[model].pricing_view;
    assert.equal(view.selectedQuoteId, id);
    const selected = view.groups.flatMap(({ quotes }) => quotes).find((quote) => quote.selected);
    assert.equal(selected.quoteId, id);
    assert.equal(selected.syncable, true);
    assert.equal(selected.sourcePrice.input, input);
    assert.equal(selected.cnyCost.input, input * 7);
  }
  assert.equal(
    createHash('sha256').update(read.bytes('api/newapi/ratio_config.json')).digest('hex'),
    '4ce3d8a4415534e3e44423b99d1d09cca0347793b188623dcd40c7ec821a6152',
  );
});

test('a genuinely future-dated original stays pending and never becomes syncable', (t) => {
  const read = buildCandidate(t, (official) => {
    official.excludedQuotes.find(
      ({ id }) => id === 'openai-gpt-6.2-sol-ultrafast-list-global-reference',
    ).effectiveAt = '2027-03-01T00:00:00-08:00';
  });
  const view = read('api/all.json').openai.models['gpt-6.2-sol'].pricing_view;
  const pending = view.groups
    .flatMap(({ quotes }) => quotes)
    .find(
      ({ quoteId }) =>
        quoteId === 'reviewed-reference:openai-gpt-6.2-sol-ultrafast-list-global-reference',
    );
  assert.equal(pending.status, 'pending-effective');
  assert.equal(pending.reason, 'official-price-not-yet-effective');
  assert.equal(pending.selected, false);
  assert.equal(pending.syncable, false);
  const selected = view.groups.flatMap(({ quotes }) => quotes).find((quote) => quote.selected);
  assert.equal(selected.quoteId, 'us-openai-gpt-6.2-sol-global-standard');
  assert.equal(selected.syncable, true);
});
