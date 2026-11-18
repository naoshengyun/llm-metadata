import { readHistoricalOfficialInputs } from './fixtures/november-2026-cny.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LocalPublicationPlatform,
  verifyLocalPublication,
} from '../scripts/publication-transition.mjs';
import { buildOfficialSnapshot } from '../scripts/build-official-cny.mjs';
import { buildPublicationPackage } from '../.cache/cny-build/cny/publication-package.js';
import {
  preparePublicationTransition,
  verifyPublicationSnapshot,
  executePublicationTransition,
  PublicationNotSubmittedError,
  downloadStablePublication,
} from '../.cache/cny-build/cny/publication-promotion.js';
import { hash } from '../.cache/cny-build/cny/generate.js';
import { createServer } from 'node:http';

const artifact = Buffer.from(
  JSON.stringify(
    buildOfficialSnapshot({
      sourceSha: 'd5a84ca10d8599343370c1541828439a56b8dd1b',
      ...readHistoricalOfficialInputs(),
    }).artifact,
  ),
);
function pack(models = ['kimi-k3.1-pro'], purpose = 'test') {
  return buildPublicationPackage(artifact, {
    models,
    plugins: {},
    tools: [],
    mode: 'partial',
    purpose,
  });
}
test('S: a reviewed package produces one stable pointer/model snapshot without changing source dates', () => {
  const p = pack();
  const plan = preparePublicationTransition(null, p.files, p, 'promote');
  const pointer = JSON.parse(plan.snapshot.files['current.json']);
  assert.equal(pointer.releaseId, p.releaseId);
  assert.equal(pointer.manifestSha256, p.manifestSha256);
  assert.equal(plan.snapshot.files['api/newapi/ratio_config.json'], p.files['ratio_config.json']);
  assert.equal(
    plan.snapshot.files[`versions/${p.releaseId}/publication-record.json`],
    p.files['publication-record.json'],
  );
  assert.equal(pointer.complete, false);
  assert.equal(plan.fromRevision, null);
});
test('S: promotion retains immutable versions and rollback can select only a retained version', () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']);
  const first = preparePublicationTransition(null, a.files, a, 'promote');
  assert.throws(
    () => preparePublicationTransition(first.snapshot, b.files, b, 'rollback'),
    /retained/,
  );
  const next = preparePublicationTransition(first.snapshot, b.files, b, 'promote');
  const back = preparePublicationTransition(next.snapshot, a.files, a, 'rollback');
  assert.equal(JSON.parse(back.snapshot.files['current.json']).releaseId, a.releaseId);
  for (const p of [a, b])
    for (const [name, body] of Object.entries(p.files))
      assert.equal(back.snapshot.files[`versions/${p.releaseId}/${name}`], body);
});
test('S: inconsistent current snapshots and corrupted retained packages cannot be promoted over', () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']);
  const { snapshot } = preparePublicationTransition(null, a.files, a, 'promote');
  assert.equal(verifyPublicationSnapshot(snapshot).pointer.releaseId, a.releaseId);
  for (const [name, value] of [
    ['api/newapi/ratio_config.json', '{}'],
    [`versions/${a.releaseId}/plugin_prices.json`, 'CORRUPT'],
    [`versions/${a.releaseId}/__proto__`, 'extra'],
    ['current.json', '{}'],
    ['unexpected.txt', 'extra'],
  ]) {
    const files = { ...snapshot.files, [name]: value },
      bad = { revision: hash(files), files };
    assert.throws(() => preparePublicationTransition(bad, b.files, b, 'promote'));
  }
  assert.throws(() => verifyPublicationSnapshot({ ...snapshot, revision: '0'.repeat(64) }));
});
class Platform {
  current = null;
  permitted = true;
  attempts = new Set();
  async hasAttempt(operationId) {
    return this.attempts.has(operationId);
  }
  async claim(operationId) {
    if (this.attempts.has(operationId)) return false;
    this.attempts.add(operationId);
    return true;
  }
  async read() {
    return structuredClone(this.current);
  }
  async canSubmit() {
    return this.permitted;
  }
  async submit(snapshot, expectedRevision) {
    if (!this.permitted) throw new PublicationNotSubmittedError('permission denied');
    if ((this.current?.revision ?? null) !== expectedRevision)
      throw new PublicationNotSubmittedError('concurrent update');
    this.current = structuredClone(snapshot);
  }
}
const confirm = (plan) => ({
  confirmed: true,
  actor: 'test-reviewer',
  approvalRef: 'local-test-review',
  planId: plan.id,
});
test('S: exact manual confirmation binds snapshot and semantic diff before a promotion can submit', async () => {
  const a = pack(),
    platform = new Platform(),
    plan = preparePublicationTransition(null, a.files, a, 'promote');
  await assert.rejects(
    executePublicationTransition(platform, plan, { ...confirm(plan), confirmed: false }),
    /confirmation/,
  );
  assert.equal(await platform.read(), null);
  const result = await executePublicationTransition(platform, plan, confirm(plan));
  assert.equal(result.status, 'applied');
  assert.equal(result.actor, 'test-reviewer');
  assert.equal(result.approvalRef, 'local-test-review');
  assert.equal(result.target.releaseId, a.releaseId);
  assert.deepEqual(result.diff, [
    {
      partition: 'models',
      key: 'kimi-k3.1-pro',
      before: null,
      after: {
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)',
      },
    },
  ]);
  assert.equal((await platform.read()).revision, plan.snapshot.revision);
});
test('S: missing deployment permission fails before submission and keeps the previous entry unchanged', async () => {
  const a = pack(),
    platform = new Platform(),
    plan = preparePublicationTransition(null, a.files, a, 'promote');
  platform.permitted = false;
  const result = await executePublicationTransition(platform, plan, confirm(plan));
  assert.equal(result.status, 'failed');
  assert.equal(result.submission, 'not-attempted');
  assert.equal(await platform.read(), null);
});
test('S: repeating the same confirmed transition verifies the result and returns a no-op', async () => {
  const p = pack(),
    platform = new Platform(),
    plan = preparePublicationTransition(null, p.files, p, 'promote');
  await executePublicationTransition(platform, plan, confirm(plan));
  const result = await executePublicationTransition(platform, plan, confirm(plan));
  assert.equal(result.status, 'already-applied');
  assert.equal(result.submission, 'not-attempted');
  assert.deepEqual(await platform.read(), plan.snapshot);
});
test('S: a platform rejection known to occur before commit preserves the old snapshot', async () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']),
    platform = new Platform();
  const first = preparePublicationTransition(null, a.files, a, 'promote');
  await executePublicationTransition(platform, first, confirm(first));
  const next = preparePublicationTransition(await platform.read(), b.files, b, 'promote');
  platform.submit = async () => {
    throw new PublicationNotSubmittedError('rejected before commit');
  };
  const result = await executePublicationTransition(platform, next, confirm(next));
  assert.equal(result.status, 'failed');
  assert.equal(result.submission, 'rejected-before-commit');
  assert.deepEqual(await platform.read(), first.snapshot);
});
test('S: a lost submit response is reconciled by exact readback, without sending again', async () => {
  const p = pack(),
    platform = new Platform(),
    plan = preparePublicationTransition(null, p.files, p, 'promote');
  platform.submit = async (snapshot, previous) => {
    await Platform.prototype.submit.call(platform, snapshot, previous);
    throw new Error('response timed out');
  };
  const result = await executePublicationTransition(platform, plan, confirm(plan));
  assert.equal(result.status, 'applied');
  assert.equal(result.submission, 'unknown');
  assert.equal(result.readbackRevision, plan.snapshot.revision);
  assert.deepEqual(await platform.read(), plan.snapshot);
});
test('S: uncertain submission remains unknown when readback is old or unavailable', async () => {
  const p = pack();
  for (const unavailable of [false, true]) {
    const platform = new Platform(),
      plan = preparePublicationTransition(null, p.files, p, 'promote');
    platform.submit = async () => {
      if (unavailable)
        platform.read = async () => {
          throw new Error('read timeout');
        };
      throw new Error('submit timeout');
    };
    const result = await executePublicationTransition(platform, plan, confirm(plan));
    assert.equal(result.status, 'unknown');
    assert.equal(result.submission, 'unknown');
  }
});
test('S: retrying an unknown operation reads back without making a new submission', async () => {
  const p = pack(),
    platform = new Platform(),
    plan = preparePublicationTransition(null, p.files, p, 'promote');
  platform.submit = async () => {
    throw new Error('possibly accepted, response unknown');
  };
  assert.equal(
    (await executePublicationTransition(platform, plan, confirm(plan))).status,
    'unknown',
  );
  platform.submit = Platform.prototype.submit.bind(platform);
  const retried = await executePublicationTransition(platform, plan, confirm(plan));
  assert.equal(retried.status, 'unknown');
  assert.equal(await platform.read(), null);
});
test('H: fixed version/hash checks detect stable pointer and model responses mixed by caches', async () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']);
  const snapshot = preparePublicationTransition(null, a.files, a, 'promote').snapshot;
  let mix = false;
  const server = createServer((req, res) => {
    const path = req.url.slice(1),
      body =
        mix && path === 'api/newapi/ratio_config.json'
          ? b.files['ratio_config.json']
          : snapshot.files[path];
    res.writeHead(body === undefined ? 404 : 200);
    res.end(body ?? 'missing');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}/`;
    const result = await downloadStablePublication(base, a);
    assert.equal(result.releaseId, a.releaseId);
    assert.equal(result.modelSource, a.files['ratio_config.json']);
    mix = true;
    await assert.rejects(downloadStablePublication(base, a), /mixed|mismatch/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test('S: stale or changed confirmations cannot replace a newer publication', async () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']),
    platform = new Platform();
  const first = preparePublicationTransition(null, a.files, a, 'promote'),
    stale = preparePublicationTransition(null, b.files, b, 'promote');
  await executePublicationTransition(platform, first, confirm(first));
  await assert.rejects(executePublicationTransition(platform, stale, confirm(stale)), /conflict/);
  const next = preparePublicationTransition(await platform.read(), b.files, b, 'promote');
  const approval = confirm(next);
  next.diff = [];
  await assert.rejects(executePublicationTransition(platform, next, approval), /confirmation/);
  assert.deepEqual(await platform.read(), first.snapshot);
});
test('S: rollback has its own confirmation, diff and exact readback without restoring instances', async () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']),
    platform = new Platform();
  const first = preparePublicationTransition(null, a.files, a, 'promote');
  await executePublicationTransition(platform, first, confirm(first));
  const second = preparePublicationTransition(await platform.read(), b.files, b, 'promote');
  await executePublicationTransition(platform, second, confirm(second));
  const back = preparePublicationTransition(await platform.read(), a.files, a, 'rollback');
  await assert.rejects(
    executePublicationTransition(platform, back, confirm(second)),
    /confirmation/,
  );
  const result = await executePublicationTransition(platform, back, confirm(back));
  assert.equal(result.action, 'rollback');
  assert.equal(result.diff[0].key, 'claude-sonnet-4-5');
  assert.equal(result.diff[0].after, null);
  assert.equal(result.instanceConfiguration, 'not-written');
  assert.equal(JSON.parse((await platform.read()).files['current.json']).releaseId, a.releaseId);
});
test('S: even a rehashed approval cannot submit a plan whose stated diff disagrees with its package', async () => {
  const p = pack(),
    platform = new Platform(),
    plan = preparePublicationTransition(null, p.files, p, 'promote');
  const { id, ...content } = { ...plan, diff: [] };
  const contradictory = { ...content, id: hash(content) };
  await assert.rejects(
    executePublicationTransition(platform, contradictory, confirm(contradictory)),
    /plan|diff/,
  );
  assert.equal(await platform.read(), null);
  platform.current = structuredClone(plan.snapshot);
  await assert.rejects(
    executePublicationTransition(platform, contradictory, confirm(contradictory)),
    /plan|diff/,
  );
});
test('S: concurrent transitions from one old revision cannot both replace the stable entry', async () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']),
    platform = new Platform();
  const first = preparePublicationTransition(null, a.files, a, 'promote'),
    second = preparePublicationTransition(null, b.files, b, 'promote');
  const results = await Promise.all([
    executePublicationTransition(platform, first, confirm(first)),
    executePublicationTransition(platform, second, confirm(second)),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), ['applied', 'failed']);
  const successful = results.find((x) => x.status === 'applied');
  assert.equal(
    JSON.parse((await platform.read()).files['current.json']).releaseId,
    successful.target.releaseId,
  );
});
test('S: candidate export rejects retained test versions even when the current release is candidate', async () => {
  const mixed = mkdtempSync(join(tmpdir(), 'cny-mixed-candidate-')),
    clean = mkdtempSync(join(tmpdir(), 'cny-clean-candidate-'));
  try {
    const a = pack(),
      b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5'], 'candidate'),
      platform = new LocalPublicationPlatform(mixed);
    const first = preparePublicationTransition(null, a.files, a, 'promote');
    await executePublicationTransition(platform, first, confirm(first));
    const next = preparePublicationTransition(await platform.read(), b.files, b, 'promote');
    await executePublicationTransition(platform, next, confirm(next));
    await assert.rejects(
      verifyLocalPublication(mixed, next.snapshot.revision, true),
      /test.*candidate|retained test/,
    );
    const cleanPlatform = new LocalPublicationPlatform(clean),
      reviewed = preparePublicationTransition(null, b.files, b, 'promote');
    await executePublicationTransition(cleanPlatform, reviewed, confirm(reviewed));
    assert.equal(
      (await verifyLocalPublication(clean, reviewed.snapshot.revision, true)).pointer.releaseId,
      b.releaseId,
    );
  } finally {
    rmSync(mixed, { recursive: true, force: true });
    rmSync(clean, { recursive: true, force: true });
  }
});
test('S: explicit native model names do not inherit object properties in the semantic diff', () => {
  const mapped = buildOfficialSnapshot({
    sourceSha: 'd5a84ca10d8599343370c1541828439a56b8dd1b',
    ...readHistoricalOfficialInputs(),
    selection: { constructor: JSON.parse(artifact).selection['kimi-k3.1-pro'] },
  }).artifact;
  const p = buildPublicationPackage(Buffer.from(JSON.stringify(mapped)), {
    models: ['constructor'],
    plugins: {},
    tools: [],
    mode: 'partial',
    purpose: 'test',
  });
  const plan = preparePublicationTransition(null, p.files, p, 'promote');
  assert.deepEqual(plan.diff, [
    {
      partition: 'models',
      key: 'constructor',
      before: null,
      after: {
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)',
      },
    },
  ]);
});
test('S: changing plan or confirmation during permission or claim waits rejects before submission', async () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']);
  for (const boundary of ['canSubmit', 'claim'])
    for (const changeConfirmation of [false, true]) {
      const platform = new Platform(),
        plan = preparePublicationTransition(null, a.files, a, 'promote'),
        approval = confirm(plan);
      const original = platform[boundary].bind(platform);
      platform[boundary] = async (...args) => {
        const result = await original(...args);
        if (changeConfirmation) {
          approval.confirmed = false;
          approval.approvalRef = 'changed-during-await';
        } else {
          const replacement = preparePublicationTransition(null, b.files, b, 'promote');
          plan.snapshot = replacement.snapshot;
          plan.identity = replacement.identity;
          plan.diff = replacement.diff;
        }
        return result;
      };
      await assert.rejects(
        executePublicationTransition(platform, plan, approval),
        /changed|confirmation/,
      );
      assert.equal(await platform.read(), null);
    }
});
test('S: a platform mutating its submitted payload cannot make a different release pass exact readback', async () => {
  const a = pack(),
    b = pack(['kimi-k3.1-pro', 'claude-sonnet-4-5']),
    platform = new Platform();
  const plan = preparePublicationTransition(null, a.files, a, 'promote'),
    wrong = preparePublicationTransition(null, b.files, b, 'promote');
  platform.submit = async (snapshot) => {
    Object.assign(snapshot, structuredClone(wrong.snapshot));
    platform.current = structuredClone(snapshot);
  };
  const result = await executePublicationTransition(platform, plan, confirm(plan));
  assert.equal(result.status, 'unknown');
  assert.equal(result.target.releaseId, a.releaseId);
  assert.equal(JSON.parse((await platform.read()).files['current.json']).releaseId, b.releaseId);
});
test('S: existing unknown operations remain unknown after permission loss or an initial read failure', async () => {
  const p = pack();
  for (const readFails of [false, true]) {
    const platform = new Platform(),
      plan = preparePublicationTransition(null, p.files, p, 'promote');
    platform.submit = async () => {
      throw new Error('ambiguous timeout');
    };
    const first = await executePublicationTransition(platform, plan, confirm(plan));
    assert.equal(first.status, 'unknown');
    assert.equal(await platform.hasAttempt(first.operationId), true);
    platform.permitted = false;
    if (readFails)
      platform.read = async () => {
        throw new Error('initial reconciliation read failed');
      };
    const result = await executePublicationTransition(platform, plan, confirm(plan));
    assert.equal(result.status, 'unknown');
    assert.equal(result.submission, 'unknown');
  }
});
test('S: a stale no-attempt read cannot downgrade another callers unresolved submission', async () => {
  const p = pack();
  for (const readFails of [false, true]) {
    const platform = new Platform(),
      plan = preparePublicationTransition(null, p.files, p, 'promote');
    let captured, release;
    const capturedRead = new Promise((r) => {
        captured = r;
      }),
      delayedRead = new Promise((r) => {
        release = r;
      });
    const lookup = platform.hasAttempt.bind(platform);
    let delayFirst = true;
    platform.hasAttempt = async (operationId) => {
      const observed = await lookup(operationId);
      if (delayFirst) {
        delayFirst = false;
        captured();
        await delayedRead;
      }
      return observed;
    };
    platform.submit = async () => {
      throw new Error('ambiguous accepted request');
    };
    const late = executePublicationTransition(platform, plan, confirm(plan));
    await capturedRead;
    const active = await executePublicationTransition(platform, plan, confirm(plan));
    assert.equal(active.status, 'unknown');
    assert.equal(await lookup(active.operationId), true);
    platform.permitted = false;
    if (readFails)
      platform.read = async () => {
        throw new Error('late initial read failed');
      };
    release();
    const result = await late;
    assert.equal(result.status, 'unknown');
    assert.equal(result.submission, 'unknown');
  }
});
