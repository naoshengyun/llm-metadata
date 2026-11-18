import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adaptCatalog, sha } from './upstream-cny.mjs';
const json = (v) => JSON.stringify(v, null, 2) + '\n';
export function makeSnapshot(repository = '.') {
  const root = join(repository, 'data/upstream/b755761bf') + '/';
  const source = JSON.parse(readFileSync(root + 'source.json'));
  for (const [file, meta] of Object.entries(source.files))
    if (sha(readFileSync(root + file)) !== meta.sha256)
      throw Error('upstream source hash mismatch: ' + file);
  const datasets = Object.fromEntries(
    ['en', 'zh', 'ja'].map((l) => [l, adaptCatalog(JSON.parse(readFileSync(root + l + '.json')))]),
  );
  const main = datasets.en;
  const releaseId = sha(
    json({
      adapter: 'upstream-cny/v1',
      source,
      selected: main.selected,
      exclusions: main.exclusions,
      catalogs: Object.fromEntries(
        Object.entries(datasets).map(([l, d]) => [l, sha(json(d.providers))]),
      ),
    }),
  );
  const files = {
    'ratio_config.json': json(main.config),
    'selection.json': json(main.selected),
    'exclusions.json': json(main.exclusions),
    'source.json': json(source),
  };
  for (const locale of ['en', 'zh', 'ja'])
    files[`catalog.${locale}.json`] = json(datasets[locale].providers);
  const manifest = {
    schemaVersion: 1,
    adapterVersion: 'upstream-cny/v1',
    releaseId,
    upstreamSha: source.upstreamSha,
    complete: false,
    stats: main.stats,
    policy: {
      source: 'upstream-only',
      CNY: 1,
      USD: 7,
      domesticFallback: false,
      groupRatio: 'independent',
    },
    files: Object.fromEntries(
      Object.entries(files).map(([p, b]) => [p, { sha256: sha(b), bytes: Buffer.byteLength(b) }]),
    ),
  };
  files['manifest.json'] = json(manifest);
  return { releaseId, manifestSha256: sha(files['manifest.json']), files, manifest, datasets };
}
