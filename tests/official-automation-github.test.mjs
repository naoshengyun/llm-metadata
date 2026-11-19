import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { publishOfficialProposal } from '../scripts/publish-official-cny.mjs';
import { publishOfficialState } from '../scripts/official-check-state.mjs';

const repo = 'naoshengyun/llm-metadata';
const base = 'a'.repeat(40);
const revision = 'b'.repeat(40);
const digest = 'c'.repeat(64);
const repository = { full_name: repo };
const env = {
  GITHUB_REPOSITORY: repo,
  GITHUB_REF: 'refs/heads/naoshengyun',
  GITHUB_SHA: base,
  GITHUB_RUN_ID: '31',
  GH_TOKEN: 'test-contents-token',
};
const reply = (body, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), { status });

test('the first observed change opens an App PR and a repeat reuses it', async () => {
  const head = 'codex/official-prices/' + digest;
  let remote = null;
  let pull;
  let creates = 0;
  let pushes = 0;
  const fetchApi = async (raw, options) => {
    const path = new URL(raw).pathname;
    const method = options.method;
    const api = '/repos/' + repo;
    const body = options.body && JSON.parse(options.body);
    if (path === api + '/git/ref/heads/naoshengyun') {
      return reply({ ref: 'refs/heads/naoshengyun', object: { type: 'commit', sha: base } });
    }
    if (path === api + '/git/ref/heads/' + head) {
      return remote
        ? reply({ ref: 'refs/heads/' + head, object: { type: 'commit', sha: remote } })
        : reply({}, 404);
    }
    if (path === api + '/pulls' && method === 'GET') return reply(pull ? [pull] : []);
    if (path === api + '/installation')
      return reply({ id: 512, app_id: 5826118, account: { login: 'naoshengyun' } });
    if (path === '/app/installations/512/access_tokens') {
      assert.deepEqual(body, {
        repositories: ['llm-metadata'],
        permissions: { pull_requests: 'write' },
      });
      return reply({
        token: 'test-app-token',
        permissions: { pull_requests: 'write', metadata: 'read' },
      });
    }
    if (path === '/installation/repositories')
      return reply({ total_count: 1, repositories: [repository] });
    if (path === '/installation/token' && method === 'DELETE') return reply(null, 204);
    if (path === api + '/pulls' && method === 'POST') {
      assert.equal(options.headers.Authorization, 'Bearer test-app-token');
      assert.equal(body.head, head);
      assert.equal(body.base, 'naoshengyun');
      assert.match(body.body, /"sourcePrice":/);
      assert.match(body.body, /https:\/\/github.com\/naoshengyun\/llm-metadata\/actions\/runs\/31/);
      creates++;
      pull = {
        state: 'open',
        number: 99,
        html_url: 'https://github.com/' + repo + '/pull/99',
        head: { ref: head, sha: remote, repo: repository },
        base: { ref: 'naoshengyun', repo: repository },
        user: { login: 'naoshengyun-cny-pr-codex[bot]', type: 'Bot' },
        body: body.body,
      };
      return reply(pull, 201);
    }
    throw Error('Unexpected fixture operation: ' + method + ' ' + path);
  };
  const execGit = (_, args) => {
    if (args[0] === 'rev-list') return revision + ' ' + base + '\n';
    if (args[0] === 'diff') return 'data/cny/official-catalog.json\n';
    assert.ok(
      args.includes('push') && args.includes('--force-with-lease=refs/heads/' + head + ':'),
    );
    pushes++;
    remote = revision;
    return '';
  };
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const options = {
    fetchApi,
    execGit,
    env: {
      ...env,
      CNY_UPSTREAM_PR_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    },
  };
  const plan = {
    version: { sourceSha: base, candidateId: 'd'.repeat(64) },
    digest,
    attemptedAt: '2026-11-19T12:00:00Z',
    changes: [
      {
        id: 'quote',
        nativeKey: 'model',
        status: 'changed',
        observed: { sourcePrice: { input: 2 } },
        difference: { amounts: { before: { input: 1 }, after: { input: 2 } } },
      },
    ],
  };
  assert.equal((await publishOfficialProposal(plan, options)).status, 'opened');
  assert.equal((await publishOfficialProposal(plan, options)).status, 'reused');
  assert.equal(creates, 1);
  assert.equal(pushes, 1);
});

test('status updates append to the isolated branch and refuse an older attempt', async () => {
  const ref = 'refs/heads/cny-official-check-state';
  let revision;
  let state;
  let pending;
  let writes = 0;
  const fetchApi = async (raw, options) => {
    const path = new URL(raw).pathname;
    const method = options.method;
    const api = '/repos/' + repo;
    const body = options.body && JSON.parse(options.body);
    if (path === api + '/git/ref/heads/cny-official-check-state')
      return revision ? reply({ ref, object: { type: 'commit', sha: revision } }) : reply({}, 404);
    if (path === api + '/contents/official-check.json') {
      assert.equal(new URL(raw).searchParams.get('ref'), revision);
      return reply({
        path: 'official-check.json',
        encoding: 'base64',
        content: Buffer.from(JSON.stringify(state)).toString('base64'),
      });
    }
    if (path === api + '/git/blobs') {
      pending = JSON.parse(Buffer.from(body.content, 'base64'));
      return reply({ sha: 'e'.repeat(40) }, 201);
    }
    if (path === api + '/git/trees') {
      assert.deepEqual(body.tree, [
        { path: 'official-check.json', mode: '100644', type: 'blob', sha: 'e'.repeat(40) },
      ]);
      return reply({ sha: 'f'.repeat(40) }, 201);
    }
    if (path === api + '/git/commits') {
      assert.deepEqual(body.parents, revision ? [revision] : []);
      return reply({ sha: String(++writes).repeat(40) }, 201);
    }
    if (path === api + '/git/refs' && method === 'POST') assert.equal(body.ref, ref);
    else if (path === api + '/git/refs/heads/cny-official-check-state' && method === 'PATCH')
      assert.equal(body.force, false);
    else throw Error('Unexpected fixture operation: ' + method + ' ' + path);
    revision = body.sha;
    state = pending;
    return reply({ ref, object: { sha: revision } });
  };
  const options = { env, fetchApi };
  const first = {
    schemaVersion: 1,
    attemptedAt: '2026-11-19T12:00:00Z',
    publishedVersion: { sourceSha: base, candidateId: digest },
    runtime: { url: 'https://github.com/' + repo + '/actions/runs/31' },
    results: [],
  };
  assert.equal(await publishOfficialState(first, options), '1'.repeat(40));
  assert.equal(await publishOfficialState(first, options), '1'.repeat(40));
  assert.equal(
    await publishOfficialState({ ...first, attemptedAt: '2026-11-20T12:00:00Z' }, options),
    '2'.repeat(40),
  );
  await assert.rejects(() => publishOfficialState(first, options), /newer attempt/);
  assert.equal(writes, 2);
});
