/** Compose preserved legacy versions and a new immutable upstream-only CNY snapshot. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { makeSnapshot } from './upstream-snapshot.mjs';
import { sha, domesticProviders } from './upstream-cny.mjs';
import { hash } from '../.cache/cny-build/cny/generate.js';

const [requestPath, out, candidatePath] = process.argv.slice(2);
const unified = candidatePath ? readUnifiedCandidate(candidatePath) : null;

function readUnifiedCandidate(directory) {
  const manifestBytes = readFileSync(join(directory, 'manifest.json'));
  const { candidateId, ...manifest } = JSON.parse(manifestBytes);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(hash(manifest), candidateId, 'Unified candidate identity mismatch');
  const files = Object.fromEntries(
    Object.entries(manifest.files).map(([name, { sha256, bytes }]) => {
      assert.match(name, /^(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.json$/);
      assert.ok(!name.split('/').some((part) => part === '.' || part === '..'));
      const contents = readFileSync(join(directory, name));
      assert.equal(contents.length, bytes, name);
      assert.equal(sha(contents), sha256, name);
      return [name, contents];
    }),
  );
  return { candidateId, manifest, manifestBytes, files };
}
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
  writeFileSync(
    join(out, p),
    typeof b === 'string' || Buffer.isBuffer(b) ? b : JSON.stringify(b, null, 2) + '\n',
  );
};
for (const [p, b] of Object.entries(snapshot.files)) put(`versions/${snapshot.releaseId}/${p}`, b);
if (!unified) {
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
}
const providersForLogos = unified
  ? JSON.parse(unified.files['api/all.json'])
  : snapshot.datasets.en.providers;
const upstreamLogoIds = new Set(Object.keys(snapshot.datasets.en.providers));
if (unified) {
  for (const { providerId, origin } of JSON.parse(unified.files['coverage.json']).models) {
    if (origin === 'upstream') upstreamLogoIds.add(providerId);
  }
}
for (const id of Object.keys(providersForLogos)) {
  const path = `dist/api/logos/${id}.svg`;
  try {
    mkdirSync(join(out, 'api/logos'), { recursive: true });
    copyFileSync(path, join(out, 'api/logos', id + '.svg'));
  } catch (error) {
    // Providers introduced by the official catalog can use the site's initials fallback.
    if (error.code === 'ENOENT' && !upstreamLogoIds.has(id)) continue;
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
if (unified) {
  const { candidateId, manifest, manifestBytes, files } = unified;
  const previous = JSON.parse(readFileSync(join(out, 'current.json')));
  const firstPage = readFileSync(join(out, 'legacy-publication.html'), 'utf8');
  put('legacy-current.json', old);
  put(
    'legacy-publication.html',
    firstPage
      .replace('./api/newapi/ratio_config.json', `./versions/${old.releaseId}/ratio_config.json`)
      .replace('./current.json', './legacy-current.json'),
  );
  const priorPage = readFileSync(join(out, 'publication.html'), 'utf8');
  put(
    'upstream-publication.html',
    priorPage
      .replace('./api/newapi/ratio_config.json', './' + previous.modelSource)
      .replace('./current.json', './upstream-current.json'),
  );
  copyFileSync(join(out, 'current.json'), join(out, 'upstream-current.json'));
  const fixedBase = `versions/${candidateId}/`;
  const priceFile = 'api/newapi/ratio_config.json';
  for (const [name, bytes] of Object.entries(files)) {
    put(fixedBase + name, bytes);
    if (name.startsWith('api/')) put(name, bytes);
  }
  put(fixedBase + 'manifest.json', manifestBytes);
  put('api/manifest.json', {
    candidateId,
    ...manifest,
    newapi: { exchangeRates: { CNY: 1 } },
  });
  put('current.json', {
    schemaVersion: 3,
    releaseId: candidateId,
    manifestSha256: sha(manifestBytes),
    fixedBase,
    modelSource: fixedBase + priceFile,
    modelSourceSha256: manifest.files[priceFile].sha256,
    sourceSha: manifest.sourceSha,
    complete: false,
    previousRelease: previous.releaseId,
  });
  put(
    'publication.html',
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>脑生云 CNY 价格源</title><main><h1>脑生云 CNY 价格源</h1><p>${manifest.stats.models} 条目录记录 · ${manifest.stats.apiModels} 个可同步价格键</p><ul><li><a href="./">模型目录与工具参考</a></li><li><a href="./${fixedBase}${priceFile}" download>下载 New API 价格 JSON</a></li><li><a href="./${fixedBase}coverage.json">完整覆盖清单</a></li><li><a href="./${fixedBase}price-diff.json">价格差异</a></li><li><a href="./${fixedBase}manifest.json">固定候选清单</a></li><li><a href="./upstream-publication.html">历史上游价格页面</a></li><li><a href="./legacy-publication.html">历史 43 价格页面</a></li></ul></main></html>`,
  );
}
execFileSync('npm', ['exec', '--', 'tsc', '--noEmit'], { cwd: 'web', stdio: 'inherit' });
execFileSync('npm', ['exec', '--', 'vite', 'build', '--outDir', resolve(out)], {
  cwd: 'web',
  stdio: 'inherit',
});
const walk = (dir, prefix = '') =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), prefix + e.name + '/') : [prefix + e.name],
  );
const identity = unified
  ? {
      schemaVersion: 3,
      releaseId: unified.candidateId,
      manifestSha256: sha(unified.manifestBytes),
      upstreamSha: unified.manifest.upstreamSha,
      sourceSha: unified.manifest.sourceSha,
    }
  : {
      schemaVersion: 2,
      releaseId: snapshot.releaseId,
      manifestSha256: snapshot.manifestSha256,
      upstreamSha: request.upstreamSha,
    };
put('site-manifest.json', {
  ...identity,
  complete: false,
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
    ...identity,
    stats: unified?.manifest.stats ?? snapshot.manifest.stats,
  }),
);
