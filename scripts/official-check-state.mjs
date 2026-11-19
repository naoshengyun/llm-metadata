/** Publish a small status-only document on a separate append-only branch. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { githubApi } from './publish-upstream-sync.mjs';

const repository = 'naoshengyun/llm-metadata';
const route = '/repos/' + repository;
const branch = 'cny-official-check-state';
const filename = 'official-check.json';
const ref = 'refs/heads/' + branch;
const json = (value) => JSON.stringify(value) + '\n';

export function summarizeOfficialCheck(report, plan, proposal, runId, proposalError) {
  assert.equal(report.schemaVersion, 1);
  assert.ok(Number.isFinite(Date.parse(report.attemptedAt)));
  assert.match(runId, /^[1-9]\d*$/);
  assert.match(report.publishedVersion.candidateId, /^[a-f0-9]{64}$/);
  assert.match(report.publishedVersion.sourceSha, /^[a-f0-9]{40}$/);
  if (plan) assert.deepEqual(plan.version, report.publishedVersion);
  if (proposal) {
    assert.equal(proposal.digest, plan.digest);
    assert.ok(Number.isSafeInteger(proposal.number));
    assert.equal(proposal.url, 'https://github.com/' + repository + '/pull/' + proposal.number);
    assert.ok(['opened', 'reused', 'closed'].includes(proposal.status));
  }
  const affected = new Set(plan?.changes.map(({ id }) => id));
  return {
    schemaVersion: 1,
    publishedVersion: report.publishedVersion,
    attemptedAt: report.attemptedAt,
    runtime: { url: 'https://github.com/' + repository + '/actions/runs/' + runId },
    summary: report.summary,
    ...(proposalError && { proposalError: 'review-proposal-failed' }),
    results: report.results.map((item) => ({
      id: item.id,
      quoteId: item.quoteId,
      nativeKey: item.nativeKey,
      identity: item.identity,
      sourceId: item.sourceId,
      selected: item.selected,
      coverageStatus: item.coverageStatus,
      status: item.status,
      reason: item.reason,
      latestAttemptedAt: item.latestAttemptedAt,
      latestSuccessfulAt: item.latestSuccessfulAt,
      publishedEvidence: item.publishedEvidence,
      effectiveAt: item.observed?.effectiveAt,
      ...(affected.has(item.id) && proposal && { proposal }),
    })),
  };
}

function apiFor(env, fetchApi) {
  assert.equal(env.GITHUB_REPOSITORY, repository);
  assert.equal(env.GITHUB_REF, 'refs/heads/naoshengyun');
  assert.match(env.GH_TOKEN, /^[A-Za-z0-9._~+\/-]+={0,2}$/);
  return (operation, path, options) =>
    githubApi(fetchApi, operation, route + path, env.GH_TOKEN, options);
}

async function readCurrent(github) {
  const pointer = await github('read official check state ref', '/git/ref/heads/' + branch, {
    allowMissing: true,
  });
  if (pointer === null) return null;
  assert.equal(pointer.ref, ref);
  assert.equal(pointer.object.type, 'commit');
  const revision = pointer.object.sha;
  assert.match(revision, /^[a-f0-9]{40}$/);
  const object = await github(
    'read official check state',
    '/contents/' + filename + '?ref=' + revision,
  );
  assert.equal(object.path, filename);
  assert.equal(object.encoding, 'base64');
  const state = JSON.parse(Buffer.from(object.content, 'base64'));
  assert.equal(state.schemaVersion, 1);
  assert.ok(Number.isFinite(Date.parse(state.attemptedAt)));
  return { revision, state };
}

export async function publishOfficialState(state, { env = process.env, fetchApi = fetch } = {}) {
  const github = apiFor(env, fetchApi);
  assert.equal(state.publishedVersion.sourceSha, env.GITHUB_SHA);
  const current = await readCurrent(github);
  if (current) {
    const order = Date.parse(state.attemptedAt) - Date.parse(current.state.attemptedAt);
    assert.ok(order >= 0, 'Official check state already records a newer attempt');
    if (order === 0) {
      assert.deepEqual(state.publishedVersion, current.state.publishedVersion);
      assert.deepEqual(state.runtime, current.state.runtime);
      if (!current.state.proposalError || state.proposalError) return current.revision;
    }
  }
  const bytes = Buffer.from(json(state));
  assert.ok(
    bytes.length < 1_000_000,
    'Official check state exceeds the GitHub single-file read limit',
  );
  const { sha: blob } = await github('write official check status blob', '/git/blobs', {
    method: 'POST',
    body: { content: bytes.toString('base64'), encoding: 'base64' },
  });
  assert.match(blob, /^[a-f0-9]{40}$/);
  const { sha: tree } = await github('write isolated official check state tree', '/git/trees', {
    method: 'POST',
    body: { tree: [{ path: filename, mode: '100644', type: 'blob', sha: blob }] },
  });
  assert.match(tree, /^[a-f0-9]{40}$/);
  const { sha: commit } = await github('commit official check status', '/git/commits', {
    method: 'POST',
    body: {
      message: 'Official price check ' + state.attemptedAt,
      author: {
        name: 'github-actions[bot]',
        email: '41898282+github-actions[bot]@users.noreply.github.com',
      },
      tree,
      parents: current ? [current.revision] : [],
    },
  });
  assert.match(commit, /^[a-f0-9]{40}$/);
  const next = current
    ? await github('advance official check state ref', '/git/refs/heads/' + branch, {
        method: 'PATCH',
        body: { sha: commit, force: false },
      })
    : await github('create official check state ref', '/git/refs', {
        method: 'POST',
        body: { ref, sha: commit },
      });
  assert.equal(next.ref, ref);
  assert.equal(next.object.sha, commit);
  return commit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, first, second, third] = process.argv.slice(2);
  if (action === 'read') {
    const current = await readCurrent(apiFor(process.env, fetch));
    if (current?.state.publishedVersion.candidateId === first)
      writeFileSync(second, json(current.state), { flag: 'wx' });
  } else if (action === 'publish') {
    const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file)) : undefined);
    const state = summarizeOfficialCheck(
      read(first),
      read(second),
      read(third),
      process.env.GITHUB_RUN_ID,
      process.env.PROPOSAL_FAILED === 'true',
    );
    const commit = await publishOfficialState(state);
    console.log(JSON.stringify({ commit, summary: state.summary }));
  } else {
    throw Error('Unknown official check status operation: ' + action);
  }
}
