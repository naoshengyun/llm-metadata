import { createHash } from 'node:crypto';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical, generateCny, hash, type OfficialQuote } from './generate.js';
import { verifyArtifact, type FixedArtifact } from './artifact.js';
import { buildModelRelease, type ModelReleaseSelection } from './publication.js';

export interface PublicationSelection extends ModelReleaseSelection {
  plugins: Record<string, string[]>;
  tools: string[];
}
export interface PublicationIdentity {
  releaseId: string;
  manifestSha256: string;
}
const payloadNames = [
  'artifact.json',
  'ratio_config.json',
  'plugin_prices.json',
  'tool_prices.json',
  'selection.json',
  'coverage.json',
  'exclusions.json',
  'publication-record.json',
  'OPERATIONS.md',
];
function json(value: unknown) {
  return JSON.stringify(JSON.parse(canonical(value)), null, 2) + '\n';
}
function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function utf8File(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes),
    text = buffer.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(buffer))
    throw new Error('package files require lossless UTF-8');
  return text;
}

export function buildPublicationPackage(
  artifactBytes: Uint8Array,
  selection: PublicationSelection,
) {
  const artifactText = utf8File(artifactBytes);
  const artifact = JSON.parse(artifactText) as FixedArtifact;
  if (!verifyArtifact(artifact)) throw new Error('invalid fixed artifact');
  if (
    !selection ||
    !Array.isArray(selection.models) ||
    new Set(selection.models).size !== selection.models.length ||
    selection.models.some((n) => typeof n !== 'string' || !n.trim()) ||
    !['partial', 'full'].includes(selection.mode) ||
    !['test', 'candidate'].includes(selection.purpose)
  )
    throw new Error('explicit model selection/mode/purpose required');
  if (selection.mode === 'full' && !artifact.manifest.complete)
    throw new Error('full release requires complete candidate');
  const model = selection.models.length ? buildModelRelease(artifact, selection) : null;
  if (
    !selection.plugins ||
    Array.isArray(selection.plugins) ||
    typeof selection.plugins !== 'object' ||
    !Array.isArray(selection.tools) ||
    new Set(selection.tools).size !== selection.tools.length ||
    selection.tools.some((k) => typeof k !== 'string' || !k.trim())
  )
    throw new Error('explicit unique plugin/tool selection required');
  const regenerated = generateCny({
    upstream: { providers: {} },
    records: (artifact.quotes as { records: OfficialQuote[] }).records,
    selection: artifact.selection,
  });
  const sourceCatalog = artifact.quotes as {
    excludedQuotes?: unknown[];
    optionalToolFees?: unknown[];
  };
  const coverage = (artifact.data as { coverage?: { status: string }[] })?.coverage;
  if (
    artifact.manifest.complete &&
    (regenerated.exclusions.length ||
      sourceCatalog.excludedQuotes?.length ||
      sourceCatalog.optionalToolFees?.length ||
      !Array.isArray(coverage) ||
      coverage.some((r) => r.status !== 'ready'))
  )
    throw new Error('inconsistent source completeness');
  const plugins: Record<string, Record<string, string>> = {};
  for (const [name, keys] of Object.entries(selection.plugins).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (
      !Array.isArray(keys) ||
      new Set(keys).size !== keys.length ||
      keys.some((k) => typeof k !== 'string' || !k.trim())
    )
      throw new Error('unique plugin keys required');
    if (!keys.length) continue;
    plugins[name] = {};
    for (const key of [...keys].sort()) {
      const value = artifact.plugins[name]?.[key];
      if (typeof value !== 'string' || !value.trim() || regenerated.plugins[name]?.[key] !== value)
        throw new Error('ineligible plugin source or price');
      plugins[name]![key] = value;
    }
  }
  const tools: Record<string, number> = {};
  for (const key of [...selection.tools].sort()) {
    const price = artifact.tools[key];
    if (
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price < 0 ||
      regenerated.tools[key] !== price
    )
      throw new Error('ineligible tool source or price');
    tools[key] = price;
  }
  const normalized = {
    models: [...selection.models].sort(),
    mode: selection.mode,
    purpose: selection.purpose,
    plugins: Object.fromEntries(Object.entries(plugins).map(([name, p]) => [name, Object.keys(p)])),
    tools: Object.keys(tools),
  };
  if (!normalized.models.length && !Object.keys(plugins).length && !normalized.tools.length)
    throw new Error('select at least one price');
  if (
    selection.mode === 'full' &&
    (hash(normalized.models) !== hash(Object.keys(artifact.models).sort()) ||
      hash(normalized.tools) !== hash(Object.keys(artifact.tools).sort()) ||
      hash(normalized.plugins) !==
        hash(
          Object.fromEntries(
            Object.entries(artifact.plugins).map(([name, p]) => [name, Object.keys(p).sort()]),
          ),
        ))
  )
    throw new Error('full mode requires every model/plugin/tool');
  const records = (artifact.quotes as { records: OfficialQuote[] }).records;
  const quoteFor = (name: string) =>
    structuredClone(records.find((q) => q.id === artifact.selection[name])!);
  const selectedQuotes = new Set<string>();
  const selectedModels = normalized.models.map((name) => {
    const quote = quoteFor(name);
    selectedQuotes.add(quote.id);
    return { nativeModel: name, quote };
  });
  const selectedPlugins = Object.entries(plugins).flatMap(([name, p]) =>
    Object.keys(p).map((plugin) => {
      const quote = quoteFor(name);
      selectedQuotes.add(quote.id);
      return { nativeModel: name, plugin, quote };
    }),
  );
  const selectedTools = normalized.tools.map((key) => {
    const ids = new Set(Object.values(artifact.selection));
    const quotes = records
      .filter((q) => {
        if (
          !ids.has(q.id) ||
          !q.tools?.some((t) => t.key === key) ||
          regenerated.diagnostics.find((d) => d.id === q.id)?.status !== 'ready'
        )
          return false;
        return Object.entries(artifact.selection)
          .filter(([, id]) => id === q.id)
          .some(([nativeName]) => {
            const contribution = generateCny({
              upstream: { providers: {} },
              records: [q],
              selection: { [nativeName]: q.id },
            });
            return (
              contribution.diagnostics.every((d) => d.status === 'ready') &&
              contribution.tools[key] === tools[key]
            );
          });
      })
      .map((q) => structuredClone(q));
    if (!quotes.length) throw new Error('selected tool has no eligible price contributor');
    for (const q of quotes) selectedQuotes.add(q.id);
    return {
      key,
      normalized: { amount: tools[key], unit: 'per_thousand_calls', currency: 'CNY' },
      quotes,
    };
  });
  const publicationRecord = {
    purpose: selection.purpose,
    selected: { models: selectedModels, plugins: selectedPlugins, tools: selectedTools },
    notSelected: {
      models: Object.keys(artifact.models)
        .filter((k) => !normalized.models.includes(k))
        .sort(),
      plugins: Object.entries(artifact.plugins).flatMap(([name, p]) =>
        Object.keys(p)
          .filter((k) => !Object.hasOwn(plugins[name] ?? {}, k))
          .map((plugin) => ({ nativeModel: name, plugin })),
      ),
      tools: Object.keys(artifact.tools)
        .filter((k) => !normalized.tools.includes(k))
        .sort(),
      officialQuotes: records
        .filter((q) => !selectedQuotes.has(q.id))
        .map((q) => ({
          quoteId: q.id,
          model: q.model,
          source: structuredClone(q.source),
          reason:
            regenerated.diagnostics.find((d) => d.id === q.id)?.status === 'ready'
              ? 'not-selected'
              : (regenerated.diagnostics.find((d) => d.id === q.id)?.status ?? 'incomplete'),
        })),
    },
    operatingState: {
      publication: 'not-executed-by-builder',
      configuration: 'requires-target-confirmation',
      calls: 'not-tested',
      billing: 'not-tested',
      sale: 'not-approved',
    },
  };
  const operations = `# 固定版本运营接入\n\n先核对manifest、固定版本hash、selection及partial/excluded和原核价日期；测试选择不是首发批准。此包只交付数据，不自动改实例。\n\n模型：在原版 Model prices → Upstream price sync（或模型metadata的Sync pricing）输入本目录ratio_config.json完整固定URL，核对实际URL，逐模型拉取、选择及预览；仅明确获准后Confirm Changes并核对结果。需要Root/SUPER_ADMIN权限。URL仅组件内存，刷新/关闭后重填；预设名称/Official徽标不随URL改变。空价格、无差异或success提示不能替代所选字段齐全。没有选择模型时跳过模型源，空模型文件不表示有可应用模型。\n\n插件：同版plugin_prices.json是每model的plugin→expression对象，在Model prices相应插件编辑器分别核对；模型URL不导入它们。\n\n工具：同版tool_prices.json是每千次CNY单价，在Tool prices的visual/JSON页面独立处理。必须fresh全表基线/合并、独占窗口、保存后读回，不能覆盖未选键；原版PUT无CAS。无独占则不应用该分区。\n\n目标预检：固定原版rc50，USDExchangeRate=1、QuotaPerUnit=500000，已归一USD×7不再乘7；组倍率由运营独立配置且不随包改写。模型/插件/工具非全局原子。冲突不强盖，超时先读回，unknown不报成功。\n\n源回退不恢复实例，不重算历史账单。实例恢复需新意图、fresh版本/工具独占及读回，保留未选键。下载校验、配置应用、真实调用、计费/账单、可售批准逐项记录，不相互代替。真实目标/渠道/alias/usage与预算走各自确认；不要求全136调用才开发本包。\n`;
  const files: Record<string, string> = {
    'artifact.json': artifactText,
    'ratio_config.json': json(
      model?.modelSource ?? { success: true, data: { billing_mode: {}, billing_expr: {} } },
    ),
    'plugin_prices.json': json(plugins),
    'tool_prices.json': json({ 'tool_price_setting.prices': tools }),
    'selection.json': json(normalized),
    'coverage.json': json(artifact.data),
    'exclusions.json': json(artifact.exclusions),
    'publication-record.json': json(publicationRecord),
    'OPERATIONS.md': operations,
  };
  const content = {
    schemaVersion: 1,
    adapterVersion: 'cny-package/v1',
    artifactId: artifact.id,
    sourceSha: artifact.sourceSha,
    artifactFileSha256: sha(artifactText),
    modelSourceReleaseId: model?.id ?? null,
    partitionStatus: {
      models: normalized.models.length ? 'selected' : 'not-selected',
      plugins: Object.keys(plugins).length ? 'selected-separate-configuration' : 'not-selected',
      tools: normalized.tools.length ? 'selected-separate-configuration' : 'not-selected',
    },
    selection: normalized,
    complete: artifact.manifest.complete,
    partial: selection.mode === 'partial',
    inventory: Object.fromEntries(
      Object.entries(files).map(([name, value]) => [
        name,
        { sha256: sha(value), bytes: Buffer.byteLength(value) },
      ]),
    ),
  };
  const releaseId = hash(content),
    manifest = { ...content, releaseId };
  files['manifest.json'] = json(manifest);
  return { releaseId, manifest, manifestSha256: sha(files['manifest.json']), files };
}

