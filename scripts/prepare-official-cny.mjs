/** Convert a verified official check into reviewable changes to the three CNY inputs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { canonical, hash } from '../.cache/cny-build/cny/generate.js';

const inputNames = ['official-catalog.json', 'proposed-selection.json', 'unified-policy.json'];
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const read = (file) => JSON.parse(readFileSync(file));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const time = (raw) => {
  assert.match(raw, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  assert.ok(Number.isFinite(Date.parse(raw)), 'Invalid official check time');
  return Date.parse(raw);
};

export function loadPublished(snapshot) {
  const pointer = read(join(snapshot, 'current.json'));
  assert.equal(pointer.schemaVersion, 3);
  assert.match(pointer.releaseId, /^[a-f0-9]{64}$/);
  assert.equal(pointer.fixedBase, 'versions/' + pointer.releaseId + '/');
  const root = join(snapshot, pointer.fixedBase);
  const manifestBytes = readFileSync(join(root, 'manifest.json'));
  assert.equal(sha256(manifestBytes), pointer.manifestSha256);
  const { candidateId, ...manifest } = JSON.parse(manifestBytes);
  assert.equal(candidateId, pointer.releaseId);
  assert.equal(hash(manifest), candidateId);
  assert.equal(manifest.sourceSha, pointer.sourceSha);
  const file = (name) => {
    const bytes = readFileSync(join(root, name));
    assert.equal(sha256(bytes), manifest.files[name].sha256, name);
    return JSON.parse(bytes);
  };
  const version = {
    candidateId,
    sourceSha: manifest.sourceSha,
    coverageSha256: manifest.files['coverage.json'].sha256,
  };
  return {
    root,
    version,
    inputs: manifest.inputs,
    manifestSha256: pointer.manifestSha256,
    selection: file('selection.json'),
    policy: file('policy.json'),
    config: file('api/newapi/ratio_config.json').data,
  };
}

function confirmEvidence(change, responses, attemptedAt) {
  const evidence = change.evidence;
  const response = Object.values(responses).find((response) => response.file === evidence?.file);
  assert.ok(
    response && response.status === 200 && canonical(response) === canonical(evidence),
    'Official evidence is missing from the run: ' + change.id,
  );
  assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
  assert.equal(new URL(evidence.finalUrl).protocol, 'https:');
  assert.ok(time(evidence.obtainedAt) >= time(attemptedAt), 'Official evidence predates the run');
  return {
    url: evidence.finalUrl,
    sha256: evidence.sha256,
    checkedAt: evidence.obtainedAt.slice(0, 10),
  };
}

function modelRecord(change, source, providerAliases) {
  const record = change.candidate?.record;
  const { identity, sourcePrice, sourceUnit, conditions, effectiveAt } = change.observed;
  assert.ok(
    record && /^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$/.test(record.id),
    'Missing reviewable quote record',
  );
  assert.deepEqual(
    [
      providerAliases?.[record.provider] ?? record.provider,
      record.endpoint ?? identity.endpoint,
      record.model,
      record.priceList,
      record.currency,
    ],
    [
      identity.providerId,
      identity.endpoint,
      identity.modelId,
      identity.priceList,
      identity.currency,
    ],
  );
  assert.equal(record.model, change.nativeKey);
  assert.equal(record.unit, sourceUnit);
  assert.deepEqual(record.task ? record.task.tiers : record.cost, sourcePrice);
  assert.deepEqual(record.conditions, conditions);
  assert.equal(record.effectiveAt, effectiveAt);
  for (const [key, value] of Object.entries(source)) assert.equal(record.source[key], value);
  return record;
}

export function prepareOfficialChanges(published, report, inputs) {
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.publishedVersion, published.version);
  const { attemptedAt } = report;
  const attempt = time(attemptedAt);
  const { catalog, selection, policy } = structuredClone(inputs);
  assert.equal(policy.asOf, published.policy.asOf);
  assert.deepEqual(policy.lifecycle, published.policy.lifecycle);
  const records = new Map(catalog.records.map((record) => [record.id, record]));
  assert.equal(records.size, catalog.records.length);
  const results = new Map(report.results.map((result) => [result.id, result]));
  assert.equal(results.size, report.results.length);
  const seen = new Set();
  const applied = [];
  const changedKeys = new Set();
  let cutoff = Math.max(time(policy.asOf), attempt);
  for (const change of report.changes) {
    const { id, nativeKey, status, observed } = change;
    assert.ok(!seen.has(id), 'Duplicate official change: ' + id);
    seen.add(id);
    const result = results.get(id);
    assert.ok(
      result &&
        result.status === status &&
        result.nativeKey === nativeKey &&
        result.selected === change.selected &&
        canonical(result.observed) === canonical(observed) &&
        canonical(result.difference) === canonical(change.difference),
      'Official change does not match its result: ' + id,
    );
    if (!['changed', 'withdrawal', 'restoration'].includes(status)) continue;
    const selected = published.selection[nativeKey] === id;
    assert.equal(
      change.selected,
      selected,
      'Official change selection differs from the release: ' + id,
    );
    const existing = records.get(id);
    if (!selected && status !== 'restoration' && (status !== 'changed' || !existing)) continue;
    assert.ok(
      typeof nativeKey === 'string' && nativeKey && !Object.hasOwn(Object.prototype, nativeKey),
    );
    const source = confirmEvidence(change, report.responses, attemptedAt);
    if (observed.effectiveAt)
      assert.ok(time(observed.effectiveAt) <= attempt, 'Official price is not effective');
    const lifecycle = status === 'withdrawal' || status === 'restoration';
    if (lifecycle) {
      const statement = observed[status]?.statement;
      assert.ok(
        typeof statement === 'string' && statement.trim(),
        'Missing formal lifecycle evidence',
      );
      const history = Object.hasOwn(policy.lifecycle, nativeKey) ? policy.lifecycle[nativeKey] : [];
      const prior = history.at(-1);
      assert.ok(
        status === 'restoration'
          ? prior?.state === 'withdrawn' &&
              prior.quoteId === id &&
              !prior.reason &&
              source.sha256 !== prior.evidence.sha256
          : prior?.state !== 'withdrawn',
        'Official lifecycle does not match the reviewed state: ' + id,
      );
      const at = observed.effectiveAt ?? change.evidence.obtainedAt;
      cutoff = Math.max(cutoff, time(at));
      const quoteId = status === 'withdrawal' ? id : change.candidate?.record.id;
      policy.lifecycle[nativeKey] = [
        ...history,
        {
          state: status === 'withdrawal' ? 'withdrawn' : 'restored',
          at,
          quoteId,
          evidence: { ...source, detail: statement },
        },
      ];
    }
    if (status !== 'withdrawal') {
      const record = modelRecord(change, source, policy.providerAliases);
      if (existing)
        assert.equal(record.id, existing.id, 'An existing official price cannot change identity');
      if (!existing && records.has(record.id))
        throw Error('Official quote collides with an existing record: ' + record.id);
      records.set(record.id, record);
      if (selected || status === 'restoration') selection.selection[nativeKey] = record.id;
    }
    if (selected || lifecycle) {
      assert.ok(
        !changedKeys.has(nativeKey),
        'Two changes affect the same selected model: ' + nativeKey,
      );
      changedKeys.add(nativeKey);
      delete policy.upstreamSelection[nativeKey];
      if (status === 'withdrawal') delete selection.selection[nativeKey];
    }
    applied.push(change);
  }
  if (!applied.length) return { plan: { version: published.version, attemptedAt, changes: [] } };
  catalog.records = [...records.values()];
  policy.asOf = new Date(cutoff).toISOString();
  const changes = applied.sort((left, right) => left.id.localeCompare(right.id));
  const digest = hash(
    changes.map(({ id, nativeKey, status, selected, observed, difference }) => ({
      id,
      nativeKey,
      status,
      selected,
      identity: observed.identity,
      ...(status === 'changed'
        ? { difference }
        : {
            effectiveAt: observed.effectiveAt,
            sourcePrice: observed.sourcePrice,
            sourceUnit: observed.sourceUnit,
            conditions: observed.conditions,
          }),
    })),
  );
  return {
    catalog,
    selection,
    policy,
    plan: {
      version: published.version,
      attemptedAt,
      digest,
      changedKeys: [...changedKeys].sort(),
      changes,
    },
  };
}

export function validateOfficialBuild(published, plan, candidateRoot) {
  assert.deepEqual(plan.version, published.version);
  const config = read(join(candidateRoot, 'api/newapi/ratio_config.json')).data;
  const selected = read(join(candidateRoot, 'selection.json'));
  const manifest = read(join(candidateRoot, 'manifest.json'));
  assert.deepEqual(
    manifest.inputs['previous/manifest.json'],
    published.manifestSha256 ?? sha256(readFileSync(join(published.root, 'manifest.json'))),
  );
  const changed = new Set(plan.changedKeys);
  for (const key of new Set([
    ...Object.keys(config.billing_expr),
    ...Object.keys(published.config.billing_expr),
  ])) {
    if (changed.has(key)) continue;
    assert.equal(config.billing_expr[key], published.config.billing_expr[key], key);
    assert.equal(config.billing_mode[key], published.config.billing_mode[key], key);
    assert.equal(selected[key], published.selection[key], key);
  }
  for (const change of plan.changes) {
    if (!changed.has(change.nativeKey)) continue;
    const key = change.nativeKey;
    if (change.status === 'withdrawal') {
      assert.ok(!Object.hasOwn(config.billing_expr, key) && !Object.hasOwn(selected, key));
    } else {
      assert.equal(selected[key], change.candidate.record.id);
      assert.equal(config.billing_mode[key], 'tiered_expr');
      assert.ok(config.billing_expr[key]);
    }
  }
  return manifest.candidateId;
}

// Replace changed JSON values while preserving unrelated lines in the review diff.
function reviewJson(original, updated) {
  const before = JSON.parse(original);
  const source = ts.parseJsonText('cny-input.json', original);
  const edits = [];
  const pretty = (value, depth) =>
    JSON.stringify(value, null, 2).replaceAll('\n', '\n' + '  '.repeat(depth));
  function walk(node, oldValue, newValue, depth) {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;
    if (
      ts.isArrayLiteralExpression(node) &&
      Array.isArray(newValue) &&
      oldValue.length &&
      oldValue.length <= newValue.length
    ) {
      for (let index = 0; index < oldValue.length; index++) {
        walk(node.elements[index], oldValue[index], newValue[index], depth + 1);
      }
      if (oldValue.length < newValue.length) {
        const end = node.elements.at(-1).end;
        const extension = newValue.slice(oldValue.length).map((value) => pretty(value, depth + 1));
        edits.push([
          end,
          end,
          ',\n' + '  '.repeat(depth + 1) + extension.join(',\n' + '  '.repeat(depth + 1)),
        ]);
      }
      return;
    }
    if (
      ts.isObjectLiteralExpression(node) &&
      newValue !== null &&
      typeof newValue === 'object' &&
      JSON.stringify(Object.keys(oldValue)) === JSON.stringify(Object.keys(newValue))
    ) {
      for (const property of node.properties) {
        const key = property.name.text;
        walk(property.initializer, oldValue[key], newValue[key], depth + 1);
      }
      return;
    }
    edits.push([node.getStart(source), node.end, pretty(newValue, depth)]);
  }
  walk(source.statements[0].expression, before, updated, 0);
  const result = edits
    .sort(([a], [b]) => b - a)
    .reduce(
      (content, [start, end, replacement]) =>
        content.slice(0, start) + replacement + content.slice(end),
      original,
    );
  assert.deepEqual(JSON.parse(result), updated);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [operation, snapshot, source, destination] = process.argv.slice(2);
  assert.ok(
    snapshot && source && destination,
    'Pass operation, published snapshot, report or plan, and output',
  );
  const published = loadPublished(snapshot);
  if (operation === 'prepare') {
    const values = inputNames.map((name) => {
      const bytes = readFileSync(join('data/cny', name));
      const field = {
        'official-catalog.json': 'official-catalog',
        'proposed-selection.json': 'official-selection',
        'unified-policy.json': 'unified-policy',
      }[name];
      assert.equal(
        sha256(bytes),
        published.inputs[field],
        'Source changed since public release: ' + name,
      );
      return bytes.toString('utf8');
    });
    const [catalog, selection, policy] = values.map((value) => JSON.parse(value));
    const report = read(source);
    for (const [id, response] of Object.entries(report.responses)) {
      assert.match(id, /^[a-z0-9][a-z0-9-]*$/);
      assert.equal(response.file, 'responses/' + id + '.body');
      assert.equal(
        sha256(readFileSync(join(dirname(source), response.file))),
        response.sha256,
        'Official response hash mismatch: ' + id,
      );
    }
    const proposal = prepareOfficialChanges(published, report, {
      catalog,
      selection,
      policy,
    });
    mkdirSync(destination);
    writeFileSync(join(destination, 'plan.json'), json(proposal.plan));
    if (proposal.plan.changes.length) {
      [proposal.catalog, proposal.selection, proposal.policy].forEach((value, index) =>
        writeFileSync(join(destination, inputNames[index]), reviewJson(values[index], value)),
      );
    }
    console.log(
      JSON.stringify({ changes: proposal.plan.changes.length, digest: proposal.plan.digest }),
    );
  } else if (operation === 'validate') {
    console.log(validateOfficialBuild(published, read(source), destination));
  } else {
    throw Error('Unknown official candidate operation: ' + operation);
  }
}
