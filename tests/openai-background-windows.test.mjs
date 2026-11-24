import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { backgroundEvidence, openAiBackgroundRows } from '../scripts/openai-background-matrix.mjs';

const expectedSource = {
  ...backgroundEvidence.backgroundGuide,
  supplemental: [backgroundEvidence.pricing, backgroundEvidence.flexGuide],
};
const usages = ['input', 'output', 'cache_read', 'cache_write', 'cache_write_12h'];

function assertBackgroundMatrix(official) {
  const expected = openAiBackgroundRows();
  assert.equal(expected.length, 8);
  assert.deepEqual(
    [...new Set(expected.map((row) => row.model))],
    ['gpt-6.2-astra', 'gpt-6.2-sol', 'gpt-6.1-terra', 'gpt-6-luna'],
  );
  for (const row of expected) {
    const record = official.excludedQuotes.find(({ id }) => id === row.id);
    assert.ok(record, `Missing ${row.model} background ${row.completionWindow}`);
    const base = official.records.find(({ id }) => id === row.baseQuoteId);
    assert.ok(base, `Missing original Standard base ${row.baseQuoteId}`);
    for (const [index, usage] of usages.entries()) {
      assert.equal(base.cost[usage], row.short[index], `${row.model} short ${usage}`);
      assert.equal(base.cost.tiers[0][usage], row.long[index], `${row.model} long ${usage}`);
    }
    assert.equal(record.provider, 'openai');
    assert.equal(record.officialModel, row.model);
    assert.equal(record.priceList, row.priceList);
    assert.doesNotMatch(record.priceList, /Flex|Batch/);
    assert.equal(record.priceRole, 'background-reference');
    assert.equal(record.completionWindow, row.completionWindow);
    assert.equal(record.baseQuoteId, row.baseQuoteId);
    assert.deepEqual(record.baseCost, base.cost);
    assert.deepEqual(record.baseSource, backgroundEvidence.pricing);
    assert.equal(record.endpoint, 'https://api.openai.com/v1');
    assert.equal(record.officialRegion, 'global');
    assert.equal(record.currency, 'USD');
    assert.equal(record.unit, 'per_million_tokens');
    assert.equal(record.status, 'incomplete');
    assert.deepEqual(record.display, {
      hidden: true,
      reason: 'user-hidden-standard-background-reference',
    });
    assert.equal(record.displayWithoutRates, undefined);
    assert.equal(record.reason, 'background-completion-window-meter-specific-rates-unverified');
    assert.deepEqual(record.conditions, row.conditions);
    assert.deepEqual(record.source, expectedSource);
    for (const field of ['cost', 'candidateCost', 'fees', 'rawFees', 'raw'])
      assert.equal(record[field], undefined, `${row.id} must not contain guessed ${field}`);
  }
}

function buildCandidate(t) {
  const directory = mkdtempSync(join(tmpdir(), 'openai-background-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'candidate');
  execFileSync(process.execPath, ['scripts/build-unified-cny.mjs', output], { encoding: 'utf8' });
  const read = (name) => JSON.parse(readFileSync(join(output, name), 'utf8'));
  read.bytes = (name) => readFileSync(join(output, name));
  return read;
}

test('official background evidence covers all four models without guessing five rate columns', () => {
  const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
  assertBackgroundMatrix(official);

  const missingWindow = structuredClone(official);
  missingWindow.excludedQuotes = missingWindow.excludedQuotes.filter(
    ({ id }) => id !== 'openai-gpt-6.2-sol-standard-background-2h-global-reference',
  );
  assert.throws(() => assertBackgroundMatrix(missingWindow), /Missing gpt-6\.2-sol background 2h/);

  const misplacedFlex = structuredClone(official);
  misplacedFlex.excludedQuotes.find(
    ({ id }) => id === 'openai-gpt-6.2-sol-standard-background-2h-global-reference',
  ).priceList = 'OpenAI API / Flex / global / background 2h';
  assert.throws(() => assertBackgroundMatrix(misplacedFlex), /Flex|Batch/);

  const guessedRates = structuredClone(official);
  guessedRates.excludedQuotes.find(
    ({ id }) => id === 'openai-gpt-6.2-sol-standard-background-2h-global-reference',
  ).cost = { input: 1.4 };
  assert.throws(() => assertBackgroundMatrix(guessedRates), /must not contain guessed cost/);

  const missingCacheCondition = structuredClone(official);
  delete missingCacheCondition.excludedQuotes.find(
    ({ id }) => id === 'openai-gpt-6.2-sol-standard-background-2h-global-reference',
  ).conditions.cacheReuse;
  assert.throws(() => assertBackgroundMatrix(missingCacheCondition), /cacheReuse/);
});

test('all eight evidence records stay out of public display without changing native pricing', (t) => {
  const read = buildCandidate(t);
  const catalog = read('api/all.json');
  const coverage = read('display-coverage.json');
  for (const row of openAiBackgroundRows()) {
    const quoteId = `reviewed-reference:${row.id}`;
    const view = catalog.openai.models[row.model].pricing_view;
    const quotes = view.groups.flatMap(({ quotes }) => quotes);
    assert.equal(quotes.find(({ quoteId: id }) => id === quoteId), undefined, quoteId);
    assert.equal(
      quotes.some((quote) => quote.originalQuote?.priceRole === 'background-reference'),
      false,
    );
    assert.equal(JSON.stringify(view.summary).includes('background'), false);
    const selected = quotes.find(({ quoteId: id }) => id === row.baseQuoteId);
    assert.equal(selected.selected, true);
    assert.equal(selected.syncable, true);
    for (const prefix of ['cost', 'cost:tier-0'])
      for (const usage of usages)
        assert.ok(
          selected.displayRows.some((row) => row.rowId === `${prefix}:${usage}`),
          `${row.model} must retain ${prefix}:${usage}`,
        );
    const ledger = coverage.sourceRecords.find(
      (record) => record.sourceRecordId === quoteId,
    );
    assert.equal(ledger.disposition, 'not-displayed');
    assert.deepEqual(ledger.locations, []);
    assert.equal(ledger.notDisplayedReason, 'user-hidden-standard-background-reference');
  }
  assert.equal(Object.keys(read('api/newapi/ratio_config.json').data.billing_expr).length, 210);
});
