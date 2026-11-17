/** H: independent disposable rc50 fetch/preview only. Never reuse the retained I target. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes, publicEncrypt, constants, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { buildModelRelease, writeModelRelease } from '../.cache/cny-build/cny/publication.js';
import { hash } from '../.cache/cny-build/cny/generate.js';
import { buildPublicationPackage } from '../.cache/cny-build/cny/publication-package.js';
import {
  preparePublicationTransition,
  executePublicationTransition,
  downloadStablePublication,
} from '../.cache/cny-build/cny/publication-promotion.js';

const artifactPath = process.argv[2];
if (!artifactPath) throw new Error('provide the fixed artifact.json path explicitly');
const originalBytes = readFileSync(artifactPath);
const artifact = JSON.parse(originalBytes);
assert.equal(artifact.id, '18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138');
const selection = {
  models: ['kimi-k3.1-pro', 'claude-sonnet-4-5'],
  mode: 'partial',
  purpose: 'test',
};
const release = buildModelRelease(artifact, selection);
const root = mkdtempSync(join(tmpdir(), 'cny-publication-H-'));
const directory = writeModelRelease(root, release);
const image =
  'calciumion/new-api@sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9';
const baseline = 'f2aa91232ed3e5878a614762ace6736a2b74257f';
const name = 'cny-h-' + randomBytes(6).toString('hex');
const runEnv = { ...process.env, SESSION_SECRET: randomBytes(32).toString('hex') };
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    env: runEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const metadata = JSON.parse(docker('image', 'inspect', image))[0];
assert.equal(metadata.Config.Labels['org.opencontainers.image.revision'], baseline);
assert.equal(metadata.Config.Labels['org.opencontainers.image.version'], 'v1.0.0-rc.50');
const prefix = '/' + randomBytes(16).toString('hex');
const httpRequests = [],
  apiRequests = [];
let stableSnapshot = null;
const transitions = [];
const modelBytes = readFileSync(join(directory, 'ratio_config.json'));
const server = createServer((req, res) => {
  httpRequests.push({ method: req.method, path: req.url });
  if (req.method === 'GET' && stableSnapshot && req.url.startsWith(prefix + '/')) {
    const body = stableSnapshot.files[req.url.slice(prefix.length + 1)];
    if (body !== undefined) {
      res.setHeader('content-type', 'application/json');
      res.end(body);
      return;
    }
  }
  if (
    req.method !== 'GET' ||
    ![
      prefix + '/models.json',
      prefix + '/bad.json',
      prefix + '/missing.json',
      prefix + '/false-empty.json',
    ].includes(req.url)
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader('content-type', 'application/json');
  if (req.url.endsWith('/bad.json'))
    res.end(
      JSON.stringify({
        success: false,
        message: 'H intentionally rejected source',
        data: release.modelSource.data,
      }),
    );
  else if (req.url.endsWith('/false-empty.json'))
    res.end(JSON.stringify({ success: false, message: '', data: release.modelSource.data }));
  else if (req.url.endsWith('/missing.json') || process.argv.includes('--legacy-envelope'))
    res.end(JSON.stringify({ data: release.modelSource.data }));
  else res.end(modelBytes);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let created = false,
  report;
try {
  docker(
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
  assert.equal(inspect.Image, metadata.Id);
  assert.deepEqual(inspect.HostConfig.Tmpfs, { '/data': 'rw' });
  assert.ok(!inspect.HostConfig.Binds?.length);
  const origin = 'http://127.0.0.1:' + docker('port', name, '3000/tcp').split(':').at(-1);
  let token;
  const request = async (path, method = 'GET', body) => {
    assert.ok(
      method === 'GET' ||
        [
          '/api/setup',
          '/api/user/login',
          '/api/ratio_sync/fetch',
          '/api/option/model_pricing/preview',
        ].includes(path),
      'H must never save price configuration',
    );
    const r = await fetch(origin + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    const e = await r.json();
    apiRequests.push({ method, path, status: r.status, success: e.success });
    assert.ok(r.ok && e.success, `${method} ${path}: ${e.message}`);
    return e.data;
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
  assert.ok(ready);
  const setup = await request('/api/setup');
  assert.equal(setup.status, false);
  assert.equal(setup.root_init, false);
  const password = 'Cny!' + randomBytes(18).toString('hex');
  await request('/api/setup', 'POST', {
    username: 'cnyh',
    password,
    confirmPassword: password,
    SelfUseModeEnabled: false,
    DemoSiteEnabled: false,
  });
  const key = await request('/api/user/login/encryption-key');
  const login = key.enabled
    ? {
        username: 'cnyh',
        password_encrypted: publicEncrypt(
          { key: key.public_key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
          Buffer.from(password),
        ).toString('base64'),
        encryption_key_id: key.kid,
      }
    : { username: 'cnyh', password };
  token = (await request('/api/user/login', 'POST', login)).access_token;
  assert.ok(token);
  const status = await request('/api/status');
  assert.equal(status.version, 'v1.0.0-rc.50');
  const optionsBefore = await request('/api/option/'),
    pricingBefore = await request('/api/option/model_pricing');
  const endpoint = 'http://host.docker.internal:' + server.address().port + prefix;
  const sourceFetch = (path) =>
    request('/api/ratio_sync/fetch', 'POST', {
      upstreams: [
        {
          id: 0,
          name: 'CNY-H',
          base_url: 'http://host.docker.internal:' + server.address().port,
          endpoint: endpoint + path,
        },
      ],
      include_unchanged: true,
    });
  const fetched = await sourceFetch('/models.json');
  writeFileSync(
    join(root, 'native-fetch.json'),
    JSON.stringify({ fetched, httpRequests }, null, 2) + '\n',
    { mode: 0o600 },
  );
  if (!selection.models.every((m) => fetched.prices?.[m]))
    console.error(
      JSON.stringify({
        testResults: fetched.test_results,
        models: Object.keys(fetched.prices ?? {}),
        httpRequests,
        evidence: root,
      }),
    );
  assert.equal(fetched.test_results[0].status, 'success', JSON.stringify(fetched.test_results));
  const previewed = [];
  for (const model of selection.models) {
    const expected = {
      billing_mode: 'tiered_expr',
      billing_expr: artifact.models[model].billing_expr,
    };
    assert.deepEqual(fetched.prices[model].upstreams['CNY-H'], expected);
    const draft = {
      'billing_setting.billing_mode': expected.billing_mode,
      'billing_setting.billing_expr': expected.billing_expr,
    };
    const preview = await request('/api/option/model_pricing/preview', 'POST', {
      model_name: model,
      pricing: draft,
    });
    assert.equal(preview.effective['billing_setting.billing_expr'], expected.billing_expr);
    previewed.push({ model, pricing: draft, effective: preview.effective });
  }
  const rejected = await sourceFetch('/bad.json');
  assert.equal(rejected.test_results[0].status, 'error');
  assert.deepEqual(rejected.prices, {});
  const missingSuccess = await sourceFetch('/missing.json');
  assert.deepEqual(missingSuccess.prices, {}); // Native empty-message error path mislabels success; record it honestly.
  const falseEmptyMessage = await sourceFetch('/false-empty.json');
  assert.deepEqual(falseEmptyMessage.prices, {});
  if (process.argv.includes('--publication-transitions')) {
    const a = buildPublicationPackage(originalBytes, {
      ...selection,
      models: ['kimi-k3.1-pro'],
      plugins: {},
      tools: [],
    });
    const b = buildPublicationPackage(originalBytes, { ...selection, plugins: {}, tools: [] });
    const attempts = new Set();
    const platform = {
      hasAttempt: async (id) => attempts.has(id),
      claim: async (id) => {
        if (attempts.has(id)) return false;
        attempts.add(id);
        return true;
      },
      read: async () => structuredClone(stableSnapshot),
      canSubmit: async () => true,
      submit: async (snapshot, expected) => {
        assert.equal(stableSnapshot?.revision ?? null, expected);
        stableSnapshot = structuredClone(snapshot);
      },
    };
    for (const [action, p] of [
      ['promote', a],
      ['promote', b],
      ['rollback', a],
    ]) {
      const plan = preparePublicationTransition(await platform.read(), p.files, p, action);
      const receipt = await executePublicationTransition(platform, plan, {
        confirmed: true,
        actor: 'isolated-H-reviewer',
        approvalRef: 'test-only-H',
        planId: plan.id,
      });
      assert.equal(receipt.status, 'applied');
      const downloaded = await downloadStablePublication(
        `http://127.0.0.1:${server.address().port}${prefix}/`,
        p,
      );
      const native = await sourceFetch('/api/newapi/ratio_config.json');
      const expected = JSON.parse(p.files['ratio_config.json']).data,
        previews = [];
      for (const model of p.manifest.selection.models) {
        const price = {
          billing_mode: expected.billing_mode[model],
          billing_expr: expected.billing_expr[model],
        };
        assert.deepEqual(native.prices[model].upstreams['CNY-H'], price);
        const preview = await request('/api/option/model_pricing/preview', 'POST', {
          model_name: model,
          pricing: {
            'billing_setting.billing_mode': price.billing_mode,
            'billing_setting.billing_expr': price.billing_expr,
          },
        });
        assert.equal(preview.effective['billing_setting.billing_expr'], price.billing_expr);
        assert.equal(preview.effective['billing_setting.billing_mode'], price.billing_mode);
        previews.push({ model, price, effective: preview.effective });
      }
      transitions.push({ action, receipt, downloaded, native, previews });
    }
    writeFileSync(
      join(root, 'publication-state.json'),
      JSON.stringify(stableSnapshot, null, 2) + '\n',
      { mode: 0o600 },
    );
    assert.equal(transitions.length, 3);
  }
  const optionsAfter = await request('/api/option/'),
    pricingAfter = await request('/api/option/model_pricing');
  const normalized = (opts) => [...opts].sort((a, b) => a.key.localeCompare(b.key));
  assert.equal(hash(normalized(optionsBefore)), hash(normalized(optionsAfter)));
  assert.equal(hash(pricingBefore), hash(pricingAfter));
  assert.equal((await request('/api/channel/?p=1&page_size=1')).total, 0);
  assert.deepEqual(readFileSync(artifactPath), originalBytes);
  report = {
    seam: 'H',
    executorSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    artifactId: artifact.id,
    artifactFileSha256: createHash('sha256').update(originalBytes).digest('hex'),
    releaseId: release.id,
    selection,
    sourceModelResponseSha256: release.modelSourceSha256,
    partial: release.partial,
    complete: release.complete,
    image: {
      reference: image,
      id: inspect.Image,
      revision: baseline,
      statusVersion: status.version,
    },
    target: { name, id: inspect.Id, origin, tmpfs: inspect.HostConfig.Tmpfs },
    sourceTransport: {
      containerHost: 'host.docker.internal',
      serverBind: '127.0.0.1',
      reachableFromNativeFetch: true,
    },
    fetched,
    previewed,
    rejected,
    missingSuccess,
    falseEmptyMessage,
    transitions,
    nativeMissingSuccessLimit:
      'empty message can label success despite empty prices; not a usable import',
    apiRequests,
    httpRequests,
    before: { pricingHash: hash(pricingBefore), optionsHash: hash(normalized(optionsBefore)) },
    after: { pricingHash: hash(pricingAfter), optionsHash: hash(normalized(optionsAfter)) },
    priceWrites: 0,
    providerCalls: 0,
    pageAcceptance: false,
    publicPublication: false,
    releaseDirectory: directory,
  };
} finally {
  try {
    if (created) docker('rm', '--force', name);
  } finally {
    await new Promise((r) => server.close(r));
  }
}
const remaining = docker('ps', '-a', '--filter', 'name=^/' + name + '$', '--format', '{{.Names}}');
assert.equal(remaining, '');
report.cleanup = { onlyOwnTemporaryContainer: true, removed: true, absenceVerified: true };
writeFileSync(join(root, 'H-report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(
  JSON.stringify({
    seam: 'H',
    passed: true,
    releaseId: release.id,
    artifactId: artifact.id,
    priceWrites: 0,
    providerCalls: 0,
    report: resolve(root, 'H-report.json'),
  }),
);
