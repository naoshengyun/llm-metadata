import { createHash } from 'node:crypto';
import { canonical, hash } from './generate.js';
import {
  verifyPublicationPackage,
  downloadPublicationPackage,
  type PublicationIdentity,
} from './publication-package.js';

export interface PublicationSnapshot {
  revision: string;
  files: Record<string, string>;
}
export interface PublicationPlatform {
  read(): Promise<PublicationSnapshot | null>;
  canSubmit(): Promise<boolean>;
  /** Atomically remember an operation before submission; false means readback only. */
  claim(operationId: string): Promise<boolean>;
  /** One complete snapshot; reject if expectedRevision no longer matches. */
  submit(snapshot: PublicationSnapshot, expectedRevision: string | null): Promise<void>;
}
export interface PublicationConfirmation {
  confirmed: boolean;
  actor: string;
  approvalRef: string;
  planId: string;
}
export type PublicationStatus = 'applied' | 'already-applied' | 'failed' | 'unknown';
export type PublicationSubmission =
  | 'not-attempted'
  | 'rejected-before-commit'
  | 'acknowledged'
  | 'unknown';
/** A platform may use this only when it can prove no submission was accepted. */
export class PublicationNotSubmittedError extends Error {}
const MODEL_PATH = 'api/newapi/ratio_config.json';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const json = (v: unknown) => JSON.stringify(JSON.parse(canonical(v)), null, 2) + '\n';
type Package = ReturnType<typeof verifyPublicationPackage>;
function prices(p: Package | null) {
  const data = p
    ? JSON.parse(p.files['ratio_config.json']!).data
    : { billing_expr: {}, billing_mode: {} };
  const plugins: Record<string, unknown> = {};
  if (p)
    for (const [model, items] of Object.entries(JSON.parse(p.files['plugin_prices.json']!)))
      for (const [plugin, expr] of Object.entries(items as Record<string, string>))
        plugins[JSON.stringify([model, plugin])] = expr;
  return {
    models: Object.fromEntries(
      Object.keys(data.billing_expr).map((k) => [
        k,
        { billing_mode: data.billing_mode[k], billing_expr: data.billing_expr[k] },
      ]),
    ),
    plugins,
    tools: p ? JSON.parse(p.files['tool_prices.json']!)['tool_price_setting.prices'] : {},
  } as Record<'models' | 'plugins' | 'tools', Record<string, unknown>>;
}
function semanticDiff(before: Package | null, after: Package) {
  const old = prices(before),
    next = prices(after),
    changes: { partition: string; key: string; before: unknown; after: unknown }[] = [];
  for (const partition of ['models', 'plugins', 'tools'] as const)
    for (const key of [
      ...new Set([...Object.keys(old[partition]), ...Object.keys(next[partition])]),
    ].sort()) {
      const b = old[partition][key] ?? null,
        a = next[partition][key] ?? null;
      if (hash(b) !== hash(a)) changes.push({ partition, key, before: b, after: a });
    }
  return changes;
}
function pointerFor(target: Package) {
  return {
    schemaVersion: 1,
    releaseId: target.releaseId,
    manifestSha256: target.manifestSha256,
    fixedBase: `versions/${target.releaseId}/`,
    modelSource: `versions/${target.releaseId}/ratio_config.json`,
    modelSourceSha256: sha(target.files['ratio_config.json']!),
    complete: target.manifest.complete,
  };
}

