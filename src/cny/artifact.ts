import { CNY_POLICY, hash } from './generate.js';
export interface ArtifactInput {
  sourceSha: string;
  data: unknown;
  quotes: unknown;
  selection: Record<string, string>;
  models: Record<string, { billing_mode: 'tiered_expr'; billing_expr: string }>;
  plugins: Record<string, Record<string, string>>;
  tools: Record<string, number>;
  exclusions: unknown[];
  description?: string;
}
export function buildArtifact(input: ArtifactInput, generatedAt = new Date().toISOString()) {
  if (!/^[a-f0-9]{40}$/.test(input.sourceSha)) throw new Error('full source SHA required');
  const { description: _description, ...fixed } = structuredClone(input);
  const manifest = {
    sourceSha: fixed.sourceSha,
    dataHash: hash(fixed.data),
    quotesHash: hash(fixed.quotes),
    policyHash: hash(CNY_POLICY),
    partitionHashes: {
      models: hash(fixed.models),
      plugins: hash(fixed.plugins),
      tools: hash(fixed.tools),
    },
    selection: fixed.selection,
    exclusions: fixed.exclusions,
    complete: fixed.exclusions.length === 0,
    nativeBaseline: 'f2aa91232ed3e5878a614762ace6736a2b74257f',
    policy: CNY_POLICY,
  };
  return { ...fixed, manifest, id: hash({ ...fixed, manifest }), generatedAt };
}
export type FixedArtifact = ReturnType<typeof buildArtifact>;
export function verifyArtifact(artifact: FixedArtifact): boolean {
  try {
    // buildArtifact accepts structural extras; select only its public input fields.
    const input: ArtifactInput = {
      sourceSha: artifact.sourceSha,
      data: artifact.data,
      quotes: artifact.quotes,
      selection: artifact.selection,
      models: artifact.models,
      plugins: artifact.plugins,
      tools: artifact.tools,
      exclusions: artifact.exclusions,
    };
    return (
      buildArtifact(input, artifact.generatedAt).id === artifact.id &&
      hash(buildArtifact(input).manifest) === hash(artifact.manifest)
    );
  } catch {
    return false;
  }
}
function priceSemantics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(priceSemantics);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['description', 'checkedAt', 'generatedAt', 'dryRun'].includes(key))
        .map(([key, item]) => [key, priceSemantics(item)]),
    );
  return value;
}
/** Only price semantics, not source check dates, descriptions, build timestamps or dry runs. */
export function semanticDiff(before: FixedArtifact, after: FixedArtifact) {
  const changes: { partition: string; key: string; before: unknown; after: unknown }[] = [];
  for (const partition of ['models', 'plugins', 'tools', 'selection'] as const) {
    const old = before[partition],
      next = after[partition];
    for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (hash(old[key] ?? null) !== hash(next[key] ?? null))
        changes.push({ partition, key, before: old[key] ?? null, after: next[key] ?? null });
    }
  }
  if (hash(priceSemantics(before.quotes)) !== hash(priceSemantics(after.quotes)))
    changes.push({
      partition: 'quotes',
      key: 'official',
      before: priceSemantics(before.quotes),
      after: priceSemantics(after.quotes),
    });
  return changes;
}
