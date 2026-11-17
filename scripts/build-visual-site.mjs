/** Compose the upstream application with the approved publication. Never run the upstream price build. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const [requestFile, out] = process.argv.slice(2);
execFileSync(process.execPath, ['scripts/build-pages-site.mjs', requestFile, out], {
  stdio: 'inherit',
});
const request = JSON.parse(readFileSync(requestFile));
const artifact = JSON.parse(readFileSync(request.artifactPath));
const fixed = JSON.parse(readFileSync(join(out, 'api/newapi/ratio_config.json')));
const providers = {};
const names = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  moonshot: 'Moonshot',
  zhipu: '智谱 Zhipu',
  dashscope: '阿里云 DashScope',
  volcengine: '火山引擎 Volcengine',
};
const convert = (v, rate, key = '') =>
  typeof v === 'number'
    ? key === 'size'
      ? v
      : v * rate
    : Array.isArray(v)
      ? v.map((x) => convert(x, rate))
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v).map(([k, x]) => [k, k === 'tier' ? x : convert(x, rate, k)]),
          )
        : v;
for (const id of request.selection.models) {
  const quote = artifact.quotes.records.find((q) => q.id === artifact.selection[id]);
  assert.ok(quote, `missing exact quote ${id}`);
  const provider = (providers[quote.provider] ??= {
    id: quote.provider,
    name: names[quote.provider] ?? quote.provider,
    currency: 'CNY',
    doc: quote.source.url,
    models: {},
  });
  const cost = {
    ...convert(quote.cost, quote.currency === 'USD' ? 7 : 1),
    currency: 'CNY',
    publication_expr: fixed.data.billing_expr[id],
  };
  if (quote.cost.cache_write_1h !== undefined)
    provider.billing = {
      ...provider.billing,
      cacheWrite1h: quote.cost.cache_write_1h / quote.cost.input,
    };
  if (quote.cost.cache_write_12h !== undefined)
    provider.billing = {
      ...provider.billing,
      cacheWrite12h: quote.cost.cache_write_12h / quote.cost.input,
    };
  // TTL prices are quoted amounts, not inferred from a provider-wide multiplier.
  provider.models[id] = {
    id,
    name: id,
    cost,
    description: quote.description,
    last_updated: quote.source.checkedAt,
    publication: {
      quoteId: quote.id,
      sourceCurrency: quote.currency,
      source: quote.source,
      priceList: quote.priceList,
      feeDeclarations: quote.feeDeclarations,
    },
  };
}
assert.equal(
  Object.values(providers).reduce((n, p) => n + Object.keys(p.models).length, 0),
  43,
);
for (const id of Object.keys(providers)) {
  const logo = [
    'dist/api/logos/' +
      ({ moonshot: 'moonshotai-cn', zhipu: 'zhipuai', dashscope: 'alibaba-cn' }[id] ?? id) +
      '.svg',
  ].find((p) => {
    try {
      return readFileSync(p).length > 0;
    } catch {
      return false;
    }
  });
  if (logo) {
    mkdirSync(join(out, 'api/logos'), { recursive: true });
    copyFileSync(logo, join(out, 'api/logos/' + id + '.svg'));
  }
}
const put = (path, value) => {
  mkdirSync(join(out, path, '..'), { recursive: true });
  writeFileSync(join(out, path), JSON.stringify(value, null, 2) + '\n');
};
const index = Object.values(providers).flatMap((p) =>
  Object.keys(p.models).map((id) => ({ id, name: id, providerId: p.id })),
);
const providerIndex = {
  providers: Object.values(providers).map(({ models, ...p }) => ({
    ...p,
    modelCount: Object.keys(models).length,
  })),
};
for (const locale of ['', 'i18n/zh/', 'i18n/ja/']) {
  put('api/' + locale + 'providers.json', providerIndex);
  put('api/' + locale + 'index.json', { models: index });
  for (const p of Object.values(providers)) put('api/' + locale + 'providers/' + p.id + '.json', p);
}
put('api/all.json', providers);
put('api/manifest.json', {
  stats: { providers: Object.keys(providers).length, models: 43 },
  newapi: { exchangeRates: { CNY: 1 } },
  releaseId: request.releaseId,
  complete: false,
});
// Keep the old publication index available as an audit/download view, outside model browsing.
copyFileSync(join(out, 'index.html'), join(out, 'publication.html'));
execFileSync('npm', ['exec', '--', 'tsc', '--noEmit'], { cwd: 'web', stdio: 'inherit' });
execFileSync('npm', ['exec', '--', 'vite', 'build', '--outDir', resolve(out)], {
  cwd: 'web',
  stdio: 'inherit',
});
const walk = (dir, prefix = '') =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), prefix + e.name + '/') : [prefix + e.name],
  );
const manifest = JSON.parse(readFileSync(join(out, 'site-manifest.json')));
manifest.files = Object.fromEntries(
  walk(out)
    .filter((p) => p !== 'site-manifest.json')
    .map((p) => {
      const b = readFileSync(join(out, p));
      return [p, { sha256: createHash('sha256').update(b).digest('hex'), bytes: b.length }];
    }),
);
put('site-manifest.json', manifest);
