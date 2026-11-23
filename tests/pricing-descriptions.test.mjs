import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = (source) =>
  'data:text/javascript;base64,' +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  ).toString('base64');
const labels = moduleUrl(readFileSync('web/src/lib/pricing-display-labels.ts', 'utf8'));
const { priceDescription } = await import(
  moduleUrl(
    readFileSync('web/src/lib/pricing-description.ts', 'utf8').replace(
      './pricing-display-labels',
      labels,
    ),
  )
);

test('every current official description has a distinct readable summary in all three languages', () => {
  const catalog = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
  const descriptions = new Set();
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.description === 'string') descriptions.add(value.description);
    for (const child of Object.values(value)) collect(child);
  };
  collect(catalog);
  assert.ok(descriptions.size >= 31);
  for (const description of descriptions) {
    const summaries = ['en', 'zh', 'ja'].map((locale) => priceDescription(description, locale));
    assert.equal(new Set(summaries).size, 3, description);
    for (const summary of summaries) {
      assert.notEqual(summary, description);
      assert.doesNotMatch(
        summary,
        /usage[.]|cache_write|fixed schema|unconditional fallback|img_o|optionalToolFees/,
      );
    }
  }
});

test('unreviewed description changes retain their conditions until a new summary is reviewed', () => {
  const description = 'A newly published minimum charge applies.';
  for (const locale of ['en', 'zh', 'ja'])
    assert.equal(priceDescription(description, locale), description);
});
