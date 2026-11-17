/** Compose preserved legacy versions and a new immutable upstream-only CNY snapshot. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { makeSnapshot } from './upstream-snapshot.mjs';
import { sha, domesticProviders } from './upstream-cny.mjs';
const [requestPath, out] = process.argv.slice(2);
const request = JSON.parse(readFileSync(requestPath));
const snapshot = makeSnapshot();
assert.equal(request.approval.confirmed, true);
assert.ok(request.approval.reference);
assert.equal(snapshot.releaseId, request.releaseId);
assert.equal(snapshot.manifestSha256, request.manifestSha256);
assert.equal(snapshot.manifest.upstreamSha, request.upstreamSha);
// Regenerate the original legacy package unchanged, never overwrite its fixed directory.
execFileSync(
  process.execPath,
  ['scripts/build-pages-site.mjs', 'data/cny/publication/first-release.json', out],
  { stdio: 'inherit' },
);
const old = JSON.parse(readFileSync(join(out, 'current.json')));
copyFileSync(join(out, 'index.html'), join(out, 'legacy-publication.html'));
const put = (p, b) => {
  mkdirSync(join(out, p, '..'), { recursive: true });
  writeFileSync(join(out, p), typeof b === 'string' ? b : JSON.stringify(b, null, 2) + '\n');
};
for (const [p, b] of Object.entries(snapshot.files)) put(`versions/${snapshot.releaseId}/${p}`, b);
for (const locale of ['en', 'zh', 'ja']) {
  const providers = snapshot.datasets[locale].providers;
  const prefix = 'api/' + (locale === 'en' ? '' : `i18n/${locale}/`);
  put(prefix + 'all.json', providers);
  put(prefix + 'providers.json', {
    providers: Object.values(providers).map(({ models, ...p }) => ({
      ...p,
      modelCount: Object.keys(models).length,
    })),
  });
  put(prefix + 'index.json', {
    models: Object.values(providers)
      .sort((a, b) => Number(domesticProviders.has(b.id)) - Number(domesticProviders.has(a.id)))
      .flatMap((p) =>
        Object.values(p.models).map((m) => ({ id: m.id, name: m.name ?? m.id, providerId: p.id })),
      ),
  });
  for (const p of Object.values(providers)) put(prefix + 'providers/' + p.id + '.json', p);
}
for (const id of Object.keys(snapshot.datasets.en.providers)) {
  const path = `dist/api/logos/${id}.svg`;
  try {
    mkdirSync(join(out, 'api/logos'), { recursive: true });
    copyFileSync(path, join(out, 'api/logos', id + '.svg'));
  } catch {
    throw Error('Missing checked-in upstream logo ' + id);
  }
}
put('api/newapi/ratio_config.json', snapshot.files['ratio_config.json']);
put('api/manifest.json', { ...snapshot.manifest, newapi: { exchangeRates: { CNY: 1 } } });
put('current.json', {
  schemaVersion: 2,
  releaseId: snapshot.releaseId,
  manifestSha256: snapshot.manifestSha256,
  fixedBase: `versions/${snapshot.releaseId}/`,
  modelSource: `versions/${snapshot.releaseId}/ratio_config.json`,
  modelSourceSha256: sha(snapshot.files['ratio_config.json']),
  complete: false,
  previousRelease: old.releaseId,
});
put(
  'publication.html',
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CNY source</title><body><h1>上游完整目录 · CNY</h1><p>上游固定版本 ${request.upstreamSha}。仅用上游资料；价格不是重新核价。缺源不以零补齐，订阅与不支持项不进入原生模型价格。</p><p>${snapshot.manifest.stats.providers} providers / ${snapshot.manifest.stats.models} model entries / ${snapshot.manifest.stats.apiModels} native prices · partial / complete=false</p><nav><a href="./">Browse</a> · <a href="./api/newapi/ratio_config.json">Native API</a> · <a href="./versions/${snapshot.releaseId}/exclusions.json">排除与缺价原因</a> · <a href="./versions/${snapshot.releaseId}/selection.json">区域选择</a> · <a href="./versions/${snapshot.releaseId}/manifest.json">Fixed manifest</a> · <a href="./current.json">Current</a> · <a href="./legacy-publication.html">旧43发布历史</a> · <a href="./site-manifest.json">Site inventory</a></nav><p>USDExchangeRate=1 / QuotaPerUnit=500000；分组倍率独立。无实例配置写入，工具参考不等于客户附加费或目标已清零。</p></body></html>`,
);
execFileSync('npm', ['exec', '--', 'tsc', '--noEmit'], { cwd: 'web', stdio: 'inherit' });
execFileSync('npm', ['exec', '--', 'vite', 'build', '--outDir', resolve(out)], {
  cwd: 'web',
  stdio: 'inherit',
});
const walk = (dir, prefix = '') =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), prefix + e.name + '/') : [prefix + e.name],
  );
put('site-manifest.json', {
  schemaVersion: 2,
  releaseId: snapshot.releaseId,
  manifestSha256: snapshot.manifestSha256,
  upstreamSha: request.upstreamSha,
  files: Object.fromEntries(
    walk(out)
      .filter((p) => p !== 'site-manifest.json')
      .map((p) => {
        const b = readFileSync(join(out, p));
        return [p, { sha256: sha(b), bytes: b.length }];
      }),
  ),
});
console.log(
  JSON.stringify({
    releaseId: snapshot.releaseId,
    manifestSha256: snapshot.manifestSha256,
    stats: snapshot.manifest.stats,
  }),
);
