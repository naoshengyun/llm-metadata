import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { publishUpstreamSync } from '../scripts/publish-upstream-sync.mjs';

const repo = 'naoshengyun/llm-metadata';
const base = 'naoshengyun';
const upstream = 'a'.repeat(40);
const previousUpstream = 'b'.repeat(40);
const branch = 'codex/upstream-sync/' + upstream;
const appId = 5826118;
const bot = 'naoshengyun-cny-pr-codex[bot]';
const url = 'https://github.com/' + repo + '/pull/42';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  GH_TOKEN: 'fake-contents-token',
  CNY_UPSTREAM_PR_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  GITHUB_REPOSITORY: repo,
  GITHUB_RUN_ID: '123456789',
};

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'publish-upstream-sync-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const cwd = join(root, 'candidate');
  mkdirSync(cwd);
  function git(...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  }
  git('init');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('commit', '--allow-empty', '-m', 'Business');
  const business = git('rev-parse', 'HEAD');
  mkdirSync(join(cwd, 'data'));
  mkdirSync(join(cwd, 'bad @everyone'));
  writeFileSync(join(cwd, 'data', 'price.json'), '{}');
  writeFileSync(join(cwd, 'bad @everyone', 'entry.json'), '{}');
  writeFileSync(join(cwd, 'package.json'), '{}');
  git('add', '.');
  git('commit', '-m', 'Candidate');
  const candidate = git('rev-parse', 'HEAD');
  const preparation = join(root, 'preparation.json');
  const validation = join(root, 'validation.json');
  const preparationReport = {
    status: 'candidate-ready', output: cwd, candidate, upstream, business, previousUpstream,
    quarantinedWorkflows: ['@everyone.md'],
  };
  const validationReport = {
    candidate, upstream, business, candidateId: 'd'.repeat(64),
    models: { before: 7, after: 8 }, priceDiff: { added: 1, changed: 2, removed: 3 }, officialKeys: 4,
  };
  function writeReports() {
    writeFileSync(preparation, JSON.stringify(preparationReport));
    writeFileSync(validation, JSON.stringify(validationReport));
  }
  writeReports();
  return { preparation, validation, preparationReport, validationReport, candidate, business, writeReports, git };
}

