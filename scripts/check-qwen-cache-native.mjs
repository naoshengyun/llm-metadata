#!/usr/bin/env node
// Offline Qwen cache metering check against the exact official New API commit.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generateCny } from '../.cache/cny-build/cny/generate.js';

const COMMIT = 'f2aa91232ed3e5878a614762ace6736a2b74257f';
const { values } = parseArgs({
  options: {
    'new-api': { type: 'string' },
    candidate: { type: 'string' },
    go: { type: 'string', default: 'go' },
  },
});
if (!values['new-api'] || !values.candidate)
  throw new Error('Usage: node scripts/check-qwen-cache-native.mjs --new-api /local/new-api --candidate /local/candidate [--go /exact/go]');
const candidate = resolve(values.candidate);
const official = JSON.parse(readFileSync('data/cny/official-catalog.json', 'utf8'));
const ratio = JSON.parse(readFileSync(join(candidate, 'api/newapi/ratio_config.json'), 'utf8'));
const flashExpression = ratio.data.billing_expr['qwen3.8-flash'];
assert.equal(
  flashExpression,
  'tier("standard", p * 0.8 + cr * 0.1 + cc * 1.25 + c * 2.7)',
);

function expressionFor(model, mode) {
  const record = official.records.find(
    (quote) => quote.id === `dashscope--${model}--cn-beijing-online-original-${mode}`,
  );
  assert.ok(record, model + ' ' + mode);
  const result = generateCny({
    upstream: { providers: {} },
    records: [record],
    selection: { [model]: record.id },
  });
  if (!result.models[model]) throw new Error(JSON.stringify(result.diagnostics));
  return { record, expression: result.models[model].billing_expr };
}
assert.equal(expressionFor('qwen3.8-flash', 'explicit').expression, flashExpression);

const vectors = [];
const scenarios = {
  ordinary: { prompt: 1000, read: 0, write: 0, completion: 100, explicit: false },
  creation: { prompt: 1500, read: 0, write: 1200, completion: 100, explicit: true },
  'pure-hit': { prompt: 1200, read: 1200, write: 0, completion: 100, explicit: true },
  'partial-hit': { prompt: 1510, read: 1200, write: 300, completion: 100, explicit: true },
};
const probe = {
  chat: 'param("messages.0.content.0.cache_control.type") == "ephemeral" ? 1 : 0',
  responses: 'header("x-dashscope-session-cache") == "enable" ? 1 : 0',
  anthropic: 'param("system.0.cache_control.type") == "ephemeral" ? 1 : 0',
};
function requestIdentity(protocol, explicit) {
  if (protocol === 'responses')
    return { body: {}, headers: explicit ? { 'x-dashscope-session-cache': 'enable' } : {} };
  if (!explicit) return { body: { messages: [] }, headers: {} };
  if (protocol === 'chat')
    return {
      body: {
        messages: [
          { role: 'system', content: [{ type: 'text', text: 'A', cache_control: { type: 'ephemeral' } }] },
        ],
      },
      headers: {},
    };
  return {
    body: { system: [{ type: 'text', text: 'A', cache_control: { type: 'ephemeral' } }] },
    headers: {},
  };
}
function usageFor(protocol, scenario) {
  const common = { cached_tokens: scenario.read };
  if (scenario.write) {
    // Three aliases deliberately carry the same count: the native total must use max, not sum.
    common.cache_creation_input_tokens = scenario.write;
    common.cache_write_tokens = scenario.write;
    common.cached_creation_tokens = scenario.write;
  }
  if (protocol === 'responses')
    return {
      input_tokens: scenario.prompt,
      output_tokens: scenario.completion,
      input_tokens_details: common,
    };
  const usage = {
    prompt_tokens: scenario.prompt,
    completion_tokens: scenario.completion,
    prompt_tokens_details: common,
  };
  if (protocol === 'anthropic') {
    usage.prompt_tokens = scenario.prompt - scenario.read - scenario.write;
    usage.usage_semantic = 'anthropic';
  }
  return usage;
}
function addUsageVector(protocol, name, scenario, event) {
  const identity = requestIdentity(protocol, scenario.explicit);
  const p = scenario.prompt - scenario.read - scenario.write;
  vectors.push({
    name: `${protocol}:${event}:${name}`,
    protocol,
    event,
    expression: flashExpression,
    modeProbe: probe[protocol],
    usage: usageFor(protocol, scenario),
    requestBody: identity.body,
    headers: identity.headers,
    expected: {
      P: p,
      C: scenario.completion,
      CR: scenario.read,
      CC: scenario.write,
      Len: scenario.prompt,
      amount: p * 0.8 + scenario.read * 0.1 + scenario.write * 1.25 + scenario.completion * 2.7,
      modeProbe: scenario.explicit ? 1 : 0,
    },
  });
}
for (const protocol of ['chat', 'responses', 'anthropic']) {
  for (const [name, scenario] of Object.entries(scenarios)) {
    addUsageVector(protocol, name, scenario, 'final');
    addUsageVector(protocol, name, scenario, 'stream-final');
  }
  addUsageVector(
    protocol,
    'missing-creation-not-inferred',
    { prompt: 1500, read: 0, write: 0, completion: 100, explicit: true },
    'final',
  );
}

