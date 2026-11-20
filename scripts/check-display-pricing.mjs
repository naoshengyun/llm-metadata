/** Browser assertions for the reviewed display contract. The caller serves a fixed candidate locally. */
import assert from 'node:assert/strict';

const messages = {
  en: {
    heading: 'Official tariffs',
    source: 'Source price',
    base: 'CNY base price',
    unit: 'Per million tokens',
    multi: 'Multiple billing units',
    cards: 'Card view',
    table: 'Table view',
  },
  zh: {
    heading: '官方价目',
    source: '源价格',
    base: 'CNY 基础价',
    unit: '每百万 Token',
    multi: '多种计费单位',
    cards: '卡片视图',
    table: '表格视图',
  },
  ja: {
    heading: '公式料金表',
    source: '元の料金',
    base: 'CNY 基準価格',
    unit: '100 万トークンあたり',
    multi: '複数の課金単位',
    cards: 'カード表示',
    table: 'テーブル表示',
  },
};

const sampleModels = [
  ['openai', 'gpt-6.1-sol'],
  ['anthropic', 'claude-haiku-5-5'],
  ['volcengine', 'doubao-seedance-2-5-260628'],
  ['alibaba-cn', 'wan3.0-video'],
  ['alibaba-cn', 'wan3.0-video-prime'],
  ['alibaba', 'wan3.0-video'],
  ['minimax-cn', 'MiniMax-H3'],
  ['minimax-cn', 'image-01-live'],
  ['mistral', 'voxtral-small-2507'],
  ['google', 'gemini-3.8-flash'],
  ['xai', 'grok-4.20-0309-non-reasoning'],
];
const keyFor = (providerId, modelId) => JSON.stringify([providerId, modelId]);
const quoteAt = (page, id) => page.locator(`[data-quote-id="${id}"]`);

async function assertNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => {
    const { scrollWidth, clientWidth } = document.documentElement;
    return { scrollWidth, clientWidth };
  });
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, JSON.stringify(dimensions));
}

async function compareVisibleQuotes(page, view, labels) {
  const expected = view.groups.flatMap(({ groupId, quotes }) =>
    quotes.map((quote) => ({ groupId, quote })),
  );
  if (expected.length)
    await page.getByRole('heading', { name: labels.heading, exact: true }).waitFor();
  const actual = page.locator('[data-quote-id]');
  assert.equal(await actual.count(), expected.length);
  if (view.selectedQuoteId)
    assert.equal(await actual.first().getAttribute('data-quote-id'), view.selectedQuoteId);
  let count = 0;
  for (const { groupId, quote } of expected) {
    const card = quoteAt(page, quote.quoteId);
    assert.equal(await card.getAttribute('data-pricing-group'), groupId);
    assert.equal(await card.getAttribute('data-syncable'), String(quote.syncable));
    assert.equal(await card.getAttribute('data-quote-status'), quote.status);
    const disclosure = card.locator('details').first();
    assert.equal(
      (await disclosure.getAttribute('open')) !== null,
      quote.originalCurrencyEligible !== false,
    );
    if (quote.originalCurrencyEligible === false)
      await disclosure.locator('summary').first().click();
    const rows = await card.locator('[data-pricing-row]').evaluateAll((entries) =>
      Object.fromEntries(
        entries.map((element) => [
          element.dataset.pricingRow,
          {
            amount: element.dataset.sourceAmount,
            currency: element.dataset.sourceCurrency,
            unit: element.dataset.unit,
            cny: element.dataset.cnyAmount,
            text: element.innerText,
            cells: [...element.cells].slice(0, 3).map((cell) => cell.innerText),
            visible: element.getClientRects().length > 0,
          },
        ]),
      ),
    );
    assert.equal(Object.keys(rows).length, quote.displayRows.length, quote.quoteId);
    for (const { rowId, amount, sourceValue, currency, unit, cnyAmount } of quote.displayRows) {
      const row = rows[rowId];
      assert.ok(row?.visible, quote.quoteId + ' ' + rowId);
      assert.equal(row.amount, String(amount ?? ''), rowId);
      assert.equal(row.currency, currency ?? '', rowId);
      assert.equal(row.unit, unit ?? '', rowId);
      assert.equal(row.cny, String(cnyAmount ?? ''), rowId);
      if (amount !== null || sourceValue)
        assert.ok(row.cells[1].includes(String(amount ?? sourceValue)), rowId);
      if (currency) assert.ok(row.cells[1].includes(currency), rowId);
      if (cnyAmount !== null) assert.ok(row.cells[2].includes('¥' + cnyAmount), rowId);
      if (unit) assert.ok(row.cells[0].includes('\n'), rowId);
      count += 1;
    }
    if (quote.displayRows.length && quote.originalCurrencyEligible !== false) {
      await card.getByRole('columnheader', { name: labels.source, exact: true }).first().waitFor();
      await card.getByRole('columnheader', { name: labels.base, exact: true }).first().waitFor();
    }
  }
  return count;
}

