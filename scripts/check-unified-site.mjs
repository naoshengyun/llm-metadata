/** Exercise the final built site in real desktop and mobile Chromium. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { sha } from './upstream-cny.mjs';

const [sitePath, playwrightPath, evidenceDir] = process.argv.slice(2);
assert.ok(
  sitePath && playwrightPath && evidenceDir,
  'Pass site, Playwright module and exclusive evidence directory',
);
const root = resolve(sitePath);
const { chromium } = await import(playwrightPath);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    assert.ok(file.startsWith(root + sep));
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await mkdir(evidenceDir);
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ channel: 'chrome' });
const get = async (path) => {
  const response = await fetch(origin + '/' + path);
  assert.ok(response.ok, path);
  return response.text();
};
const snapshot = (page, width, name) =>
  page.screenshot({ path: `${evidenceDir}/${width}-${name}.png` });
const results = { browser: browser.version(), viewports: [] };
try {
  const current = JSON.parse(await get('current.json'));
  assert.equal(current.schemaVersion, 3);
  const fixedManifest = await get(current.fixedBase + 'manifest.json');
  assert.equal(sha(fixedManifest), current.manifestSha256);
  const { sourceSha, stats, files } = JSON.parse(fixedManifest);
  results.sourceSha = sourceSha;
  results.candidateId = current.releaseId;
  results.manifestSha256 = current.manifestSha256;
  const canonical = await get('api/newapi/ratio_config.json');
  assert.equal(await get(current.modelSource), canonical);
  assert.equal(sha(canonical), current.modelSourceSha256);
  results.ratioSha256 = sha(canonical);
  const { data } = JSON.parse(canonical);
  const names = Object.keys(data.billing_expr).sort();
  assert.equal(names.length, stats.apiModels);
  assert.deepEqual(Object.keys(data.billing_mode).sort(), names);
  assert.ok(!names.includes('doubao-seedance-2-5-260628'));
  const coverage = JSON.parse(await get(current.fixedBase + 'coverage.json'));
  for (const q of coverage.quotes.filter(({ outputKind }) => outputKind === 'tool-reference'))
    assert.ok(!names.includes(q.modelId));

  // Check the complete localized public catalog contract, including exact selected owner and expression.
  for (const prefix of ['api/', 'api/i18n/zh/', 'api/i18n/ja/']) {
    const allPath = prefix + 'all.json';
    const text = await get(allPath);
    assert.equal(await get(current.fixedBase + allPath), text);
    assert.equal(sha(text), files[allPath].sha256);
    const all = JSON.parse(text);
    const syncable = new Map();
    const index = JSON.parse(await get(current.fixedBase + prefix + 'index.json'));
    const indexKeys = new Set(
      index.models.map(({ providerId, id }) => JSON.stringify([providerId, id])),
    );
    assert.equal(indexKeys.size, stats.models);
    for (const [providerId, provider] of Object.entries(all)) {
      const providerPath = prefix + 'providers/' + providerId + '.json';
      const detail = await get(current.fixedBase + providerPath);
      assert.equal(sha(detail), files[providerPath].sha256);
      assert.deepEqual(JSON.parse(detail), provider);
      for (const [id, model] of Object.entries(provider.models)) {
        assert.ok(indexKeys.has(JSON.stringify([providerId, id])));
        if (model.cnyPrice.exported) {
          assert.ok(!syncable.has(id), id);
          syncable.set(id, model.cnyPrice.expr);
          assert.equal(model.cost.publication_expr, model.cnyPrice.expr, id);
          assert.equal(model.cnyPrice.quotes.filter((q) => q.syncable).length, 1, id);
          assert.equal(data.billing_mode[id], 'tiered_expr', id);
        } else assert.ok(!model.cost?.publication_expr, id);
      }
    }
    assert.deepEqual(Object.fromEntries(syncable), data.billing_expr);
  }

  const previous = JSON.parse(await get('upstream-current.json'));
  assert.equal(previous.releaseId, current.previousRelease);
  assert.equal(sha(await get(previous.modelSource)), previous.modelSourceSha256);
  assert.ok((await get('upstream-publication.html')).includes('./' + previous.modelSource));
  const first = JSON.parse(await get('legacy-current.json'));
  const firstSource = `versions/${first.releaseId}/ratio_config.json`;
  assert.ok((await get('legacy-publication.html')).includes('./' + firstSource));
  assert.notEqual(await get(firstSource), canonical);
  const select = (id, model) =>
    '/#' + new URLSearchParams({ p: id, ...(model ? { m: model } : {}) });

  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const mobile = viewport.width < 700;
    const context = await browser.newContext({
      viewport,
      locale: 'en-US',
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: mobile ? 2 : 1,
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const goto = (path) => page.goto(origin + path, { waitUntil: 'domcontentloaded' });
    const expectVisible = (locator) => locator.waitFor({ timeout: 7000 });
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    const readCopy = async (button) => {
      const target = await button.elementHandle();
      await button.click();
      await page.waitForFunction((element) => element.dataset.copied === 'true', target);
      await target.dispose();
      return clipboard();
    };

    await goto(select('moonshotai-cn'));
    await page.getByRole('button', { name: 'Card view' }).click();
    const kimi = page
      .locator('article')
      .filter({
        has: page.getByRole('button', { name: 'View details for Kimi K3.1 Pro', exact: true }),
      });
    await expectVisible(kimi.getByText('CNY base price · included in API'));
    assert.match(await kimi.innerText(), /¥13/);
    assert.match(await kimi.innerText(), /¥68/);
    await snapshot(page, viewport.width, 'cards');
    await page.getByRole('button', { name: 'Table view' }).click();
    const row = page
      .getByRole('row')
      .filter({
        has: page.getByRole('button', { name: 'View details for Kimi K3.1 Pro', exact: true }),
      });
    await expectVisible(row.getByText('CNY base price · included in API'));
    assert.match(await row.innerText(), /¥13/);
    assert.match(await row.innerText(), /¥68/);
    await snapshot(page, viewport.width, 'table');
    await page.getByRole('textbox', { name: 'Search models…', exact: true }).fill('kimi-k3.1-pro');
    await page.getByRole('button', { name: 'View details for Kimi K3.1 Pro', exact: true }).click();
    await expectVisible(page.getByRole('heading', { name: 'Official tariffs' }));
    const kimiExpr = Object.entries(data.billing_expr).find(([key]) => key === 'kimi-k3.1-pro')[1];
    assert.equal(await page.locator('code').filter({ hasText: 'tier(' }).innerText(), kimiExpr);
    await page.getByRole('heading', { name: 'Official tariffs' }).scrollIntoViewIfNeeded();
    await snapshot(page, viewport.width, 'detail');
    await expectVisible(
      page.getByText('Save and read-back in the isolated rc.50 acceptance test').first(),
    );
    await expectVisible(page.getByText('Actual billing awaiting verification').first());

    await page.getByRole('button', { name: 'View details for Moonshot AI', exact: true }).click();
    await expectVisible(
      page.getByText('explicit-official-price-selected', { exact: false }).first(),
    );
    assert.equal(new URL(page.url()).hash, select('moonshotai', 'kimi-k3.1-pro').split('/')[1]);

    if (mobile) await page.getByText('Search providers / all models', { exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Filter providers or models…' })
      .fill('gpt-image-2.5-sunburst');
    await page.getByRole('button', { name: /gpt-image-2\.5-sunburst/i }).click();
    assert.equal(
      new URL(page.url()).hash,
      select('openai', 'gpt-image-2.5-sunburst').split('/')[1],
    );
    await expectVisible(page.getByText('Selected for sync', { exact: true }).first());

    await goto(select('volcengine', 'doubao-seedance-2-5-260628'));
    for (const name of [
      'seedance-4k-two-target-billing-cases-unverified',
      'Official price documented',
      'Model expression import evidence',
      'Target deployment billing still pending for both 4K cases',
    ])
      await expectVisible(page.getByText(name, { exact: false }).first());
    const fullTariff = page.locator('pre').first();
    const seedance = JSON.parse(await fullTariff.innerText());
    assert.deepEqual(seedance.rows, [
      ['480p,720p', 70, 42],
      ['1080p', 77, 46],
      ['4K', 31, 19],
    ]);
    await fullTariff.scrollIntoViewIfNeeded();
    await snapshot(page, viewport.width, 'seedance');

    await goto(select('alibaba-coding-plan-cn'));
    await expectVisible(
      page.getByText('Subscription plan; not a token tariff', { exact: false }).first(),
    );
    await goto(select('volcengine'));
    await page.getByRole('button', { name: 'Card view' }).click();
    await expectVisible(page.getByText(/CNY 0\.12 \/ count/).first());
    await page.getByRole('button', { name: 'Table view' }).click();
    await expectVisible(page.getByText(/CNY 0\.12 \/ count/).first());

    // Actually use every provider clipboard that contributes at least one native key.
    const selectedProviders = [
      ...new Set(
        coverage.models.filter(({ syncable }) => syncable).map(({ providerId }) => providerId),
      ),
    ];
    const merged = { billing_expr: {}, billing_mode: {} };
    for (const provider of selectedProviders) {
      await goto(select(provider));
      const { data: subset } = JSON.parse(
        await readCopy(page.getByRole('button', { name: 'Copy ratio_config' })),
      );
      for (const field of ['billing_expr', 'billing_mode']) {
        for (const [key, value] of Object.entries(subset[field])) {
          assert.ok(!Object.hasOwn(merged[field], key), key);
          merged[field][key] = value;
        }
      }
    }
    assert.deepEqual(merged, data);

    await page.getByRole('button', { name: 'new-api' }).click();
    const dialog = page.getByRole('dialog');
    await expectVisible(
      dialog.getByText('A plugin-specific override takes precedence.', { exact: false }),
    );
    await expectVisible(dialog.getByText('tool calls are free', { exact: false }));
    await dialog.getByText('Official tool tariff references').click();
    await expectVisible(dialog.getByText('search_std · CNY 0.01 / per_call'));
    await dialog.getByText('Official tool tariff references').click();
    assert.equal(
      await readCopy(dialog.getByRole('button', { name: 'Copy full configuration' })),
      canonical,
    );
    const download = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Download configuration' }).click();
    const downloaded = await download;
    assert.equal(downloaded.suggestedFilename(), 'ratio_config.json');
    assert.equal(await readFile(await downloaded.path(), 'utf8'), canonical);
    assert.equal(
      new URL(
        await dialog.getByRole('link', { name: 'Download configuration' }).getAttribute('href'),
        origin + '/',
      ).pathname,
      '/' + current.modelSource,
    );
    await snapshot(page, viewport.width, 'export');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Change language' }).click();
    await page.getByRole('menuitemradio', { name: '中文' }).click();
    await expectVisible(page.getByRole('button', { name: '表格视图' }));
    await page.getByRole('button', { name: '切换语言' }).click();
    await page.getByRole('menuitemradio', { name: '日本語' }).click();
    await expectVisible(page.getByRole('button', { name: 'テーブル表示' }));
    await goto(select('moonshotai-cn', 'kimi-k3.1-pro'));
    await expectVisible(page.getByRole('heading', { name: '公式料金表' }));
    assert.deepEqual(errors, []);
    results.viewports.push({
      viewport,
      mobile,
      providersCopied: selectedProviders.length,
      modelsCompared: names.length,
      languages: ['en', 'zh', 'ja'],
      errors,
    });
    await context.close();
  }
  results.passed = true;
} catch (error) {
  results.failed = error.message;
  throw error;
} finally {
  await browser.close();
  server.close();
  await writeFile(
    resolve(evidenceDir, 'browser-report.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
}
console.log(JSON.stringify(results, null, 2));