const reviewModels = [
  'qwen-doc-turbo',
  'qwen-flash',
  'qwen-plus',
  'qwen3-coder-flash',
  'qwen3-vl-plus',
  'qwen3.7-flash',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.8-max',
];
for (const model of reviewModels) {
  const implicit = expressionFor(model, 'implicit');
  const explicit = expressionFor(model, 'explicit');
  const rows = explicit.record.cost.tiers
    ? [
        { cost: explicit.record.cost, len: explicit.record.cost.tiers[0].tier.size },
        ...explicit.record.cost.tiers.map((tier) => ({ cost: tier, len: tier.tier.size + 1 })),
      ]
    : [{ cost: explicit.record.cost, len: 1000 }];
  for (const [index, row] of rows.entries()) {
    const params = { P: 1000, C: 0, CR: 100, CC: 100, Len: row.len };
    vectors.push({
      name: `candidate-tier:${model}:${index}:${row.len}`,
      protocol: 'direct',
      event: 'tier-boundary',
      expression: explicit.expression,
      direct: params,
      expected: {
        ...params,
        amount:
          params.P * row.cost.input +
          params.CR * row.cost.cache_read +
          params.CC * row.cost.cache_write,
      },
    });
  }
  const params = { P: 0, C: 0, CR: 1200, CC: 0, Len: 1200 };
  for (const [mode, item] of [
    ['implicit', implicit],
    ['explicit', explicit],
  ]) {
    vectors.push({
      name: `mode-gap:${model}:${mode}-pure-hit`,
      protocol: 'direct',
      event: 'same-usage-different-mode',
      expression: item.expression,
      direct: params,
      expected: { ...params, amount: params.CR * item.record.cost.cache_read },
    });
  }
}

