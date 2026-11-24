/** Browser assertions for the reviewed display contract. The caller serves a fixed candidate locally. */
import assert from 'node:assert/strict';
import { openAiOfficialRows } from './openai-official-matrix.mjs';
import { openAiBackgroundRows } from './openai-background-matrix.mjs';

const messages = {
  en: {
    heading: 'Official tariffs',
    source: 'Source price',
    base: 'CNY base price',
    unit: 'Per million tokens',
    multi: 'Multiple billing units',
    cards: 'Card view',
    table: 'Table view',
    wholeRequest: 'Rates apply to the entire request',
  },
  zh: {
    heading: '官方价目',
    source: '源价格',
    base: 'CNY 基础价',
    unit: '每百万 Token',
    multi: '多种计费单位',
    cards: '卡片视图',
    table: '表格视图',
    wholeRequest: '整次请求按该档计费',
  },
  ja: {
    heading: '公式料金表',
    source: '元の料金',
    base: 'CNY 基準価格',
    unit: '100 万トークンあたり',
    multi: '複数の課金単位',
    cards: 'カード表示',
    table: 'テーブル表示',
    wholeRequest: 'リクエスト全体に適用',
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
  ['zhipuai', 'glm-4.7'],
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

const nestedConditionKeys = (value) => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nestedConditionKeys);
  return Object.entries(value).flatMap(([key, nested]) => {
    if (nested && typeof nested === 'object' && Object.keys(nested).length === 0) return [];
    return [key, ...nestedConditionKeys(nested)];
  });
};

const rowOnlyConditionKeys = new Set([
  'cacheHitRenewsTtl',
  'cacheTtl',
  'cacheWriteTtlSeconds',
  'cacheWrite',
  'cacheWriteIncludedInInput',
  'durationSeconds',
  'condition',
  'tierName',
  'when',
  'resolution',
  'amount',
  'currency',
  'unit',
  'referenceFee',
  'maxInput',
  'maxOutput',
  'minOutput',
  'inputBands',
  'inputOutputBands',
]);

async function compareVisibleQuotes(page, view, labels, locale) {
  const expected = view.groups.flatMap(({ groupId, quotes }) =>
    quotes.map((quote) => ({ groupId, quote })),
  );
  if (expected.length)
    await page.getByRole('heading', { name: labels.heading, exact: true }).waitFor();
  const actual = page.locator('[data-quote-id]');
  const actualQuoteIds = await actual.evaluateAll(
    (entries) => [...new Set(entries.map((entry) => entry.dataset.quoteId))].sort(),
  );
  assert.deepEqual(actualQuoteIds, expected.map(({ quote }) => quote.quoteId).sort());
  if (view.selectedQuoteId) {
    const selected = quoteAt(page, view.selectedQuoteId).first();
    const scope = await selected.getAttribute('data-pricing-scope');
    assert.ok(scope);
    assert.equal(
      await page.locator(`[data-pricing-scope="${scope}"][data-quote-id]`).first().getAttribute('data-quote-id'),
      view.selectedQuoteId,
    );
  }
  let count = 0;
  for (const { groupId, quote } of expected) {
    const cards = quoteAt(page, quote.quoteId);
    assert.ok((await cards.count()) >= 1, quote.quoteId);
    for (const card of await cards.all()) {
      assert.equal(await card.getAttribute('data-pricing-group'), groupId);
      assert.equal(await card.getAttribute('data-syncable'), String(quote.syncable));
      assert.equal(await card.getAttribute('data-quote-status'), quote.status);
      assert.ok(await card.getAttribute('data-service-entry'), quote.quoteId);
      const disclosure = card.locator('details').first();
      assert.equal((await disclosure.getAttribute('open')) !== null, true, quote.quoteId);
    }
    const rendered = await cards.locator('[data-pricing-row]').evaluateAll((entries) =>
      entries.map((element) => [
        element.dataset.pricingRow,
        {
          amount: element.dataset.sourceAmount,
          currency: element.dataset.sourceCurrency,
          unit: element.dataset.unit,
          bandUnit: element.closest('[data-rate-band]')?.dataset.unit,
          cny: element.dataset.cnyAmount,
          text: element.innerText,
          entry: element.closest('article')?.dataset.serviceEntry,
          rowConditions: [...element.querySelectorAll('[data-condition]')].map(
            (condition) => condition.dataset.condition,
          ),
          rowConditionValues: [...element.querySelectorAll('[data-condition]')].reduce(
            (values, condition) => {
              const key = condition.dataset.condition;
              (values[key] ??= []).push(condition.dataset.conditionValue ?? null);
              return values;
            },
            {},
          ),
          commonConditionValues: [
            ...element
              .closest('article')
              .querySelectorAll('[data-common-conditions] [data-condition]'),
          ].reduce((values, condition) => {
            const key = condition.dataset.condition;
            (values[key] ??= []).push(condition.dataset.conditionValue ?? null);
            return values;
          }, {}),
          commonConditions: [
            ...element
              .closest('article')
              .querySelectorAll('[data-common-conditions] [data-condition]'),
          ].map((condition) => condition.dataset.condition),
          commonDescriptionCount: element
            .closest('article')
            .querySelectorAll('[data-common-conditions] [data-price-description]').length,
          cells: [...element.cells].slice(0, 3).map((cell) => cell.innerText),
          visible: element.getClientRects().length > 0,
        },
      ]),
    );
    const rows = Object.fromEntries(rendered);
    assert.equal(rendered.length, Object.keys(rows).length, quote.quoteId + ' duplicate rows');
    const visibleRows = quote.displayRows.filter((row) => {
      if (!row.rowId.split(':').includes('context_over_200k')) return true;
      const prefix = row.rowId.split(':context_over_200k:')[0];
      return !quote.displayRows.some(
        (other) =>
          other.rowId.startsWith(prefix + ':tier-') &&
          other.tier?.size &&
          other.unit === row.unit &&
          other.conditions.serviceTier === row.conditions.serviceTier,
      );
    });
    assert.equal(Object.keys(rows).length, visibleRows.length, quote.quoteId);
    const meteredConditions = new Set(
      quote.displayRows
        .filter(({ rowId }) => rowId.startsWith('condition-fee:'))
        .map(({ usageKey }) => usageKey),
    );
    const details = quote.originalQuote?.conditions ?? quote.conditions;
    const originalConditionKeys = new Set([
      ...(details && typeof details === 'object' ? Object.keys(details) : []),
      ...(typeof details === 'string' ? ['officialCondition'] : []),
      ...(quote.originalQuote?.effectiveAt ? ['effectiveAt'] : []),
    ]);
    const commonRowConditionKeys = ['minimumUsage', 'draft', 'rounding'];
    for (const { rowId, usageKey, amount, sourceValue, currency, unit, cnyAmount, conditions } of visibleRows) {
      const row = rows[rowId];
      assert.ok(row?.visible, quote.quoteId + ' ' + rowId);
      assert.equal(row.amount, String(amount ?? ''), rowId);
      assert.equal(row.currency, currency ?? '', rowId);
      assert.equal(row.unit, unit ?? '', rowId);
      assert.equal(row.bandUnit, unit ?? '', rowId);
      assert.equal(row.cny, String(cnyAmount ?? ''), rowId);
      if (amount !== null || sourceValue)
        assert.ok(row.cells[1].includes(String(amount ?? sourceValue)), rowId);
      if (currency) assert.ok(row.cells[1].includes(currency), rowId);
      if (cnyAmount !== null) assert.ok(row.cells[2].includes('¥' + cnyAmount), rowId);
      const term = quote.displayFeeTerms?.find((candidate) => candidate.usageKey === usageKey);
      if (term?.retentionMinutes !== undefined && !/^cache_write_\d+[hm]$/.test(usageKey)) {
        const minutes = { en: 'min', zh: '分钟', ja: '分' }[locale];
        assert.ok(
          row.text.includes(`${term.retentionMinutes} ${minutes}`),
          `${quote.quoteId} ${rowId} missing TTL ${term.retentionMinutes}`,
        );
      }
      if (term?.condition) assert.ok(row.text.includes(term.condition), rowId + ' missing fee term');
      const expectedRowConditions = Object.entries(conditions).filter(
        ([key, value]) =>
          !['tier', 'serviceTier', 'above'].includes(key) &&
          !meteredConditions.has(key) &&
          value !== undefined &&
          !(value && typeof value === 'object' && Object.keys(value).length === 0),
      );
      for (const [key, value] of expectedRowConditions) {
        const entryRows = visibleRows.filter((candidate) => rows[candidate.rowId].entry === row.entry);
        const canBeCommon =
          !rowOnlyConditionKeys.has(key) &&
          (commonRowConditionKeys.includes(key) || originalConditionKeys.has(key)) &&
          entryRows.every(
            (candidate) =>
              key in candidate.conditions &&
              JSON.stringify(candidate.conditions[key]) === JSON.stringify(value),
          );
        const serialized = JSON.stringify(value);
        if (canBeCommon) {
          assert.ok(
            row.commonConditionValues[key]?.includes(serialized),
            `${quote.quoteId} ${row.entry} lost common condition value ${key}`,
          );
        } else {
          assert.ok(
            row.rowConditionValues[key]?.includes(serialized),
            `${quote.quoteId} ${rowId} lost row condition value ${key}`,
          );
          assert.ok(
            !row.commonConditions.includes(key),
            `${quote.quoteId} ${rowId} incorrectly hoisted ${key}`,
          );
        }
      }
      for (const key of meteredConditions)
        assert.ok(
          !row.commonConditions.includes(key),
          `${quote.quoteId} ${row.entry} invented common metered condition ${key}`,
        );
      count += 1;
    }
    const originalCommonEntries = details && typeof details === 'object'
      ? Object.entries(details).filter(
          ([key, value]) =>
            !meteredConditions.has(key) &&
            !rowOnlyConditionKeys.has(key) &&
            value !== undefined &&
            !(value && typeof value === 'object' && Object.keys(value).length === 0),
        )
      : [];
    if (quote.originalQuote?.effectiveAt && !rowOnlyConditionKeys.has('effectiveAt'))
      originalCommonEntries.push(['effectiveAt', quote.originalQuote.effectiveAt]);
    for (const entry of new Set(Object.values(rows).map((row) => row.entry))) {
      const entryRows = visibleRows.filter(({ rowId }) => rows[rowId].entry === entry);
      const commonEntries = originalCommonEntries.flatMap(([key, value]) => {
        const rowsWithCondition = entryRows.filter((row) => key in row.conditions);
        if (!rowsWithCondition.length) return [[key, value]];
        const first = rowsWithCondition[0].conditions[key];
        return rowsWithCondition.length === entryRows.length &&
          rowsWithCondition.every(
            (row) => JSON.stringify(row.conditions[key]) === JSON.stringify(first),
          )
          ? [[key, first]]
          : [];
      });
      for (const key of commonRowConditionKeys) {
        const value = entryRows[0]?.conditions[key];
        if (
          typeof value === 'string' &&
          entryRows.every((row) => row.conditions[key] === value) &&
          !commonEntries.some(([existing]) => existing === key)
        )
          commonEntries.push([key, value]);
      }
      const commonKeys = new Set(entryRows.flatMap(({ rowId }) => rows[rowId].commonConditions));
      const commonValues = entryRows[0] ? rows[entryRows[0].rowId].commonConditionValues : {};
      const allowedCommonKeys = new Set(
        commonEntries.flatMap(([key, value]) => [key, ...nestedConditionKeys(value)]),
      );
      if (typeof details === 'string') allowedCommonKeys.add('officialCondition');
      if (quote.originalQuote?.contextNote) allowedCommonKeys.add('contextNote');
      if (quote.originalQuote?.cache?.reason) allowedCommonKeys.add('cacheAvailability');
      for (const key of commonKeys)
        assert.ok(
          allowedCommonKeys.has(key),
          `${quote.quoteId} ${entry} incorrectly hoisted ${key}`,
        );
      for (const [key, value] of commonEntries)
        assert.ok(
          commonValues[key]?.includes(JSON.stringify(value)),
          `${quote.quoteId} ${entry} lost common condition value ${key}`,
        );
      if (typeof details === 'string')
        assert.ok(commonKeys.has('officialCondition'), `${quote.quoteId} ${entry} lost condition text`);
      for (const { rowId } of entryRows)
        assert.equal(
          rows[rowId].commonDescriptionCount,
          quote.originalQuote?.description ? 1 : 0,
          `${quote.quoteId} ${entry} description placement`,
        );
    }
    if (quote.displayRows.length) {
      await cards
        .getByRole('columnheader', { name: labels.source, exact: true, includeHidden: true })
        .first()
        .waitFor({ state: 'attached' });
      await cards
        .getByRole('columnheader', { name: labels.base, exact: true, includeHidden: true })
        .first()
        .waitFor({ state: 'attached' });
    }
  }
  return count;
}