/** Validates every retained version, not merely the current stable alias. */
export function verifyPublicationSnapshot(snapshot: PublicationSnapshot) {
  if (!snapshot || !snapshot.files || hash(snapshot.files) !== snapshot.revision)
    throw new Error('snapshot revision mismatch');
  const versions: Record<string, Record<string, string>> = Object.create(null);
  for (const [path, body] of Object.entries(snapshot.files)) {
    if (typeof body !== 'string') throw new Error('snapshot files must be UTF-8 strings');
    if (['current.json', MODEL_PATH, '.nojekyll'].includes(path)) continue;
    const match = /^versions\/([a-f0-9]{64})\/([A-Za-z0-9._-]+)$/.exec(path);
    if (!match) throw new Error('unsupported snapshot path');
    (versions[match[1]!] ??= Object.create(null))[match[2]!] = body;
  }
  const pointer = JSON.parse(snapshot.files['current.json'] ?? 'null') as ReturnType<
    typeof pointerFor
  >;
  if (!pointer || pointer.schemaVersion !== 1 || !versions[pointer.releaseId])
    throw new Error('invalid discovery pointer');
  const validated: Record<string, Package> = {};
  for (const [id, files] of Object.entries(versions))
    validated[id] = verifyPublicationPackage(files, {
      releaseId: id,
      manifestSha256: sha(files['manifest.json'] ?? ''),
    });
  const target = validated[pointer.releaseId]!;
  if (
    !target.manifest.selection.models.length ||
    hash(pointer) !== hash(pointerFor(target)) ||
    snapshot.files[MODEL_PATH] !== target.files['ratio_config.json'] ||
    snapshot.files['.nojekyll'] !== ''
  )
    throw new Error('inconsistent stable pointer or model source');
  return { pointer, target };
}

/** Prepares data only. The caller must obtain a new confirmation before submitting it. */
export function preparePublicationTransition(
  current: PublicationSnapshot | null,
  files: Record<string, string>,
  identity: PublicationIdentity,
  action: 'promote' | 'rollback',
) {
  const previous = current ? verifyPublicationSnapshot(current).target : null;
  const target = verifyPublicationPackage(files, identity);
  if (!target.manifest.selection.models.length)
    throw new Error('stable native source requires selected models');
  if (!['promote', 'rollback'].includes(action))
    throw new Error('explicit transition action required');
  if (action === 'rollback' && !current?.files[`versions/${target.releaseId}/manifest.json`])
    throw new Error('rollback requires a retained immutable version');
  const output = { ...current?.files };
  for (const [name, body] of Object.entries(target.files)) {
    const path = `versions/${target.releaseId}/${name}`;
    if (output[path] !== undefined && output[path] !== body)
      throw new Error('immutable version conflict');
    output[path] = body;
  }
  output['current.json'] = json(pointerFor(target));
  output[MODEL_PATH] = target.files['ratio_config.json']!;
  output['.nojekyll'] = '';
  const content = {
    action,
    fromRevision: current?.revision ?? null,
    fromIdentity: previous
      ? { releaseId: previous.releaseId, manifestSha256: previous.manifestSha256 }
      : null,
    identity: { releaseId: target.releaseId, manifestSha256: target.manifestSha256 },
    diff: semanticDiff(previous, target),
    snapshot: { revision: hash(output), files: output },
  };
  return { ...content, id: hash(content) };
}
export type PublicationPlan = ReturnType<typeof preparePublicationTransition>;

