/** Developer-only retained UI fixture. Creates its own rc50, never saves prices. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomBytes, publicEncrypt, constants } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createInterface } from 'node:readline';
import {
  buildPublicationPackage,
  writePublicationPackage,
  downloadPublicationPackage,
} from '../.cache/cny-build/cny/publication-package.js';
import { hash } from '../.cache/cny-build/cny/generate.js';

const [artifactPath, selectionPath] = process.argv.slice(2);
if (!artifactPath || !selectionPath)
  throw new Error('provide explicit fixed artifact and test-selection JSON files');
const artifactBytes = readFileSync(artifactPath),
  selection = JSON.parse(readFileSync(selectionPath));
assert.equal(selection.purpose, 'test');
assert.ok(selection.models.length);
const pack = buildPublicationPackage(artifactBytes, selection);
assert.equal(
  pack.manifest.artifactId,
  '18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138',
);
const root = mkdtempSync(join(tmpdir(), 'cny-publication-ui20-'));
chmodSync(root, 0o700);
const versions = join(root, 'versions');
mkdirSync(versions);
const directory = writePublicationPackage(versions, pack.files, {
  releaseId: pack.releaseId,
  manifestSha256: pack.manifestSha256,
});
const save = (name, value) =>
  writeFileSync(join(root, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const httpRequests = [],
  apiRequests = [];
const prefix = '/versions/' + pack.releaseId + '/';
const server = createServer((req, res) => {
  const name = req.url?.startsWith(prefix) ? req.url.slice(prefix.length) : '';
  httpRequests.push({ at: new Date().toISOString(), method: req.method, path: req.url });
  save('http-requests.json', httpRequests);
  if (req.method !== 'GET' || !Object.hasOwn(pack.files, name)) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const bytes = readFileSync(join(directory, name));
    res.setHeader('cache-control', 'no-store');
    res.setHeader(
      'content-type',
      name.endsWith('.json') ? 'application/json' : 'text/markdown; charset=utf-8',
    );
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const sourceBase = 'http://127.0.0.1:' + server.address().port + prefix;
const nativeSourceUrl =
  'http://host.docker.internal:' + server.address().port + prefix + 'ratio_config.json';
await downloadPublicationPackage(sourceBase, {
  releaseId: pack.releaseId,
  manifestSha256: pack.manifestSha256,
});
const image =
  'calciumion/new-api@sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9';
const runEnv = { ...process.env, SESSION_SECRET: randomBytes(32).toString('hex') };
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    env: runEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const name = 'cny-ui20-' + randomBytes(6).toString('hex');
let created = false,
  ready = false,
  origin,
  token;
const username = 'cnyui',
  password = 'Cny!' + randomBytes(18).toString('hex');
let identity;
const request = async (path, method = 'GET', body) => {
  assert.ok(
    method === 'GET' ||
      [
        '/api/setup',
        '/api/user/login',
        '/api/ratio_sync/fetch',
        '/api/option/model_pricing/preview',
      ].includes(path),
    'UI preparation cannot save configuration',
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
  apiRequests.push({
    at: new Date().toISOString(),
    method,
    path,
    status: r.status,
    success: e.success,
  });
  save('api-requests.json', apiRequests);
  assert.ok(r.ok && e.success, `${method} ${path}: ${e.message}`);
  return e.data;
};
async function login() {
  const key = await request('/api/user/login/encryption-key');
  const body = key.enabled
    ? {
        username,
        password_encrypted: publicEncrypt(
          { key: key.public_key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
          Buffer.from(password),
        ).toString('base64'),
        encryption_key_id: key.kid,
      }
    : { username, password };
  token = (await request('/api/user/login', 'POST', body)).access_token;
  assert.ok(token);
  save('runtime-private.json', { ...identity, username, password, token });
}
const state = async () => ({
  pricing: await request('/api/option/model_pricing'),
  options: await request('/api/option/'),
});
const optionHash = (opts) => hash([...opts].sort((a, b) => a.key.localeCompare(b.key)));
try {
  const meta = JSON.parse(docker('image', 'inspect', image))[0];
  assert.equal(
    meta.Config.Labels['org.opencontainers.image.revision'],
    'f2aa91232ed3e5878a614762ace6736a2b74257f',
  );
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
  origin = 'http://127.0.0.1:' + docker('port', name, '3000/tcp').split(':').at(-1);
  for (let i = 0; i < 80; i++) {
    try {
      await request('/api/setup');
      break;
    } catch {
      await delay(250);
    }
  }
  const setup = await request('/api/setup');
  assert.equal(setup.status, false);
  assert.equal(setup.root_init, false);
  await request('/api/setup', 'POST', {
    username,
    password,
    confirmPassword: password,
    SelfUseModeEnabled: false,
    DemoSiteEnabled: false,
  });
  const inspect = JSON.parse(docker('inspect', name))[0];
  assert.deepEqual(inspect.HostConfig.Tmpfs, { '/data': 'rw' });
  assert.ok(!inspect.HostConfig.Binds?.length);
  identity = { name, id: inspect.Id, origin };
  await login();
  const self = await request('/api/user/self');
  assert.equal(self.id, 1);
  assert.equal(self.role, 100);
  assert.equal(self.username, username);
  save('test-login-private.json', { target: origin, username, password });
  const before = await state();
  save('baseline.json', before);
  const source = await request('/api/ratio_sync/fetch', 'POST', {
    upstreams: [
      {
        id: 0,
        name: 'UI-package-H',
        base_url: 'http://host.docker.internal:' + server.address().port,
        endpoint: nativeSourceUrl,
      },
    ],
    include_unchanged: true,
  });
  const response = JSON.parse(pack.files['ratio_config.json']);
  for (const model of selection.models)
    assert.deepEqual(source.prices[model].upstreams['UI-package-H'], {
      billing_mode: response.data.billing_mode[model],
      billing_expr: response.data.billing_expr[model],
    });
  const after = await state();
  assert.equal(hash(after.pricing), hash(before.pricing));
  assert.equal(optionHash(after.options), optionHash(before.options));
  assert.equal((await request('/api/channel/?p=1&page_size=1')).total, 0);
  const proposal = {
    createdAt: new Date().toISOString(),
    executorSha: execFileSync(
      'git',
      ['-C', dirname(fileURLToPath(import.meta.url)), 'rev-parse', 'HEAD'],
      { encoding: 'utf8' },
    ).trim(),
    target: {
      ...identity,
      host: execFileSync('scutil', ['--get', 'ComputerName'], { encoding: 'utf8' }).trim(),
      imageId: inspect.Image,
      revision: meta.Config.Labels['org.opencontainers.image.revision'],
      statusVersion: (await request('/api/status')).version,
      tmpfs: inspect.HostConfig.Tmpfs,
      ports: inspect.NetworkSettings.Ports,
      startedAt: inspect.State.StartedAt,
    },
    package: {
      releaseId: pack.releaseId,
      manifestSha256: pack.manifestSha256,
      artifactId: pack.manifest.artifactId,
      sourceBase,
      nativeSourceUrl,
      purpose: 'test',
      complete: pack.manifest.complete,
    },
    testIdentity: { id: self.id, username: self.username, role: self.role },
    browserLoginRequired: true,
    privateLoginFile: join(root, 'test-login-private.json'),
    selectedModels: selection.models,
    selectedPriceDrafts: Object.fromEntries(
      selection.models.map((m) => [
        m,
        {
          'billing_setting.billing_mode': response.data.billing_mode[m],
          'billing_setting.billing_expr': response.data.billing_expr[m],
        },
      ]),
    ),
    baseline: {
      pricingHash: hash(before.pricing),
      optionsHash: optionHash(before.options),
      options: before.options.filter((o) =>
        ['USDExchangeRate', 'QuotaPerUnit', 'GroupRatio', 'tool_price_setting.prices'].includes(
          o.key,
        ),
      ),
      selected: selection.models.map((m) => ({
        model: m,
        configured: before.pricing.entries.find((e) => e.model_name === m)?.configured ?? {},
        version:
          before.pricing.entries.find((e) => e.model_name === m)?.version ??
          before.pricing.empty_version,
      })),
    },
    requestedFutureIntent: {
      authorized: false,
      throughOriginalUIOnly: true,
      unitPreparation: 'USDExchangeRate7.3->1;Quota/Group unchanged',
      modelsOnly: selection.models,
      pluginsTools: 'read-only page checks; no save',
      restore: 'requires separate new confirmation after actual results/fresh restoration preview',
      cleanup: false,
      suppliers: false,
    },
    readOnlyH: {
      sourceFetched: source,
      optionsUnchanged: true,
      pricingUnchanged: true,
      priceWrites: 0,
      providerCalls: 0,
    },
    pageEvidence: 'not-run',
  };
  save('proposal.json', proposal);
  ready = true;
  console.log(
    JSON.stringify({
      ready: true,
      target: identity,
      releaseId: pack.releaseId,
      sourceBase,
      nativeSourceUrl,
      proposal: join(root, 'proposal.json'),
      privateLoginFile: join(root, 'test-login-private.json'),
      priceWrites: 0,
      providerCalls: 0,
      retained: true,
    }),
  );
  createInterface({ input: process.stdin }).on('line', async (line) => {
    if (line.trim() !== 'snapshot') return;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (payload.exp * 1000 < Date.now() + 60000) await login();
      const current = await state();
      const file = 'snapshot-' + Date.now() + '.json';
      save(file, current);
      console.log(
        JSON.stringify({
          snapshot: join(root, file),
          pricingHash: hash(current.pricing),
          optionsHash: optionHash(current.options),
          priceWrites: 0,
        }),
      );
    } catch (e) {
      console.log(JSON.stringify({ snapshotError: e.message }));
    }
  });
} catch (e) {
  try {
    if (created && !ready) docker('rm', '--force', name);
  } finally {
    server.close();
  }
  throw e;
}
// The retained fixture is intentionally not removed when this source process exits.
