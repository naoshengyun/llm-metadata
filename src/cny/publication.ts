import { canonical, generateCny, hash, type OfficialQuote } from './generate.js';
import { verifyArtifact, type FixedArtifact } from './artifact.js';
import { createHash } from 'node:crypto';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ModelReleaseSelection {
  models: string[];
  mode: 'partial' | 'full';
  purpose: 'test' | 'candidate';
}
function releaseJson(value: unknown): string {
  return JSON.stringify(JSON.parse(canonical(value)), null, 2) + '\n';
}
export function buildModelRelease(artifact: FixedArtifact, selection: ModelReleaseSelection) {
  if (!verifyArtifact(artifact)) throw new Error('invalid fixed artifact');
  if (
    !selection ||
    !Array.isArray(selection.models) ||
    !selection.models.length ||
    selection.models.some((n) => typeof n !== 'string' || !n.trim()) ||
    new Set(selection.models).size !== selection.models.length ||
    !['partial', 'full'].includes(selection.mode) ||
    !['test', 'candidate'].includes(selection.purpose)
  )
    throw new Error('explicit unique model selection, mode and purpose required');
  const names = [...selection.models].sort();
  const sourceRecords = (artifact.quotes as { records?: OfficialQuote[] })?.records;
  if (
    !Array.isArray(sourceRecords) ||
    new Set(sourceRecords.map((q) => q.id)).size !== sourceRecords.length
  )
    throw new Error('missing or duplicate official source records');
  if (
    selection.mode === 'full' &&
    (!artifact.manifest.complete || names.length !== Object.keys(artifact.models).length)
  )
    throw new Error('full release requires a complete candidate and full model selection');
  for (const name of names) {
    const price = artifact.models[name];
    if (
      price?.billing_mode !== 'tiered_expr' ||
      typeof price.billing_expr !== 'string' ||
      !price.billing_expr.trim()
    )
      throw new Error(`selected model requires a complete mode/expression pair: ${name}`);
    const record = sourceRecords.find((q) => q.id === artifact.selection[name]);
    if (!record) throw new Error(`selected model has no eligible source: ${name}`);
    const regenerated = generateCny({
      upstream: { providers: {} },
      records: [record],
      selection: { [name]: record.id },
    });
    if (hash(regenerated.models[name] ?? null) !== hash(price))
      throw new Error(`selected model has ineligible or inconsistent source: ${name}`);
  }
  const modelSource = {
    success: true,
    data: {
      billing_mode: Object.fromEntries(
        names.map((name) => [name, artifact.models[name]!.billing_mode]),
      ),
      billing_expr: Object.fromEntries(
        names.map((name) => [name, artifact.models[name]!.billing_expr]),
      ),
    },
  };
  const records = sourceRecords;
  const selected = names.map((model) => {
    const record = records.find((q) => q.id === artifact.selection[model])!;
    return { model, quoteId: record.id, source: structuredClone(record.source) };
  });
  const selectedIds = new Set(selected.map((q) => q.quoteId));
  const notSelected = records
    .filter((q) => !selectedIds.has(q.id))
    .map((q) => {
      const generated = generateCny({
        upstream: { providers: {} },
        records: [q],
        selection: { [q.model]: q.id },
      });
      const status = generated.diagnostics[0]?.status ?? 'incomplete';
      return {
        quoteId: q.id,
        model: q.model,
        kind: q.kind ?? 'model',
        reason: status === 'ready' ? 'not-selected' : status,
      };
    });
  const content = {
    schemaVersion: 1,
    adapterVersion: 'cny-model-source/v1',
    source: {
      artifactId: artifact.id,
      artifactHash: hash(artifact),
      sourceSha: artifact.sourceSha,
      checkedAt: (artifact.quotes as { checkedAt?: string }).checkedAt,
      nativeBaseline: artifact.manifest.nativeBaseline,
      policy: structuredClone(artifact.manifest.policy),
    },
    selection: { models: names, mode: selection.mode, purpose: selection.purpose },
    selected,
    notSelected,
    complete: artifact.manifest.complete,
    partial: selection.mode === 'partial',
    coverage: structuredClone(artifact.data),
    exclusions: structuredClone(artifact.exclusions),
    partitionStatus: {
      models: 'model-source-only',
      plugins: 'separate-configuration-required',
      tools: 'separate-configuration-required',
    },
    modelSource,
    modelSourceSha256: createHash('sha256').update(releaseJson(modelSource)).digest('hex'),
  };
  return { ...content, id: hash(content) };
}

/** Writes only a local immutable candidate version; no hosting or promotion. */
export function writeModelRelease(root: string, release: ReturnType<typeof buildModelRelease>) {
  const { id, ...content } = release;
  const response = releaseJson(release.modelSource);
  if (
    !/^[a-f0-9]{64}$/.test(id) ||
    hash(content) !== id ||
    createHash('sha256').update(response).digest('hex') !== release.modelSourceSha256
  )
    throw new Error('invalid model release identity');
  const names = release.selection.models;
  const data = release.modelSource.data;
  if (
    [data, data?.billing_mode, data?.billing_expr].some(
      (value) => !value || typeof value !== 'object' || Array.isArray(value),
    )
  )
    throw new Error('model response requires data and model field maps');
  if (
    release.modelSource.success !== true ||
    !names.length ||
    hash(Object.keys(data).sort()) !== hash(['billing_expr', 'billing_mode']) ||
    hash(Object.keys(data.billing_mode).sort()) !== hash([...names].sort()) ||
    hash(Object.keys(data.billing_expr).sort()) !== hash([...names].sort()) ||
    names.some(
      (name) =>
        data.billing_mode[name] !== 'tiered_expr' ||
        typeof data.billing_expr[name] !== 'string' ||
        !data.billing_expr[name]!.trim(),
    )
  )
    throw new Error('model response must completely cover selection');
  const directory = join(realpathSync(root), id);
  mkdirSync(directory); // Exclusive: existing directories, files and symlinks all reject.
  writeFileSync(join(directory, 'release.json'), releaseJson(release), {
    flag: 'wx',
  });
  writeFileSync(join(directory, 'ratio_config.json'), response, { flag: 'wx' });
  return directory;
}