const directory = mkdtempSync(join(tmpdir(), 'qwen-cache-native-'));
const archive = join(directory, 'new-api.tar');
execFileSync('git', ['-C', resolve(values['new-api']), 'archive', COMMIT, '--output', archive]);
execFileSync('tar', ['-xf', archive, '-C', directory]);
mkdirSync(join(directory, 'cmd/qwen-cache-check'), { recursive: true });
writeFileSync(join(directory, 'vectors.json'), JSON.stringify(vectors));
writeFileSync(
  join(directory, 'cmd/qwen-cache-check/main.go'),
  `package main
import (
 "encoding/json"
 "fmt"
 "math"
 "os"
 b "github.com/QuantumNous/new-api/pkg/billingexpr"
 "github.com/QuantumNous/new-api/relaykit/dto"
 "github.com/QuantumNous/new-api/service"
)
type expected struct {
 P float64
 C float64
 CR float64
 CC float64
 Len float64
 Amount float64
 ModeProbe *float64
}
type vector struct {
 Name string
 Protocol string
 Event string
 Expression string
 ModeProbe string
 Usage json.RawMessage
 Direct *b.TokenParams
 RequestBody json.RawMessage
 Headers map[string]string
 Expected expected
}
func closeEnough(a,b float64) bool { return math.Abs(a-b) <= 0.000000001 }
func main() {
 data,err:=os.ReadFile("vectors.json");if err!=nil{panic(err)}
 var vectors []vector;if err:=json.Unmarshal(data,&vectors);err!=nil{panic(err)}
 results:=make([]map[string]any,0,len(vectors))
 for _,v:=range vectors {
  var params b.TokenParams
  if v.Direct != nil { params=*v.Direct } else {
   var usage dto.Usage
   if v.Protocol=="responses" {
    var src dto.Usage
    if err:=json.Unmarshal(v.Usage,&src);err!=nil{panic(fmt.Sprintf("%s: %v",v.Name,err))}
    service.ApplyResponsesUsage(&usage,&src)
   } else if err:=json.Unmarshal(v.Usage,&usage);err!=nil{panic(fmt.Sprintf("%s: %v",v.Name,err))}
   params=service.BuildTieredTokenParams(&usage,usage.UsageSemantic=="anthropic",map[string]bool{"p":true,"c":true,"cr":true,"cc":true,"len":true})
  }
  if !closeEnough(params.P,v.Expected.P)||!closeEnough(params.C,v.Expected.C)||!closeEnough(params.CR,v.Expected.CR)||!closeEnough(params.CC,v.Expected.CC)||!closeEnough(params.Len,v.Expected.Len) {
   panic(fmt.Sprintf("%s params: got %+v want %+v",v.Name,params,v.Expected))
  }
  req:=b.RequestInput{Body:v.RequestBody,Headers:v.Headers}
  amount,trace,err:=b.RunExprWithRequest(v.Expression,params,req);if err!=nil{panic(fmt.Sprintf("%s: %v",v.Name,err))}
  if !closeEnough(amount,v.Expected.Amount){panic(fmt.Sprintf("%s amount: got %v want %v",v.Name,amount,v.Expected.Amount))}
  result:=map[string]any{"name":v.Name,"protocol":v.Protocol,"event":v.Event,"amount":amount,"matchedTier":trace.MatchedTier,"params":params}
  if v.Expected.ModeProbe!=nil {
   probe,_,err:=b.RunExprWithRequest(v.ModeProbe,params,req);if err!=nil{panic(fmt.Sprintf("%s probe: %v",v.Name,err))}
   if !closeEnough(probe,*v.Expected.ModeProbe){panic(fmt.Sprintf("%s mode probe: got %v want %v",v.Name,probe,*v.Expected.ModeProbe))}
   result["fixtureModeProbe"]=probe
  }
  results=append(results,result)
 }
 if err:=json.NewEncoder(os.Stdout).Encode(results);err!=nil{panic(err)}
}
`,
);
try {
  const output = execFileSync(values.go, ['run', './cmd/qwen-cache-check'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, GOCACHE: join(tmpdir(), 'cny-go-build-cache') },
    timeout: 180000,
  });
  const results = JSON.parse(output);
  for (const model of reviewModels) {
    const implicit = results.find((row) => row.name === `mode-gap:${model}:implicit-pure-hit`);
    const explicit = results.find((row) => row.name === `mode-gap:${model}:explicit-pure-hit`);
    assert.deepEqual(implicit.params, explicit.params, model + ' must share indistinguishable native usage');
    assert.ok(explicit.amount < implicit.amount, model + ' explicit pure-hit would be cheaper');
  }
  console.log(
    JSON.stringify({
      kind: 'offline-qwen-cache-native',
      commit: COMMIT,
      status: 'passed',
      totalCases: results.length,
      protocolUsageCases: 27,
      tierBoundaryCases: results.filter((row) => row.event === 'tier-boundary').length,
      ambiguousPureHitPairs: reviewModels.length,
      automaticCacheModeRouting: false,
      modeBoundary:
        'Protocol-specific request markers exist, but TokenParams has no trusted implicit/explicit mode. Fixed fixture probe paths are not a general router; cc=0 is ambiguous for pure hits.',
      nativeInstance: false,
      supplierCalls: false,
      productionBillingVerified: false,
      results,
    }) + '\n',
  );
} catch (error) {
  process.stderr.write(
    JSON.stringify({ kind: 'offline-qwen-cache-native', commit: COMMIT, status: 'failed', error: error.message }) + '\n',
  );
  process.exitCode = 1;
}
