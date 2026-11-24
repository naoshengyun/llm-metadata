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
function payloadFor(protocol, scenario, event) {
  const stream = event === 'stream-final';
  if (protocol === 'anthropic') {
    const usage = {
      input_tokens: scenario.prompt - scenario.read - scenario.write,
      output_tokens: scenario.completion,
      cache_read_input_tokens: scenario.read,
      ...(scenario.write && { cache_creation_input_tokens: scenario.write }),
    };
    if (!stream)
      return JSON.stringify({
        id: 'msg_qwen_fixture',
        type: 'message',
        role: 'assistant',
        model: 'qwen3.8-flash',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage,
      });
    return [
      {
        type: 'message_start',
        message: {
          id: 'msg_qwen_fixture',
          type: 'message',
          role: 'assistant',
          model: 'qwen3.8-flash',
          content: [],
          usage: { ...usage, output_tokens: 0 },
        },
      },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: scenario.completion } },
      { type: 'message_stop' },
    ]
      .map((item) => 'data: ' + JSON.stringify(item) + '\n\n')
      .join('');
  }
  const details = { cached_tokens: scenario.read };
  if (scenario.write) {
    // Three aliases deliberately carry the same count: the native total must use max, not sum.
    details.cache_creation_input_tokens = scenario.write;
    details.cache_write_tokens = scenario.write;
    details.cached_creation_tokens = scenario.write;
  }
  if (protocol === 'responses') {
    const response = {
      id: 'resp_qwen_fixture',
      model: 'qwen3.8-flash',
      status: 'completed',
      output: [],
      usage: {
        input_tokens: scenario.prompt,
        output_tokens: scenario.completion,
        total_tokens: scenario.prompt + scenario.completion,
        input_tokens_details: details,
      },
    };
    return stream
      ? 'data: ' + JSON.stringify({ type: 'response.completed', response }) + '\n\n'
      : JSON.stringify(response);
  }
  const usage = {
    prompt_tokens: scenario.prompt,
    completion_tokens: scenario.completion,
    total_tokens: scenario.prompt + scenario.completion,
    prompt_tokens_details: details,
  };
  if (!stream)
    return JSON.stringify({
      id: 'chat_qwen_fixture',
      object: 'chat.completion',
      created: 1,
      model: 'qwen3.8-flash',
      choices: [
        { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
      ],
      usage,
    });
  const first = {
    id: 'chat_qwen_fixture',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'qwen3.8-flash',
    choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' } }],
  };
  const last = {
    ...first,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage,
  };
  return `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`;
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
    payload: payloadFor(protocol, scenario, event),
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
 "io"
 "math"
 "net/http"
 "net/http/httptest"
 "os"
 "strings"
 "time"
 b "github.com/QuantumNous/new-api/pkg/billingexpr"
 "github.com/QuantumNous/new-api/constant"
 "github.com/QuantumNous/new-api/relay/channel/claude"
 "github.com/QuantumNous/new-api/relay/channel/openai"
 relaycommon "github.com/QuantumNous/new-api/relay/common"
 "github.com/QuantumNous/new-api/relaykit/dto"
 relaytypes "github.com/QuantumNous/new-api/relaykit/types"
 "github.com/QuantumNous/new-api/service"
 "github.com/gin-gonic/gin"
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
 Payload string
 Direct *b.TokenParams
 RequestBody json.RawMessage
 Headers map[string]string
 Expected expected
}
func closeEnough(a,b float64) bool { return math.Abs(a-b) <= 0.000000001 }
func handlerUsage(v vector) (*dto.Usage,string,error) {
 gin.SetMode(gin.TestMode)
 constant.StreamingTimeout=1
 writer:=httptest.NewRecorder()
 c,_:=gin.CreateTestContext(writer)
 c.Request=httptest.NewRequest(http.MethodPost,"/fixture",nil)
 format:=relaytypes.RelayFormatOpenAI
 if v.Protocol=="responses" { format=relaytypes.RelayFormatOpenAIResponses }
 if v.Protocol=="anthropic" { format=relaytypes.RelayFormatClaude }
 info:=&relaycommon.RelayInfo{
  OriginModelName:"qwen3.8-flash",
  IsStream:v.Event=="stream-final",
  DisablePing:true,
  StartTime:time.Now(),
  RelayFormat:format,
  ChannelMeta:&relaycommon.ChannelMeta{UpstreamModelName:"qwen3.8-flash"},
 }
 info.SetEstimatePromptTokens(int(v.Expected.Len))
 contentType:="application/json"
 if v.Event=="stream-final" { contentType="text/event-stream" }
 resp:=&http.Response{StatusCode:http.StatusOK,Body:io.NopCloser(strings.NewReader(v.Payload)),Header:http.Header{"Content-Type":{contentType}}}
 var usage *dto.Usage
 var apiErr *relaytypes.NewAPIError
 handler:=""
 switch v.Protocol {
 case "chat":
  if v.Event=="stream-final" { handler="openai.OaiStreamHandler";usage,apiErr=openai.OaiStreamHandler(c,info,resp) } else { handler="openai.OpenaiHandler";usage,apiErr=openai.OpenaiHandler(c,info,resp) }
 case "responses":
  if v.Event=="stream-final" { handler="openai.OaiResponsesStreamHandler";usage,apiErr=openai.OaiResponsesStreamHandler(c,info,resp) } else { handler="openai.OaiResponsesHandler";usage,apiErr=openai.OaiResponsesHandler(c,info,resp) }
 case "anthropic":
  if v.Event=="stream-final" { handler="claude.ClaudeStreamHandler";usage,apiErr=claude.ClaudeStreamHandler(c,resp,info) } else { handler="claude.ClaudeHandler";usage,apiErr=claude.ClaudeHandler(c,resp,info) }
 default: panic("unknown protocol: "+v.Protocol)
 }
 if apiErr!=nil { return nil,handler,apiErr }
 return usage,handler,nil
}
func main() {
 data,err:=os.ReadFile("vectors.json");if err!=nil{panic(err)}
 var vectors []vector;if err:=json.Unmarshal(data,&vectors);err!=nil{panic(err)}
 results:=make([]map[string]any,0,len(vectors))
 for _,v:=range vectors {
  var params b.TokenParams
  handler:="direct-params"
  if v.Direct != nil { params=*v.Direct } else {
   usage,handlerName,err:=handlerUsage(v)
   if err!=nil{panic(fmt.Sprintf("%s %s: %v",v.Name,handlerName,err))}
   handler=handlerName
   params=service.BuildTieredTokenParams(usage,usage.UsageSemantic=="anthropic",map[string]bool{"p":true,"c":true,"cr":true,"cc":true,"len":true})
  }
  if !closeEnough(params.P,v.Expected.P)||!closeEnough(params.C,v.Expected.C)||!closeEnough(params.CR,v.Expected.CR)||!closeEnough(params.CC,v.Expected.CC)||!closeEnough(params.Len,v.Expected.Len) {
   panic(fmt.Sprintf("%s params: got %+v want %+v",v.Name,params,v.Expected))
  }
  req:=b.RequestInput{Body:v.RequestBody,Headers:v.Headers}
  amount,trace,err:=b.RunExprWithRequest(v.Expression,params,req);if err!=nil{panic(fmt.Sprintf("%s: %v",v.Name,err))}
  if !closeEnough(amount,v.Expected.Amount){panic(fmt.Sprintf("%s amount: got %v want %v",v.Name,amount,v.Expected.Amount))}
  result:=map[string]any{"name":v.Name,"protocol":v.Protocol,"event":v.Event,"handler":handler,"amount":amount,"matchedTier":trace.MatchedTier,"params":params}
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
  const jsonLine = output
    .trim()
    .split('\n')
    .find((line) => line.startsWith('[{') && line.includes('"name"'));
  assert.ok(jsonLine, 'Native harness must emit one JSON result array: ' + output.slice(-2000));
  const results = JSON.parse(jsonLine);
  for (const protocol of ['chat', 'responses', 'anthropic']) {
    const creation = results.find((row) => row.name === `${protocol}:final:creation`);
    assert.equal(creation.params.CC, 1200, protocol + ' creation must not be omitted');
    assert.equal(creation.amount, 2010, protocol + ' creation amount');
    const partial = results.find((row) => row.name === `${protocol}:final:partial-hit`);
    assert.equal(partial.params.CC, 300, protocol + ' aliases use max, not sum');
    assert.equal(partial.params.P, 10, protocol + ' creation/read do not double-count input');
    assert.equal(partial.amount, 773, protocol + ' partial amount');
    assert.notEqual(partial.amount, 1973, protocol + ' rejects double-counted input');
    const missing = results.find((row) => row.name === `${protocol}:final:missing-creation-not-inferred`);
    assert.equal(missing.params.CC, 0, protocol + ' missing creation stays zero');
    assert.equal(missing.amount, 1470, protocol + ' missing creation is not inferred');
    for (const scenario of Object.keys(scenarios)) {
      const sync = results.find((row) => row.name === `${protocol}:final:${scenario}`);
      const stream = results.find((row) => row.name === `${protocol}:stream-final:${scenario}`);
      assert.deepEqual(stream.params, sync.params, `${protocol} ${scenario} stream params`);
      assert.equal(stream.amount, sync.amount, `${protocol} ${scenario} stream amount`);
      assert.notEqual(sync.handler, stream.handler, `${protocol} ${scenario} uses both real handlers`);
    }
  }
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
      wireHandlerCases: 27,
      realHandlers: [
        'openai.OpenaiHandler',
        'openai.OaiStreamHandler',
        'openai.OaiResponsesHandler',
        'openai.OaiResponsesStreamHandler',
        'claude.ClaudeHandler',
        'claude.ClaudeStreamHandler',
      ],
      fixturesAreProductionReceipts: false,
      negativeGuards: [
        'missing creation is not inferred',
        'creation aliases use max rather than sum',
        'creation/read tokens are not double-counted as ordinary input',
        'sync and stream handlers return identical normalized usage and amounts',
      ],
      tierBoundaryCases: results.filter((row) => row.event === 'tier-boundary').length,
      ambiguousPureHitPairs: reviewModels.length,
      automaticCacheModeRouting: false,
      modeBoundary:
        'Unified explicit customer pricing needs no New API core change. Exact per-request implicit/explicit matching needs a trusted mode: TokenParams lacks it, fixed fixture probe paths are not a general router, and cc=0 is ambiguous for pure hits.',
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
