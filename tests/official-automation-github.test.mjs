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

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const appEnv = {
  ...env,
  CNY_UPSTREAM_PR_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};

function appResponse(path, method, body) {
  if (path === '/repos/' + repo + '/installation')
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
}

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
    const app = appResponse(path, method, body);
    if (app) return app;
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
  const options = { fetchApi, execGit, env: appEnv };
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

test('an interrupted App proposal can recover across business advancement without overwriting manual work', async () => {
  const head = 'codex/official-prices/' + digest;
  const candidateRef = 'refs/heads/' + head;
  const nextBase = 'd'.repeat(40);
  const nextCommit = 'e'.repeat(40);
  const manual = 'f'.repeat(40);
  const api = '/repos/' + repo;
  const bot = { login: 'github-actions[bot]', type: 'Bot', id: 41898282 };
  const rawBot = {
    name: bot.login,
    email: '41898282+github-actions[bot]@users.noreply.github.com',
  };
  let business = base;
  let candidate = revision;
  let remote = null;
  let pull;
  let createAttempts = 0;
  let pushAttempts = 0;
  let compareAttempts = 0;
  const fetchApi = async (raw, options) => {
    const path = new URL(raw).pathname;
    const { method } = options;
    const body = options.body && JSON.parse(options.body);
    if (path === api + '/git/ref/heads/naoshengyun')
      return reply({ ref: 'refs/heads/naoshengyun', object: { type: 'commit', sha: business } });
    if (path === api + '/git/ref/heads/' + head)
      return remote
        ? reply({ ref: candidateRef, object: { type: 'commit', sha: remote } })
        : reply({}, 404);
    if (path === api + '/pulls' && method === 'GET') return reply(pull ? [pull] : []);
    if (path === api + '/commits/' + remote) {
      return reply({
        sha: remote,
        commit: {
          author: rawBot,
          committer: rawBot,
          message: 'Review current official prices\n\nCNY official semantic change: ' + digest,
        },
        author: remote === manual ? { login: 'maintainer', type: 'User', id: 12 } : bot,
        committer: bot,
        parents: [{ sha: base }],
        files: [{ filename: 'data/cny/official-catalog.json', status: 'modified' }],
      });
    }
    if (path === api + '/compare/' + base + '...' + nextBase) {
      compareAttempts++;
      return reply({
        status: 'ahead',
        base_commit: { sha: base },
        merge_base_commit: { sha: base },
      });
    }
    const app = appResponse(path, method, body);
    if (app) return app;
    if (path === api + '/pulls' && method === 'POST') {
      assert.equal(options.headers.Authorization, 'Bearer test-app-token');
      assert.equal(body.head, head);
      if (++createAttempts === 1) return reply({}, 503);
      assert.equal(remote, nextCommit);
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
    throw Error('Unexpected GitHub operation: ' + method + ' ' + path);
  };
  const execGit = (_, args) => {
    if (args[0] === 'rev-list') return candidate + ' ' + business + '\n';
    if (args[0] === 'diff') return 'data/cny/official-catalog.json\n';
    assert.ok(args.includes('push'));
    assert.ok(args.includes('--force-with-lease=' + candidateRef + ':' + (remote ?? '')));
    assert.ok(args.includes(candidate + ':' + candidateRef));
    pushAttempts++;
    remote = candidate;
    return '';
  };
  const propose = () =>
    publishOfficialProposal(
      {
        version: { sourceSha: business, candidateId: digest },
        digest,
        attemptedAt: '2026-11-19T12:00:00Z',
        changes: [{ id: 'quote', nativeKey: 'model', status: 'changed' }],
      },
      { env: { ...appEnv, GITHUB_SHA: business }, fetchApi, execGit },
    );

  await assert.rejects(propose, /create official price review PR failed/);
  assert.equal(remote, revision);
  assert.equal(pull, undefined);

  business = nextBase;
  candidate = nextCommit;
  remote = manual;
  await assert.rejects(propose, /Existing official proposal ref does not match this review/);
  assert.equal(remote, manual);
  assert.equal(pushAttempts, 1);
  assert.equal(createAttempts, 1);

  remote = revision;
  assert.equal((await propose()).status, 'opened');
  assert.equal(remote, nextCommit);
  assert.equal((await propose()).status, 'reused');
  assert.equal(pushAttempts, 2);
  assert.equal(createAttempts, 2);
  assert.equal(compareAttempts, 1);
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
