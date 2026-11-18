/** Test the final site price bytes against a fresh, isolated original New API rc.50. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { constants, publicEncrypt, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { sha } from './upstream-cny.mjs';

const [sitePath, evidenceDir] = process.argv.slice(2);
assert.ok(sitePath && evidenceDir, 'Pass the final site and an exclusive evidence directory');
const root = resolve(sitePath);
const read = (name) => JSON.parse(readFileSync(join(root, name)));
const current = read('current.json');
assert.equal(current.schemaVersion, 3);
const manifestBytes = readFileSync(join(root, current.fixedBase, 'manifest.json'));
assert.equal(sha(manifestBytes), current.manifestSha256);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.candidateId, current.releaseId);
const ratio = '/api/newapi/ratio_config.json';
const bytes = readFileSync(join(root, ratio));
assert.equal(sha(bytes), current.modelSourceSha256);
assert.ok(bytes.equals(readFileSync(join(root, current.modelSource))));
const {
  data: { billing_mode, billing_expr },
} = JSON.parse(bytes);
const names = Object.keys(billing_expr);
assert.deepEqual(Object.keys(billing_mode), names);
assert.equal(names.length, manifest.stats.apiModels);
const coverage = read(current.fixedBase + 'coverage.json');
const tasks = coverage.quotes.filter((row) => row.outputKind === 'task-model' && row.syncable);
assert.equal(tasks.length, 9);
assert.ok(!Object.hasOwn(billing_expr, 'doubao-seedance-2-5-260628'));
for (const quote of coverage.quotes.filter((row) => row.outputKind === 'tool-reference'))
  assert.ok(!Object.hasOwn(billing_expr, quote.modelId));

mkdirSync(evidenceDir);
const save = (name, data) =>
  writeFileSync(join(evidenceDir, name), JSON.stringify(data, null, 2) + '\n');
const image =
  'calciumion/new-api@sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9';
const revision = 'f2aa91232ed3e5878a614762ace6736a2b74257f';
const name = 'cny-unified-check-' + randomBytes(6).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    env: { ...process.env, SESSION_SECRET: secret },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const secret = randomBytes(32).toString('hex');
assert.equal(
  JSON.parse(docker('image', 'inspect', image))[0].Config.Labels[
    'org.opencontainers.image.revision'
  ],
  revision,
);
const served = [];
const server = createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== ratio) {
    res.writeHead(404).end();
    return;
  }
  served.push({ method: req.method, path: req.url, sha256: sha(bytes) });
  res.writeHead(200, { 'content-type': 'application/json' }).end(bytes);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const report = {
  sourceSha: manifest.sourceSha,
  codeSha256: manifest.codeSha256,
  candidateId: manifest.candidateId,
  manifestSha256: current.manifestSha256,
  ratioSha256: sha(bytes),
  image,
  revision,
  sourceHTTP: served,
  modelCount: names.length,
  pluginChecks: [],
  supplierCalls: 0,
};
let created = false;
try {
  const containerId = docker(
    'run',
    '--detach',
    '--pull=never',
    '--name',
    name,
    '--publish',
    '127.0.0.1::3000',
    '--tmpfs',
    '/data:rw',
    '--env',
    'SQLITE_PATH=/data/new-api.db',
    '--env',
    'SESSION_SECRET',
    image,
  );
  created = true;
  const inspect = JSON.parse(docker('inspect', name))[0];
  assert.deepEqual(inspect.HostConfig.Tmpfs, { '/data': 'rw' });
  assert.ok(!inspect.HostConfig.Binds?.length);
  report.containerId = containerId;
  const origin = 'http://127.0.0.1:' + docker('port', name, '3000/tcp').split(':').at(-1);
  let token;
  async function request(path, method = 'GET', body, expectedStatus = 200) {
    const response = await fetch(origin + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const envelope = await response.json();
    assert.equal(response.status, expectedStatus, `${method} ${path}: ${envelope.message}`);
    assert.equal(
      envelope.success,
      expectedStatus === 200,
      `${method} ${path}: ${envelope.message}`,
    );
    return envelope.data;
  }
  for (let i = 0; i < 80; i++) {
    try {
      await request('/api/setup');
      break;
    } catch {
      await delay(250);
    }
  }
  assert.equal((await request('/api/setup')).status, false);
  const username = 'cnyunified';
  const password = 'Cny!' + randomBytes(18).toString('hex');
  await request('/api/setup', 'POST', {
    username,
    password,
    confirmPassword: password,
    SelfUseModeEnabled: false,
    DemoSiteEnabled: false,
  });
  const key = await request('/api/user/login/encryption-key');
  const credentials = key.enabled
    ? {
        username,
        password_encrypted: publicEncrypt(
          { key: key.public_key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
          Buffer.from(password),
        ).toString('base64'),
        encryption_key_id: key.kid,
      }
    : { username, password };
  token = (await request('/api/user/login', 'POST', credentials)).access_token;
  const self = await request('/api/user/self');
  assert.equal(self.username, username);
  assert.equal(self.role, 100);
  report.version = (await request('/api/status')).version;
  assert.match(report.version, /rc[.-]?50/);
  assert.equal((await request('/api/channel/?p=1&page_size=1')).total, 0);

  const pricingPath = '/api/option/model_pricing';
  const entry = async (model) =>
    (await request(pricingPath + '?model=' + encodeURIComponent(model))).entries[0];
  const fields = {
    mode: 'billing_setting.billing_mode',
    expr: 'billing_setting.billing_expr',
    plugin: 'billing_setting.plugin_billing_expr',
  };
  const modelPricing = (model) => ({
    [fields.mode]: billing_mode[model],
    [fields.expr]: billing_expr[model],
  });
  const patch = (changes, status) => request(pricingPath, 'PATCH', { changes }, status);
  const makeChange = (model_name, expected_version, pricing) => ({
    model_name,
    expected_version,
    pricing,
  });
  const preview = (model_name, pricing) =>
    request(pricingPath + '/preview', 'POST', { model_name, pricing });
  const getAll = () => request(pricingPath);
  const baseline = await getAll();
  const optionsBefore = await request('/api/option/');
  const pluginOptions = await request('/api/task_plugin_options');
  save('baseline.json', baseline);
  save('plugin-options.json', pluginOptions);

  const override = 'tier("isolated_override", 0)';
  const baselineOverrides = new Map();
  for (const task of tasks) {
    const model = task.modelId;
    const configured = { [fields.plugin]: { [task.usagePlugin]: override } };
    const before = await entry(model);
    await preview(model, configured);
    await patch([makeChange(model, before.version, configured)]);
    const seeded = await entry(model);
    assert.equal(
      seeded.plugin_variants.find((v) => v.plugin_key === task.usagePlugin).effective,
      override,
    );
    baselineOverrides.set(model, configured);
  }

  const sync = await request('/api/ratio_sync/fetch', 'POST', {
    upstreams: [
      {
        name: 'unified',
        base_url: 'http://host.docker.internal:' + server.address().port,
        endpoint: ratio,
      },
    ],
    include_unchanged: true,
    timeout: 10,
  });
  assert.ok(served.length > 0);
  const fetched = Object.fromEntries(
    Object.entries(sync.prices).flatMap(([model, row]) =>
      row.upstreams?.unified ? [[model, row.upstreams.unified]] : [],
    ),
  );
  assert.deepEqual(Object.keys(fetched).sort(), [...names].sort());
  for (const model of names)
    assert.deepEqual(
      fetched[model],
      { billing_mode: billing_mode[model], billing_expr: billing_expr[model] },
      model,
    );
  save('native-http-sync.json', fetched);
  const preSync = await getAll();
  const byName = new Map(preSync.entries.map((e) => [e.model_name, e]));
  const changes = [];
  const previews = {};
  for (const model of names) {
    const current = byName.get(model);
    const imported = {
      [fields.mode]: fetched[model].billing_mode,
      [fields.expr]: fetched[model].billing_expr,
    };
    const pricing = { ...current?.configured, ...imported };
    const result = await preview(model, pricing);
    for (const [field, value] of Object.entries(imported))
      assert.equal(result.effective[field], value, model);
    previews[model] = result;
    changes.push(makeChange(model, current?.version ?? preSync.empty_version, pricing));
  }
  save('native-previews.json', previews);
  // The planned source selection is exactly the HTTP key set. No full-table write.
  for (let start = 0; start < changes.length; start += 25)
    await patch(changes.slice(start, start + 25));
  const afterSync = await getAll();
  const persisted = new Map(afterSync.entries.map((e) => [e.model_name, e]));
  for (const model of names)
    assert.deepEqual(
      persisted.get(model).configured,
      { ...byName.get(model)?.configured, ...modelPricing(model) },
      model,
    );
  for (const old of preSync.entries.filter((e) => !Object.hasOwn(billing_expr, e.model_name)))
    assert.deepEqual(persisted.get(old.model_name), old, old.model_name);
  save('native-readback.json', afterSync);
  const stale = changes.find(
    ({ expected_version, model_name }) => expected_version !== persisted.get(model_name).version,
  );
  assert.ok(stale);
  await patch([stale], 409);
  assert.deepEqual(await getAll(), afterSync);
  report.staleVersionHTTP = 409;

  for (const task of tasks) {
    const model = task.modelId;
    const expression = billing_expr[model];
    const withOverride = persisted.get(model);
    const plugin = task.usagePlugin;
    const findVariant = (entry) => entry.plugin_variants.find((item) => item.plugin_key === plugin);
    const variant = findVariant(withOverride);
    assert.ok(
      pluginOptions.find((option) => option.key === plugin && option.models.includes(model)),
    );
    assert.equal(variant.configured, override);
    assert.equal(variant.effective, override);
    assert.deepEqual(
      withOverride.configured[fields.plugin],
      baselineOverrides.get(model)[fields.plugin],
    );
    const tiers = task.cnyTaskTiers;
    assert.ok(tiers?.length);
    assert.deepEqual(
      tiers,
      task.sourcePrice.map((tier) => ({
        ...tier,
        charges: tier.charges.map((charge) => ({
          ...charge,
          amount: charge.amount * (charge.currency === 'USD' ? 7 : 1),
          currency: 'CNY',
        })),
      })),
    );
    for (const tier of tiers) {
      assert.ok(expression.includes(`tier(${JSON.stringify(tier.name)}, `), model);
      for (const [key, value] of Object.entries(tier.when ?? {})) {
        const term = `u(${JSON.stringify(key)})`;
        assert.ok(
          expression.includes(
            typeof value === 'boolean'
              ? value
                ? term
                : '!' + term
              : term + ' == ' + JSON.stringify(value),
          ),
          model,
        );
        if (typeof value === 'string')
          assert.ok(variant.usage_schema[key].enum.includes(value), model);
        else assert.equal(variant.usage_schema[key].type, 'boolean', model);
      }
      const included = new Set(tier.charges.map((c) => c.usageKey));
      for (const [key, shape] of Object.entries(variant.usage_schema))
        if (shape.type === 'number')
          assert.ok(included.has(key) || tier.notApplicable?.[key], model + ' ' + key);
      for (const { usageKey, unit, amount } of tier.charges) {
        const schema = variant.usage_schema[usageKey];
        assert.equal(schema.type, 'number');
        assert.equal(
          unit,
          schema.unit === 'token' ? 'per_million_tokens' : 'per_' + schema.unit,
          model,
        );
        assert.ok(
          expression.includes(
            `u(${JSON.stringify(usageKey)}) * ${amount}${schema.unit === 'token' ? ' / 1000000' : ''}`,
          ),
          model,
        );
      }
    }
    const remove = { ...modelPricing(model), [fields.plugin]: {} };
    await preview(model, remove);
    await patch([makeChange(model, withOverride.version, remove)]);
    const removed = await entry(model);
    assert.equal(findVariant(removed).effective, expression);
    assert.ok(!findVariant(removed).configured);
    assert.equal(findVariant(removed).compatible, true);
    // An ordinary model sync with no existing override uses exactly the same base expression.
    await patch([makeChange(model, removed.version, modelPricing(model))]);
    const inherited = await entry(model);
    assert.equal(findVariant(inherited).effective, expression);
    assert.ok(!findVariant(inherited).configured);
    assert.equal(findVariant(inherited).compatible, true);
    report.pluginChecks.push({ model, tiers, withOverride, removed, inherited });
  }
  const final = await getAll();
  const byFinal = new Map(final.entries.map((e) => [e.model_name, e]));
  for (const model of names) {
    assert.equal(byFinal.get(model).configured[fields.mode], billing_mode[model]);
    assert.equal(byFinal.get(model).configured[fields.expr], billing_expr[model]);
  }
  save('native-final.json', final);
  assert.equal((await request('/api/channel/?p=1&page_size=1')).total, 0);
  const ordinaryOptions = (list) =>
    list
      .filter(({ key }) => !Object.values(fields).includes(key))
      .sort((a, b) => a.key.localeCompare(b.key));
  assert.deepEqual(ordinaryOptions(await request('/api/option/')), ordinaryOptions(optionsBefore));
  report.passed = true;
} catch (error) {
  report.failed = error.message;
  throw error;
} finally {
  try {
    if (created) docker('rm', '--force', name);
    report.isolatedContainerRemoved = created;
  } finally {
    server.close();
    save('native-report.json', report);
  }
}
console.log(
  JSON.stringify(
    { ...report, pluginChecks: report.pluginChecks.map(({ model }) => model) },
    null,
    2,
  ),
);
