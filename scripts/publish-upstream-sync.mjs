import { execFileSync } from 'node:child_process';
import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const OWNER = 'naoshengyun';
const REPO = 'llm-metadata';
const REPOSITORY = OWNER + '/' + REPO;
const API_REPO = '/repos/' + REPOSITORY;
const WEB_REPO = 'https://github.com/' + REPOSITORY;
const GIT_URL = WEB_REPO + '.git';
const BASE_REF = 'refs/heads/' + OWNER;
const APP_ID = 5826118;
const APP_BOT = 'naoshengyun-cny-pr-codex[bot]';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const isDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const isId = (value) => Number.isSafeInteger(value) && value > 0;
const isToken = (value) => typeof value === 'string' && /^[A-Za-z0-9._~+\/-]+=*$/.test(value);

function readReport(path, name) {
  assert(path, 'Usage: node scripts/publish-upstream-sync.mjs <preparation-report.json> <validation-report.json>');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('Cannot read ' + name + ' report as JSON');
  }
}

function checkReports(preparation, validation) {
  assert(preparation?.status === 'candidate-ready', 'Preparation report has no ready candidate');
  const { output, candidate, upstream, business, previousUpstream, quarantinedWorkflows } = preparation;
  assert(typeof output === 'string' && isAbsolute(output), 'Preparation report needs an absolute candidate path');
  assert([candidate, upstream, business, previousUpstream].every(isSha), 'Preparation report needs full Git commit SHAs');
  assert(candidate !== business && upstream !== previousUpstream, 'Preparation report has no new upstream sync candidate');
  assert(Array.isArray(quarantinedWorkflows), 'Preparation report is missing quarantined workflows');
  assert(
    validation?.candidate === candidate && validation.upstream === upstream && validation.business === business,
    'Validation report does not match the prepared Git candidate',
  );
  const { candidateId, priceDiff, models, officialKeys } = validation;
  assert(isDigest(candidateId), 'Validation report needs a fixed CNY candidate ID');
  assert(
    [priceDiff?.added, priceDiff?.changed, priceDiff?.removed, models?.before, models?.after, officialKeys].every(isCount),
    'Validation report needs nonnegative model and price counts',
  );
}

