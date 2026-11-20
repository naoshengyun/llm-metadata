/** Offline #34 candidate. Builds the page data and the model sync endpoint together. */
import { groupBy } from './group-by.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical, generateCny, hash, CNY_POLICY } from '../.cache/cny-build/cny/generate.js';
import { adaptPrice, domesticProviders, sha } from './upstream-cny.mjs';
import { makeSnapshot } from './upstream-snapshot.mjs';
import { verifyArtifact } from '../.cache/cny-build/cny/artifact.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const locales = ['en', 'zh', 'ja'];
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const entries = (value) => Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
const providerModel = (providerId, modelId) => JSON.stringify([providerId, modelId]);

function readInputs(policyPath, officialPath, selectionPath, upstreamPath, previousPath) {
  const inputs = {};
  const read = (path, name = path) => {
    const bytes = readFileSync(resolve(root, path));
    inputs[name] = sha(bytes);
    return JSON.parse(bytes);
  };
  const policy = read(policyPath, 'unified-policy');
  const upstreamRoot = resolve(root, upstreamPath ?? policy.upstreamDirectory);
  const source = read(join(upstreamRoot, 'source.json'), 'upstream/source.json');
  const snapshots = {};
  for (const name of [...locales.map((locale) => locale + '.json'), 'native.json']) {
    const path = 'upstream/' + name;
    const data = read(join(upstreamRoot, name), path);
    if (inputs[path] !== source.files[name]?.sha256)
      throw Error('Upstream source hash mismatch: ' + name);
    if (name !== 'native.json') snapshots[name.slice(0, 2)] = data;
  }
  const legacy = read('data/cny/publication/artifact.json');
  if (!verifyArtifact(legacy)) throw Error('Invalid original candidate baseline');
  const request = read('data/cny/publication/upstream-release.json');
  const prior = makeSnapshot(root);
  if (
    !request.approval?.confirmed ||
    request.releaseId !== prior.releaseId ||
    request.manifestSha256 !== prior.manifestSha256
  )
    throw Error('Could not verify fixed previous upstream release for price diff');
  inputs['previous/ratio_config.json'] = sha(prior.files['ratio_config.json']);
  const previous = previousPath ? readPrevious(previousPath, read, inputs) : null;
  return {
    source,
    snapshots,
    inputs,
    legacy,
    prior,
    previous,
    official: read(officialPath, 'official-catalog'),
    selection: read(selectionPath, 'official-selection').selection,
    policy,
  };
}

function readPrevious(previousPath, read, inputs) {
  const readFile = (name) => read(join(previousPath, name), 'previous/' + name);
  const { candidateId, ...manifest } = readFile('manifest.json');
  if (manifest.schemaVersion !== 1 || hash(manifest) !== candidateId)
    throw Error('Invalid previous unified candidate identity');
  const verified = (name) => {
    const value = readFile(name);
    if (inputs['previous/' + name] !== manifest.files[name]?.sha256)
      throw Error('Previous unified candidate file hash mismatch: ' + name);
    return value;
  };
  return {
    candidateId,
    policy: verified('policy.json'),
    coverage: verified('coverage.json'),
    selected: verified('selection.json'),
    officialSelection: verified('official-selection.json'),
    config: verified('api/newapi/ratio_config.json'),
  };
}

function effectiveTime(value, label) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw Error('Explicit timestamp and timezone required: ' + label);
  return Date.parse(value);
}

function validateServiceScope(policy, selection) {
  const keys = policy.notOfferedModels ?? [];
  if (
    !Array.isArray(keys) ||
    keys.some((key) => typeof key !== 'string' || !key || /\s/.test(key)) ||
    new Set(keys).size !== keys.length ||
    (keys.length && !policy.sources.notOffered?.startsWith('https://'))
  ) {
    throw Error('Invalid model service scope or decision source');
  }
  for (const key of keys) {
    if (Object.hasOwn(selection, key) || Object.hasOwn(policy.upstreamSelection, key))
      throw Error('Model outside service scope has an explicit price selection: ' + key);
  }
}