/** External identity must come from a reviewed receipt/pointer, not this manifest itself. */
export function verifyPublicationPackage(
  files: Record<string, string>,
  expected: PublicationIdentity,
) {
  if (
    !/^[a-f0-9]{64}$/.test(expected.releaseId) ||
    !/^[a-f0-9]{64}$/.test(expected.manifestSha256) ||
    typeof files['manifest.json'] !== 'string' ||
    sha(files['manifest.json']) !== expected.manifestSha256
  )
    throw new Error('invalid external manifest identity');
  const manifest = JSON.parse(files['manifest.json']) as ReturnType<
    typeof buildPublicationPackage
  >['manifest'];
  if (manifest.releaseId !== expected.releaseId || typeof files['artifact.json'] !== 'string')
    throw new Error('missing artifact or wrong version');
  const rebuilt = buildPublicationPackage(Buffer.from(files['artifact.json']), manifest.selection);
  if (
    rebuilt.releaseId !== expected.releaseId ||
    rebuilt.manifestSha256 !== expected.manifestSha256 ||
    hash(Object.keys(rebuilt.files).sort()) !== hash(Object.keys(files).sort()) ||
    Object.entries(rebuilt.files).some(([name, value]) => files[name] !== value)
  )
    throw new Error('incomplete, inconsistent or mixed-version publication package');
  return rebuilt;
}

