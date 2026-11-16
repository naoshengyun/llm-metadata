/** I seam: disposable official rc50, localhost only, no provider requests. Run after npm run test:cny. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes, publicEncrypt, constants } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { generateCny } from '../.cache/cny-build/cny/generate.js';
import { buildArtifact } from '../.cache/cny-build/cny/artifact.js';
import {
  NativePricingAdapter,
  previewArtifact,
  applyArtifact,
} from '../.cache/cny-build/cny/apply.js';

const image =
  'calciumion/new-api@sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9';
const baseline = 'f2aa91232ed3e5878a614762ace6736a2b74257f';
const name = `cny-i-${randomBytes(6).toString('hex')}`;
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const metadata = JSON.parse(docker('image', 'inspect', image))[0];
assert.equal(metadata.Config.Labels['org.opencontainers.image.revision'], baseline);
assert.equal(metadata.Config.Labels['org.opencontainers.image.version'], 'v1.0.0-rc.50');
console.log(
  JSON.stringify({
    test: 'I',
    image,
    baseline,
    imageVersion: metadata.Config.Labels['org.opencontainers.image.version'],
  }),
);
let created = false;
try {
  docker(
    'run',
    '--detach',
    '--name',
    name,
    '--publish',
    '127.0.0.1::3000',
    '--tmpfs',
    '/data:rw',
    '--env',
    'SQLITE_PATH=/data/new-api.db',
    '--env',
    `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
    image,
  );
  created = true;
  const port = docker('port', name, '3000/tcp').split(':').at(-1);
  const origin = `http://127.0.0.1:${port}`;
  let token;
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(origin + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope = await response.json();
    assert.equal(envelope.success, true, `${method} ${path}: ${envelope.message}`);
    return envelope.data;
  };
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      await request('/api/setup');
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  assert.ok(ready, 'temporary rc50 did not start');
  const setup = await request('/api/setup');
  assert.equal(setup.status, false);
  assert.equal(setup.root_init, false);
  const password = `Cny!${randomBytes(18).toString('hex')}`;
  await request('/api/setup', 'POST', {
    username: 'cnytest',
    password,
    confirmPassword: password,
    SelfUseModeEnabled: false,
    DemoSiteEnabled: false,
  });
  const key = await request('/api/user/login/encryption-key');
  const login = key.enabled
    ? {
        username: 'cnytest',
        password_encrypted: publicEncrypt(
          { key: key.public_key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
          Buffer.from(password),
        ).toString('base64'),
        encryption_key_id: key.kid,
      }
    : { username: 'cnytest', password };
  const auth = await request('/api/user/login', 'POST', login);
  token = auth.access_token;
  assert.ok(token);
  const authenticatedFetch = async (url, init = {}) => {
    assert.equal(new URL(url).origin, origin, 'only the temporary localhost origin is allowed');
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };
  const adapter = new NativePricingAdapter(origin, authenticatedFetch);
  await request('/api/option/', 'PUT', { key: 'USDExchangeRate', value: '1' });
  await request('/api/option/', 'PUT', { key: 'QuotaPerUnit', value: '500000' });
  await request('/api/option/', 'PUT', { key: 'GroupRatio', value: '{"default":0.8}' });
  await request('/api/option/', 'PUT', {
    key: 'tool_price_setting.prices',
    value: '{"file_search":2.5,"web_search":10}',
  });
  const emptyPricing = await request('/api/option/model_pricing');
  await request('/api/option/model_pricing', 'PATCH', {
    changes: [
      {
        model_name: 'cny-I-text',
        expected_version: emptyPricing.empty_version,
        pricing: { ModelRatio: 2, CacheRatio: 0.5 },
      },
    ],
  });
  const beforeOptions = await request('/api/option/');
  const groupBefore = beforeOptions.find((o) => o.key === 'GroupRatio').value;
  const plugins = await request('/api/task_plugin_options');
  const hasAlibaba = plugins.some((p) => p.key === 'alibaba' && p.models.includes('wan2.7-image'));
  const videoModel = 'doubao-seedance-2-0-fast-260128';
  const hasDoubao = plugins.some((p) => p.key === 'doubao' && p.models.includes(videoModel));
  const quote = (id, model, cost, extra = {}) => ({
    id,
    provider: 'synthetic-official-fixture',
    model,
    priceList: 'standard',
    origin: 'foreign',
    currency: 'USD',
    source: { url: 'https://example.org/synthetic-I-fixture', checkedAt: '2026-11-16' },
    required: ['input', 'output'],
    cost,
    ...extra,
  });
  const records = [
    quote('text', 'cny-I-text', { input: 3, output: 15 }),
    quote('image', 'cny-I-image', { per_image: 0.1 }, { required: ['per_image'] }),
    quote(
      'tool',
      'web_search',
      {},
      {
        kind: 'tool',
        required: [],
        tools: [{ key: 'web_search', amount: 10, unit: 'per_thousand_calls', currency: 'USD' }],
      },
    ),
  ];
  records.push(
    quote(
      'modal',
      'cny-I-modal',
      {
        input: 20,
        output: 100,
        input_image: 30,
        output_image: 120,
        cache_read_image: 3,
        cache_read: 2,
        cache_write: 5,
        cache_write_1h: 10,
        tiers: [
          {
            tier: { size: 32000, type: 'input' },
            input: 40,
            output: 200,
            input_image: 60,
            output_image: 240,
            cache_read_image: 6,
            cache_read: 4,
            cache_write: 10,
            cache_write_1h: 20,
          },
        ],
      },
      {
        currency: 'CNY',
        origin: 'domestic',
        required: [
          'input',
          'output',
          'input_image',
          'output_image',
          'cache_read_image',
          'cache_read',
          'cache_write',
          'cache_write_1h',
        ],
      },
    ),
  );
  const selection = { 'cny-I-text': 'text', 'cny-I-image': 'image', web_search: 'tool' };
  selection['cny-I-modal'] = 'modal';
  if (hasAlibaba) {
    records.push(
      quote(
        'task',
        'wan2.7-image',
        {},
        {
          kind: 'task',
          currency: 'CNY',
          origin: 'domestic',
          required: [],
          task: {
            plugin: 'alibaba',
            model: 'wan2.7-image',
            tiers: [
              {
                name: 'standard',
                charges: [
                  { usageKey: 'image_count', amount: 0.2, unit: 'per_count', currency: 'CNY' },
                ],
              },
            ],
          },
        },
      ),
    );
    selection['wan2.7-image'] = 'task';
  }
  if (hasDoubao) {
    records.push(
      quote(
        'video',
        videoModel,
        {},
        {
          kind: 'task',
          required: [],
          task: {
            plugin: 'doubao',
            model: videoModel,
            tiers: [
              {
                name: 'standard',
                charges: [
                  { usageKey: 'tokens', amount: 3, unit: 'per_million_tokens', currency: 'USD' },
                ],
              },
            ],
          },
        },
      ),
    );
    selection[videoModel] = 'video';
  }
  const result = generateCny({ upstream: {}, records, selection });
  if (hasDoubao)
    assert.equal(result.plugins[videoModel].doubao, 'tier("standard", u("tokens") * 21 / 1000000)');
  assert.deepEqual(result.exclusions, [], 'all synthetic fixture records must compile');
  const artifact = buildArtifact({
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    data: {},
    quotes: records,
    selection,
    models: result.models,
    plugins: result.plugins,
    tools: result.tools,
    exclusions: result.exclusions,
  });
  const selected = {
    models: Object.keys(artifact.models),
    plugins: Object.fromEntries(
      Object.entries(artifact.plugins).map(([model, variants]) => [model, Object.keys(variants)]),
    ),
    tools: Object.keys(artifact.tools),
  };
  const plan = await previewArtifact(adapter, artifact, selected);
  const confirm = (p) => ({
    confirmed: true,
    actor: 'isolated-I-fixture',
    target: p.target,
    artifactId: artifact.id,
    planId: p.id,
  });
  const receipt = await applyArtifact(adapter, artifact, plan, confirm(plan));
  assert.equal(receipt.success, true, JSON.stringify(receipt));
  const after = await request('/api/option/model_pricing');
  const text = after.entries.find((e) => e.model_name === 'cny-I-text');
  assert.equal(
    text.configured['billing_setting.billing_expr'],
    'tier("standard", p * 21 + c * 105)',
  );
  assert.equal(text.configured.ModelRatio, 2);
  assert.equal(text.configured.CacheRatio, 0.5);
  if (hasDoubao)
    assert.equal(
      after.entries.find((e) => e.model_name === videoModel).configured[
        'billing_setting.plugin_billing_expr'
      ].doubao,
      'tier("standard", u("tokens") * 21 / 1000000)',
    );
  const toolOptions = await request('/api/option/');
  const tools = JSON.parse(toolOptions.find((o) => o.key === 'tool_price_setting.prices').value);
  assert.deepEqual(tools, { file_search: 2.5, web_search: 70 });
  assert.equal(toolOptions.find((o) => o.key === 'GroupRatio').value, groupBefore);
  console.log(
    JSON.stringify({
      test: 'I-native-save-readback',
      artifactId: artifact.id,
      receipt,
      groupPreserved: true,
      toolsPreserved: true,
      videoPlugin: hasDoubao
        ? 'doubao video Token /1M saved/read back'
        : 'unsupported: factory video plugin unavailable; video I not run',
      plugin: hasAlibaba
        ? 'alibaba/wan2.7-image saved/read back'
        : 'not available; plugin I not run',
    }),
  );
  const conflictPlan = await previewArtifact(adapter, artifact, {
    models: ['cny-I-text'],
    plugins: {},
    tools: [],
  });
  await request('/api/option/model_pricing', 'PATCH', {
    changes: [
      {
        model_name: 'cny-I-text',
        expected_version: text.version,
        pricing: { ...text.configured, 'billing_setting.billing_expr': 'p * 22 + c * 105' },
      },
    ],
  });
  const conflict = await applyArtifact(adapter, artifact, conflictPlan, confirm(conflictPlan));
  assert.equal(conflict.success, false);
  assert.equal(conflict.items[0].status, 'conflict');
  console.log(JSON.stringify({ test: 'I-expected-version-conflict', receipt: conflict }));
  // Optional fixed real-price candidate. Still runs only in this disposable origin.
  if (process.argv[2]) {
    const official = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(
      official.sourceSha,
      sourceSha,
      'candidate must bind the checked-out source commit',
    );
    const selection = {
      models: Object.keys(official.models),
      plugins: Object.fromEntries(
        Object.entries(official.plugins).map(([model, variants]) => [model, Object.keys(variants)]),
      ),
      tools: Object.keys(official.tools),
    };
    const before = await request('/api/option/');
    const unchangedGroup = before.find((o) => o.key === 'GroupRatio').value;
    const unchangedTools = JSON.parse(
      before.find((o) => o.key === 'tool_price_setting.prices').value,
    );
    const proposal = await previewArtifact(adapter, official, selection);
    const receipt = await applyArtifact(adapter, official, proposal, {
      confirmed: true,
      actor: 'isolated-official-candidate-test',
      target: proposal.target,
      artifactId: official.id,
      planId: proposal.id,
    });
    const expectedItems =
      selection.models.length +
      selection.tools.length +
      Object.values(selection.plugins).reduce((n, keys) => n + keys.length, 0);
    assert.equal(receipt.items.length, expectedItems);
    assert.equal(receipt.success, true, JSON.stringify(receipt));
    const after = await request('/api/option/');
    assert.equal(after.find((o) => o.key === 'GroupRatio').value, unchangedGroup);
    const actualTools = JSON.parse(after.find((o) => o.key === 'tool_price_setting.prices').value);
    for (const [key, value] of Object.entries(unchangedTools))
      if (!selection.tools.includes(key)) assert.equal(actualTools[key], value);
    console.log(
      JSON.stringify({
        test: 'I-maintained-official-candidate',
        sourceSha,
        artifactId: official.id,
        receipt,
        suppliersCalled: 0,
        groupAndUnselectedToolsPreserved: true,
      }),
    );
  }

  console.log(
    JSON.stringify({
      test: 'I',
      status: 'passed',
      suppliersCalled: 0,
      quotaExample: { tokens: 1000, cny: 0.021, quota: 10500, groupRatio: 0.8, groupQuota: 8400 },
      note: 'quota example is independent arithmetic, no supplier consumption or settlement executed',
    }),
  );
} finally {
  if (created) docker('rm', '--force', name);
  console.log(JSON.stringify({ test: 'I-cleanup', createdContainerRemoved: created, name }));
}