function lifecycleState(policy, selection, legacySelection, previous) {
  const asOf = effectiveTime(policy.asOf, 'asOf');
  const state = new Map();
  const approvedRestorations = new Set();
  const priorSelection = { ...legacySelection, ...previous?.officialSelection };
  if (previous && asOf < Date.parse(previous.policy.asOf))
    throw Error('Candidate effective time cannot precede the previous reviewed cutoff');
  for (const [key, priorEvents] of entries(previous?.policy.lifecycle ?? {})) {
    const prefix = policy.lifecycle[key]?.slice(0, priorEvents.length);
    if (!prefix || hash(prefix) !== hash(priorEvents))
      throw Error('Lifecycle history was removed or rewritten: ' + key);
  }
  for (const [key, events] of entries(policy.lifecycle)) {
    if (!Array.isArray(events) || !events.length) throw Error('Missing lifecycle events: ' + key);
    const existingEvents = previous?.policy.lifecycle[key];
    let activeQuoteId =
      existingEvents?.[0].quoteId ?? previous?.selected[key] ?? legacySelection[key];
    let lastEvent;
    for (const event of events) {
      const at = effectiveTime(event.at, key);
      if (
        !['withdrawn', 'restored'].includes(event.state) ||
        (event.reason !== undefined &&
          (event.state !== 'withdrawn' || event.reason !== 'model-deprecated')) ||
        !event.quoteId ||
        !event.evidence?.url?.startsWith('https://') ||
        !/^[0-9a-f]{64}$/.test(event.evidence?.sha256 ?? '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(event.evidence?.checkedAt ?? '') ||
        at > asOf ||
        (lastEvent &&
          (at <= Date.parse(lastEvent.at) ||
            event.state === lastEvent.state ||
            event.evidence.sha256 === lastEvent.evidence.sha256)) ||
        (!lastEvent && event.state !== 'withdrawn') ||
        (event.state === 'withdrawn' && activeQuoteId && event.quoteId !== activeQuoteId)
      )
        throw Error('Invalid lifecycle event: ' + key);
      if (event.state === 'restored') activeQuoteId = event.quoteId;
      lastEvent = event;
    }
    if (
      lastEvent.state === 'restored' &&
      selection[key] !== lastEvent.quoteId &&
      policy.upstreamSelection[key] !== lastEvent.quoteId
    )
      throw Error('Restoration requires explicit selection: ' + key);
    if (lastEvent.state === 'withdrawn' && selection[key] && selection[key] !== lastEvent.quoteId)
      throw Error('Withdrawn native key requires explicit restoration: ' + key);
    if (
      lastEvent.state === 'restored' &&
      existingEvents?.length === events.length &&
      previous.selected[key] === lastEvent.quoteId
    ) {
      approvedRestorations.add(key);
    }
    state.set(key, lastEvent);
  }
  for (const key of Object.keys(previous?.policy.upstreamSelection ?? {}))
    if (
      !Object.hasOwn(selection, key) &&
      !Object.hasOwn(policy.upstreamSelection, key) &&
      !policy.notOfferedModels?.includes(key) &&
      state.get(key)?.state !== 'withdrawn'
    )
      throw Error('Selected upstream identity removed without withdrawal or replacement: ' + key);
  for (const [key] of entries(priorSelection))
    if (
      !Object.hasOwn(selection, key) &&
      priorSelection[key] &&
      !policy.notOfferedModels?.includes(key) &&
      state.get(key)?.state !== 'withdrawn' &&
      !Object.hasOwn(policy.upstreamSelection, key)
    )
      throw Error('Selected price removed without withdrawal: ' + key);
  return { asOf, state, approvedRestorations, hasPrevious: Boolean(previous) };
}

function withdrawalStatus(event) {
  return event.reason === 'model-deprecated' ? 'deprecated' : 'withdrawn';
}

function originalPrice(model, currency) {
  if (!model.cost) return null;
  if (currency && model.cost.currency !== currency && model.cost.currency_options?.[currency])
    return model.cost.currency_options[currency];
  const { currency_options, currency: _currency, ...price } = model.cost;
  return price;
}

function upstreamRows(providers, policy, source) {
  const records = new Map();
  for (const [providerId, provider] of entries(providers)) {
    if (provider.id !== providerId)
      throw Error('Upstream provider identity mismatch: ' + providerId);
    for (const [modelId, model] of entries(provider.models)) {
      if (model.id !== modelId) throw Error('Upstream model identity mismatch: ' + modelId);
      const price = adaptPrice(provider, model);
      const deferred = policy.deferredModels[providerId]?.includes(modelId);
      const deferredEvidence = policy.deferredEvidence[providerId];
      const evidence = deferredEvidence?.models.includes(modelId)
        ? deferredEvidence.criterion
        : null;
      const correction = policy.ineligibleUpstream[modelId];
      const exclusion = policy.nativeCapabilityExclusions?.[modelId];
      const incapable =
        exclusion?.providerId === providerId && exclusion.endpoint === (provider.api ?? null);
      const corrected = correction?.providerId === providerId;
      const domestic = domesticProviders.has(providerId) || provider.currency === 'CNY';
      if (
        incapable &&
        (corrected ||
          deferred ||
          evidence ||
          exclusion.currency !== (domestic ? 'CNY' : 'USD') ||
          (!domestic && !exclusion.source?.endpoint?.startsWith('https://')) ||
          !exclusion.sourceUnit ||
          !exclusion.sourcePrice ||
          !exclusion.conditions ||
          !exclusion.reason ||
          !exclusion.source?.url?.startsWith('https://') ||
          !/^[0-9a-f]{64}$/.test(exclusion.source?.sha256 ?? '') ||
          !/^\d{4}-\d{2}-\d{2}$/.test(exclusion.source?.checkedAt ?? ''))
      ) {
        throw Error('Invalid native capability exclusion evidence: ' + modelId);
      }
      const sourceCurrency = corrected
        ? correction.sourceCurrency
        : incapable
          ? exclusion.currency
          : evidence === 'source-currency'
            ? null
            : (price.sourceCurrency ?? model.cost?.currency ?? (model.cost ? 'USD' : null));
      const status = deferred || evidence
        ? 'deferred'
        : corrected || price.reason?.startsWith('unsupported-source-currency:')
          ? 'excluded'
          : incapable
            ? 'unsupported'
            : price.status;
      const reason = deferred
        ? 'approved-deferred-model'
        : evidence
          ? 'approved-deferred-evidence:complete-tariff-requires-' + evidence
          : corrected
            ? correction.reason
            : incapable
              ? exclusion.reason
              : (price.reason ?? null);
      const amount = originalPrice(model, sourceCurrency);
      const upstreamPrice = {
        quoteId: 'upstream:' + providerId + ':' + modelId + ':' + (sourceCurrency ?? 'unknown'),
        providerId,
        modelId,
        nativeKey: modelId,
        priceList: 'fixed upstream primary or original CNY sheet',
        endpoint: provider.api ?? null,
        sourceCurrency,
        originalCurrencyEligible: Boolean(
          (incapable && exclusion.sourcePrice) ||
            (amount && price.sourceCurrency && !corrected && evidence !== 'source-currency'),
        ),
        sourcePrice:
          corrected || evidence === 'source-currency'
            ? null
            : incapable
              ? exclusion.sourcePrice
              : amount,
        ...(incapable && { conditions: exclusion.conditions }),
        upstreamReportedCost: model.cost ?? null,
        sourceUnit: incapable
          ? exclusion.sourceUnit
          : price.unit === 'image'
            ? 'per_image'
            : price.unit === 'token'
              ? 'per_million_tokens'
              : null,
        source: incapable
          ? exclusion.source
          : {
              url: corrected ? correction.source : (provider.doc ?? null),
              upstreamSha: source.upstreamSha,
              snapshotAt: source.snapshotAt,
              checkedAt: null,
              sha256: amount ? hash({ amount, sourceCurrency }) : null,
            },
        status,
        reason,
        selected: false,
        syncable: false,
        outputKind: 'model',
        cnyCost: incapable
          ? (domestic ? exclusion.sourcePrice : undefined)
          : corrected || deferred || evidence
            ? undefined
            : price.cost,
        unit: price.unit,
        billing_expr: status === 'eligible' ? price.expr : undefined,
      };
      records.set(providerModel(providerId, modelId), {
        providerId,
        modelId,
        status,
        reason,
        origin: 'upstream',
        domestic,
        upstreamPrice,
        quoteIds: [],
      });
    }
  }
  return records;
}

function requiredShape(quote) {
  const fees = new Set(quote.required ?? []);
  addConditionFields(quote.conditions, 'conditions');

  for (const tier of quote.task?.tiers ?? []) {
    fees.add('task.tiers.' + tier.name);
    for (const key of Object.keys(tier.when ?? {}))
      fees.add('task.tiers.' + tier.name + '.when.' + key);
    for (const { usageKey, freeQuantity } of tier.charges ?? []) {
      const field = 'task.tiers.' + tier.name + '.charges.' + usageKey;
      fees.add(field);
      if (freeQuantity !== undefined) fees.add(field + '.freeQuantity');
    }
  }
  return fees;

  function addConditionFields(value, path) {
    if (value == null || value === '') return;
    if (typeof value !== 'object') {
      fees.add(path);
      return;
    }
    for (const [key, field] of Object.entries(value)) addConditionFields(field, path + '.' + key);
  }
}

function sameRestorationEvidence(source, evidence) {
  return (
    source?.url === evidence.url &&
    source?.sha256 === evidence.sha256 &&
    source?.checkedAt === evidence.checkedAt
  );
}

function officialRows(
  officialRecords,
  selection,
  policy,
  records,
  providers,
  lifecycle,
  previousQuotes,
) {
  // The offered JSON uses one model-level expression for task and ordinary prices.
  const compileSelection = Object.fromEntries(
    entries(selection).filter(([key]) => lifecycle.state.get(key)?.state !== 'withdrawn'),
  );
  // Generate from original quotes even when upstream removes a previously associated model.
  const recordsForCompilation = officialRecords.map(({ upstreamKey, ...quote }) => quote);
  const compiled = generateCny({
    upstream: { providers: {} },
    records: recordsForCompilation,
    selection: compileSelection,
  });
  const quoteById = new Map();
  const previousById = new Map(previousQuotes.map((quote) => [quote.id, quote]));
  const selectionById = new Map();
  for (const [key, id] of entries(selection)) {
    if (selectionById.has(id)) throw Error('Quote selected for multiple native keys: ' + id);
    selectionById.set(id, key);
  }
  for (const [index, entry] of compiled.catalog.entries()) {
    const { diagnostic, cnyCost } = entry;
    const quote = officialRecords[index];
    if (
      quote.upstreamKey &&
      (quote.upstreamKey.model !== quote.model ||
        quote.upstreamKey.provider !== (policy.providerAliases[quote.provider] ?? quote.provider))
    )
      throw Error('Conflicting official catalog association: ' + quote.id);
    const providerId = policy.providerAliases[quote.provider] ?? quote.provider;
    const key = selectionById.get(quote.id);
    const tool = quote.kind === 'tool';
    const task = quote.kind === 'task';
    const applicationShapeValid =
      task === Boolean(quote.task) && tool === Boolean(quote.tools?.length);
    const pending =
      quote.effectiveAt !== undefined &&
      effectiveTime(quote.effectiveAt, quote.id) > lifecycle.asOf;
    const event = lifecycle.state.get(quote.model);
    const withdrawn = event?.state === 'withdrawn';
    const notOffered = !tool && policy.notOfferedModels?.includes(quote.model);
    const row = {
      quoteId: quote.id,
      providerId,
      sourceProviderId: quote.provider,
      modelId: quote.model,
      nativeKey: tool ? null : (key ?? quote.model),
      priceList: quote.priceList,
      endpoint: quote.endpoint ?? providers[providerId]?.api ?? null,
      sourceCurrency: quote.currency ?? null,
      sourcePrice: task ? quote.task?.tiers : tool ? quote.tools : quote.cost,
      sourceUnit:
        task || tool
          ? 'per-charge'
          : quote.cost?.per_image !== undefined
            ? 'per_image'
            : 'per_million_tokens',
      source: {
        ...quote.source,
        recordSha256: hash(quote),
        historicalEvidence:
          policy.fixedEvidence?.[quote.id]?.recordSha256 === hash(quote)
            ? policy.fixedEvidence[quote.id]
            : undefined,
      },
      originalQuote: quote,
      status: notOffered
        ? 'not-offered'
        : withdrawn
          ? withdrawalStatus(event)
          : pending
            ? 'pending-effective'
            : diagnostic.status,
      reason: notOffered
        ? 'naoshengyun-service-scope'
        : withdrawn
          ? (event.reason ?? 'official-price-withdrawn')
          : pending
            ? 'official-price-not-yet-effective'
            : diagnostic.fields.join('; ') || null,
      lifecycle: event,
      selected: key !== undefined,
      syncable: false,
      outputKind: tool ? 'tool-reference' : task ? 'task-model' : 'model',
      cnyCost: task || tool || diagnostic.status !== 'ready' ? undefined : cnyCost,
      usagePlugin: task ? quote.task?.plugin : undefined,
      cnyTaskTiers:
        task && diagnostic.status === 'ready'
          ? quote.task.tiers.map((tier) => ({
              ...tier,
              charges: tier.charges.map((charge) => ({
                ...charge,
                amount: charge.amount * CNY_POLICY[charge.currency],
                currency: 'CNY',
              })),
            }))
          : undefined,
      toolPolicy: tool
        ? { customerPrice: 0, operation: 'configure-in-New-API', reference: policy.sources.tools }
        : undefined,
      officialToolCny:
        tool && key
          ? Object.fromEntries((quote.tools ?? []).map(({ key }) => [key, compiled.tools[key]]))
          : undefined,
    };
    quoteById.set(quote.id, row);
    if (!tool) {
      const identity = providerModel(providerId, quote.model);
      if (!records.has(identity)) {
        records.set(identity, {
          providerId,
          modelId: quote.model,
          origin: 'official-addition',
          status: 'not-selected',
          reason: 'official-price-not-selected',
          domestic: quote.origin === 'domestic',
          quoteIds: [],
        });
      }
      records.get(identity).quoteIds.push(quote.id);
    }
    if (!key) continue;
    if (key !== quote.model)
      throw Error('Selected native key does not match exact official model: ' + key);
    if (withdrawn) continue;
    if (pending) throw Error('Selected quote is not yet effective: ' + quote.id);
    if (
      event?.state === 'restored' &&
      !sameRestorationEvidence(quote.source, event.evidence) &&
      !(
        (!lifecycle.hasPrevious || lifecycle.approvedRestorations.has(key)) &&
        sameRestorationEvidence(quote.restorationEvidence, event.evidence)
      )
    )
      throw Error('Restored quote needs matching new official evidence: ' + quote.id);
    if (diagnostic.status !== 'ready' || !applicationShapeValid)
      throw Error(
        'Selected quote incomplete: ' +
          quote.id +
          ' ' +
          (row.reason ?? 'incompatible charge partition'),
      );
    const previous = previousById.get(quote.id);
    if (previous) {
      for (const field of [
        'provider',
        'model',
        'priceList',
        'origin',
        'currency',
        'kind',
        'endpoint',
      ])
        if (previous[field] !== quote[field])
          throw Error('Selected quote changed identity field ' + field + ': ' + quote.id);
      const required = requiredShape(quote);
      for (const path of requiredShape(previous))
        if (!required.has(path))
          throw Error('Selected quote dropped charge or condition: ' + quote.id + ' ' + path);
    }
    if (tool) continue;
    const expression = task
      ? compiled.plugins[key]?.[row.usagePlugin]
      : compiled.models[key]?.billing_expr;
    if (!expression) throw Error('Selected quote did not emit a complete price: ' + quote.id);
    row.billing_expr = expression;
    row.unit = quote.cost?.per_image !== undefined ? 'image' : task ? 'task' : 'token';
  }
  for (const [key, id] of entries(selection)) {
    if (!quoteById.has(id) && lifecycle.state.get(key)?.state !== 'withdrawn')
      throw Error('Selected quote missing: ' + key + ' -> ' + id);
  }
  return quoteById;
}

function addSeedanceReference(official, policy, selection, records, quotes) {
  const modelId = 'doubao-seedance-2-5-260628';
  const providerId = 'volcengine';
  const held = official.excludedQuotes.find((entry) => entry.officialModel === modelId);
  if (!held?.rawFees?.rows?.length) throw Error('Missing full Seedance 2.5 reference tariff');
  const quoteId = 'volcengine:' + modelId + ':official-reference';
  const reason = 'seedance-4k-two-target-billing-cases-unverified';
  const previous = records.get(providerModel(providerId, modelId));
  const record = previous ?? {
    providerId,
    modelId,
    origin: 'requested-addition',
    domestic: true,
    quoteIds: [],
  };
  const selected = record.quoteIds.includes(selection[modelId]);
  if (!selected) {
    record.status = 'validation-held';
    record.reason = reason;
  }
  record.quoteIds.push(quoteId);
  records.set(providerModel(providerId, modelId), record);
  quotes.set(quoteId, {
    quoteId,
    providerId,
    modelId,
    nativeKey: modelId,
    sourceCurrency: 'CNY',
    priceList: 'Volcengine Ark / mainland / online',
    source: { ...held.source, sha256: hash(held) },
    sourcePrice: selected
      ? { ...held.rawFees, rows: held.rawFees.rows.filter(([resolution]) => resolution === '4K') }
      : held.rawFees,
    sourceUnit: held.rawFees.unit,
    status: 'validation-held',
    reason,
    selected: false,
    syncable: false,
    outputKind: 'task-model',
    verification: {
      decision: policy.sources.seedance,
      officialPrice: true,
      modelExpressionImportEvidence: policy.sources.seedance,
      actual4kBillingVerified: false,
    },
  });
}

function selectPrices(records, quotes, selection, policy, lifecycle) {
  const groups = groupBy(records.values(), (row) => row.modelId);
  const selected = Object.create(null);
  for (const [modelId, current] of groups) {
    if (policy.notOfferedModels?.includes(modelId)) {
      for (const row of current) {
        row.status = 'not-offered';
        row.reason = 'naoshengyun-service-scope';
        if (row.upstreamPrice) {
          row.upstreamPrice.status = row.status;
          row.upstreamPrice.reason = row.reason;
          delete row.upstreamPrice.billing_expr;
        }
      }
      continue;
    }
    const official = quotes.get(selection[modelId]);
    const held = current.find(({ status }) => status === 'validation-held');
    if (held) continue;
    const event = lifecycle.state.get(modelId);
    if (event?.state === 'withdrawn') {
      for (const row of current) {
        row.status = withdrawalStatus(event);
        row.reason = event.reason ?? 'official-price-withdrawn';
        row.lifecycle = event;
        if (row.status === 'deprecated' && row.upstreamPrice) {
          row.upstreamPrice.status = row.status;
          row.upstreamPrice.reason = row.reason;
          delete row.upstreamPrice.billing_expr;
        }
      }
      continue;
    }
    const exclusion = policy.nativeCapabilityExclusions?.[modelId];
    if (exclusion) {
      const identity = current.find(
        (row) =>
          row.providerId === exclusion.providerId &&
          row.upstreamPrice?.endpoint === exclusion.endpoint &&
          row.status === 'unsupported',
      );
      if (current.some((row) => row.providerId === exclusion.providerId) && !identity)
        throw Error('Native capability exclusion identity changed: ' + modelId);
      if (official || Object.hasOwn(policy.upstreamSelection, modelId))
        throw Error('Native capability exclusion blocks price selection: ' + modelId);
      for (const row of current) {
        row.status = 'unsupported';
        row.reason = exclusion.reason;
      }
      continue;
    }
    if (official && official.outputKind !== 'tool-reference') {
      const record = records.get(providerModel(official.providerId, modelId));
      if (record.status === 'deferred')
        throw Error(
          'Selected official quote has an excluded catalog identity: ' + official.quoteId,
        );
      if (Object.hasOwn(policy.upstreamSelection, modelId))
        throw Error('Multiple explicit selections for native key: ' + modelId);
      put(modelId, official, record);
      for (const row of current) {
        if (row === record || row.status !== 'eligible') continue;
        row.reason = 'explicit-official-price-selected';
        row.status = 'not-selected';
      }
      continue;
    }
    const domestic = current.filter((row) => row.domestic);
    const pool = domestic.length ? domestic : current;
    const explicit = policy.upstreamSelection[modelId];
    const eligible = (explicit ? current : pool).filter((row) => row.status === 'eligible');
    const correction = policy.ineligibleUpstream[modelId];
    if (correction) {
      if (explicit)
        throw Error('Upstream source-currency correction blocks automatic replacement: ' + modelId);
      for (const row of current) {
        if (row.status === 'eligible') {
          row.status = 'excluded';
          row.reason = 'source-currency-correction-requires-explicit-official-quote';
        }
      }
      continue;
    }
    if (!explicit && eligible.length > 1)
      throw Error(
        'Ambiguous upstream price identity for ' +
          modelId +
          ': ' +
          eligible.map((row) => row.upstreamPrice.quoteId).join(', '),
      );
    const winner = explicit
      ? eligible.find((row) => row.upstreamPrice.quoteId === explicit)
      : eligible.length === 1
        ? eligible[0]
        : undefined;
    if (explicit && !winner)
      throw Error('Explicit upstream price is no longer eligible: ' + modelId);
    if (
      event?.state === 'restored' &&
      (winner?.upstreamPrice.source.url !== event.evidence.url ||
        winner?.upstreamPrice.source.sha256 !== event.evidence.sha256)
    )
      throw Error('Restored quote needs matching new official evidence: ' + modelId);
    if (winner) put(modelId, winner.upstreamPrice, winner);
    for (const row of current) {
      if (row.upstreamPrice?.status !== 'eligible' || row === winner) continue;
      row.reason =
        !explicit && !pool.includes(row)
          ? 'domestic-price-identity-preferred'
          : 'another-price-identity-selected';
      row.status = 'not-selected';
    }
  }
  for (const key of Object.keys(policy.upstreamSelection))
    if (!groups.has(key)) throw Error('Explicit upstream price is missing: ' + key);
  return selected;

  function put(key, price, row) {
    price.selected = true;
    price.syncable = true;
    selected[key] = price;
    row.status = 'selected';
    row.reason = null;
    row.selectedQuoteId = price.quoteId;
    row.syncable = true;
  }
}

function checkSelectionContinuity(previous, selected, records, selection, policy, lifecycle) {
  if (!previous) return;
  const formerModels = new Map(
    previous.coverage.models.filter(({ syncable }) => syncable).map((row) => [row.nativeKey, row]),
  );
  const formerQuotes = new Map(previous.coverage.quotes.map((row) => [row.quoteId, row]));
  const identityFields = [
    'providerId',
    'sourceProviderId',
    'modelId',
    'endpoint',
    'priceList',
    'sourceCurrency',
    'outputKind',
  ];
  for (const [key, quoteId] of entries(previous.selected)) {
    const formerUpstream = formerModels.get(key)?.upstreamPrice;
    const former = formerUpstream?.syncable ? formerUpstream : formerQuotes.get(quoteId);
    if (former?.quoteId !== quoteId) throw Error('Missing previous selected identity: ' + key);
    const current = selected[key];
    if (!current) {
      if (policy.notOfferedModels?.includes(key) || lifecycle.state.get(key)?.state === 'withdrawn')
        continue;
      const row = records.get(providerModel(former.providerId, former.modelId))?.upstreamPrice;
      if (former === formerUpstream && row && row.endpoint === former.endpoint) {
        const capability = policy.nativeCapabilityExclusions?.[key];
        const correction = policy.ineligibleUpstream[key];
        if (
          row.quoteId === quoteId &&
          (row.status === 'deferred' ||
            (row.status === 'unsupported' && capability?.providerId === former.providerId))
        )
          continue;
        if (row.status === 'excluded' && correction?.providerId === former.providerId) continue;
      }
      throw Error('Selected price removed without withdrawal or replacement: ' + key);
    }
    if (current.quoteId === quoteId) {
      if (identityFields.some((field) => former[field] !== current[field]))
        throw Error('Selected price identity changed under the same quote ID: ' + key);
    } else if (
      selection[key] !== current.quoteId &&
      policy.upstreamSelection[key] !== current.quoteId
    ) {
      throw Error('Selected price identity changed without explicit replacement: ' + key);
    }
  }
}

function catalogFiles(files, snapshots, records, quotes, selected) {
  for (const locale of locales) {
    const providers = Object.assign(Object.create(null), structuredClone(snapshots[locale]));
    for (const row of records.values()) {
      const { providerId, modelId, status, reason, upstreamPrice, quoteIds } = row;
      if (
        !providers[providerId] &&
        row.origin === 'official-addition' &&
        !Object.hasOwn(snapshots.en, providerId)
      ) {
        providers[providerId] = { id: providerId, name: providerId, models: Object.create(null) };
      }
      const provider = providers[providerId];
      if (!provider) throw Error('Missing localized provider: ' + locale + '/' + providerId);
      const existing = provider.models[modelId];
      if (row.origin === 'upstream' && !existing)
        throw Error('Missing localized upstream model: ' + locale + '/' + modelId);
      const winner = selected[modelId]?.providerId === providerId ? selected[modelId] : null;
      const displayPrice = winner ?? upstreamPrice;
      const model = existing ?? { id: modelId, name: modelId };
      if (status === 'not-offered' || status === 'deprecated') {
        delete model.cost;
        delete model.sourceCost;
        model.cnyPrice = {
          status,
          reason,
          exported: false,
          outputKind: 'model',
          ...(status === 'deprecated' && { lifecycle: row.lifecycle }),
        };
        provider.models[modelId] = model;
        continue;
      }
      model.sourceCost = model.cost;
      model.cost = {
        ...(displayPrice?.cnyCost ?? {}),
        currency: 'CNY',
        ...(winner ? { publication_expr: winner.billing_expr, publication_unit: winner.unit } : {}),
      };
      model.cnyPrice = {
        status: winner ? 'eligible' : status,
        reason,
        sourceCurrency: displayPrice?.sourceCurrency ?? null,
        exported: Boolean(winner),
        expr: winner?.billing_expr,
        outputKind: winner?.outputKind ?? (status === 'validation-held' ? 'task-model' : 'model'),
        selectedQuoteId: winner?.quoteId ?? null,
        quotes: [
          ...quoteIds.map((quoteId) => quotes.get(quoteId)),
          ...(upstreamPrice
            ? [
                {
                  ...upstreamPrice,
                  reason: upstreamPrice.syncable
                    ? null
                    : winner
                      ? 'explicit-official-price-selected'
                      : reason,
                },
              ]
            : []),
        ],
      };
      provider.models[modelId] = model;
    }
    const prefix = 'api/' + (locale === 'en' ? '' : 'i18n/' + locale + '/');
    files[prefix + 'all.json'] = json(providers);
    files[prefix + 'providers.json'] = json({
      providers: Object.values(providers).map(({ models, ...provider }) => ({
        ...provider,
        modelCount: Object.keys(models).length,
      })),
    });
    files[prefix + 'index.json'] = json({
      models: Object.values(providers).flatMap((provider) =>
        Object.values(provider.models).map((model) => ({
          id: model.id,
          name: model.name ?? model.id,
          providerId: provider.id,
        })),
      ),
    });
    for (const [id, provider] of entries(providers))
      files[prefix + 'providers/' + id + '.json'] = json(provider);
  }
}

function quoteTerms(quote) {
  if (!quote) return undefined;
  return {
    sourcePrice: quote.sourcePrice,
    sourceCurrency: quote.sourceCurrency,
    sourceUnit: quote.originalQuote?.unit ?? quote.sourceUnit,
    sourceUrl: quote.source?.url,
    conditions: quote.originalQuote?.conditions ?? quote.conditions,
    description: quote.originalQuote?.description,
    cnyPrice: quote.cnyTaskTiers ?? quote.cnyCost,
  };
}

function priceDiff(prior, selected, models, policy, lifecycle, previousCandidate) {
  const baseline = previousCandidate
    ? { candidateId: previousCandidate.candidateId }
    : {
        releaseId: prior.releaseId,
        manifestSha256: prior.manifestSha256,
        ratioConfigSha256: sha(prior.files['ratio_config.json']),
      };
  const { billing_expr: previous } = (
    previousCandidate?.config ?? JSON.parse(prior.files['ratio_config.json'])
  ).data;
  const formerRows = new Map(
    (previousCandidate?.coverage.models ?? [])
      .filter(({ syncable }) => syncable)
      .map((row) => [row.nativeKey, row]),
  );
  const formerQuotes = new Map(
    (previousCandidate?.coverage.quotes ?? []).map((quote) => [quote.quoteId, quote]),
  );
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(selected)])].sort();
  const changes = [];
  const byKey = groupBy(models, (row) => row.nativeKey);
  for (const key of keys) {
    const before = previous[key];
    const after = selected[key];
    const former = previousCandidate ? formerRows.get(key) : prior.datasets.en.selected[key];
    const underlying = byKey.get(key) ?? [];
    const changedIdentity =
      after &&
      former &&
      after.quoteId !==
        (previousCandidate
          ? previousCandidate.selected[key]
          : underlying.find((row) => row.providerId === former.providerId)?.upstreamPrice?.quoteId);
    const formerQuoteId = previousCandidate?.selected[key];
    const formerQuote = formerQuotes.get(formerQuoteId) ?? former?.upstreamPrice;
    const beforeTerms = quoteTerms(formerQuote);
    const afterTerms = quoteTerms(after);
    const changedTerms =
      beforeTerms && afterTerms && canonical(beforeTerms) !== canonical(afterTerms);
    if (before === after?.billing_expr && !changedIdentity && !changedTerms) continue;
    const correction = policy.ineligibleUpstream[key];
    const event = lifecycle.state.get(key);
    const capability = policy.nativeCapabilityExclusions?.[key];
    const priorRow = underlying.find((row) => row.providerId === former?.providerId);
    const notOffered = policy.notOfferedModels?.includes(key);
    const reason = notOffered
      ? 'naoshengyun-service-scope'
      : event?.state === 'withdrawn'
        ? (event.reason ?? 'formal-withdrawal')
        : correction && former?.providerId === correction.providerId
          ? 'source-currency-correction'
          : capability && former?.providerId === capability.providerId
            ? 'native-capability-exclusion'
            : after
              ? 'candidate-selection'
              : (priorRow?.reason ?? 'no-eligible-price-identity');
    changes.push({
      nativeKey: key,
      type: before && after ? 'changed' : before ? 'removed' : 'added',
      reason,
      evidence: notOffered
        ? { url: policy.sources.notOffered }
        : correction
          ? { url: correction.source, detail: correction.reason }
          : (event?.evidence ??
            (capability && { ...capability.source, detail: capability.reason }) ??
            (priorRow?.status === 'deferred' ? { url: policy.sources.deferred } : undefined)),
      before: before
        ? {
            quoteId: formerQuoteId,
            providerId: former.providerId,
            billing_mode: 'tiered_expr',
            billing_expr: before,
            ...beforeTerms,
          }
        : null,
      after: after
        ? {
            quoteId: after.quoteId,
            providerId: after.providerId,
            billing_mode: 'tiered_expr',
            billing_expr: after.billing_expr,
            ...afterTerms,
          }
        : null,
    });
  }
  return {
    baseline,
    changes,
  };
}