function github(f, {
  prior = null, head = null, baseSha, failOnceAfterPush = false, failOnceAt, moveBeforePush = null,
} = {}) {
  let pushed = false;
  const requests = [];
  const pulls = [];
  const transitions = [];
  const nodeId = 'PR_kwDTEST';
  const businessTip = () => baseSha ?? f.business;
  const code = (sha) => String.fromCharCode(96) + sha + String.fromCharCode(96);
  function response(value, status = 200) {
    return new Response(JSON.stringify(value), { status });
  }
  function pull(state, sha = f.candidate, login = bot, recorded = sha) {
    return {
      state, number: 42, node_id: nodeId, draft: prior?.draft ?? false, html_url: url,
      body: prior?.body ?? [
        '请保留人工评审备注。', '<!-- cny-upstream-sync:start -->',
        '| 业务基线 | ' + code(prior?.business ?? f.business) + ' |',
        '| Git 候选提交 | ' + code(recorded) + ' |', '<!-- cny-upstream-sync:end -->',
      ].join('\n'),
      user: { login, type: 'Bot' },
      head: { ref: branch, sha, repo: { full_name: repo } },
      base: { ref: base, sha: businessTip(), repo: { full_name: repo } },
    };
  }
  async function fetchApi(raw, options) {
    const target = new URL(raw);
    assert.equal(target.origin, 'https://api.github.com');
    const method = options.method;
    const auth = options.headers.Authorization;
    const path = target.pathname.replace('/repos/' + repo, '');
    requests.push([method, path]);
    if (method === 'GET' && path === '/pulls') {
      assert.equal(auth, 'Bearer ' + env.GH_TOKEN);
      assert.equal(target.searchParams.get('state'), 'all');
      assert.equal(target.searchParams.get('head'), 'naoshengyun:' + branch);
      assert.equal(target.searchParams.get('base'), base);
      return response(prior ? [pull(prior.state, head ?? prior.sha, prior.login, prior.recorded ?? prior.sha)] : []);
    }
    if (method === 'GET' && path === '/git/ref/heads/' + base) {
      assert.equal(auth, 'Bearer ' + env.GH_TOKEN);
      return response({ ref: 'refs/heads/' + base, object: { type: 'commit', sha: businessTip() } });
    }
    if (method === 'GET' && path === '/git/ref/heads/' + branch) {
      assert.equal(auth, 'Bearer ' + env.GH_TOKEN);
      return head
        ? response({ ref: 'refs/heads/' + branch, object: { type: 'commit', sha: head } })
        : response({}, 404);
    }
    if (method === 'GET' && path === '/installation') {
      const [header, claims, signature] = auth.slice(7).split('.');
      assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256');
      assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).iss, String(appId));
      assert.ok(verify('RSA-SHA256', Buffer.from(header + '.' + claims), publicKey, Buffer.from(signature, 'base64url')));
      return response({ id: 7, app_id: appId, account: { login: 'naoshengyun' }, suspended_at: null });
    }
    if (method === 'POST' && path === '/app/installations/7/access_tokens') {
      assert.deepEqual(JSON.parse(options.body), {
        repositories: ['llm-metadata'], permissions: { pull_requests: 'write' },
      });
      return response({ token: 'fake-installation-token', permissions: { pull_requests: 'write', metadata: 'read' } }, 201);
    }
    if (method === 'GET' && path === '/installation/repositories') {
      assert.equal(auth, 'Bearer fake-installation-token');
      return response({ total_count: 1, repositories: [{ full_name: repo }] });
    }
    if (path === '/pulls/42' && method === 'GET') {
      assert.equal(auth, 'Bearer ' + env.GH_TOKEN);
      return response(pull(prior.state, head, prior.login, prior.recorded ?? prior.sha));
    }
    if (path === '/pulls/42' && method === 'PATCH') {
      assert.equal(auth, 'Bearer fake-installation-token');
      if (pushed && (failOnceAfterPush || (failOnceAt === 'after ready' && !prior.draft))) {
        failOnceAfterPush = false;
        failOnceAt = undefined;
        return response({}, 500);
      }
      const request = JSON.parse(options.body);
      assert.deepEqual(Object.keys(request), ['body']);
      prior.body = request.body;
      return response(pull(prior.state, head, prior.login));
    }
    if (path === '/graphql' && method === 'POST') {
      assert.equal(auth, 'Bearer fake-installation-token');
      const { query, variables } = JSON.parse(options.body);
      assert.equal(variables.input.pullRequestId, nodeId);
      const mutation = query.includes('convertPullRequestToDraft') ? 'convertPullRequestToDraft' : 'markPullRequestReadyForReview';
      assert.ok(query.includes(mutation));
      if (failOnceAt === 'before draft' && mutation === 'convertPullRequestToDraft') {
        failOnceAt = undefined;
        return response({}, 500);
      }
      prior.draft = mutation === 'convertPullRequestToDraft';
      transitions.push(prior.draft ? 'draft' : 'ready');
      return response({ data: { [mutation]: { pullRequest: {
        id: nodeId, isDraft: prior.draft, state: 'OPEN', headRefOid: head, baseRefOid: businessTip(),
      } } } });
    }
    if (method === 'POST' && path === '/pulls') {
      assert.equal(auth, 'Bearer fake-installation-token');
      assert.equal(head, f.candidate);
      const request = JSON.parse(options.body);
      assert.equal(request.head, branch);
      assert.equal(request.base, base);
      pulls.push(request);
      prior = { state: 'open', sha: head, body: request.body };
      return response(pull('open'), 201);
    }
    if (method === 'DELETE' && path === '/installation/token') {
      assert.equal(auth, 'Bearer fake-installation-token');
      return new Response(null, { status: 204 });
    }
    assert.fail(method + ' ' + path);
  }
  function execGit(binary, args, options) {
    if (!args.includes('push')) return execFileSync(binary, args, options);
    assert.equal(options.env.CNY_UPSTREAM_PR_APP_PRIVATE_KEY, undefined);
    assert.equal(options.env.GIT_CONFIG_KEY_0, 'http.https://github.com/' + repo + '.git.extraheader');
    assert.equal(options.env.GIT_CONFIG_VALUE_0, 'Authorization: Basic ' + Buffer.from('x-access-token:' + env.GH_TOKEN).toString('base64'));
    assert.deepEqual(args.slice(args.indexOf('push') + 1), [
      '--no-verify', '--force-with-lease=refs/heads/' + branch + ':' + (head ?? ''),
      'https://github.com/' + repo + '.git', f.candidate + ':refs/heads/' + branch,
    ]);
    assert.ok(head === null || prior?.draft, 'Update a managed head only while the PR is draft');
    if (moveBeforePush) {
      head = moveBeforePush;
      moveBeforePush = null;
      throw new Error('stale info');
    }
    transitions.push('push');
    head = f.candidate;
    pushed = true;
  }
  const run = () => publishUpstreamSync(f.preparation, f.validation, { env, fetchApi, execGit });
  return { run, get pushed() { return pushed; }, requests, pulls, transitions, get body() { return prior?.body; }, get draft() { return prior?.draft; } };
}

