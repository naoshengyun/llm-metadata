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

test('an App price review is reused until a previously merged change genuinely recurs', async () => {
  const head = 'codex/official-prices/' + digest;
  const refs = new Map();
  const pulls = new Map();
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
    if (path.startsWith(api + '/git/ref/heads/' + head)) {
      const name = path.slice((api + '/git/ref/heads/').length);
      const sha = refs.get(name);
      return sha
        ? reply({ ref: 'refs/heads/' + name, object: { type: 'commit', sha } })
        : reply({}, 404);
    }
    if (path === api + '/pulls' && method === 'GET') {
      const name = new URL(raw).searchParams.get('head').split(':')[1];
      return reply(pulls.has(name) ? [pulls.get(name)] : []);
    }
    if (path === api + '/pulls/99') return reply(pulls.get(head));
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
      assert.equal(body.head, creates === 0 ? head : head + '-after-99');
      assert.equal(body.base, 'naoshengyun');
      assert.match(body.body, /"sourcePrice":/);
      assert.match(body.body, /https:\/\/github.com\/naoshengyun\/llm-metadata\/actions\/runs\/31/);
      creates++;
      const number = 98 + creates;
      const pull = {
        state: 'open',
        number,
        html_url: 'https://github.com/' + repo + '/pull/' + number,
        head: { ref: body.head, sha: refs.get(body.head), repo: repository },
        base: { ref: 'naoshengyun', repo: repository },
        user: { login: 'naoshengyun-cny-pr-codex[bot]', type: 'Bot' },
        body: body.body,
      };
      pulls.set(body.head, pull);
      return reply(pull, 201);
    }
    throw Error('Unexpected fixture operation: ' + method + ' ' + path);
  };
  const execGit = (_, args) => {
    if (args[0] === 'rev-list') return revision + ' ' + base + '\n';
    if (args[0] === 'diff') return 'data/cny/official-catalog.json\n';
    const name = pushes === 0 ? head : head + '-after-99';
    assert.ok(
      args.includes('push') && args.includes('--force-with-lease=refs/heads/' + name + ':'),
    );
    pushes++;
    refs.set(name, revision);
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
  pulls.get(head).state = 'closed';
  assert.equal((await publishOfficialProposal(plan, options)).status, 'closed');
  pulls.get(head).merged_at = '2026-11-20T12:00:00Z';
  assert.equal((await publishOfficialProposal(plan, options)).number, 100);
  assert.equal((await publishOfficialProposal(plan, options)).number, 100);
  assert.equal(creates, 2);
  assert.equal(pushes, 2);
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