/** Publication only: this interface has no gateway/instance configuration operation. */
export async function executePublicationTransition(
  platform: PublicationPlatform,
  plan: PublicationPlan,
  confirmation: PublicationConfirmation,
) {
  const { id, ...content } = plan;
  if (
    hash(content) !== id ||
    confirmation.confirmed !== true ||
    confirmation.planId !== id ||
    !confirmation.actor?.trim() ||
    !confirmation.approvalRef?.trim()
  )
    throw new Error('exact explicit publication confirmation required');
  const target = verifyPublicationSnapshot(plan.snapshot).target;
  if (
    hash(plan.identity) !==
    hash({ releaseId: target.releaseId, manifestSha256: target.manifestSha256 })
  )
    throw new Error('inconsistent publication plan identity');
  let previous: Package | null = null;
  if (plan.fromIdentity) {
    const prefix = `versions/${plan.fromIdentity.releaseId}/`;
    previous = verifyPublicationPackage(
      Object.fromEntries(
        Object.entries(plan.snapshot.files)
          .filter(([p]) => p.startsWith(prefix))
          .map(([p, v]) => [p.slice(prefix.length), v]),
      ),
      plan.fromIdentity,
    );
  }
  if (
    (plan.fromRevision === null) !== (plan.fromIdentity === null) ||
    hash(semanticDiff(previous, target)) !== hash(plan.diff)
  )
    throw new Error('inconsistent publication plan diff');
  const operationId = hash({
    planId: id,
    actor: confirmation.actor,
    approvalRef: confirmation.approvalRef,
  });
  const makeReceipt = (
    status: PublicationStatus,
    submission: PublicationSubmission,
    readbackRevision: string | null,
  ) => {
    const receipt = {
      schemaVersion: 1,
      status,
      submission,
      actor: confirmation.actor,
      approvalRef: confirmation.approvalRef,
      planId: id,
      operationId,
      action: plan.action,
      target: plan.identity,
      fromRevision: plan.fromRevision,
      readbackRevision,
      diff: plan.diff,
      instanceConfiguration: 'not-written',
    };
    return { ...receipt, id: hash(receipt) };
  };
  const current = await platform.read();
  if (current) verifyPublicationSnapshot(current);
  if (current?.revision === plan.snapshot.revision) {
    return makeReceipt('already-applied', 'not-attempted', current.revision);
  }
  if ((current?.revision ?? null) !== plan.fromRevision)
    throw new Error('previous publication revision conflict');
  if (preparePublicationTransition(current, target.files, plan.identity, plan.action).id !== id)
    throw new Error('inconsistent publication plan or semantic diff');
  if (!(await platform.canSubmit())) {
    return makeReceipt('failed', 'not-attempted', current?.revision ?? null);
  }
  const readRevision = async () => {
    try {
      const observed = await platform.read();
      if (observed) {
        verifyPublicationSnapshot(observed);
        return observed.revision;
      }
    } catch {
      /* A failed read cannot justify a new submission. */
    }
    return null;
  };
  let claimed: boolean;
  try {
    claimed = await platform.claim(operationId);
  } catch {
    return makeReceipt('failed', 'not-attempted', current?.revision ?? null);
  }
  if (!claimed) {
    const observed = await readRevision();
    return makeReceipt(
      observed === plan.snapshot.revision ? 'applied' : 'unknown',
      'unknown',
      observed,
    );
  }
  let submission: PublicationSubmission = 'acknowledged';
  try {
    await platform.submit(plan.snapshot, plan.fromRevision);
  } catch (error) {
    if (error instanceof PublicationNotSubmittedError) {
      return makeReceipt('failed', 'rejected-before-commit', current?.revision ?? null);
    }
    submission = 'unknown';
  }
  const readbackRevision = await readRevision();
  return makeReceipt(
    readbackRevision === plan.snapshot.revision ? 'applied' : 'unknown',
    submission,
    readbackRevision,
  );
}

/** Cross-request cache mixing is detected, not hidden behind an atomicity claim. */
export async function downloadStablePublication(
  base: string,
  expected: PublicationIdentity,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(base);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol)
  )
    throw new Error('credential-free static publication URL required');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  const read = async (path: string) => {
    const response = await fetcher(new URL(path, url), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('publication HTTP fetch failed');
    const bytes = Buffer.from(await response.arrayBuffer()),
      text = bytes.toString('utf8');
    if (bytes.length > 16 * 1024 * 1024 || !Buffer.from(text).equals(bytes))
      throw new Error('invalid publication UTF-8 or size');
    return text;
  };
  const pointer = JSON.parse(await read('current.json')) as ReturnType<typeof pointerFor>;
  if (
    pointer?.releaseId !== expected.releaseId ||
    pointer.manifestSha256 !== expected.manifestSha256
  )
    throw new Error('discovery identity mismatch');
  const p = await downloadPublicationPackage(
    new URL(`versions/${expected.releaseId}/`, url).href,
    expected,
    fetcher,
  );
  if (hash(pointer) !== hash(pointerFor(p))) throw new Error('discovery metadata mismatch');
  const modelSource = await read(MODEL_PATH);
  if (modelSource !== p.files['ratio_config.json'])
    throw new Error('mixed stable model response: use fixed URL/hash');
  return {
    releaseId: p.releaseId,
    manifestSha256: p.manifestSha256,
    modelSource,
    fixedModelSource: new URL(pointer.modelSource, url).href,
    instanceConfiguration: 'not-written',
  };
}