test('publishes a fixed candidate with separate GitHub credentials and review evidence', async (t) => {
  const f = fixture(t);
  const remote = github(f);
  assert.deepEqual(await remote.run(), { status: 'created', number: 42, url });
  assert.equal(remote.pushed, true);
  assert.equal(remote.pulls.length, 1);
  assert.deepEqual(remote.requests.at(-1), ['DELETE', '/installation/token']);
  const { title, body } = remote.pulls[0];
  assert.match(title, /上游同步/);
  for (const value of [upstream, previousUpstream, f.business, f.candidate, f.validationReport.candidateId]) {
    assert.ok(body.includes(value));
  }
  assert.ok(body.includes('`data`'));
  assert.match(body, /模型.*7.*8/);
  assert.match(body, /新增.*1.*变更.*2.*移除.*3/);
  assert.match(body, /人工审核.*人工合并/);
  assert.match(body, /https:\/\/github\.com\/naoshengyun\/llm-metadata\/actions\/runs\/123456789/);
  assert.doesNotMatch(body, /@everyone|package\.json/);
});


test('resumes an exact candidate ref left before PR creation', async (t) => {
  const f = fixture(t);
  const remote = github(f, { head: f.candidate });
  assert.deepEqual(await remote.run(), { status: 'created', number: 42, url });
  assert.equal(remote.pushed, false);
  assert.equal(remote.pulls.length, 1);
});

test('reuses an existing app-authored PR without changing its checked head', async (t) => {
  const f = fixture(t);
  const reviewed = 'e'.repeat(40);
  const remote = github(f, { prior: { state: 'open', sha: reviewed }, head: reviewed });
  assert.deepEqual(await remote.run(), { status: 'reused', number: 42, url, headSha: reviewed, freshHead: false });
  assert.equal(remote.pushed, false);
  assert.equal(remote.pulls.length, 0);
  assert.ok(remote.requests.every(([method]) => method === 'GET'));
});

test('keeps the outcome of a closed app-authored PR after head deletion', async (t) => {
  const f = fixture(t);
  const remote = github(f, { prior: { state: 'closed' }, baseSha: 'f'.repeat(40) });
  assert.deepEqual(await remote.run(), { status: 'closed', number: 42, url });
  assert.equal(remote.pushed, false);
  assert.equal(remote.pulls.length, 0);
  assert.ok(remote.requests.every(([method]) => method === 'GET'));
});

test('leaves a same-ref PR from another author untouched', async (t) => {
  const f = fixture(t);
  const remote = github(f, { prior: { state: 'open', login: 'another-bot[bot]' }, head: f.candidate });
  await assert.rejects(remote.run(), /another author/);
  assert.equal(remote.pushed, false);
  assert.equal(remote.pulls.length, 0);
  assert.ok(remote.requests.every(([method]) => method === 'GET'));
});

test('refuses an orphan managed ref with a different SHA', async (t) => {
  const f = fixture(t);
  const remote = github(f, { head: 'e'.repeat(40) });
  await assert.rejects(remote.run(), /points to another commit/);
  assert.equal(remote.pushed, false);
  assert.equal(remote.pulls.length, 0);
  assert.ok(remote.requests.every(([method]) => method === 'GET'));
});

test('refuses to publish on a stale business base', async (t) => {
  const f = fixture(t);
  const remote = github(f, { baseSha: 'e'.repeat(40) });
  await assert.rejects(remote.run(), /Business branch moved/);
  assert.equal(remote.pushed, false);
  assert.equal(remote.pulls.length, 0);
  assert.ok(remote.requests.every(([method]) => method === 'GET'));
});

test('rejects out-of-date validation and a rewritten local HEAD before contacting GitHub', async (t) => {
  const f = fixture(t);
  const remote = github(f);
  f.validationReport.candidate = 'e'.repeat(40);
  f.writeReports();
  await assert.rejects(remote.run(), /Validation report does not match/);
  f.validationReport.candidate = f.candidate;
  f.writeReports();
  f.git('commit', '--allow-empty', '-m', 'Unvalidated changes');
  await assert.rejects(remote.run(), /Candidate HEAD must match/);
  assert.deepEqual(remote.requests, []);
});

