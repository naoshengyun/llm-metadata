import { groupBy } from './group-by.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  canonical,
  CNY_POLICY,
  generateCny,
  hash,
  PRICE_KEYS,
} from '../.cache/cny-build/cny/generate.js';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => canonical(a) === canonical(b);
const identityOf = (row) => ({
  providerId: row.providerId,
  endpoint: row.endpoint,
  modelId: row.modelId,
  priceList: row.priceList,
  currency: row.sourceCurrency,
});
const fields = (obj) => Object.keys(obj ?? {});
const skipped = new Set([
  'deferred',
  'subscription',
  'excluded',
  'withdrawn',
  'not-offered',
  'deprecated',
]);
const timestamp = (value) => {
  const valid =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
  if (!valid) throw Error('Expected an ISO timestamp with timezone: ' + value);
  return Date.parse(value);
};

function readBaseline(directory) {
  const { candidateId, ...manifest } = JSON.parse(readFileSync(join(directory, 'manifest.json')));
  if (manifest.schemaVersion !== 1 || hash(manifest) !== candidateId) {
    throw Error('Invalid unified candidate identity');
  }
  function read(name) {
    const bytes = readFileSync(join(directory, name));
    const expected = manifest.files[name];
    if (bytes.length !== expected?.bytes || sha(bytes) !== expected.sha256) {
      throw Error('Unified candidate file hash mismatch: ' + name);
    }
    return JSON.parse(bytes);
  }
  return {
    baseline: {
      candidateId,
      sourceSha: manifest.sourceSha,
      coverageSha256: manifest.files['coverage.json'].sha256,
    },
    coverage: read('coverage.json'),
    selection: read('selection.json'),
    policy: read('policy.json'),
  };
}

async function loadAdapters() {
  const directory = new URL('./official-sources/', import.meta.url);
  const sources = await Promise.all(
    readdirSync(directory)
      .filter((name) => name.endsWith('.mjs'))
      .sort()
      .map(async (name) => (await import(new URL(name, directory))).adapter),
  );
  return sources.flat();
}

function httpsUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw Error('Expected an unauthenticated HTTPS official URL');
  }
  return url.href;
}

async function getOfficialResponse(adapter) {
  const urls = new Set([adapter.url, ...(adapter.allowedFinalUrls ?? [])].map(httpsUrl));
  const signal = AbortSignal.timeout(20_000);
  let url = httpsUrl(adapter.url);
  for (let redirect = 0; redirect < 5; redirect++) {
    if (!urls.has(url)) throw Error('Official source redirected outside its registered URLs');
    const response = await fetch(url, { method: 'GET', redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw Error('Official source redirect is missing Location');
      url = new URL(location, url).href;
      continue;
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) throw Error('Official response exceeds 16 MiB');
      chunks.push(chunk);
    }
    return {
      url,
      body: Buffer.concat(chunks),
      status: response.status,
      obtainedAt: new Date().toISOString(),
    };
  }
  throw Error('Too many official source redirects');
}

function previousResults(previous, baseline, attemptedAt) {
  if (previous == null) return new Map();
  if (
    previous.schemaVersion !== 1 ||
    previous.publishedVersion?.candidateId !== baseline.candidateId
  ) {
    throw Error('Previous official check belongs to a different fixed candidate');
  }
  if (timestamp(previous.attemptedAt) > timestamp(attemptedAt)) {
    throw Error('Previous official check is newer than this attempt');
  }
  const values = new Map();
  for (const result of previous.results) {
    if (values.has(result.id)) throw Error('Duplicate result in previous official check');
    if (
      result.latestSuccessfulAt &&
      timestamp(result.latestSuccessfulAt) > timestamp(previous.attemptedAt)
    ) {
      throw Error('Previous successful check time is newer than its attempt');
    }
    values.set(result.id, result);
  }
  return values;
}