function buildCandidate({
  source,
  snapshots: upstreamSnapshots,
  inputs,
  official,
  selection,
  policy,
  sourceSha,
  codeSha256,
  legacy,
  prior,
  previous,
}) {
  validateServiceScope(policy, selection);
  const lifecycle = lifecycleState(policy, selection, legacy.selection, previous);
  const excludedProviderIds = new Set(policy.outOfScopeProviders);
  for (const providers of Object.values(upstreamSnapshots))
    for (const [id, provider] of Object.entries(providers))
      if (provider.subscription) excludedProviderIds.add(id);
  const snapshots = Object.fromEntries(
    locales.map((locale) => [
      locale,
      Object.fromEntries(
        Object.entries(upstreamSnapshots[locale]).filter(([id]) => !excludedProviderIds.has(id)),
      ),
    ]),
  );
  const officialRecords = official.records.filter(
    ({ provider }) =>
      !excludedProviderIds.has(provider) &&
      !excludedProviderIds.has(policy.providerAliases[provider]),
  );
  const records = upstreamRows(snapshots.en, policy, source);
  const quotes = officialRows(officialRecords, selection, policy, records, snapshots.en, lifecycle, [
    ...legacy.quotes.records,
    ...(previous?.coverage.quotes ?? []).flatMap(({ originalQuote }) =>
      originalQuote ? [originalQuote] : [],
    ),
  ]);
  addSeedanceReference(official, policy, selection, records, quotes);
  const selected = selectPrices(records, quotes, selection, policy, lifecycle);
  checkSelectionContinuity(previous, selected, records, selection, policy, lifecycle);
  const billing_mode = Object.fromEntries(entries(selected).map(([key]) => [key, 'tiered_expr']));
  const billing_expr = Object.fromEntries(
    entries(selected).map(([key, row]) => [key, row.billing_expr]),
  );
  const models = [...records.values()].map((row) => ({
    endpoint: snapshots.en[row.providerId]?.api ?? null,
    ...row,
    nativeKey: row.modelId,
    outputKind:
      selected[row.modelId]?.providerId === row.providerId
        ? selected[row.modelId].outputKind
        : row.status === 'validation-held'
          ? 'task-model'
          : 'model',
    selected: Boolean(row.syncable),
    syncable: Boolean(row.syncable),
  }));
  const coverage = {
    models,
    quotes: [...quotes.values()],
    toolReferences: official.optionalToolFees ?? [],
    excludedProviderIds: [...excludedProviderIds].sort(),
  };
  const files = {
    'api/newapi/ratio_config.json': json({
      success: true,
      message: '',
      data: { billing_mode, billing_expr },
    }),
    'coverage.json': json(coverage),
    'api/cny-tools.json': json({
      official: coverage.quotes.filter((quote) => quote.outputKind === 'tool-reference'),
      optional: coverage.toolReferences,
    }),
    'price-diff.json': json(priceDiff(prior, selected, models, policy, lifecycle, previous)),
    'policy.json': json(policy),
    'official-selection.json': json(selection),
    'selection.json': json(
      Object.fromEntries(entries(selected).map(([key, row]) => [key, row.quoteId])),
    ),
  };
  catalogFiles(files, snapshots, records, quotes, selected);
  const providerIds = new Set([
    ...Object.keys(snapshots.en),
    ...models.map(({ providerId }) => providerId),
  ]);
  const base = {
    schemaVersion: 1,
    sourceSha,
    codeSha256,
    upstreamSha: source.upstreamSha,
    inputs,
    policy: { ...CNY_POLICY, domesticFallback: false, asOf: policy.asOf },
    stats: {
      providers: providerIds.size,
      models: models.length,
      subscriptions: 0,
      apiModels: Object.keys(billing_expr).length,
      officialQuotes: officialRecords.length,
      statuses: Object.fromEntries(
        [...groupBy(models, (row) => row.status)].map(([status, rows]) => [status, rows.length]),
      ),
    },
    files: Object.fromEntries(
      entries(files).map(([name, body]) => [
        name,
        { sha256: sha(body), bytes: Buffer.byteLength(body) },
      ]),
    ),
  };
  const manifest = { ...base, candidateId: hash(base) };
  files['manifest.json'] = json(manifest);
  return { files, manifest };
}

