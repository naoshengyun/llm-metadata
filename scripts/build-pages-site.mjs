/** Build an approved public static site; no gateway writes or hosting mutation. */
import { readFileSync, writeFileSync, mkdirSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildPublicationPackage } from '../.cache/cny-build/cny/publication-package.js';
import { preparePublicationTransition } from '../.cache/cny-build/cny/publication-promotion.js';
import { buildPublicationSite } from '../.cache/cny-build/cny/publication-page.js';
const root = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const safe = (p) => {
  const file = resolve(root, p);
  if (
    lstatSync(file).isSymbolicLink() ||
    !lstatSync(file).isFile() ||
    !realpathSync(file).startsWith(root + '/')
  )
    throw Error('tracked regular repository input required');
  return file;
};
const [requestPath, output, mode] = process.argv.slice(2);
if (!requestPath || !output) throw Error('request and exclusive output required');
const request = JSON.parse(readFileSync(safe(requestPath), 'utf8'));
const artifact = readFileSync(safe(request.artifactPath));
if (createHash('sha256').update(artifact).digest('hex') !== request.artifactSha256)
  throw Error('original artifact bytes changed');
if (request.selection.purpose !== 'candidate') throw Error('test package cannot be published');
const pack = buildPublicationPackage(artifact, request.selection, 'v2');
const plan = preparePublicationTransition(null, pack.files, pack, 'promote');
if (
  pack.releaseId !== request.releaseId ||
  pack.manifestSha256 !== request.manifestSha256 ||
  plan.snapshot.revision !== request.snapshotRevision
)
  throw Error('release confirmation identity changed');
if (
  mode !== '--proposal' &&
  (request.approval?.confirmed !== true ||
    !request.approval.reference ||
    request.approval.releaseId !== pack.releaseId ||
    request.approval.manifestSha256 !== pack.manifestSha256)
)
  throw Error('explicit exact first-release approval required');
const site = buildPublicationSite(plan.snapshot),
  out = resolve(output);
mkdirSync(out);
for (const [path, body] of Object.entries(site.files)) {
  const target = join(out, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body, { flag: 'wx' });
}
console.log(
  JSON.stringify({
    releaseId: pack.releaseId,
    manifestSha256: pack.manifestSha256,
    snapshotRevision: plan.snapshot.revision,
    siteManifestSha256: createHash('sha256').update(site.files['site-manifest.json']).digest('hex'),
    models: request.selection.models.length,
    plugins: Object.values(request.selection.plugins).reduce((n, p) => n + p.length, 0),
    tools: request.selection.tools.length,
    approved: request.approval?.confirmed === true,
    mode: mode ?? 'approved',
  }),
);