function coverageEntries(coverage, selection) {
  const modelKey = ({ providerId, modelId }) => JSON.stringify([providerId, modelId]);
  const models = new Map(coverage.models.map((row) => [modelKey(row), row]));
  const prices = coverage.models.flatMap((model) =>
    model.upstreamPrice ? [model.upstreamPrice] : [],
  );
  prices.push(...coverage.quotes);
  const known = new Set(prices.map(({ quoteId }) => quoteId));
  if (known.size !== prices.length) throw Error('Duplicate quote identity in unified coverage');
  for (const model of coverage.models) {
    if (!model.upstreamPrice && !model.quoteIds?.length) {
      prices.push({ ...model, quoteId: null, source: null });
    }
  }
  return [
    ...prices.map((price) => {
      const model = models.get(modelKey(price));
      const modelStatus = model?.status;
      const status = skipped.has(modelStatus) ? modelStatus : price.status;
      return {
        id: price.quoteId ?? modelKey(price),
        quote: price,
        status,
        reason: skipped.has(modelStatus) ? model.reason : price.reason,
        selected: Boolean(price.quoteId && selection[price.nativeKey] === price.quoteId),
        domestic: model?.domestic ?? price.originalQuote?.origin === 'domestic',
      };
    }),
    ...coverage.toolReferences.map((reference, index) => ({
      id: 'tool-reference:' + index,
      quote: { outputKind: 'tool-reference', modelId: reference.key, reference },
    })),
  ];
}

function registeredTargets(adapters, entries, notOfferedModels, excludedProviderIds = []) {
  const sources = new Set();
  const registered = new Map();
  const available = new Map(entries.map((entry) => [entry.id, entry]));
  const excludedProviders = new Set(excludedProviderIds);
  for (const { status, quote } of entries)
    if (status === 'subscription') excludedProviders.add(quote.providerId);
  for (const source of adapters) {
    if (
      !/^[a-z0-9][a-z0-9-]*$/.test(source.id) ||
      source.id.includes('--') ||
      sources.has(source.id)
    ) {
      throw Error('Invalid or duplicate official source ID: ' + source.id);
    }
    sources.add(source.id);
    httpsUrl(source.url);
    const supplementalIds = new Set();
    for (const request of source.supplemental ?? []) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(request.id) || supplementalIds.has(request.id)) {
        throw Error('Invalid or duplicate supplemental official source ID: ' + request.id);
      }
      supplementalIds.add(request.id);
      httpsUrl(request.url);
    }
    for (const target of source.targets) {
      if (
        notOfferedModels?.includes(target.modelId) ||
        excludedProviders.has(target.providerId)
      )
        continue;
      if (!target.group || registered.has(target.quoteId)) {
        throw Error('Invalid or duplicate official quote registration: ' + target.quoteId);
      }
      const entry = available.get(target.quoteId);
      const { providerId, endpoint, modelId, priceList, currency } = target;
      const identity = { providerId, endpoint, modelId, priceList, currency };
      const baselineIdentity = { ...identity, ...target.baselineIdentity };
      const publishedIdentity = entry && identityOf(entry.quote);

      if (
        fields(identity).some((key) => typeof identity[key] !== 'string' || !identity[key]) ||
        (entry &&
          (!equal(publishedIdentity, baselineIdentity) ||
            currency !== (entry.domestic ? 'CNY' : 'USD')))
      ) {
        throw Error('Official registration identity or currency mismatch: ' + target.quoteId);
      }
      registered.set(target.quoteId, { source, target, identity, missing: !entry });
    }
  }
  return registered;
}

// Split source objects into reviewable monetary, unit, and condition fields.
function priceComponents(value, path = '', result = { amounts: {}, units: {}, conditions: {} }) {
  for (const [key, item] of Object.entries(value ?? {})) {
    const name = path ? path + '.' + key : key;
    if (PRICE_KEYS.has(key) || key === 'amount') {
      result.amounts[name] = item;
    } else if (key === 'unit') {
      result.units[name] = item;
    } else if (item !== null && typeof item === 'object') {
      priceComponents(item, name, result);
    } else {
      result.conditions[name] = item;
    }
  }
  return result;
}