function codeIdentity() {
  const files = [
    ...['scripts', 'src', 'web/src', '.cache/cny-build'].flatMap((dir) =>
      readdirSync(join(root, dir), { recursive: true })
        .filter((name) => /\.(?:[cm]?js|tsx?|css)$/.test(name))
        .map((name) => join(dir, name)),
    ),
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'web/index.html',
    'web/package.json',
    'web/package-lock.json',
    'web/tsconfig.json',
    'web/vite.config.ts',
  ].sort();
  return hash(Object.fromEntries(files.map((name) => [name, sha(readFileSync(join(root, name)))])));
}

const [
  output,
  policyPath = 'data/cny/unified-policy.json',
  officialPath = 'data/cny/official-catalog.json',
  selectionPath = 'data/cny/proposed-selection.json',
  upstreamPath,
  previousPath,
] = process.argv.slice(2);
if (!output)
  throw Error(
    'Usage: build-unified-cny.mjs <exclusive-output> [policy [official-catalog [selection [upstream-directory [previous-candidate]]]]]',
  );
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const candidate = buildCandidate({
  ...readInputs(policyPath, officialPath, selectionPath, upstreamPath, previousPath),
  sourceSha,
  codeSha256: codeIdentity(),
});
mkdirSync(output);
for (const [name, body] of entries(candidate.files)) {
  const file = join(output, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body, { flag: 'wx' });
}
console.log(json(candidate.manifest));