const bandText = (row) => row.evaluate((element) => element.closest('[data-rate-band]').innerText);
const sourceText = (row) => row.locator('[data-price-source]:visible').innerText();
const cnyText = (row) => row.locator('[data-price-cny]:visible').innerText();

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
      assert.match(await bandText(rows.first()), /272000/);
    }
    assert.match(
      await selected.locator('[data-pricing-row="cost:input"]').innerText(),
      /\$2[\s\S]*¥14/,
    );
    assert.match(await bandText(selected.locator('[data-pricing-row="cost:input"]')), /272000/);
    assert.match(
      await selected.locator('[data-pricing-row="cost:output"]').innerText(),
      /\$10[\s\S]*¥70/,
    );
    assert.match(
      await bandText(selected.locator('[data-pricing-row="cost:tier-0:input"]')),
      /272001/,
    );
  } else if (modelId === 'grok-4.20-0309-non-reasoning') {
    const low = await bandText(selected.locator('[data-pricing-row="cost:input"]'));
    const high = await bandText(selected.locator('[data-pricing-row="cost:tier-0:input"]'));
    assert.match(low, /199999/);
    assert.match(high, /200000/);
    assert.doesNotMatch(high, /200001/);
  } else if (modelId === 'claude-haiku-5-5') {
    assert.match(await bandText(selected.locator('[data-pricing-row="cost:input"]')), /100000/);
    assert.match(
      await bandText(selected.locator('[data-pricing-row="cost:tier-0:input"]')),
      /100001/,
    );
    assert.match(
      await selected.locator('[data-price-description]').innerText(),
      {
        en: /100,000 prompt tokens, including cache reads and writes/,
        zh: /100,000 Token（含缓存读写）/,
        ja: /キャッシュ読書込を含むプロンプトが100,000トークン/,
      }[locale],
    );
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
        .locator('[data-price-list]')
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
      await held.locator('[data-condition="minimumUsage"]').innerText(),
      {
        en: /output token count reported by the API/,
        zh: /接口返回的输出 Token 数/,
        ja: /APIが返す出力トークン数/,
      }[locale],
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
  } else if (modelId === 'glm-4.7') {
    const upstream = view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ sourceRecordId }) => sourceRecordId.startsWith('upstream:'));
    const repeat = quoteAt(page, upstream.quoteId);
    const cache = repeat.locator('[data-pricing-row="cost:cache_write"]');
    await cache.waitFor();
    assert.equal(await cache.locator('[data-tier-condition]').count(), 0);
    assert.match(await bandText(repeat.locator('[data-pricing-row="cost:input"]')), /32000/);
  } else if (modelId === 'gemini-3.8-flash') {
    const labels = {
      en: ['Effective from', 'Valid through', 'Announced rates', 'Cache read'],
      zh: ['生效时间', '有效期截至', '已公布费率', '缓存读取'],
      ja: ['適用開始', '有効期限', '発表済み料金', 'キャッシュ読み取り'],
    };
    for (const [index, key] of ['starts', 'through', 'announcedPrices', 'cache_read'].entries()) {
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
    const renderedRows = await compareVisibleQuotes(page, view, labels, locale);
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

export async function checkPricingReviewFindings({
  page,
  goto,
  select,
  current,
  catalog,
  locale,
  mobile,
  respond,
  checkStatusUrl,
}) {
  const models = (provider, model) => catalog[provider].models[model];
  const visit = async (provider, model) => {
    await goto(select(provider, model));
    await page
      .locator(`[data-pricing-provider="${provider}"][data-pricing-model="${model}"]`)
      .first()
      .waitFor();
  };
  const row = (quote, id) => quote.locator(`[data-pricing-row="${id}"]`);
  const findings = [];
  const verify = async (name, check) => {
    try {
      await check();
    } catch (error) {
      findings.push(name + ' – ' + error.message);
    }
  };

  await verify('OpenAI structured tiers replace legacy rows in the price table', async () => {
    await visit('openai', 'gpt-6.2-astra');
    const selected = page.locator('[data-syncable="true"]');
    assert.equal(await selected.locator('[data-pricing-row*="context_over_200k"]').count(), 0);
    assert.equal(await row(selected, 'cost:input').getAttribute('data-source-amount'), '8');
    assert.equal(await row(selected, 'cost:tier-0:input').getAttribute('data-source-amount'), '16');
    assert.equal(
      await row(selected, 'cost:tier-0:output').getAttribute('data-source-amount'),
      '60',
    );
    assert.match(await bandText(row(selected, 'cost:input')), /272000/);
    assert.match(await bandText(row(selected, 'cost:tier-0:input')), /272001/);
    assert.match(await selected.locator('pre').textContent(), /context_over_200k/);
    for (const id of ['cost:cache_write', 'cost:tier-0:cache_write'])
      assert.match(
        await row(selected, id).locator('th').innerText(),
        { en: /30 min/, zh: /30 分钟/, ja: /30 分/ }[locale],
      );
    const longLabel = await row(selected, 'cost:cache_write_12h').locator('th').innerText();
    assert.equal((longLabel.match(/12/g) ?? []).length, 1);
    assert.doesNotMatch(longLabel, /720/);
  });

  await verify('Independent OpenAI evidence reaches every applicable tariff and cache row', async () => {
    const roleLabels = {
      en: { 'official-list': 'Official list price', 'promotion-reference': 'Promotion reference' },
      zh: { 'official-list': '官网列表原价', 'promotion-reference': '促销参考' },
      ja: { 'official-list': '公式リスト基準価格', 'promotion-reference': 'プロモーション参考' },
    }[locale];
    for (const expected of openAiOfficialRows()) {
      await visit('openai', expected.model);
      const card = quoteAt(page, `reviewed-reference:${expected.id}`);
      assert.equal(await card.count(), 1, expected.id);
      assert.equal(await card.getAttribute('data-service-name'), expected.service);
      assert.equal(await card.getAttribute('data-price-role'), expected.priceRole);
      assert.equal(await card.getAttribute('data-quote-status'), 'reference-only');
      assert.equal(await card.getAttribute('data-syncable'), 'false');
      assert.ok(await card.locator('details').first().evaluate((details) => details.open));
      const summary = await card.locator('summary').first().innerText();
      assert.match(summary, new RegExp(expected.service));
      if (roleLabels[expected.priceRole]) assert.match(summary, new RegExp(roleLabels[expected.priceRole]));
      assert.doesNotMatch(await card.innerText(), /pending-effective|Awaiting effective date|等待官方价目生效|公式料金の発効待ち/);
      for (const [band, prefix] of [
        [expected.short, 'cost'],
        [expected.long, 'cost:tier-0'],
      ])
        for (const [usage, amount] of Object.entries(band))
          assert.equal(
            await row(card, `${prefix}:${usage}`).getAttribute('data-source-amount'),
            String(amount),
            `${expected.id} ${prefix}:${usage}`,
          );
      for (const id of ['cost:cache_write', 'cost:tier-0:cache_write'])
        assert.match(
          await row(card, id).locator('th').innerText(),
          { en: /30 min/, zh: /30 分钟/, ja: /30 分/ }[locale],
        );
      assert.equal(await card.locator('[data-pricing-row]').count(), 10);
      for (const prefix of ['cost', 'cost:tier-0']) {
        const band = row(card, `${prefix}:input`).locator('xpath=ancestor::*[@data-rate-band][1]');
        assert.deepEqual(
          await band.locator('[data-pricing-row]').evaluateAll((rows) =>
            rows.map((entry) => entry.dataset.pricingRow),
          ),
          ['input', 'output', 'cache_read', 'cache_write', 'cache_write_12h'].map(
            (usage) => `${prefix}:${usage}`,
          ),
        );
      }
      if (expected.priceRole === 'official-list')
        assert.equal(await card.locator('[data-condition="listChargingStarts"]').count(), 1);
      if (expected.priceRole === 'promotion-reference')
        assert.equal(await card.locator('[data-condition="promotionThrough"]').count(), 1);
      assert.equal(await card.locator('[data-condition="effectiveAt"]').count(), 0);
      assert.equal(await page.locator('[data-service-name="Flex"]').count(), 0);
      await assertNoPageOverflow(page);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-quote-id]').first().waitFor();
    assert.ok(
      await page
        .locator('[data-quote-id] > details')
        .evaluateAll((details) => details.every((entry) => entry.open)),
    );
  });

  await verify('Standard background windows retain conditions without guessed meter rates', async () => {
    const titles = {
      en: { '2h': 'Background completion · 2 hours', '8h': 'Background completion · 8 hours' },
      zh: { '2h': '后台完成窗口 · 2 小时', '8h': '后台完成窗口 · 8 小时' },
      ja: { '2h': 'バックグラウンド完了期間・2 時間', '8h': 'バックグラウンド完了期間・8 時間' },
    }[locale];
    const derivation = {
      en: /Not shown/,
      zh: /不显示推导价/,
      ja: /算出料金は未表示/,
    }[locale];
    const explanation = {
      en: /No derived prices are shown/,
      zh: /不显示推导价/,
      ja: /算出料金は表示せず/,
    }[locale];
    for (const expected of openAiBackgroundRows()) {
      await visit('openai', expected.model);
      const card = quoteAt(page, `reviewed-reference:${expected.id}`);
      assert.equal(await card.count(), 1, expected.id);
      assert.equal(await card.getAttribute('data-service-name'), 'Standard');
      assert.equal(await card.getAttribute('data-price-role'), 'background-reference');
      assert.equal(await card.getAttribute('data-completion-window'), expected.completionWindow);
      assert.equal(await card.getAttribute('data-quote-status'), 'incomplete');
      assert.equal(await card.getAttribute('data-syncable'), 'false');
      assert.ok(await card.locator('details').first().evaluate((details) => details.open));
      const summary = await card.locator('summary').first().innerText();
      assert.match(summary, /Standard/);
      assert.match(summary, new RegExp(titles[expected.completionWindow]));
      assert.doesNotMatch(summary, /Flex|Batch/);
      assert.equal(await card.locator('[data-pricing-row]').count(), 0);
      assert.equal(await card.locator('[data-price-source]').count(), 0);
      for (const [key, value] of Object.entries(expected.conditions)) {
        if (key === 'baseQuoteId') continue;
        const condition = card.locator(`[data-condition="${key}"]`);
        assert.equal(await condition.count(), 1, `${expected.id} ${key}`);
        assert.equal(await condition.getAttribute('data-condition-value'), JSON.stringify(value));
      }
      assert.match(
        await card.locator('[data-condition="rateDerivation"]').innerText(),
        derivation,
      );
      assert.match(
        await card.locator('[data-condition="cacheReuse"]').innerText(),
        { en: /cannot reuse cache entries/, zh: /不能复用/, ja: /再利用できません/ }[locale],
      );
      assert.match(await card.locator('[data-price-explanation]').innerText(), explanation);
      assert.match(
        await card.locator('[data-condition="officialMultiplier"]').innerText(),
        new RegExp(expected.completionWindow === '2h' ? '30' : '40'),
      );
      assert.equal(await card.locator('[data-condition="baseQuoteId"]').count(), 0);
      const commonText = await card.locator('[data-common-conditions]').innerText();
      assert.ok(!commonText.includes(expected.baseQuoteId), `${expected.id} leaks its internal base ID`);
      const baseReference = card.locator('[data-base-quote-reference]');
      assert.equal(await baseReference.count(), 1, expected.id);
      assert.match(
        await baseReference.innerText(),
        {
          en: /Standard base quote/,
          zh: /Standard 基础价目/,
          ja: /Standard 基準料金/,
        }[locale],
      );
      const baseLink = baseReference.getByRole('link', {
        name: 'Standard · global · https://api.openai.com/v1',
        exact: true,
      });
      assert.equal(await baseLink.count(), 1, expected.id);
      const href = await baseLink.getAttribute('href');
      assert.ok(href?.startsWith('#'), `${expected.id} base link ${href}`);
      const target = page.locator(href);
      assert.equal(await target.getAttribute('data-quote-id'), expected.baseQuoteId);
      assert.equal(await target.getAttribute('data-syncable'), 'true');
      assert.equal(await target.getAttribute('data-service-name'), 'Standard');
      assert.match(
        await target.locator('[data-price-list]').innerText(),
        /OpenAI API \/ Standard \/ global/,
      );
      await baseLink.click();
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute('data-quote-id')),
        expected.baseQuoteId,
      );
      await card.locator('[data-price-audit] > summary').click();
      const audit = await card.locator('[data-price-audit]').innerText();
      assert.ok(audit.includes(`"baseQuoteId": "${expected.baseQuoteId}"`), expected.id);
      assert.ok(audit.includes('"baseCost"'), expected.id);
      await assertNoPageOverflow(page);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-quote-id]').first().waitFor();
    assert.ok(
      await page
        .locator('[data-quote-id] > details')
        .evaluateAll((details) => details.every((entry) => entry.open)),
    );
  });

  await verify('Upstream catalog references stay separate with stable rows and explicit TTL gaps', async () => {
    await visit('openai', 'gpt-6.1-sol');
    const upstreamView = models('openai', 'gpt-6.1-sol').pricing_view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ quoteId }) => quoteId.startsWith('upstream:'));
    const upstream = quoteAt(page, upstreamView.quoteId);
    const upstreamScope = upstream.locator('xpath=ancestor::section[@data-pricing-scope][1]');
    assert.equal(await upstreamScope.getAttribute('data-reference-kind'), 'upstream');
    assert.match(
      await upstreamScope.locator('[data-scope-title]').innerText(),
      { en: /Upstream catalog reference/, zh: /上游目录参考价/, ja: /上流カタログ参考料金/ }[locale],
    );
    const summary = await upstream.locator('summary').first().innerText();
    assert.doesNotMatch(summary, /fixed upstream primary or original CNY sheet/);
    assert.equal(await upstream.locator('[data-price-list]').count(), 0);
    await upstream.locator('[data-price-audit] > summary').click();
    assert.match(
      await upstream.locator('[data-price-audit]').innerText(),
      /fixed upstream primary or original CNY sheet/,
    );
    assert.match(
      summary,
      { en: /Upstream catalog record/, zh: /上游目录记录/, ja: /上流カタログ記録/ }[locale],
    );
    const selectedScope = await page.locator('[data-syncable="true"]').getAttribute('data-pricing-scope');
    assert.notEqual(await upstream.getAttribute('data-pricing-scope'), selectedScope);
    const positions = await page.locator('section[data-reference-kind]').evaluateAll((scopes) =>
      scopes.map((scope) => scope.dataset.referenceKind),
    );
    assert.deepEqual(positions, ['official', 'upstream']);
    for (const band of await upstream.locator('[data-rate-band]').all()) {
      const order = await band.locator('[data-pricing-row]').evaluateAll((rows) =>
        rows.map((row) => row.dataset.pricingRow.split(':').at(-1)),
      );
      const ranks = { input: 1, output: 2, cache_read: 3, cache_write: 4, cache_write_12h: 5 };
      const core = order.filter((id) => ranks[id]);
      assert.deepEqual(core, [...core].sort((a, b) => ranks[a] - ranks[b]), core.join(', '));
    }
    for (const label of await upstream.locator('[data-pricing-row$=":cache_write"] th').allTextContents())
      assert.match(
        label,
        { en: /TTL undocumented in source/, zh: /源记录未注明缓存有效期/, ja: /元資料にキャッシュ TTL の記載なし/ }[locale],
      );
    await assertNoPageOverflow(page);
  });

  await verify('Documented cache TTLs stay scoped to each tariff', async () => {
    for (const [provider, model, quoteId, minutes] of [
      ['moonshotai-cn', 'kimi-k3', 'cn-moonshot-kimi-k3-standard', 5],
      ['moonshotai-cn', 'kimi-k3', 'cn-moonshot-kimi-k3-batch', 5],
      ['alibaba-cn', 'qwen-flash', 'dashscope--qwen-flash--cn-beijing-online-original-explicit', 5],
      [
        'alibaba',
        'qwen-flash',
        'dashscope--qwen-flash--sg-international-online-original-explicit',
        5,
      ],
    ]) {
      await visit(provider, model);
      const card = page.locator(`[data-quote-id="${quoteId}"]`);
      const details = card.locator('details').first();
      if ((await details.getAttribute('open')) === null)
        await details.locator('summary').first().click();
      for (const label of await card
        .locator('[data-pricing-row$=":cache_write"] th')
        .allTextContents())
        assert.match(
          label,
          new RegExp(minutes + ' ' + { en: 'min', zh: '分钟', ja: '分' }[locale]),
        );
      for (const label of await card
        .locator('[data-pricing-row$=":cache_write_1h"] th')
        .allTextContents())
        assert.doesNotMatch(label, /60/);
    }
  });

  await verify(
    'Price explanations are readable and technical originals stay in audit details',
    async () => {
      const cases = [
        [
          'alibaba-cn',
          'qvq-max',
          'missing-original-CNY',
          {
            en: 'Official CNY pricing is not yet verified.',
            zh: '尚未核实官方人民币原价。',
            ja: '公式の人民元料金は未確認です。',
          },
        ],
        [
          'inception',
          'mercury-2',
          'approved-deferred-evidence:complete-tariff-requires-source-currency',
          {
            en: 'Source currency will be verified before planned integration.',
            zh: '源币种待确认，将在计划接入前核查。',
            ja: '導入予定時に元の通貨を確認します。',
          },
        ],
        [
          'google',
          'gemini-3.8-flash',
          'Explicit cache storage charges',
          {
            en: 'Cache storage is charged by duration and cannot currently be fully synchronized. See the tariff below for the published conditions.',
            zh: '缓存存储按时长另行收费，当前尚不能完整同步；已公布条件见价目明细。',
            ja: 'キャッシュ保存は時間に応じて別途課金され、現在は完全な同期に未対応です。公表済みの条件は料金明細をご確認ください。',
          },
        ],
      ];
      for (const [provider, model, original, labels] of cases) {
        await visit(provider, model);
        const card = page
          .locator('[data-quote-id]')
          .filter({ has: page.locator('[data-audit-reason]').filter({ hasText: original }) })
          .first();
        const disclosure = card.locator('details').first();
        if ((await disclosure.getAttribute('open')) === null)
          await disclosure.locator('summary').first().click();
        assert.equal(await card.locator('[data-price-explanation]').innerText(), labels[locale]);
        assert.equal(await card.locator('[data-audit-reason]').isVisible(), false);
        assert.ok(!(await card.innerText()).includes(original));
        await card.locator('[data-price-audit] > summary').click();
        assert.ok(await card.locator('[data-audit-reason]').isVisible());
        assert.ok((await card.locator('[data-audit-reason]').innerText()).includes(original));
      }
    },
  );

  await verify(
    'Technical descriptions stay in audit with readable billing conditions',
    async () => {
      for (const model of [
        'doubao-seedance-2-0-260128',
        'doubao-seedance-2-0-fast-260128',
        'doubao-seedance-2-0-mini-260615',
      ]) {
        await visit('volcengine', model);
        const card = page.locator(
          `[data-quote-id="volcengine--${model}--cn-beijing-task-online-original"]`,
        );
        const disclosure = card.locator('details').first();
        if ((await disclosure.getAttribute('open')) === null)
          await disclosure.locator('summary').first().click();
        assert.doesNotMatch(
          await card.innerText(),
          /usage[.]completion_tokens|fixed schema condition|Last unconditional fallback/,
        );
        const description = await card.locator('[data-price-description]').innerText();
        assert.match(
          description,
          { en: /reported output tokens/, zh: /返回的输出 Token/, ja: /返された出力トークン/ }[
            locale
          ],
        );
        assert.match(description, { en: /minimum/, zh: /最低/, ja: /最低/ }[locale]);
        assert.match(
          description,
          { en: /Failed generations are free/, zh: /生成失败不收费/, ja: /生成失敗は無料/ }[locale],
        );
        await card.locator('[data-price-audit] > summary').click();
        assert.match(
          await card.locator('[data-audit-description]').innerText(),
          /Last unconditional fallback/,
        );
      }
      await visit('volcengine', 'doubao-seedance-2-5-260628');
      const minimum = page.locator('[data-condition="minimumUsage"]').first();
      await minimum.evaluate((node) => {
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          if (parent.tagName === 'DETAILS') parent.open = true;
        }
      });
      assert.doesNotMatch(await minimum.innerText(), /usage[.]completion_tokens/);
      assert.match(
        await minimum.innerText(),
        { en: /aspect ratio and duration/, zh: /宽高比和时长/, ja: /縦横比・時間/ }[locale],
      );
      await visit('openai', 'gpt-image-2.5-sunburst');
      const image = page.locator(
        '[data-quote-id="us-openai-gpt-image-2.5-sunburst-direct-images-standard"]',
      );
      const details = image.locator('details').first();
      if ((await details.getAttribute('open')) === null)
        await details.locator('summary').first().click();
      assert.doesNotMatch(await image.innerText(), /usage[.]output_tokens|img_o|ordinary c meter/);
      const summary = await image.locator('[data-price-description]').innerText();
      assert.match(summary, /100/);
      assert.match(
        summary,
        { en: /No cached rate applies/, zh: /不适用缓存价/, ja: /キャッシュ料金は適用されません/ }[
          locale
        ],
      );
      await image.locator('[data-price-audit] > summary').click();
      assert.match(
        await image.locator('[data-audit-description]').innerText(),
        /usage[.]output_tokens/,
      );
    },
  );

  await verify('Service scopes, anchors and disclosures preserve the selected quote', async () => {
    await visit('openai', 'gpt-6.1-sol');
    const view = models('openai', 'gpt-6.1-sol').pricing_view;
    const selected = page.locator('[data-syncable="true"]');
    const summary = await selected.locator('summary').first().innerText();
    assert.match(summary, /Standard/);
    assert.doesNotMatch(summary, /OpenAI API \/ Standard \/ global/);
    const selectedScope = await selected.getAttribute('data-pricing-scope');
    const scope = selected.locator('xpath=ancestor::section[@data-pricing-scope][1]');
    assert.match(await scope.locator('[data-scope-title]').innerText(), /OpenAI API/);
    assert.match(await scope.locator('[data-scope-title]').innerText(), /global/);
    assert.ok(await selected.locator('[data-common-conditions]').count());
    const batchView = view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ priceList }) => priceList === 'Batch');
    const batch = quoteAt(page, batchView.quoteId);
    assert.equal(await batch.getAttribute('data-pricing-scope'), selectedScope);
    assert.equal(await batch.getAttribute('data-syncable'), 'false');
    assert.equal(await batch.getAttribute('data-quote-status'), 'reference-only');
    assert.ok(
      await page
        .locator('[data-quote-id] > details')
        .first()
        .evaluate((details) => details.open),
    );
    const batchEntry = await batch.getAttribute('data-service-entry');
    const routeHash = await page.evaluate(() => location.hash);
    await scope.locator(`[data-price-anchor-target="${batchEntry}"]`).click();
    assert.equal(await page.evaluate(() => location.hash), routeHash);
    assert.ok(await batch.evaluate((article) => document.activeElement === article));
    await batch.locator('summary').first().click();
    assert.equal(await batch.locator('details').first().getAttribute('open'), null);
    assert.equal(await selected.getAttribute('data-syncable'), 'true');
    assert.equal(await selected.getAttribute('data-quote-id'), view.selectedQuoteId);
    await batch.locator('summary').first().click();
    assert.ok(
      await page
        .locator('[data-quote-id] > details')
        .evaluateAll((details) => details.every((entry) => entry.open)),
    );

    const input = row(selected, 'cost:input');
    const source = input.locator('[data-price-source]:visible');
    const cny = input.locator('[data-price-cny]:visible');
    const usageBox = await input.locator('th').boundingBox();
    const sourceBox = await source.boundingBox();
    const cnyBox = await cny.boundingBox();
    assert.ok(usageBox && sourceBox && cnyBox);
    const sourceCell = source.locator('xpath=ancestor::td[1]');
    const cnyCell = cny.locator('xpath=ancestor::td[1]');
    const sharesPriceCell = await sourceCell.evaluate(
      (cell, other) => cell === other,
      await cnyCell.elementHandle(),
    );
    assert.equal(sharesPriceCell, mobile);
    if (mobile) {
      assert.ok(cnyBox.y > sourceBox.y, JSON.stringify({ sourceBox, cnyBox }));
      assert.ok(Math.abs(sourceBox.x + sourceBox.width - (cnyBox.x + cnyBox.width)) < 2);
    } else {
      assert.ok(Math.abs(sourceBox.y - cnyBox.y) < 2, JSON.stringify({ sourceBox, cnyBox }));
      assert.ok(cnyBox.x > sourceBox.x, JSON.stringify({ sourceBox, cnyBox }));
    }

    await visit('anthropic', 'claude-haiku-5-5');
    const anthropic = models('anthropic', 'claude-haiku-5-5').pricing_view;
    const globalScope = await page
      .locator('[data-syncable="true"]')
      .getAttribute('data-pricing-scope');
    const inference = anthropic.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ priceList }) => priceList === 'Standard / inference_geo=us');
    const otherScope = quoteAt(page, inference.quoteId);
    assert.notEqual(await otherScope.getAttribute('data-pricing-scope'), globalScope);
    assert.match(await otherScope.locator('[data-price-list]').innerText(), /inference_geo=us/);
    await assertNoPageOverflow(page);
  });

  await verify('One source record can expose independent service entries without losing rows', async () => {
    await visit('google', 'gemini-3.8-flash');
    const reference = models('google', 'gemini-3.8-flash').pricing_view.groups
      .flatMap(({ quotes }) => quotes)
      .find(({ quoteId }) => quoteId.startsWith('reviewed-reference:'));
    const entries = quoteAt(page, reference.quoteId);
    assert.deepEqual(
      (await entries.evaluateAll((nodes) => nodes.map((node) => node.dataset.serviceName))).sort(),
      ['Batch', 'Flex', 'Priority', 'Standard'],
    );
    assert.equal(await entries.locator('[data-pricing-row]').count(), reference.displayRows.length);
    assert.ok(
      await entries
        .locator('details')
        .first()
        .evaluateAll((details) => details.every((entry) => entry.open)),
    );
    const scope = entries.first().locator('xpath=ancestor::section[@data-pricing-scope][1]');
    for (const service of ['Standard', 'Batch', 'Flex', 'Priority'])
      assert.ok(await scope.locator(`[data-service-name="${service}"]`).count(), service);
    await assertNoPageOverflow(page);
  });

  await verify('Two-band, multi-band and partially tiered rates keep exact group semantics', async () => {
    await visit('openai', 'gpt-6.2-astra');
    const selected = page.locator('[data-syncable="true"]');
    const bands = selected.locator('[data-rate-band][data-unit="per_million_tokens"]');
    assert.equal(await bands.count(), 2);
    assert.match(await bandText(row(selected, 'cost:input')), /272000/);
    assert.match(await bandText(row(selected, 'cost:tier-0:input')), /272001/);
    for (const id of ['cost:input', 'cost:tier-0:input']) {
      const charge = row(selected, id);
      assert.match(await bandText(charge), new RegExp(messages[locale].wholeRequest));
      assert.equal(await charge.locator('[data-tier-condition]').count(), 0);
    }

    await visit('alibaba', 'qwen3-coder-flash');
    const multi = quoteAt(page, 'upstream:alibaba:qwen3-coder-flash:USD');
    assert.equal(await multi.locator('[data-rate-band]').count(), 4);
    for (const [id, bound] of [
      ['cost:input', /32000/],
      ['cost:tier-0:input', /32001.*128000/],
      ['cost:tier-1:input', /128001.*256000/],
      ['cost:tier-2:input', /256001/],
    ])
      assert.match(await bandText(row(multi, id)), bound);
    await assertNoPageOverflow(page);

    await visit('alibaba', 'qwen3.5-plus');
    const partial = quoteAt(page, 'upstream:alibaba:qwen3.5-plus:USD');
    const lowBand = row(partial, 'cost:input').locator('xpath=ancestor::*[@data-rate-band][1]');
    const highBand = row(partial, 'cost:tier-0:input').locator(
      'xpath=ancestor::*[@data-rate-band][1]',
    );
    const reasoningBand = row(partial, 'cost:reasoning').locator(
      'xpath=ancestor::*[@data-rate-band][1]',
    );
    assert.equal(await highBand.locator('[data-pricing-row]').count(), 2);
    assert.notEqual(await reasoningBand.getAttribute('data-rate-band'), await lowBand.getAttribute('data-rate-band'));
    assert.equal(await reasoningBand.locator('[data-tier-condition]').count(), 0);
    assert.notEqual(await reasoningBand.getAttribute('data-rate-band'), await highBand.getAttribute('data-rate-band'));
    await assertNoPageOverflow(page);
  });

  await verify('Mixed billing units retain their own group labels', async () => {
    await visit('minimax-cn', 'MiniMax-H3');
    const selected = page.locator('[data-syncable="true"]');
    const labels = {
      en: { per_second: 'Per second', per_count: 'Per item' },
      zh: { per_second: '每秒', per_count: '每个用量单位' },
      ja: { per_second: '1 秒あたり', per_count: '1 件あたり' },
    }[locale];
    assert.deepEqual(
      (await selected
        .locator('[data-rate-band]')
        .evaluateAll((bands) => [...new Set(bands.map((band) => band.dataset.unit))])).sort(),
      ['per_count', 'per_second'],
    );
    for (const [unit, label] of Object.entries(labels)) {
      const band = selected.locator(`[data-rate-band][data-unit="${unit}"]`).first();
      assert.ok((await band.innerText()).includes(label), unit);
    }
    await assertNoPageOverflow(page);
  });

  await verify('Zhipu short-output rate exclusivity', async () => {
    for (const model of ['glm-4.7', 'glm-4.5-air']) {
      await visit('zhipuai', model);
      const selected = page.locator('[data-syncable="true"]');
      for (const meter of ['input', 'output', 'cache_read']) {
        const ordinary = row(selected, 'cost:' + meter);
        const short = row(selected, 'cost:short_output:' + meter);
        const high = row(selected, 'cost:tier-0:' + meter);
        const outputFloor = ordinary.locator('[data-condition="minOutput"]');
        assert.equal(
          await outputFloor.count(),
          1,
          model + ' ordinary ' + meter + ' must exclude the short-output request',
        );
        assert.match(await outputFloor.innerText(), /200/);
        assert.match(await bandText(ordinary), /31999/);
        assert.match(await short.locator('[data-condition="maxOutput"]').innerText(), /199/);
        assert.match(await short.locator('[data-condition="maxInput"]').innerText(), /31999/);
        assert.match(await bandText(high), /32000/);
        assert.equal(await high.locator('[data-condition="minOutput"]').count(), 0);
      }
      if (model === 'glm-4.7') {
        assert.equal(
          await row(selected, 'cost:short_output:input').getAttribute('data-cny-amount'),
          '2',
        );
        assert.equal(
          await row(selected, 'cost:short_output:output').getAttribute('data-cny-amount'),
          '8',
        );
      }
    }
  });
  await verify('Volcengine raw token tariff bands', async () => {
    for (const model of ['doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-code-preview-260215']) {
      await visit('volcengine', model);
      const reference = page.locator('[data-quote-status="reference-only"]');
      for (const [id, amount, bounds] of [
        ['input', '3.2', /32000/],
        ['tier-0:input', '4.8', /32001.*128000/],
        ['tier-1:input', '9.6', /128001/],
      ]) {
        const charge = row(reference, 'raw-fees:token:' + id);
        assert.equal(await charge.getAttribute('data-cny-amount'), amount);
        const condition = charge.locator('[data-tier-condition]');
        assert.equal(await condition.count(), 0, model + ' ' + id + ' repeats the band on the row');
        assert.match(await bandText(charge), bounds);
      }
    }
  });
  await verify('Seedance 4K daily status identity', async () => {
    const modelId = 'doubao-seedance-2-5-260628';
    await visit('volcengine', modelId);
    const attemptedAt = '2026-11-21T01:47:00.000Z';
    const lastSuccess = '2026-11-20T01:47:00.000Z';
    const quoteId = 'volcengine:' + modelId + ':official-reference';
    respond({
      schemaVersion: 1,
      publishedVersion: { candidateId: current.releaseId, sourceSha: current.sourceSha },
      attemptedAt,
      runtime: { url: 'https://github.com/naoshengyun/llm-metadata/actions/runs/1' },
      results: [
        {
          quoteId,
          identity: { providerId: 'volcengine', modelId },
          status: 'failed',
          latestAttemptedAt: attemptedAt,
          latestSuccessfulAt: lastSuccess,
        },
      ],
    });
    const response = page.waitForResponse(checkStatusUrl);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await (await response).finished();
    const held = page.locator('[data-quote-status="validation-held"]');
    assert.equal(await held.getAttribute('data-quote-id'), quoteId);
    const status = held.locator('[data-official-check="failed"]');
    await status.waitFor({ timeout: 3500 });
    assert.deepEqual(
      await status.locator('time').evaluateAll((nodes) => nodes.map((node) => node.dateTime)),
      [attemptedAt, lastSuccess],
    );
    assert.deepEqual(
      await held
        .locator('[data-pricing-row]')
        .evaluateAll((rows) => rows.map((rate) => rate.dataset.sourceAmount)),
      ['31', '19'],
    );
    assert.equal(
      await page.locator('[data-syncable="true"] [data-official-check="failed"]').count(),
      0,
    );
  });
  await verify('MiniMax official service tier titles', async () => {
    await visit('minimax-cn', 'MiniMax-M3');
    const references = page.locator('[data-quote-status="incomplete"]');
    for (const [title, amount] of [
      ['Standard', '2.1'],
      ['Priority', '3.15'],
    ]) {
      const quote = references.filter({
        has: page.locator(`[data-pricing-row="raw-fees:0:input"][data-cny-amount="${amount}"]`),
      });
      assert.match(await quote.locator('summary h3').first().innerText(), new RegExp(title, 'i'));
    }
  });
  await verify('No reference price when there are no monetary rows', async () => {
    await visit('alibaba-cn', 'qwen3-asr-flash');
    assert.equal(await page.locator('[data-pricing-row]').count(), 0);
    assert.equal(
      await page
        .locator('[data-pricing-provider="alibaba-cn"][data-pricing-model="qwen3-asr-flash"]')
        .getAttribute('data-pricing-summary'),
      'unavailable',
    );
  });
  await verify('Perplexity token billing unit', async () => {
    await visit('perplexity', 'sonar-deep-research');
    for (const [key, amount] of [
      ['input', '14'],
      ['output', '56'],
      ['reasoning', '21'],
    ]) {
      const charge = page.locator(`[data-pricing-row="cost:${key}"]`);
      assert.equal(await charge.getAttribute('data-cny-amount'), amount);
      assert.equal(await charge.getAttribute('data-unit'), 'per_million_tokens');
      assert.doesNotMatch(await charge.locator('th').innerText(), /—/);
    }
  });
  await verify('Gemini per-image equivalents, resolution and token counts', async () => {
    for (const [model, expected] of [
      [
        'gemini-3-pro-image',
        [
          [0.134, '1K/2K', 1120],
          [0.24, '4K', 2000],
        ],
      ],
      [
        'gemini-3.1-flash-image',
        [
          [0.045, '0.5K', 747],
          [0.067, '1K', 1120],
          [0.101, '2K', 1680],
          [0.151, '4K', 2520],
        ],
      ],
      ['gemini-3.1-flash-lite-image', [[0.0336, '1K', 1120]]],
    ]) {
      await visit('google', model);
      const rates = page.locator('[data-pricing-row^="image-output-equivalent:"]');
      assert.equal(await rates.count(), expected.length, model);
      for (const [index, [amount, resolution, tokens]] of expected.entries()) {
        const rate = rates.nth(index);
        assert.equal(await rate.getAttribute('data-source-amount'), String(amount));
        assert.equal(await rate.getAttribute('data-source-currency'), 'USD');
        assert.equal(await rate.getAttribute('data-unit'), 'per_image');
        assert.match(await rate.innerText(), /≈/);
        assert.ok(
          (await rate.locator('[data-condition="resolution"]').innerText()).includes(resolution),
        );
        assert.ok(
          (await rate.locator('[data-condition="outputTokens"]').innerText()).includes(
            String(tokens),
          ),
        );
      }
    }
  });
  await verify('Gemini per-input-image equivalent', async () => {
    await visit('google', 'gemini-3-pro-image');
    const rate = page.locator('[data-pricing-row="image-input-equivalent"]');
    assert.equal(
      await rate.count(),
      1,
      'Expected one input image equivalent in the visible tariff',
    );
    assert.ok(await rate.isVisible());
    assert.equal(
      await rate.locator('xpath=ancestor::article').getAttribute('data-syncable'),
      'false',
    );
    assert.equal(await rate.getAttribute('data-unit'), 'per_image');
    assert.equal(await rate.getAttribute('data-source-currency'), 'USD');
    const direction = { en: 'Input tokens', zh: '输入 Token', ja: '入力トークン' };
    const units = { en: 'Per image', zh: '每张图片', ja: '画像 1 枚あたり' };
    const label = await rate.getByRole('rowheader').innerText();
    assert.ok(label.toLowerCase().includes(direction[locale].toLowerCase()));
    assert.ok((await bandText(rate)).includes(units[locale]));
    const tokens = await rate.locator('[data-condition="inputTokens"]').innerText();
    assert.ok(tokens.includes(direction[locale]));
    assert.match(tokens, /\b560\b/);
    assert.match(await sourceText(rate), /≈\$0\.0011\b/);
    assert.equal(await cnyText(rate), '≈¥0.0077');
  });
  await verify('Gemini Maps service tier restrictions', async () => {
    await visit('google', 'gemini-2.5-flash-lite');
    const maps = page.locator('[data-pricing-row^="tools:"][data-source-amount="25"]');
    assert.equal(await maps.count(), 1);
    const quote = maps.locator('xpath=ancestor::article');
    assert.equal(await quote.locator('details').nth(1).getAttribute('open'), null);
    assert.equal(await maps.getAttribute('data-unit'), 'per_thousand_grounded_prompts');
    assert.match(await sourceText(maps), /\$25\b/);
    assert.equal(await cnyText(maps), '¥175');
    const scope = maps.locator('xpath=ancestor::section[@data-pricing-scope][1]');
    for (const tier of ['Batch', 'Flex'])
      assert.ok(await scope.locator(`[data-service-name="${tier}"]`).count());
    const note = maps
      .locator('xpath=ancestor::table/../..')
      .locator('[data-condition="toolCondition"]');
    assert.equal(await note.count(), 1, 'Maps restriction must be beside the tool rate table');
    assert.ok(await note.isVisible());
    assert.match(await note.innerText(), /2\.5 Batch\/Flex Maps unavailable/);
  });
  await verify('Gemini image resolution restrictions', async () => {
    await visit('google', 'gemini-3.1-flash-lite-image');
    const image = page.locator('[data-pricing-row="image-output-equivalent:0"]');
    assert.equal(await image.count(), 1);
    const quote = image.locator('xpath=ancestor::article');
    assert.equal(await quote.locator('details').nth(1).getAttribute('open'), null);
    const note = image
      .locator('xpath=ancestor::table/../..')
      .locator('[data-condition="resolutionNote"]');
    assert.equal(
      await note.count(),
      1,
      'Resolution restriction must be beside the image rate table',
    );
    assert.ok(await note.isVisible());
    assert.match(await note.innerText(), /Only1K is supported;2K\/4K explicitly unsupported/);
  });
  await verify('Gemini Standard reference has exclusive input bands', async () => {
    await visit('google', 'gemini-3.1-pro-preview');
    const reference = page.locator(
      'article[data-quote-id^="reviewed-reference:"][data-service-name="Standard"]',
    );
    const upper = { en: 'up to 200000', zh: '不超过 200000', ja: '200000 以下' };
    const lower = { en: 'from 200001', zh: '从 200001 起', ja: '200001 以上' };
    for (const [usage, low, high] of [
      ['input', '14', '28'],
      ['output', '84', '126'],
      ['cache_read', '1.4', '2.8'],
    ]) {
      const standard = row(reference, `raw:${usage}`);
      const above = row(reference, `raw:tier-0:${usage}`);
      assert.equal(await standard.getAttribute('data-cny-amount'), low);
      assert.equal(await above.getAttribute('data-cny-amount'), high);
      const lowCondition = await bandText(standard);
      const highCondition = await bandText(above);
      assert.match(lowCondition, /\b200000\b/);
      assert.match(highCondition, /\b200001\b/);
      assert.ok(lowCondition.toLowerCase().includes(upper[locale]), lowCondition);
      assert.ok(highCondition.toLowerCase().includes(lower[locale]), highCondition);
    }
    assert.equal(await reference.locator('[data-pricing-row^="fees:"]').count(), 0);
  });
  await verify('DeepSeek peak and off-peak conditions match their rates', async () => {
    await visit('deepseek', 'deepseek-flash');
    const reference = page.locator('[data-quote-id="upstream:deepseek:deepseek-flash:CNY"]');
    const offPeak = row(reference, 'cost:input');
    const peak = row(reference, 'cost:schedule:windows:0:input');
    const labels = {
      en: { off: 'outside the listed peak times', peak: 'Peak', holiday: 'Off-peak rate' },
      zh: { off: '所列高峰时段之外', peak: '高峰', holiday: '适用非高峰价' },
      ja: { off: '記載のピーク時間帯以外', peak: 'ピーク', holiday: 'オフピーク料金' },
    }[locale];
    assert.equal(await offPeak.getAttribute('data-cny-amount'), '1');
    assert.equal(await peak.getAttribute('data-cny-amount'), '2');
    assert.ok(
      (await offPeak.locator('[data-condition="fallback"]').innerText()).includes(labels.off),
    );
    assert.equal(await peak.locator('[data-condition="fallback"]').count(), 0);
    assert.ok((await peak.locator('[data-condition="name"]').innerText()).includes(labels.peak));
    assert.match(
      await peak.locator('[data-condition="hours"]').innerText(),
      /09:00-12:00.*14:00-18:00/,
    );
    assert.match(await peak.locator('[data-condition="timezone"]').innerText(), /Asia\/Shanghai/);
    assert.ok(
      (await reference.locator('[data-condition="chineseLegalHolidays"]').innerText()).includes(
        labels.holiday,
      ),
    );
  });
  await verify('MiniMax tariffs do not borrow a model endpoint', async () => {
    await visit('minimax-cn', 'MiniMax-M3');
    for (const [tier, amount] of [
      ['Standard', '2.1'],
      ['Priority', '3.15'],
    ]) {
      const quote = page.locator('article[data-quote-id^="reviewed-reference:"]').filter({
        has: page.getByRole('heading', { name: tier, exact: true }),
      });
      assert.equal(await row(quote, 'raw-fees:0:input').getAttribute('data-cny-amount'), amount);
      assert.doesNotMatch(await quote.innerText(), /api\.minimax\.cn\/anthropic\/v1/);
    }
    for (const model of ['MiniMax-M3', 'MiniMax-M3.1-Flash']) {
      await visit('minimax-cn', model);
      const selected = page.locator('[data-syncable="true"]');
      assert.equal(await selected.count(), 1);
      assert.doesNotMatch(await selected.innerText(), /api\.minimax\.cn\/anthropic\/v1/);
    }
  });
  await verify('Gemini cache storage rates remain outside the native expression', async () => {
    await visit('google', 'gemini-3.1-pro-preview');
    const selected = page.locator('[data-syncable="true"]');
    const fee = row(selected, 'condition-fee:explicitCacheStorage');
    assert.equal(await fee.getAttribute('data-unit'), 'per_million_tokens_per_hour');
    assert.equal(await fee.getAttribute('data-source-currency'), 'USD');
    assert.match(await sourceText(fee), /\$4\.5\b/);
    assert.equal(await cnyText(fee), '¥31.5');
    assert.ok(await fee.locator('[data-condition="referenceFee"]').isVisible());
    assert.match(await selected.innerText(), /https:\/\/generativelanguage\.googleapis\.com/);

    await visit('google', 'gemini-3.8-flash');
    const flash = page.locator('[data-syncable="true"]');
    const currentFee = row(flash, 'condition-fee:explicitCacheStorage');
    const announcedFee = row(flash, 'condition-fee:explicitCacheStorage:next');
    assert.equal(await currentFee.getAttribute('data-cny-amount'), '3.5');
    assert.match(
      await currentFee.locator('[data-condition="validThrough"]').innerText(),
      /December 31, 2026/,
    );
    assert.equal(await announcedFee.getAttribute('data-cny-amount'), '7');
    assert.match(
      await announcedFee.locator('[data-condition="effectiveAt"]').innerText(),
      /January 1, 2027/,
    );
  });
  await verify(
    'Gemini image context and cache limits remain visible with audit closed',
    async () => {
      await visit('google', 'gemini-3-pro-image');
      const quote = page
        .locator('[data-pricing-row="image-input-equivalent"]')
        .locator('xpath=ancestor::article');
      assert.equal(await quote.locator('details').nth(1).getAttribute('open'), null);
      const context = quote.locator('[data-condition="contextNote"]');
      const cache = quote.locator('[data-condition="cacheAvailability"]');
      assert.ok(await context.isVisible());
      assert.match(await context.innerText(), /65,536.*>200K.*unreachable/);
      assert.ok(await cache.isVisible());
      assert.match(await cache.innerText(), /Context caching not supported/);
    },
  );
  await verify('Highest input tiers stop at their published upper bounds', async () => {
    for (const [provider, model, id, expected] of [
      ['volcengine', 'doubao-seed-2-0-pro-260215', 'cost:tier-1:input', /128001.*256000/],
      ['alibaba-cn', 'qwen3.7-plus', 'cost:tier-0:input', /256001.*1000000/],
      ['zhipuai', 'glm-4.7', 'cost:tier-0:input', /32000.*199999/],
    ]) {
      await visit(provider, model);
      const rate = row(page.locator('[data-syncable="true"]'), id);
      assert.match(await bandText(rate), expected);
    }
  });
  await verify('StepFun legacy cache eligibility label is localized', async () => {
    await visit('stepfun', 'step-5-preview');
    const fee = row(page.locator('[data-syncable="true"]'), 'condition-fee:legacyCacheHit');
    assert.equal(await fee.getAttribute('data-cny-amount'), '0.35');
    assert.equal(await fee.getAttribute('data-unit'), 'per_million_tokens');
    assert.equal(await cnyText(fee), '¥0.35');
    const condition = fee.locator('[data-condition="eligibility"]');
    assert.ok(await condition.isVisible());
    const label = { en: 'Eligibility', zh: '适用条件', ja: '適用条件' }[locale];
    assert.equal(await condition.locator('span').innerText(), label);
    assert.match(
      await condition.innerText(),
      /Used Step 5 Preview through the pay-as-you-go API before the effective time/,
    );
  });
  assert.deepEqual(findings, [], findings.join('\n'));
  return { findings: 25, passed: true };
}