function originalRecord(entry, parsed, evidence) {
  const { quote } = entry;
  const previous = quote.originalQuote;
  const isTask = quote.outputKind === 'task-model';
  const required = parsed.required;
  if (!Array.isArray(required) || (required.length === 0 && !isTask)) {
    throw Error('Missing applicable charges');
  }
  const oldRequired = previous?.required ?? Object.keys(priceComponents(quote.sourcePrice).amounts);
  for (const charge of oldRequired) {
    if (!required.includes(charge))
      throw Error('Previously reviewed applicable charge missing: ' + charge);
  }
  if (
    !parsed.conditions ||
    typeof parsed.conditions !== 'object' ||
    Array.isArray(parsed.conditions)
  ) {
    throw Error('Missing complete charging conditions');
  }
  if (typeof parsed.sourceUnit !== 'string' || !parsed.sourceUnit)
    throw Error('Missing billing unit');
  if (!isTask && !['per_million_tokens', 'per_image'].includes(parsed.sourceUnit)) {
    throw Error('Unsupported billing unit: ' + parsed.sourceUnit);
  }
  if (isTask && parsed.sourceUnit !== 'per-charge') throw Error('Expected task charge units');
  if (
    !isTask &&
    (parsed.sourceUnit === 'per_image') !== Object.hasOwn(parsed.sourcePrice, 'per_image')
  ) {
    throw Error('Model charge shape does not match billing unit');
  }
  const { providerId, endpoint, modelId, priceList, currency } = parsed.identity;
  const record = {
    ...previous,
    ...(!previous && { id: parsed.recordId ?? quote.quoteId, provider: providerId, endpoint }),
    model: modelId,
    priceList,
    origin: entry.domestic ? 'domestic' : 'foreign',
    currency,
    required,
    cost: isTask ? {} : parsed.sourcePrice,
    conditions: parsed.conditions,
    ...(parsed.description !== undefined && { description: parsed.description }),
    ...(parsed.thinkingToggle && { thinkingToggle: parsed.thinkingToggle }),
    unit: parsed.sourceUnit,
    source: {
      url: evidence.finalUrl,
      sha256: evidence.sha256,
      checkedAt: evidence.obtainedAt.slice(0, 10),
      ...(evidence.supplemental && {
        supplemental: Object.values(evidence.supplemental).map((item) => ({
          url: item.finalUrl,
          sha256: item.sha256,
          checkedAt: item.obtainedAt.slice(0, 10),
        })),
      }),
    },
  };
  if (previous?.upstreamKey) record.upstreamKey = previous.upstreamKey;
  delete record.effectiveAt;
  if (parsed.effectiveAt) record.effectiveAt = parsed.effectiveAt;
  if (isTask) {
    record.task = { ...previous?.task, ...parsed.task, tiers: parsed.sourcePrice };
    const applicable = (task) => new Map((task?.tiers ?? []).map((tier) => [tier.name, tier]));
    const observed = applicable(record.task);
    for (const [name, tier] of applicable(previous?.task)) {
      const updated = observed.get(name);
      if (
        !updated ||
        fields(tier.when).some((key) => !Object.hasOwn(updated.when ?? {}, key)) ||
        tier.charges.some(
          ({ usageKey, freeQuantity }) =>
            !updated.charges?.some(
              (charge) =>
                charge.usageKey === usageKey &&
                (freeQuantity === undefined || charge.freeQuantity !== undefined),
            ),
        )
      ) {
        throw Error('Previously reviewed task tier, charge or condition missing: ' + name);
      }
    }
  }
  const { upstreamKey, ...compileRecord } = record;
  const compiled = generateCny({
    upstream: {},
    records: [compileRecord],
    selection: { [quote.nativeKey ?? quote.modelId]: record.id },
  });
  const checked = compiled.catalog[0];
  if (checked.diagnostic.status !== 'ready') {
    throw Error('Official quote failed validation: ' + checked.diagnostic.fields.join(', '));
  }
  const expression = isTask
    ? compiled.plugins[quote.nativeKey]?.[record.task.plugin]
    : compiled.models[quote.nativeKey]?.billing_expr;
  const cnyCost = isTask
    ? record.task.tiers.map((tier) => ({
        ...tier,
        charges: tier.charges.map((charge) => ({
          ...charge,
          currency: 'CNY',
          amount: charge.amount * CNY_POLICY[charge.currency],
        })),
      }))
    : checked.cnyCost;
  return { record, cnyCost, expression };
}