async function exactRepresentativePrices(page, locale, providerId, modelId, view) {
  const selected = view.selectedQuoteId ? quoteAt(page, view.selectedQuoteId) : null;
  const viewSummary = page.locator('[data-pricing-summary]').first();
  if (modelId === 'gpt-6.1-sol') {
    for (const name of ['Batch', 'Flex', 'Fast', 'Ultrafast']) {
      const reference = view.groups
        .flatMap(({ quotes }) => quotes)
        .find(({ priceList }) => priceList === name);
      const card = quoteAt(page, reference.quoteId);
      const rows = card.locator('[data-pricing-row]');
      assert.equal(await rows.count(), 10, name);
      assert.match(await card.innerText(), /Responses API/);
      assert.match(
        await card.locator('[data-pricing-row="cost:cache_write"]').innerText(),
        /30\s*(?:min|分钟|分)/,
      );
      assert.match(await rows.first().innerText(), /272000/);
    }
    assert.match(
      await selected.locator('[data-pricing-row="cost:input"]').innerText(),
      /\$2[\s\S]*¥14[\s\S]*272000/,
    );
    assert.match(
      await selected.locator('[data-pricing-row="cost:output"]').innerText(),
      /\$10[\s\S]*¥70/,
    );
    assert.match(
      await selected.locator('[data-pricing-row="cost:tier-0:input"]').innerText(),
      /272001/,
    );
  } else if (modelId === 'grok-4.20-0309-non-reasoning') {
    const low = await selected.locator('[data-pricing-row="cost:input"]').innerText();
    const high = await selected.locator('[data-pricing-row="cost:tier-0:input"]').innerText();
    assert.match(low, /199999/);
    assert.match(high, /200000/);
    assert.doesNotMatch(high, /200001/);
  } else if (modelId === 'claude-haiku-5-5') {
    assert.match(await selected.locator('[data-pricing-row="cost:input"]').innerText(), /100000/);
    assert.match(
      await selected.locator('[data-pricing-row="cost:tier-0:input"]').innerText(),
      /100001/,
    );
    assert.match(await selected.innerText(), /ordinary input plus cache reads and writes/);
    const all = view.groups.flatMap(({ quotes }) => quotes);
    const batch = quoteAt(page, all.find(({ priceList }) => priceList.startsWith('Batch')).quoteId);
    await batch.locator('[data-pricing-row="cost:cache_read"]').waitFor();
    await batch.locator('[data-pricing-row="cost:cache_write_1h"]').waitFor();
    assert.match(
      await batch.locator('[data-pricing-row="cost:cache_write"]').innerText(),
      /5\s*(?:min|分钟|分)/,
    );
    assert.match(
      await quoteAt(
        page,
        all.find(({ priceList }) => priceList.includes('inference_geo=us')).quoteId,
      )
        .locator('summary')
        .first()
        .innerText(),
      /inference_geo=us/,
    );
  } else if (modelId === 'doubao-seedance-2-5-260628') {
    assert.match(await viewSummary.innerText(), /¥42–¥77/);
    assert.doesNotMatch(await viewSummary.innerText(), /4K/);
    assert.deepEqual(
      await selected
        .locator('[data-pricing-row]')
        .evaluateAll((rows) => rows.map((row) => Number(row.dataset.cnyAmount))),
      [70, 42, 70, 42, 77, 46],
    );
    const held = page.locator('[data-quote-status="validation-held"]');
    const rows = held.locator('[data-pricing-row]');
    assert.deepEqual(
      await rows.evaluateAll((entries) =>
        entries.map((row) => [Number(row.dataset.sourceAmount), row.innerText.includes('4K')]),
      ),
      [
        [31, true],
        [19, true],
      ],
    );
    assert.match(
      await held.innerText(),
      /actual charged token usage is API usage.completion_tokens/,
    );
    assert.match(await held.innerText(), /Draft and final are two separately charged tasks/);
  } else if (modelId === 'wan3.0-video') {
    const card = page
      .locator('[data-quote-id]')
      .filter({
        hasText:
          providerId === 'alibaba-cn'
            ? 'cn-beijing-task-online-original'
            : 'sg-international-task-online-original',
      })
      .first();
    const row = card.locator('[data-pricing-row*="720P"]');
    assert.equal(await row.getAttribute('data-unit'), 'per_second');
    if (providerId === 'alibaba-cn') {
      assert.equal(await row.getAttribute('data-source-currency'), 'CNY');
      assert.equal(await row.getAttribute('data-source-amount'), '0.6');
      assert.match(await card.locator('[data-price-example="720P"]').innerText(), /¥9(?:\D|$)/);
    } else {
      assert.equal(await row.getAttribute('data-source-currency'), 'USD');
      assert.equal(await row.getAttribute('data-cny-amount'), '0.7');
    }
    await card.locator('[data-condition="failedTasksFree"]').waitFor();
  } else if (modelId === 'gemini-3.8-flash') {
    const labels = {
      en: ['Effective from', 'Valid through', 'Announced rate', 'Cache read'],
      zh: ['生效时间', '有效期截至', '已公布费率', '缓存读取'],
      ja: ['適用開始', '有効期限', '発表済み料金', 'キャッシュ読み取り'],
    };
    for (const [index, key] of ['starts', 'through', 'announcedPrice', 'cache_read'].entries()) {
      const node = selected.locator(`[data-condition="${key}"]`).first();
      assert.equal(await node.locator('span').first().innerText(), labels[locale][index]);
    }
  } else if (modelId === 'MiniMax-H3') {
    assert.match(await viewSummary.innerText(), new RegExp(messages[locale].multi));
    await selected.locator('[data-condition="freeQuantity"]').first().waitFor();
  } else if (modelId === 'image-01-live') {
    assert.equal(await viewSummary.getAttribute('data-pricing-summary'), 'fixed');
    assert.match(await viewSummary.innerText(), /¥0.025/);
  }
}