test('refuses to present a moved PR ref as a checked candidate', async (t) => {
  const f = fixture(t);
  const changed = 'e'.repeat(40);
  const remote = github(f, { prior: { state: 'open', sha: changed, recorded: f.candidate }, head: changed });
  assert.deepEqual(await remote.run(), { status: 'reused', number: 42, url, headSha: changed, freshHead: false });
  assert.equal(remote.pushed, false);
  assert.equal(remote.pulls.length, 0);
});

test('refreshes the same bot PR on a moved business base and preserves human notes', async (t) => {
  const f = fixture(t);
  const oldHead = 'e'.repeat(40);
  const remote = github(f, { prior: { state: 'open', sha: oldHead, business: 'f'.repeat(40) }, head: oldHead });
  assert.deepEqual(await remote.run(), { status: 'refreshed', number: 42, url, headSha: f.candidate, freshHead: true });
  assert.deepEqual(remote.transitions, ['draft', 'push', 'ready']);
  assert.equal(remote.draft, false);
  assert.equal(remote.pulls.length, 0);
  assert.match(remote.body, /请保留人工评审备注/);
  assert.ok(remote.body.includes(f.candidate));
  assert.ok(!remote.body.includes(oldHead));
  assert.deepEqual(await remote.run(), { status: 'reused', number: 42, url, headSha: f.candidate, freshHead: true });
  assert.deepEqual(remote.transitions, ['draft', 'push', 'ready']);
});

test('finishes a refresh after an interruption between the ref push and body update', async (t) => {
  const f = fixture(t);
  const oldHead = 'e'.repeat(40);
  const remote = github(f, {
    prior: { state: 'open', sha: oldHead, business: 'f'.repeat(40) },
    head: oldHead,
    failOnceAfterPush: true,
  });
  await assert.rejects(remote.run(), /HTTP 500/);
  assert.equal(remote.draft, true);
  assert.deepEqual(remote.transitions, ['draft', 'push']);
  assert.deepEqual(await remote.run(), { status: 'refreshed', number: 42, url, headSha: f.candidate, freshHead: true });
  assert.deepEqual(remote.transitions, ['draft', 'push', 'ready']);
  assert.match(remote.body, /请保留人工评审备注/);
  assert.ok(remote.body.includes(f.candidate));
  assert.equal(remote.draft, false);
});

function advanceBusiness(f) {
  f.git('switch', '--detach', f.business);
  f.git('commit', '--allow-empty', '-m', 'Advanced business baseline');
  f.business = f.git('rev-parse', 'HEAD');
  f.git('commit', '--allow-empty', '-m', 'New checked candidate');
  f.candidate = f.git('rev-parse', 'HEAD');
  for (const report of [f.preparationReport, f.validationReport]) {
    Object.assign(report, { business: f.business, candidate: f.candidate });
  }
  f.writeReports();
}

test('supersedes an interrupted bot draft when the business branch advances again', async (t) => {
  const f = fixture(t);
  const oldHead = 'e'.repeat(40);
  const remote = github(f, {
    prior: { state: 'open', sha: oldHead, business: 'f'.repeat(40) },
    head: oldHead,
    failOnceAfterPush: true,
  });
  await assert.rejects(remote.run(), /HTTP 500/);
  assert.equal(remote.draft, true);

  const interruptedHead = f.candidate;
  advanceBusiness(f);
  assert.deepEqual(await remote.run(), { status: 'refreshed', number: 42, url, headSha: f.candidate, freshHead: true });
  assert.deepEqual(remote.transitions, ['draft', 'push', 'push', 'ready']);
  assert.match(remote.body, /请保留人工评审备注/);
  assert.ok(remote.body.includes(f.candidate));
  assert.ok(!remote.body.includes(interruptedHead));
  assert.equal(remote.draft, false);
});