function candidateGit(execGit, cwd, path) {
  const env = {
    PATH: path,
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
  return (args, failure, extraEnv = {}) => {
    try {
      return execGit('git', args, {
        cwd, env: { ...env, ...extraEnv }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      throw new Error(failure);
    }
  };
}

function changedDirectories(git, business, candidate) {
  const paths = git(
    ['diff', '--no-renames', '--name-only', '-z', business, candidate, '--'],
    'Could not read changes in the fixed Git candidate',
  ).split('\0');
  const directories = new Set(paths.filter((path) => path.includes('/')).map((path) => path.split('/', 1)[0]));
  const displayNames = [...directories]
    .filter((name) => /^[A-Za-z0-9._-]{1,80}$/.test(name))
    .sort()
    .slice(0, 30)
    .map((name) => `\`${name}\``);
  const omitted = directories.size - displayNames.length;
  if (omitted > 0) displayNames.push('另有 ' + omitted + ' 个目录');
  return displayNames.join('、') || '无';
}

function pullBody(preparation, validation, directories, env) {
  const { upstream, previousUpstream, candidate, business, quarantinedWorkflows } = preparation;
  const { candidateId, priceDiff, models, officialKeys } = validation;
  const lines = [
    '## 上游同步候选',
    '',
    '| 输入与证据 | 固定版本或检查结果 |',
    '| --- | --- |',
    `| 本次上游 | \`${upstream}\` |`,
    `| 上次上游 | \`${previousUpstream}\` |`,
    `| 业务基线 | \`${business}\` |`,
    `| Git 候选提交 | \`${candidate}\` |`,
    `| 固定候选包 | \`${candidateId}\` |`,
    '| 变动目录 | ' + directories + ' |',
    '| 目录模型 | ' + models.before + ' → ' + models.after + ' |',
    '| 官方价目计费键 | ' + officialKeys + ' |',
    '| 价格差异 | 新增 ' + priceDiff.added + '，变更 ' + priceDiff.changed + '，移除 ' + priceDiff.removed + ' |',
    '| 隔离的上游工作流 | ' + quarantinedWorkflows.length + ' |',
    '',
    '自有官方报价、CNY 政策、选价、延期与撤价记录已通过保护检查。请在运行产物中核对逐键价格差异。',
    '',
    '此候选需要必需检查通过、人工审核与人工合并。固定价格产物由合并后的发布门禁处理。',
  ];
  if (env.GITHUB_REPOSITORY === REPOSITORY && /^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '')) {
    lines.push('', '[查看候选验证运行和产物](' + WEB_REPO + '/actions/runs/' + env.GITHUB_RUN_ID + ')');
  }
  return lines.join('\n');
}

class GitHubError extends Error {
  constructor(operation, status) {
    super('GitHub ' + operation + ' failed' + (status ? ' (HTTP ' + status + ')' : ''));
    this.status = status;
  }
}

async function githubApi(fetchApi, operation, path, token, { method = 'GET', body, allowMissing = false } = {}) {
  let response;
  try {
    response = await fetchApi('https://api.github.com' + path, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GitHubError(operation);
  }
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new GitHubError(operation, response.status);
  if (response.status === 204) return null;
  try {
    const data = await response.json();
    if (data !== null) return data;
  } catch {
    // API response bodies can contain untrusted input.
  }
  throw new Error('GitHub ' + operation + ' returned an invalid response');
}

function appJwt(privateKey) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({ iat: now - 60, exp: now + 540, iss: String(APP_ID) });
  const input = header + '.' + payload;
  try {
    return input + '.' + sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  } catch {
    throw new Error('Invalid CNY_UPSTREAM_PR_APP_PRIVATE_KEY');
  }
}

function exactPull(pull, head) {
  return pull?.head?.ref === head && pull.head.repo?.full_name === REPOSITORY
    && pull.base?.ref === OWNER && pull.base.repo?.full_name === REPOSITORY;
}

function authoredByApp(pull) {
  return pull.user?.login === APP_BOT && pull.user?.type === 'Bot';
}

function pullResult(pull, status) {
  assert(isId(pull.number) && pull.html_url === WEB_REPO + '/pull/' + pull.number, 'GitHub returned an invalid pull request identity');
  return { status, number: pull.number, url: pull.html_url };
}

function pushCandidate(git, token, candidate, ref) {
  const header = 'Authorization: Basic ' + Buffer.from('x-access-token:' + token).toString('base64');
  git([
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'http.followRedirects=false',
    '-c', 'protocol.allow=never',
    '-c', 'protocol.https.allow=always',
    '-c', 'push.followTags=false',
    '-c', 'push.recurseSubmodules=no',
    'push', '--no-verify', '--force-with-lease=' + ref + ':', GIT_URL, candidate + ':' + ref,
  ], 'Could not create the managed candidate ref', {
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.' + GIT_URL + '.extraheader', GIT_CONFIG_VALUE_0: header,
  });
}

export async function publishUpstreamSync(preparationPath, validationPath, {
  env = process.env, fetchApi = fetch, execGit = execFileSync,
} = {}) {
  const preparation = readReport(preparationPath, 'preparation');
  const validation = readReport(validationPath, 'validation');
  checkReports(preparation, validation);
  const { output, candidate, business, upstream } = preparation;
  const git = candidateGit(execGit, output, process.env.PATH);
  const tip = git(['rev-list', '--parents', '-n', '1', 'HEAD'], 'Could not read the candidate HEAD and its parents');
  assert(tip.trim() === candidate + ' ' + business, 'Candidate HEAD must match the prepared SHA and have only the fixed business parent');

  const { GH_TOKEN: contentsToken, CNY_UPSTREAM_PR_APP_PRIVATE_KEY: privateKey } = env;
  assert(!env.GITHUB_REPOSITORY || env.GITHUB_REPOSITORY === REPOSITORY, 'Unexpected GitHub repository');
  assert(isToken(contentsToken), 'GH_TOKEN is missing or invalid');
  const head = 'codex/upstream-sync/' + upstream;
  const ref = 'refs/heads/' + head;
  const get = (operation, path, options) => githubApi(fetchApi, operation, path, contentsToken, options);

  async function readRef(name, allowMissing = false) {
    const response = await get('read branch ref', API_REPO + '/git/ref/' + name.slice('refs/'.length), { allowMissing });
    if (response === null && allowMissing) return null;
    assert(response?.ref === name && response.object?.type === 'commit' && isSha(response.object.sha), 'GitHub returned an invalid branch ref');
    return response.object.sha;
  }

  async function checkBase() {
    assert(await readRef(BASE_REF) === business, 'Business branch moved after candidate validation');
  }

  async function existingPull() {
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({ state: 'all', head: OWNER + ':' + head, base: OWNER, per_page: '100', page: String(page) });
      const pulls = await get('list pull requests', API_REPO + '/pulls?' + query);
      assert(Array.isArray(pulls), 'GitHub returned an invalid pull request list');
      const existing = pulls.find((pull) => exactPull(pull, head) && authoredByApp(pull));
      if (existing) {
        assert(existing.state === 'open' || existing.state === 'closed', 'GitHub returned an invalid pull request state');
        if (existing.state === 'open') {
          const recordedCandidate = /^\| Git 候选提交 \| `([a-f0-9]{40})` \|$/m.exec(existing.body ?? '')?.[1];
          assert(recordedCandidate && existing.head.sha === recordedCandidate && await readRef(ref) === recordedCandidate,
            'Existing pull request candidate ref does not match its recorded candidate SHA');
        }
        return pullResult(existing, existing.state === 'open' ? 'reused' : 'closed');
      }
      assert(!pulls.some((pull) => exactPull(pull, head)), 'Managed candidate ref already has a pull request from another author');
      if (pulls.length < 100) return null;
    }
  }

  const prior = await existingPull();
  if (prior) return prior;
  await checkBase();
  const current = await readRef(ref, true);
  assert(current === null || current === candidate, 'Managed candidate ref already points to another commit');
  const body = pullBody(preparation, validation, changedDirectories(git, business, candidate), env);

  assert(typeof privateKey === 'string' && privateKey.length > 0, 'CNY_UPSTREAM_PR_APP_PRIVATE_KEY is missing');
  const jwt = appJwt(privateKey);
  const installation = await githubApi(fetchApi, 'find app installation', API_REPO + '/installation', jwt);
  assert(
    isId(installation?.id) && installation.app_id === APP_ID && installation.account?.login === OWNER && !installation.suspended_at,
    'GitHub App installation does not match the expected account and App',
  );
  const token = await githubApi(fetchApi, 'mint installation token', '/app/installations/' + installation.id + '/access_tokens', jwt, {
    method: 'POST', body: { repositories: [REPO], permissions: { pull_requests: 'write' } },
  });
  assert(isToken(token?.token), 'GitHub returned an invalid installation token');
  const appApi = (operation, path, options) => githubApi(fetchApi, operation, path, token.token, options);
  try {
    assert(
      token.permissions?.pull_requests === 'write' && Object.entries(token.permissions).every(
        ([name, value]) => name === 'pull_requests' || (name === 'metadata' && value === 'read'),
      ),
      'GitHub App token has unexpected permissions',
    );
    const repositories = await appApi('verify installation token scope', '/installation/repositories');
    assert(
      repositories?.total_count === 1 && repositories.repositories?.length === 1 && repositories.repositories[0]?.full_name === REPOSITORY,
      'GitHub App token is not scoped to the expected repository',
    );
    if (current === null) {
      await checkBase();
      try {
        pushCandidate(git, contentsToken, candidate, ref);
      } catch (error) {
        if (await readRef(ref, true) !== candidate) throw error;
      }
    }
    const discovered = await existingPull();
    if (discovered) return discovered;
    assert(await readRef(ref) === candidate, 'Managed candidate ref moved after validation');
    await checkBase();
    let created;
    try {
      created = await appApi('create pull request', API_REPO + '/pulls', {
        method: 'POST', body: { title: '上游同步 ' + upstream.slice(0, 12), head, base: OWNER, body },
      });
    } catch (error) {
      if (!(error instanceof GitHubError) || error.status !== 422) throw error;
      const raced = await existingPull();
      if (raced) return raced;
      throw error;
    }
    assert(
      exactPull(created, head) && authoredByApp(created) && created.state === 'open'
        && created.head.sha === candidate && created.base.sha === business,
      'Created pull request did not match the expected GitHub App and fixed candidate',
    );
    return pullResult(created, 'created');
  } finally {
    await appApi('revoke installation token', '/installation/token', { method: 'DELETE' });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    assert(process.argv.length === 4, 'Usage: node scripts/publish-upstream-sync.mjs <preparation-report.json> <validation-report.json>');
    const result = await publishUpstreamSync(process.argv[2], process.argv[3]);
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : 'Upstream sync publishing failed') + '\n');
    process.exitCode = 1;
  }
}