export async function downloadPublicationPackage(
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
    throw new Error('credential-free static base URL required');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  const read = async (name: string) => {
    const response = await fetcher(new URL(name, url), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('package HTTP fetch failed: ' + name);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 16 * 1024 * 1024) throw new Error('package file too large');
    return utf8File(bytes);
  };
  const manifestText = await read('manifest.json');
  if (sha(manifestText) !== expected.manifestSha256) throw new Error('manifest hash mismatch');
  const manifest = JSON.parse(manifestText) as ReturnType<
    typeof buildPublicationPackage
  >['manifest'];
  if (
    manifest.schemaVersion !== 1 ||
    manifest.adapterVersion !== 'cny-package/v1' ||
    manifest.releaseId !== expected.releaseId ||
    !manifest.inventory ||
    hash(Object.keys(manifest.inventory).sort()) !== hash([...payloadNames].sort())
  )
    throw new Error('unsupported package inventory/version');
  const files: Record<string, string> = { 'manifest.json': manifestText };
  for (const name of payloadNames) files[name] = await read(name);
  return verifyPublicationPackage(files, expected);
}

export function writePublicationPackage(
  root: string,
  files: Record<string, string>,
  expected: PublicationIdentity,
) {
  const verified = verifyPublicationPackage(files, expected);
  const directory = join(realpathSync(root), verified.releaseId);
  mkdirSync(directory);
  for (const [name, body] of Object.entries(verified.files))
    writeFileSync(join(directory, name), body, { flag: 'wx' });
  return directory;
}
