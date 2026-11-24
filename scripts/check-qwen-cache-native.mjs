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
const scenarioNames = ['ordinary', 'creation', 'pure-hit', 'partial-hit'];
function scenarioFor(name, prompt) {
  const common = { prompt, completion: 100, explicit: name !== 'ordinary' };
  if (name === 'ordinary') return { ...common, read: 0, write: 0 };
  if (name === 'creation') return { ...common, read: 0, write: Math.floor(prompt * 0.8) };
  if (name === 'pure-hit') return { ...common, read: prompt, write: 0 };
  if (name === 'partial-hit')
    return { ...common, read: Math.floor(prompt * 0.6), write: Math.floor(prompt * 0.2) };
  throw new Error('Unknown scenario: ' + name);
}
function tierRows(record) {
  return record.cost.tiers
    ? [
        { cost: record.cost, len: record.cost.tiers[0].tier.size },
        ...record.cost.tiers.map((tier) => ({ cost: tier, len: tier.tier.size + 1 })),
      ]
    : [{ cost: record.cost, len: 6000 }];
}
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
function payloadFor(protocol, model, scenario, event) {
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
        model,
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
          model,
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
      model,
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
      model,
      choices: [
        { index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' },
      ],
      usage,
    });
  const first = {
    id: 'chat_qwen_fixture',
    object: 'chat.completion.chunk',
    created: 1,
    model,
    choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' } }],
  };
  const last = {
    ...first,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage,
  };
  return `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(last)}\n\ndata: [DONE]\n\n`;
}
function addUsageVector(protocol, model, item, row, name, scenario, event) {
  const minimum = item.record.conditions.cacheMinimumInputTokens;
  assert.ok(scenario.read === 0 || scenario.read >= minimum, `${model} ${name} read meets ${minimum} minimum`);
  assert.ok(scenario.write === 0 || scenario.write >= minimum, `${model} ${name} write meets ${minimum} minimum`);
  const identity = requestIdentity(protocol, scenario.explicit);
  const p = scenario.prompt - scenario.read - scenario.write;
  vectors.push({
    name: `${model}:${protocol}:${event}:${name}:${scenario.prompt}`,
    model,
    protocol,
    event,
    expression: item.expression,
    modeProbe: probe[protocol],
    payload: payloadFor(protocol, model, scenario, event),
    requestBody: identity.body,
    headers: identity.headers,
    expected: {
      P: p,
      C: scenario.completion,
      CR: scenario.read,
      CC: scenario.write,
      Len: scenario.prompt,
      amount:
        p * row.cost.input +
        scenario.read * row.cost.cache_read +
        scenario.write * row.cost.cache_write +
        scenario.completion * row.cost.output,
      modeProbe: scenario.explicit ? 1 : 0,
    },
  });
}
for (const model of reviewModels) {
  const implicit = expressionFor(model, 'implicit');
  const explicit = expressionFor(model, 'explicit');
  assert.equal(ratio.data.billing_expr[model], explicit.expression, model + ' selected explicit expression');
  const rows = tierRows(explicit.record);
  for (const row of rows) {
    for (const protocol of ['chat', 'responses', 'anthropic']) {
      for (const name of scenarioNames) {
        const scenario = scenarioFor(name, row.len);
        addUsageVector(protocol, model, explicit, row, name, scenario, 'final');
        addUsageVector(protocol, model, explicit, row, name, scenario, 'stream-final');
      }
    }
  }
  for (const protocol of ['chat', 'responses', 'anthropic']) {
    addUsageVector(
      protocol,
      model,
      explicit,
      rows[0],
      'missing-creation-not-inferred',
      { prompt: 1500, read: 0, write: 0, completion: 100, explicit: true },
      'final',
    );
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
 Model string
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
  OriginModelName:v.Model,
  IsStream:v.Event=="stream-final",
  DisablePing:true,
  StartTime:time.Now(),
  RelayFormat:format,
  ChannelMeta:&relaycommon.ChannelMeta{UpstreamModelName:v.Model},
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
  result:=map[string]any{"name":v.Name,"model":v.Model,"protocol":v.Protocol,"event":v.Event,"handler":handler,"amount":amount,"matchedTier":trace.MatchedTier,"params":params}
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
  for (const model of reviewModels) {
    const explicit = expressionFor(model, 'explicit');
    const rows = tierRows(explicit.record);
    for (const row of rows) {
      for (const protocol of ['chat', 'responses', 'anthropic']) {
        for (const name of scenarioNames) {
          const scenario = scenarioFor(name, row.len);
          const sync = results.find(
            (result) => result.name === `${model}:${protocol}:final:${name}:${row.len}`,
          );
          const stream = results.find(
            (result) => result.name === `${model}:${protocol}:stream-final:${name}:${row.len}`,
          );
          assert.ok(sync && stream, `${model} ${protocol} ${name} ${row.len} real handler results`);
          assert.equal(sync.params.P + sync.params.CR + sync.params.CC, row.len, model + ' exclusive input components');
          assert.equal(sync.params.CC, scenario.write, model + ' creation aliases use max, not sum');
          assert.deepEqual(stream.params, sync.params, `${model} ${protocol} ${name} stream params`);
          assert.equal(stream.amount, sync.amount, `${model} ${protocol} ${name} stream amount`);
          assert.notEqual(sync.handler, stream.handler, `${model} ${protocol} ${name} uses both real handlers`);
          if (name === 'partial-hit') {
            const doubleCharged =
              row.len * row.cost.input +
              scenario.read * row.cost.cache_read +
              scenario.write * row.cost.cache_write +
              scenario.completion * row.cost.output;
            assert.ok(sync.amount < doubleCharged, model + ' rejects duplicate ordinary input charging');
          }
        }
        const missing = results.find(
          (result) => result.name === `${model}:${protocol}:final:missing-creation-not-inferred:1500`,
        );
        assert.equal(missing.params.CC, 0, model + ' missing creation stays zero');
        assert.equal(
          missing.amount,
          1500 * rows[0].cost.input + 100 * rows[0].cost.output,
          model + ' missing creation is not inferred',
        );
      }
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
      protocolUsageCases: results.filter((row) => row.protocol !== 'direct').length,
      wireHandlerCases: results.filter((row) => row.protocol !== 'direct').length,
      selectedExplicitModels: reviewModels,
      realHandlers: [
        'openai.OpenaiHandler',
        'openai.OaiStreamHandler',
        'openai.OaiResponsesHandler',
        'openai.OaiResponsesStreamHandler',
        'claude.ClaudeHandler',
        'claude.ClaudeStreamHandler',
      ],
      fixturesAreProductionReceipts: false,
      officialCacheMinimumEnforced: true,
      cacheMinimumInputTokens: 1024,
      negativeGuards: [
        'missing creation is not inferred',
        'creation aliases use max rather than sum',
        'creation/read tokens are not double-counted as ordinary input',
        'sync and stream handlers return identical normalized usage and amounts',
      ],
      tierBoundaryCases: reviewModels.reduce(
        (total, model) => total + tierRows(expressionFor(model, 'explicit').record).length,
        0,
      ),
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