function evaluate(entry, registration, parsed, evidence, attemptedAt) {
  const { target, identity } = registration;
  const { quote } = entry;
  if (!parsed) throw Error('Exact official price row is missing');
  if (parsed.error) throw Error(parsed.error);
  const before = {
    identity,
    sourcePrice: quote.sourcePrice ?? null,
    sourceUnit: quote.sourceUnit ?? null,
    conditions: quote.originalQuote?.conditions ?? target.baselineConditions ?? {},
    ...(quote.originalQuote?.effectiveAt && { effectiveAt: quote.originalQuote.effectiveAt }),
  };
  if (!equal(parsed.identity, identity)) {
    throw Object.assign(Error('Official price identity differs from registration'), {
      difference: { identity: { before: identity, after: parsed.identity ?? null } },
    });
  }
  const future =
    parsed.effectiveAt !== undefined && timestamp(parsed.effectiveAt) > timestamp(attemptedAt);
  if (parsed.withdrawal) {
    if (typeof parsed.withdrawal.statement !== 'string' || !parsed.withdrawal.statement.trim()) {
      throw Error('Formal withdrawal requires an explicit official statement');
    }
    if (parsed.sourcePrice !== undefined)
      throw Error('Withdrawal cannot include replacement charges');
    const statement = parsed.withdrawal.statement;
    if (!new TextDecoder().decode(registration.body).includes(statement)) {
      throw Error('Formal withdrawal statement is absent from the official response');
    }
    return {
      status: future ? 'future-effective' : 'withdrawal',
      observed: { identity, withdrawal: { statement }, effectiveAt: parsed.effectiveAt },
      difference: { withdrawal: { before, after: { statement, effectiveAt: parsed.effectiveAt } } },
    };
  }
  const referenceReason = target.referenceOnlyReason;
  if (referenceReason) {
    const amounts = priceComponents(parsed.sourcePrice).amounts;
    if (
      !Object.keys(amounts).length ||
      Object.values(amounts).some((amount) => !Number.isFinite(amount) || amount < 0) ||
      !parsed.sourceUnit ||
      !parsed.conditions ||
      !Array.isArray(parsed.required) ||
      !parsed.required.length ||
      parsed.required.some((key) => !Object.hasOwn(amounts, key))
    ) {
      throw Error('Incomplete official reference amounts or conditions');
    }
  }
  const candidate = referenceReason ? undefined : originalRecord(entry, parsed, evidence);
  const observed = {
    identity,
    sourcePrice: parsed.sourcePrice,
    sourceUnit: parsed.sourceUnit,
    conditions: parsed.conditions,
    ...(parsed.effectiveAt && { effectiveAt: parsed.effectiveAt }),
    ...(candidate && { cnyCost: candidate.cnyCost }),
    ...(referenceReason && identity.currency === 'CNY' && { cnyCost: parsed.sourcePrice }),
  };
  const beforePrice = priceComponents(before.sourcePrice);
  const afterPrice = priceComponents(observed.sourcePrice);
  const difference = {};
  for (const [category, beforeValue, afterValue] of [
    ['amounts', beforePrice.amounts, afterPrice.amounts],
    [
      'units',
      { sourceUnit: before.sourceUnit, ...beforePrice.units },
      { sourceUnit: observed.sourceUnit, ...afterPrice.units },
    ],
    [
      'chargingConditions',
      { fields: beforePrice.conditions, declared: before.conditions },
      { fields: afterPrice.conditions, declared: observed.conditions },
    ],
    ['effectiveTime', before.effectiveAt, observed.effectiveAt],
  ]) {
    if (!equal(beforeValue, afterValue)) {
      difference[category] = { before: beforeValue ?? null, after: afterValue ?? null };
    }
  }
  if (!referenceReason && entry.selected && !candidate.expression)
    throw Error('Selected official quote did not emit a valid price');
  return {
    status: referenceReason
      ? future
        ? 'future-effective'
        : 'unsupported'
      : fields(difference).length === 0
        ? 'unchanged'
        : future
          ? 'future-effective'
          : 'changed',
    ...(referenceReason && { reason: referenceReason }),
    observed,
    difference,
    candidate,
  };
}

