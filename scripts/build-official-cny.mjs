// Offline maintenance snapshot. This command never fetches, publishes or applies prices.
import { generateCny } from '../.cache/cny-build/cny/generate.js';
import { buildArtifact, semanticDiff, verifyArtifact } from '../.cache/cny-build/cny/artifact.js';

import { readFileSync, writeFileSync, mkdirSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildOfficialSnapshot({ sourceSha, catalog, reference, selection }) {
  const actualCount = reference.platforms.reduce((count, p) => count + p.models.length, 0);
  if (actualCount !== reference.providedCount) throw new Error('Coverage reference count mismatch');
  const generated = generateCny({
    upstream: { providers: {} },
    records: catalog.records,
    selection,
  });
  const assessments = new Map();
  for (const row of catalog.coverage) {
    const key = `${row.platform}\0${row.model}`;
    if (assessments.has(key)) throw new Error('Duplicate coverage assessment: ' + key);
    assessments.set(key, row);
  }
  const diagnosticById = new Map(generated.diagnostics.map((d) => [d.id, d]));
  const quoteById = new Map(catalog.records.map((quote) => [quote.id, quote]));
  const coverage = [];
  for (const platform of reference.platforms) {
    for (const model of platform.models) {
      const assessment = assessments.get(`${platform.platform}\0${model}`);
      const row = {
        ...(assessment ?? {
          status: 'missing-source',
          quoteIds: [],
          reason: 'No verified original official quote for this exact supplied identifier',
        }),
        rowId: `R${String(coverage.length + 1).padStart(3, '0')}`,
        platform: platform.platform,
        protocol: platform.protocol,
        model,
      };
      if (row.status === 'ready') {
        const ids = Array.isArray(row.quoteIds) ? row.quoteIds : [];
        if (ids.some((id) => quoteById.has(id) && quoteById.get(id).model !== model)) {
          row.status = 'incomplete';
          row.reason =
            'Official quote identity does not match the exact supplied model identifier; no inferred alias mapping is allowed.';
        }
        const rejected = ids
          .map((id) => diagnosticById.get(id))
          .find((d) => !d || d.status !== 'ready');
        if (!ids.length || ids.some((id) => !diagnosticById.has(id)) || rejected) {
          row.status = rejected?.status ?? 'incomplete';
          row.reason =
            'Candidate source/price validation did not pass: ' +
            JSON.stringify(
              ids.map((id) => diagnosticById.get(id) ?? { id, status: 'missing-source' }),
            );
        }
      }
      coverage.push(row);
    }
  }
  const exclusions = [
    ...generated.exclusions,
    ...(catalog.excludedQuotes ?? []),
    ...(catalog.optionalToolFees ?? []).map((raw, index) => ({
      id: `optional-tools-${index + 1}`,
      kind: 'optional-tool-fees',
      status: 'not-selected',
      reason:
        'Separately priced optional tool meter; not included in the proposed tool configuration.',
      raw,
    })),
    ...coverage.filter((row) => row.status !== 'ready'),
  ];
  const artifact = buildArtifact({
    sourceSha,
    data: { reference, coverage },
    quotes: catalog,
    selection,
    models: generated.models,
    plugins: generated.plugins,
    tools: generated.tools,
    exclusions,
  });
  return {
    artifact,
    catalog: generated.catalog,
    coverage,
    diagnostics: generated.diagnostics,
    status: {
      artifactId: artifact.id,
      checkedAt: catalog.checkedAt,
      publication: 'not-published',
      application: 'not-applied',
      coverageComplete: coverage.every((row) => row.status === 'ready'),
      packageComplete: artifact.manifest.complete,
      referenceCount: actualCount,
      reportedCount: reference.reportedCount,
      unexplainedDifference: reference.unexplainedDifference,
    },
  };
}

export function persistOfficialSnapshot({ root, sourceSha, files }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Full source SHA required');
  root = realpathSync(root);
  const output = join(root, '.cache', 'official-cny', sourceSha);
  if (
    Object.keys(files).some(
      (name) => basename(name) !== name || name.includes('\\') || !/\.(json|md)$/.test(name),
    )
  )
    throw new Error('Snapshot filenames must be plain JSON or Markdown names');
  for (const name of Object.keys(files)) {
    let current = root;
    for (const component of ['.cache', 'official-cny', sourceSha, name]) {
      current = join(current, component);
      try {
        if (lstatSync(current).isSymbolicLink())
          throw new Error('Symlink in candidate output path');
      } catch (error) {
        if (error.code === 'ENOENT') break;
        throw error;
      }
    }
  }
  mkdirSync(dirname(output), { recursive: true });
  // Exclusive directory creation: an existing snapshot and diff baseline stay untouched.
  mkdirSync(output);
  for (const [name, value] of Object.entries(files))
    writeFileSync(join(output, name), value, { flag: 'wx' });
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = execFileSync(
    'git',
    ['-C', dirname(fileURLToPath(import.meta.url)), 'rev-parse', '--show-toplevel'],
    { encoding: 'utf8' },
  ).trim();
  const sourceSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const dirty = execFileSync(
    'git',
    [
      '-C',
      root,
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      'src',
      'scripts',
      'data/cny',
    ],
    { encoding: 'utf8' },
  ).trim();
  if (dirty)
    throw new Error('Commit source and official input snapshot before building a fixed candidate');
  const read = (name) => JSON.parse(readFileSync(join(root, 'data/cny', name), 'utf8'));
  const result = buildOfficialSnapshot({
    sourceSha,
    catalog: read('official-catalog.json'),
    reference: read('coverage-reference.json'),
    selection: read('proposed-selection.json').selection,
  });
  let baseline = null,
    changes = [];
  if (process.argv[2]) {
    const previous = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
    if (!verifyArtifact(previous)) throw new Error('Previous artifact identity is invalid');
    baseline = previous.id;
    changes = semanticDiff(previous, result.artifact);
  } else {
    for (const partition of ['models', 'plugins', 'tools'])
      for (const [key, value] of Object.entries(result.artifact[partition]))
        changes.push({ partition, key, type: 'candidate-addition', after: value });
  }
  // Preflight each existing component, including the final file, before any write.
  const content = {
    artifact: result.artifact,
    catalog: result.catalog,
    coverage: result.coverage,
    diagnostics: result.diagnostics,
    status: result.status,
    'semantic-diff': {
      baseline,
      scope: baseline
        ? 'fixed-candidate-artifact-diff'
        : 'first official candidate; no production baseline',
      changes,
    },
    ratio_config: {
      data: {
        billing_mode: Object.fromEntries(
          Object.entries(result.artifact.models).map(([key, value]) => [key, value.billing_mode]),
        ),
        billing_expr: Object.fromEntries(
          Object.entries(result.artifact.models).map(([key, value]) => [key, value.billing_expr]),
        ),
      },
    },
    plugin_prices: result.artifact.plugins,
    tool_prices: { 'tool_price_setting.prices': result.artifact.tools },
  };
  const summary = {};
  for (const row of result.coverage) summary[row.status] = (summary[row.status] ?? 0) + 1;
  const report =
    [
      `# Official CNY candidate snapshot`,
      `Source commit: ${sourceSha}`,
      `Artifact: ${result.artifact.id}`,
      `Publication: not-published. Application: not-applied.`,
      `Coverage statuses describe price-data contracts, not availability, actual supplier calls, billing acceptance or sale approval.`,
      `Provided reference: ${result.status.referenceCount}; reported: ${result.status.reportedCount}; unexplained difference: ${result.status.unexplainedDifference}.`,
      `Status counts: ${JSON.stringify(summary)}`,
      `Selected official price lists are a review proposal, not an approved account/channel/group configuration.`,
      '',
      '| Row | Platform | Protocol | Model | Price status | Reason |',
      '|---|---|---|---|---|---|',
      ...result.coverage.map((row) =>
        [row.rowId, row.platform, row.protocol, row.model, row.status, row.reason ?? '']
          .map((cell) => String(cell).replaceAll('|', '\\|').replaceAll('\n', ' '))
          .join(' | '),
      ),
    ].join('\n') + '\n';
  const files = {
    ...Object.fromEntries(
      Object.entries(content).map(([name, value]) => [
        `${name}.json`,
        JSON.stringify(value, null, 2) + '\n',
      ]),
    ),
    'coverage-report.md': report,
  };
  const output = persistOfficialSnapshot({ root, sourceSha, files });
  console.log(JSON.stringify({ ...result.status, sourceSha, output, coverageStatuses: summary }));
}