export async function checkDisplayPricing({
  page,
  goto,
  select,
  snapshot,
  catalog,
  coverage,
  locale,
}) {
  const labels = messages[locale];
  const models = (provider, model) => catalog[provider].models[model];
  const allCategories = new Set(coverage.models.flatMap(({ categories }) => categories));
  const samples = new Map();
  const include = (row) => samples.set(keyFor(row.providerId, row.modelId), row);
  for (const [providerId, modelId] of sampleModels) {
    const entry = coverage.models.find(
      (row) => row.providerId === providerId && row.modelId === modelId,
    );
    if (entry) include(entry);
  }
  for (const category of allCategories) {
    if ([...samples.values()].some((entry) => entry.categories.includes(category))) continue;
    const eligible = coverage.models.filter((entry) => entry.categories.includes(category));
    include(
      eligible.find((entry) =>
        models(entry.providerId, entry.modelId).pricing_view.groups.some(({ quotes }) =>
          quotes.some(({ displayRows }) => displayRows.length),
        ),
      ) ?? eligible[0],
    );
  }
  for (const { providerId, modelId } of samples.values()) {
    assert.ok(models(providerId, modelId).pricing_view);
  }

  // The focused list model exercises cards, expansion and navigation without a long initial grid.
  const seedance = 'doubao-seedance-2-5-260628';
  await goto(select('volcengine'));
  await page.getByRole('button', { name: labels.cards, exact: true }).click();
  const card = page
    .locator('article')
    .filter({ has: page.locator('[data-pricing-summary="range"]') })
    .filter({ hasText: seedance });
  assert.match(await card.locator('[data-pricing-summary]').first().innerText(), /¥42–¥77/);
  await assertNoPageOverflow(page);
  await snapshot(page, locale + '-structured-card');
  await page.getByRole('button', { name: labels.table, exact: true }).click();
  const row = page
    .getByRole('row')
    .filter({ has: page.locator('[data-pricing-summary="range"]') })
    .filter({ hasText: seedance })
    .first();
  assert.match(await row.locator('[data-pricing-summary]').innerText(), /¥42–¥77/);
  await row.locator('button[aria-expanded="false"]').click();
  const expanded = quoteAt(page, models('volcengine', seedance).pricing_view.selectedQuoteId);
  await expanded.waitFor();
  await assertNoPageOverflow(page);
  await expanded
    .locator('[data-pricing-row]')
    .first()
    .evaluate((row) =>
      row.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }),
    );
  await snapshot(page, locale + '-structured-table');

  const evidence = {};
  let visibleRows = 0;
  for (const { providerId, modelId, categories } of samples.values()) {
    await goto(select(providerId, modelId));
    const view = models(providerId, modelId).pricing_view;
    await page
      .locator(`[data-pricing-provider="${providerId}"][data-pricing-model="${modelId}"]`)
      .first()
      .waitFor();
    const renderedRows = await compareVisibleQuotes(page, view, labels);
    visibleRows += renderedRows;
    await exactRepresentativePrices(page, locale, providerId, modelId, view);
    await assertNoPageOverflow(page);
    for (const category of categories)
      evidence[category] ??= {
        providerId,
        modelId,
        groups: view.groups.map(({ groupId }) => groupId),
        renderedRows,
      };
    if (
      sampleModels
        .slice(0, 4)
        .some(([provider, model]) => provider === providerId && model === modelId)
    ) {
      await page
        .getByRole('heading', { name: labels.heading, exact: true })
        .scrollIntoViewIfNeeded();
      await snapshot(page, locale + '-' + modelId);
    }
  }
  assert.deepEqual(Object.keys(evidence).sort(), [...allCategories].sort());
  return { visibleRows, evidence };
}