for (const [window, completed] of [
  ['before draft', []],
  ['after ready', ['draft', 'push', 'ready']],
]) {
  test('supersedes a refresh interrupted ' + window + ' when the business branch advances', async (t) => {
    const f = fixture(t);
    const oldHead = 'e'.repeat(40);
    const remote = github(f, {
      prior: { state: 'open', sha: oldHead, business: 'f'.repeat(40), draft: false },
      head: oldHead,
      failOnceAt: window,
    });
    const interruptedHead = f.candidate;
    await assert.rejects(remote.run(), /HTTP 500/);
    assert.equal(remote.draft, false);
    assert.deepEqual(remote.transitions, completed);
    assert.match(remote.body, /cny-upstream-sync:refresh/);

    advanceBusiness(f);
    assert.deepEqual(await remote.run(), {
      status: 'refreshed', number: 42, url, headSha: f.candidate, freshHead: true,
    });
    assert.deepEqual(remote.transitions, [...completed, 'draft', 'push', 'ready']);
    assert.equal(remote.draft, false);
    assert.equal(remote.pulls.length, 0);
    assert.match(remote.body, /请保留人工评审备注/);
    assert.ok(remote.body.includes(f.candidate));
    assert.ok(!remote.body.includes(interruptedHead));
    assert.doesNotMatch(remote.body, /cny-upstream-sync:refresh/);
    assert.deepEqual(await remote.run(), {
      status: 'reused', number: 42, url, headSha: f.candidate, freshHead: true,
    });
  });
}

test('preserves a human-drafted PR with no automation refresh in progress', async (t) => {
  const f = fixture(t);
  const oldHead = 'e'.repeat(40);
  const remote = github(f, { prior: { state: 'open', sha: oldHead, business: 'f'.repeat(40), draft: true }, head: oldHead });
  assert.deepEqual(await remote.run(), { status: 'reused', number: 42, url, headSha: oldHead, freshHead: false });
  assert.equal(remote.draft, true);
  assert.ok(remote.requests.every(([method]) => method === 'GET'));
});

test('leaves a concurrently moved candidate ref untouched after a failed lease', async (t) => {
  const f = fixture(t);
  const oldHead = 'e'.repeat(40);
  const manualHead = '1'.repeat(40);
  const remote = github(f, {
    prior: { state: 'open', sha: oldHead, business: 'f'.repeat(40) }, head: oldHead, moveBeforePush: manualHead,
  });
  await assert.rejects(remote.run(), /Could not write the managed candidate ref with the expected SHA/);
  assert.deepEqual(remote.transitions, ['draft']);
  assert.deepEqual(await remote.run(), { status: 'reused', number: 42, url, headSha: manualHead, freshHead: false });
  assert.deepEqual(remote.transitions, ['draft']);
  assert.match(remote.body, /请保留人工评审备注/);
});

test('shows bounded source and CNY price changes with hostile Markdown escaped', async (t) => {
  const f = fixture(t);
  const hostile = '@everyone ' + String.fromCharCode(96).repeat(3) + ' <img>';
  f.validationReport.priceChanges = [
    {
      nativeKey: 'test-model',
      type: 'changed',
      before: { sourcePrice: { input: 1 }, sourceCurrency: 'USD', cnyPrice: { input: 7 }, conditions: 'normal' },
      after: { sourcePrice: { input: 2 }, sourceCurrency: 'USD', cnyPrice: { input: 14 }, conditions: hostile },
    },
    { nativeKey: 'oversized-model', type: 'added', after: { conditions: 'x'.repeat(100_000) } },
  ];
  f.validationReport.omittedPriceChanges = 4;
  f.writeReports();
  const remote = github(f);
  await remote.run();
  const { body } = remote.pulls[0];
  const fence = String.fromCharCode(96).repeat(3);
  const block = body.split(fence)[1];
  const data = JSON.parse(block.slice('json\n'.length));
  assert.deepEqual(data, [f.validationReport.priceChanges[0]]);
  assert.doesNotMatch(body, /@everyone|<img>|oversized-model/);
  assert.match(body, /另有 5 项/);
  assert.ok(Buffer.byteLength(body) < 20_000);
});

test('shows old and new official quote identities and sources when only evidence changes', async (t) => {
  const f = fixture(t);
  const price = { sourcePrice: { input: 1 }, sourceCurrency: 'USD', cnyPrice: { input: 7 } };
  const change = {
    nativeKey: 'evidence-model',
    type: 'changed',
    before: { ...price, quoteId: 'quote-before', sourceUrl: 'https://provider.example/before' },
    after: { ...price, quoteId: 'quote-after', sourceUrl: 'https://provider.example/after' },
  };
  f.validationReport.priceChanges = [change];
  f.writeReports();
  const remote = github(f);
  await remote.run();
  const fence = String.fromCharCode(96).repeat(3);
  const block = remote.pulls[0].body.split(fence)[1];
  assert.deepEqual(JSON.parse(block.slice('json\n'.length)), [change]);
});