export async function checkOfficialPrices({
  baseline: directory,
  attemptedAt = new Date().toISOString(),
  previous,
  adapters,
  getResponse = getOfficialResponse,
  onResponse = () => {},
}) {
  timestamp(attemptedAt);
  const { baseline, coverage, selection, policy } = readBaseline(directory);
  const old = previousResults(previous, baseline, attemptedAt);
  const entries = coverageEntries(coverage, selection);
  const registered = registeredTargets(
    adapters ?? (await loadAdapters()),
    entries,
    policy.notOfferedModels,
    coverage.excludedProviderIds,
  );
  const responses = new Map();
  const results = [];
  const changes = [];
  const staged = [];
  for (const entry of entries) {
    const { id, quote, status, reason, selected } = entry;
    const registration = registered.get(id);
    const result = {
      id,
      quoteId: quote.quoteId ?? null,
      nativeKey: quote.nativeKey ?? null,
      identity: identityOf(quote),
      outputKind: quote.outputKind,
      coverageStatus: status ?? null,
      coverageReason: reason ?? null,
      selected,
      publishedEvidence: selected ? quote.source : null,
      latestAttemptedAt: old.get(id)?.latestAttemptedAt ?? null,
      latestSuccessfulAt: old.get(id)?.latestSuccessfulAt ?? null,
    };
    results.push(result);
    if (skipped.has(status)) {
      Object.assign(result, { status, reason });
    } else if (quote.outputKind === 'tool-reference') {
      Object.assign(result, { status: 'tool-reference', reason: 'tool-price-managed-in-New-API' });
    } else if (!registration) {
      Object.assign(result, {
        status: 'not-registered',
        reason: 'no-official-adapter-for-exact-quote',
      });
    } else {
      staged.push({ entry, result, registration });
    }
  }

  for (const [id, { missing, identity }] of registered) {
    if (!missing) continue;
    const event = policy.lifecycle[identity.modelId]?.at(-1);
    const withdrawn = event?.state === 'withdrawn' && event.quoteId === id;
    const reason = withdrawn
      ? (event.reason ?? 'official-price-withdrawn')
      : 'official-registration-missing-from-unified-coverage';
    const status = withdrawn
      ? event.reason === 'model-deprecated' ? 'deprecated' : 'withdrawn'
      : 'failed';
    results.push({
      id,
      quoteId: id,
      nativeKey: identity.modelId,
      identity,
      coverageStatus: withdrawn ? status : null,
      coverageReason: reason,
      selected: false,
      publishedEvidence: null,
      latestAttemptedAt: withdrawn ? null : attemptedAt,
      latestSuccessfulAt: old.get(id)?.latestSuccessfulAt ?? null,
      status,
      reason,
      ...(withdrawn && { evidence: event.evidence }),
    });
  }

  await Promise.all(
    [...groupBy(staged, ({ registration }) => registration.source).entries()].map(
      async ([source, items]) => {
        let evidence;
        let body;
        let parsed;
        let failure;
        async function readResponse(request) {
          const response = await getResponse(request, attemptedAt);
          const body = Buffer.from(response.body);
          const url = httpsUrl(response.url);
          if (![request.url, ...(request.allowedFinalUrls ?? [])].map(httpsUrl).includes(url)) {
            throw Error('Official response came from an unregistered URL');
          }
          if (timestamp(response.obtainedAt) < timestamp(attemptedAt)) {
            throw Error('Official response predates this check attempt');
          }
          const evidence = {
            requestedUrl: request.url,
            finalUrl: url,
            sha256: sha(body),
            obtainedAt: response.obtainedAt,
            status: response.status ?? 200,
            file: 'responses/' + request.id + '.body',
          };
          onResponse(evidence, body);
          responses.set(request.id, evidence);
          return { body, evidence };
        }

        try {
          ({ body, evidence } = await readResponse(source));
          if (evidence.status !== 200) throw Error('Official source HTTP ' + evidence.status);
          const supplemental = new Map();
          if (source.supplemental?.length) {
            evidence.supplemental = {};
            for (const request of source.supplemental) {
              const response = await readResponse({
                ...request,
                id: source.id + '--' + request.id,
              });
              evidence.supplemental[request.id] = response.evidence;
              if (response.evidence.status !== 200) {
                throw Error(
                  'Supplemental official source ' +
                    request.id +
                    ' HTTP ' +
                    response.evidence.status,
                );
              }
              supplemental.set(request.id, response);
            }
          }
          parsed = await source.parse({ body, evidence, supplemental });
        } catch (error) {
          failure = error;
        }

        for (const item of items) {
          const { entry, registration, result } = item;
          Object.assign(result, { sourceId: source.id, latestAttemptedAt: attemptedAt, evidence });
          try {
            if (failure) throw failure;
            item.evaluation = evaluate(
              entry,
              { ...registration, body },
              parsed.get(entry.id),
              evidence,
              attemptedAt,
            );
          } catch (error) {
            Object.assign(result, {
              status: 'failed',
              reason: error.message,
              difference: error.difference,
            });
          }
        }

        const groups = groupBy(items, ({ registration }) => registration.target.group);
        for (const group of groups.values()) {
          const invalid = group.find(
            ({ entry, result }) => entry.selected && result.status === 'failed',
          );
          for (const { entry, result, evaluation } of group) {
            if (!evaluation) continue;
            if (invalid) {
              Object.assign(result, {
                status: 'failed',
                reason: 'Shared tariff rejected after failure for ' + invalid.entry.id,
              });
              continue;
            }
            const { status, observed, difference, reason } = evaluation;
            Object.assign(result, {
              status,
              ...(reason && { reason }),
              observed,
              difference,
              latestSuccessfulAt: attemptedAt,
            });
            if (status !== 'unchanged' && status !== 'unsupported') {
              changes.push({
                id: entry.id,
                nativeKey: entry.quote.nativeKey,
                selected: entry.selected,
                status,
                evidence,
                observed,
                difference,
                candidate: evaluation.candidate,
              });
            }
          }
        }
      },
    ),
  );

  return {
    schemaVersion: 1,
    publishedVersion: baseline,
    attemptedAt,
    summary: Object.fromEntries(
      [...groupBy(results, ({ status }) => status)].map(([status, items]) => [
        status,
        items.length,
      ]),
    ),
    responses: Object.fromEntries([...responses].sort(([a], [b]) => a.localeCompare(b))),
    results,
    changes: changes.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [baseline, output, previousPath] = process.argv.slice(2);
  if (!baseline || !output) {
    throw Error(
      'Usage: check-official-cny.mjs <fixed-unified-candidate> <exclusive-output> [previous-check.json]',
    );
  }
  const previous = previousPath ? JSON.parse(readFileSync(previousPath)) : undefined;
  mkdirSync(output);
  mkdirSync(join(output, 'responses'));
  const sourceDirectory = new URL('./official-sources/', import.meta.url);
  const sourceFiles = readdirSync(sourceDirectory, { recursive: true })
    .filter((name) => name.endsWith('.mjs'))
    .sort();
  const checkerFiles = Object.fromEntries(
    sourceFiles.map((name) => [name, sha(readFileSync(new URL(name, sourceDirectory)))]),
  );
  const checker = {
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: new URL('../', import.meta.url),
      encoding: 'utf8',
    }).trim(),
    files: {
      'check-official-cny.mjs': sha(readFileSync(new URL(import.meta.url))),
      ...checkerFiles,
    },
  };
  const report = await checkOfficialPrices({
    baseline,
    previous,
    onResponse: (evidence, body) =>
      writeFileSync(join(output, evidence.file), body, { flag: 'wx' }),
  });
  writeFileSync(
    join(output, 'official-check.json'),
    JSON.stringify({ ...report, checker }, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({ publishedVersion: report.publishedVersion, summary: report.summary }),
  );
}
