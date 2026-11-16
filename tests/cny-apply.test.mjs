import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NativePricingAdapter,
  previewArtifact,
  applyArtifact,
} from '../.cache/cny-build/cny/apply.js';
import { buildArtifact } from '../.cache/cny-build/cny/artifact.js';
const artifact = buildArtifact({
  sourceSha: 'd'.repeat(40),
  data: {},
  quotes: [],
  selection: {},
  exclusions: [],
  models: { m: { billing_mode: 'tiered_expr', billing_expr: 'p * 21' } },
  plugins: { m: { video: 'u("tokens") * 21 / 1000000' } },
  tools: { web_search: 70 },
});
const selection = { models: ['m'], plugins: { m: ['video'] }, tools: ['web_search'] };
function mock() {
  const calls = [];
  let pricing = { ModelRatio: 2, 'billing_setting.plugin_billing_expr': { other: 'u("count")' } };
  let tools = { web_search: 10, file_search: 2.5 };
  let conflict = false,
    timeout = false,
    failTools = false,
    badUnits = false,
    breakReadback = false,
    failLiveTools = false,
    optionReads = 0;
  const fetcher = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url: String(url), method, body: init.body && JSON.parse(init.body) });
    if (String(url).includes('model_pricing')) {
      if (method === 'PATCH') {
        if (conflict)
          return Response.json({ success: false, message: 'conflict' }, { status: 409 });
        pricing = JSON.parse(init.body).changes[0].pricing;
        if (timeout) throw new Error('timeout');
        return Response.json({ success: true, data: {} });
      }
      return Response.json({
        success: true,
        data: {
          entries: [{ model_name: 'm', version: 'version-1', configured: pricing }],
          empty_version: 'empty',
        },
      });
    }
    if (method === 'PUT') {
      if (failTools) return Response.json({ success: false, message: 'failed' }, { status: 400 });
      tools = JSON.parse(JSON.parse(init.body).value);
      if (breakReadback) throw new Error('timeout');
      return Response.json({ success: true });
    }
    optionReads++;
    if (failLiveTools && optionReads === 3) throw new Error('offline');
    if (breakReadback && calls.some((c) => c.method === 'PUT')) throw new Error('offline');
    return Response.json({
      success: true,
      data: [
        { key: 'USDExchangeRate', value: badUnits ? '7' : '1' },
        { key: 'QuotaPerUnit', value: '500000' },
        { key: 'tool_price_setting.prices', value: JSON.stringify(tools) },
        { key: 'GroupRatio', value: '{"default":0.8}' },
      ],
    });
  };
  return {
    calls,
    failLiveTools: () => {
      failLiveTools = true;
    },
    breakReadback: () => {
      breakReadback = true;
    },
    badUnits: () => {
      badUnits = true;
    },
    newTool: () => {
      tools.file_search = 9;
    },
    changedTool: () => {
      tools.web_search = 99;
    },
    adapter: new NativePricingAdapter('https://isolated.invalid', fetcher),
    conflict: () => {
      conflict = true;
    },
    timeout: () => {
      timeout = true;
    },
    failTools: () => {
      failTools = true;
    },
  };
}
const confirmation = (plan) => ({
  confirmed: true,
  actor: 'operator',
  target: plan.target,
  artifactId: artifact.id,
  planId: plan.id,
});
test('unconfirmed target cannot write', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, selection);
  await assert.rejects(
    () => applyArtifact(m.adapter, artifact, plan, { ...confirmation(plan), confirmed: false }),
    /confirm/,
  );
  assert.equal(m.calls.filter((c) => c.method !== 'GET').length, 0);
});
test('selected model/plugin fields and tool keys merge into native full drafts with version', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, selection);
  const result = await applyArtifact(m.adapter, artifact, plan, confirmation(plan));
  assert.equal(result.success, true);
  assert.equal(result.items.length, 3);
  const patch = m.calls.find((c) => c.method === 'PATCH').body;
  assert.deepEqual(patch, {
    changes: [
      {
        model_name: 'm',
        expected_version: 'version-1',
        pricing: {
          ModelRatio: 2,
          'billing_setting.billing_mode': 'tiered_expr',
          'billing_setting.billing_expr': 'p * 21',
          'billing_setting.plugin_billing_expr': {
            other: 'u("count")',
            video: 'u("tokens") * 21 / 1000000',
          },
        },
      },
    ],
  });
  assert.deepEqual(m.calls.find((c) => c.method === 'PUT').body, {
    key: 'tool_price_setting.prices',
    value: '{"web_search":70,"file_search":2.5}',
  });
  assert.equal(
    JSON.stringify(m.calls.filter((c) => c.method !== 'GET')).includes('GroupRatio'),
    false,
  );
});
test('version conflict reads back and records failure without force retry', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, { ...selection, tools: [] });
  m.conflict();
  const result = await applyArtifact(m.adapter, artifact, plan, confirmation(plan));
  assert.equal(result.success, false);
  assert.deepEqual(
    result.items.map((i) => i.status),
    ['conflict', 'conflict'],
  );
  assert.equal(m.calls.filter((c) => c.method === 'PATCH').length, 1);
  assert.equal(m.calls.at(-1).method, 'GET');
});
test('timeout reads back committed model, independent tool failure remains partial', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, selection);
  m.timeout();
  m.failTools();
  const result = await applyArtifact(m.adapter, artifact, plan, confirmation(plan));
  assert.equal(result.success, false);
  assert.deepEqual(
    result.items.map((i) => i.status),
    ['applied', 'applied', 'failed'],
  );
  assert.equal(m.calls.filter((c) => c.method === 'PATCH').length, 1);
  assert.equal(m.calls.filter((c) => c.method === 'PUT').length, 1);
  assert.equal(m.calls.at(-1).method, 'GET');
});
test('invalid selection and changed artifact fail before any write', async () => {
  const m = mock();
  await assert.rejects(
    () => previewArtifact(m.adapter, artifact, { ...selection, tools: ['missing'] }),
    /absent/,
  );
  const plan = await previewArtifact(m.adapter, artifact, selection);
  await assert.rejects(
    () =>
      applyArtifact(
        m.adapter,
        { ...artifact, tools: { web_search: 71 } },
        plan,
        confirmation(plan),
      ),
    /confirmation/,
  );
  assert.equal(m.calls.filter((c) => c.method !== 'GET').length, 0);
});
test('target unit preflight fails closed and does not write exchange or quota settings', async () => {
  const m = mock();
  m.badUnits();
  await assert.rejects(() => previewArtifact(m.adapter, artifact, selection), /unit/);
  assert.equal(m.calls.filter((c) => c.method !== 'GET').length, 0);
});
test('tool full-map application preserves unselected keys changed after preview', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, {
    models: [],
    plugins: {},
    tools: ['web_search'],
  });
  m.newTool();
  const result = await applyArtifact(m.adapter, artifact, plan, confirmation(plan));
  assert.equal(result.success, true);
  assert.equal(JSON.parse(m.calls.find((c) => c.method === 'PUT').body.value).file_search, 9);
});
test('selected tool changed since preview conflicts without writing', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, {
    models: [],
    plugins: {},
    tools: ['web_search'],
  });
  m.changedTool();
  const result = await applyArtifact(m.adapter, artifact, plan, confirmation(plan));
  assert.equal(result.success, false);
  assert.equal(result.items[0].status, 'conflict');
  assert.equal(m.calls.filter((c) => c.method !== 'GET').length, 0);
});
test('unit setting changes after preview invalidate confirmation before write', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, selection);
  m.badUnits();
  await assert.rejects(() => applyArtifact(m.adapter, artifact, plan, confirmation(plan)), /unit/);
  assert.equal(m.calls.filter((c) => c.method !== 'GET').length, 0);
});
test('failed readback leaves item unknown without retry or rollback', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, {
    models: [],
    plugins: {},
    tools: ['web_search'],
  });
  m.breakReadback();
  const result = await applyArtifact(m.adapter, artifact, plan, confirmation(plan));
  assert.equal(result.success, false);
  assert.equal(result.items[0].status, 'unknown');
  assert.equal(m.calls.filter((c) => c.method === 'PUT').length, 1);
});
test('tool prewrite read failure still returns already-applied model receipts', async () => {
  const m = mock();
  const plan = await previewArtifact(m.adapter, artifact, selection);
  m.failLiveTools();
  const result = await applyArtifact(m.adapter, artifact, plan, confirmation(plan));
  assert.equal(result.success, false);
  assert.deepEqual(
    result.items.map((i) => i.status),
    ['applied', 'applied', 'unknown'],
  );
  assert.equal(m.calls.filter((c) => c.method === 'PUT').length, 0);
});
test('QA F3: empty plugin selections never add unselected native PATCH requests',async()=>{
 const m=mock();
 const plan=await previewArtifact(m.adapter,artifact,{models:['m'],plugins:{unselected:[]},tools:[]});
 const result=await applyArtifact(m.adapter,artifact,plan,confirmation(plan));
 assert.deepEqual(m.calls.filter(c=>c.method==='PATCH').flatMap(c=>c.body.changes.map(x=>x.model_name)),['m']);
 assert.deepEqual(result.items,[{partition:'models',key:'m',status:'applied'}]);
 assert.equal(result.success,true);
});
