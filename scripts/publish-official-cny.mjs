/** Open or reuse the human-reviewed PR for one semantic change set. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { candidateGit, githubApi, pushCandidate, withAppToken } from './publish-upstream-sync.mjs';

const repo = 'naoshengyun/llm-metadata';
const api = '/repos/' + repo;
const url = 'https://github.com/' + repo;
const base = 'naoshengyun';
const bot = 'naoshengyun-cny-pr-codex[bot]';
const actionsBot = 'github-actions[bot]';
const actionsBotId = 41898282;
const actionsBotEmail = '41898282+github-actions[bot]@users.noreply.github.com';
const ref = (name) => 'refs/heads/' + name;
const inputPaths = new Set([
  'data/cny/official-catalog.json',
  'data/cny/proposed-selection.json',
  'data/cny/unified-policy.json',
]);
const read = (file) => JSON.parse(readFileSync(file));

const marker = (digest) => 'CNY official semantic change: ' + digest;
const bodyMarker = (digest) => '<!-- ' + marker(digest) + ' -->';
const safeJson = (row) =>
  JSON.stringify(row, null, 2).replace(
    /[<>&@`\u2028-\u202e\u2066-\u2069]/g,
    (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
  );

function reviewBody(plan, runId) {
  const evidence = url + '/actions/runs/' + runId;
  const lines = [
    bodyMarker(plan.digest),
    '## 官方核价候选',
    '',
    '已发布版本 `' + plan.version.candidateId + '`',
    '本次尝试 `' + plan.attemptedAt + '`',
    '',
    '合并由人工审核后执行。完整原始响应、来源哈希、收费条件和逐条差异见 [核价运行与产物](' +
      evidence +
      ')。',
  ];
  let used = Buffer.byteLength(lines.join('\n'));
  let omitted = 0;
  for (const { id, nativeKey, status, observed, evidence, difference } of plan.changes) {
    const snippet =
      '\n\n```json\n' +
      safeJson({ id, nativeKey, status, observed, evidence, difference }) +
      '\n```';
    if (used + Buffer.byteLength(snippet) > 50_000) {
      omitted++;
      continue;
    }
    used += Buffer.byteLength(snippet);
    lines.push(snippet);
  }
  if (omitted) lines.push('', '另有 ' + omitted + ' 项变更，请在完整运行产物核对。');
  return lines.join('\n');
}

function isActionsCommitIdentity(account, identity) {
  return (
    account?.type === 'Bot' &&
    account.login === actionsBot &&
    account.id === actionsBotId &&
    identity?.name === actionsBot &&
    identity.email === actionsBotEmail
  );
}

async function checkInterruptedCandidate(github, current, parent, digest) {
  const existing = await github('read interrupted official proposal', '/commits/' + current);
  const previousParent = existing.parents?.[0]?.sha;
  assert.ok(
    existing.sha === current &&
      existing.commit?.message?.trimEnd() ===
        'Review current official prices\n\n' + marker(digest) &&
      isActionsCommitIdentity(existing.author, existing.commit.author) &&
      isActionsCommitIdentity(existing.committer, existing.commit.committer) &&
      existing.parents.length === 1 &&
      /^[a-f0-9]{40}$/.test(previousParent ?? '') &&
      existing.files?.length > 0 &&
      existing.files.every(
        ({ filename, status }) => status === 'modified' && inputPaths.has(filename),
      ),
    'Existing official proposal ref does not match this review',
  );
  if (previousParent !== parent) {
    const ancestry = await github(
      'verify interrupted proposal parent is on the business branch',
      '/compare/' + previousParent + '...' + parent + '?per_page=1',
    );
    assert.ok(
      ancestry.status === 'ahead' &&
        ancestry.base_commit?.sha === previousParent &&
        ancestry.merge_base_commit?.sha === previousParent,
      'Existing official proposal parent is not an ancestor of the current business branch',
    );
  }
}

export async function publishOfficialProposal(
  plan,
  { env = process.env, fetchApi = fetch, execGit = execFileSync, cwd = process.cwd() } = {},
) {
  assert.equal(env.GITHUB_REPOSITORY, repo);
  assert.equal(env.GITHUB_REF, ref(base));
  assert.equal(env.GITHUB_SHA, plan.version.sourceSha);
  assert.match(env.GITHUB_RUN_ID, /^[1-9]\d*$/);
  assert.match(plan.digest, /^[a-f0-9]{64}$/);
  assert.ok(plan.changes.length > 0);
  const git = candidateGit(execGit, cwd, process.env.PATH);
  const parent = plan.version.sourceSha;
  const [commit, ...parents] = git(
    ['rev-list', '--parents', '-n', '1', 'HEAD'],
    'Could not read the official candidate',
  )
    .trim()
    .split(' ');
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.deepEqual(parents, [parent]);
  const changed = git(
    ['diff', '--name-only', parent, commit, '--'],
    'Could not read the proposal files',
  )
    .trim()
    .split('\n');
  assert.ok(
    changed.length && changed.every((path) => inputPaths.has(path)),
    'Official proposal changes unexpected files',
  );
  const headPrefix = 'codex/official-prices/' + plan.digest;
  let head = headPrefix;
  const token = env.GH_TOKEN;
  assert.ok(
    typeof token === 'string' && /^[A-Za-z0-9._~+\/-]+={0,2}$/.test(token),
    'Missing or invalid GitHub contents token',
  );
  const github = (operation, path, options) =>
    githubApi(fetchApi, operation, api + path, token, options);
  const getRef = async (name, allowMissing = false) => {
    const result = await github('read branch', '/git/ref/heads/' + name, { allowMissing });
    if (result === null) return null;
    assert.equal(result.ref, ref(name));
    assert.equal(result.object.type, 'commit');
    assert.match(result.object.sha, /^[a-f0-9]{40}$/);
    return result.object.sha;
  };
  const checkBase = async () =>
    assert.equal(await getRef(base), parent, 'Business branch advanced during official check');
  const exact = (item) =>
    item.head?.ref === head &&
    item.head.repo?.full_name === repo &&
    item.base?.ref === base &&
    item.base.repo?.full_name === repo;
  const inspect = async () => {
    const query = new URLSearchParams({
      state: 'all',
      head: 'naoshengyun:' + head,
      base,
      per_page: '100',
    });
    const pulls = await github('list official price PRs', '/pulls?' + query);
    assert.ok(Array.isArray(pulls));
    const matches = pulls.filter(exact);
    assert.ok(matches.length <= 1, 'Multiple pull requests for this semantic change');
    return matches[0];
  };
  const link = (pull, opened = false) => {
    assert.ok(
      exact(pull) &&
        pull.user?.login === bot &&
        pull.user.type === 'Bot' &&
        pull.body?.startsWith(bodyMarker(plan.digest)) &&
        ['open', 'closed'].includes(pull.state) &&
        Number.isSafeInteger(pull.number) &&
        pull.html_url === url + '/pull/' + pull.number,
      'Official price PR identity does not match the managed proposal',
    );
    return {
      status: opened ? 'opened' : pull.state === 'open' ? 'reused' : 'closed',
      number: pull.number,
      url: pull.html_url,
      digest: plan.digest,
    };
  };
  await checkBase();
  let previousNumber = 0;
  for (let prior = await inspect(); prior; prior = await inspect()) {
    const result = link(prior);
    if (result.status !== 'closed') return result;
    const details = await github('read closed price review', '/pulls/' + result.number);
    assert.deepEqual(link(details), result);
    if (!details.merged_at) return result;
    // A new publication can reintroduce the earlier rate. Start a new review cycle.
    assert.ok(result.number > previousNumber, 'Official price review history is out of order');
    previousNumber = result.number;
    head = headPrefix + '-after-' + result.number;
  }
  let current = await getRef(head, true);
  if (current === null) {
    await checkBase();
    pushCandidate(git, token, commit, ref(head));
    current = await getRef(head);
    assert.equal(current, commit);
  } else if (current !== commit) {
    await checkInterruptedCandidate(github, current, parent, plan.digest);
    const alreadyOpen = await inspect();
    if (alreadyOpen) return link(alreadyOpen);
    await checkBase();
    pushCandidate(git, token, commit, ref(head), current);
    current = await getRef(head);
    assert.equal(current, commit);
  }
  const reused = await inspect();
  if (reused) return link(reused);
  await checkBase();
  assert.equal(await getRef(head), current, 'Official proposal head changed before review');
  return withAppToken(fetchApi, env.CNY_UPSTREAM_PR_APP_PRIVATE_KEY, async (appApi) => {
    let created;
    try {
      created = await appApi('create official price review PR', api + '/pulls', {
        method: 'POST',
        body: {
          base,
          head,
          draft: false,
          title: '官方价目更新 · ' + plan.digest.slice(0, 12),
          body: reviewBody(plan, env.GITHUB_RUN_ID),
        },
      });
    } catch (error) {
      const discovered = await inspect();
      if (!discovered) throw error;
      return link(discovered);
    }
    assert.equal(created.head.sha, current);
    return link(created, true);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const plan = read(process.argv[2]);
  console.log(JSON.stringify(await publishOfficialProposal(plan)));
}
