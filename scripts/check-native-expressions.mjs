#!/usr/bin/env node
// Offline public-parser check against the exact official commit; never starts a gateway.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generateCny } from '../.cache/cny-build/cny/generate.js';
import { compileTask } from '../.cache/cny-build/cny/media.js';
const COMMIT = 'f2aa91232ed3e5878a614762ace6736a2b74257f';
const { values } = parseArgs({ options: { 'new-api': { type: 'string' }, go: { type: 'string', default: 'go' } } });
if (!values['new-api']) throw new Error('Usage: node scripts/check-native-expressions.mjs --new-api /local/new-api [--go /exact/go]');
const directory = mkdtempSync(join(tmpdir(), 'cny-rc50-parser-'));
const archive = join(directory, 'rc50.tar');
execFileSync('git', ['-C', resolve(values['new-api']), 'archive', COMMIT, '--output', archive]);
execFileSync('tar', ['-xf', archive, '-C', directory]);
const cost = { input: 3, output: 15, input_image: 5, output_image: 40, cache_read_image: 1, cache_write: 4, cache_write_1h: 6, tiers: [{ tier: { size: 200000 }, input: 6, output: 30, input_image: 10 }] };
function expression(cost, required = ['input', 'output']) {
  const result = generateCny({ upstream: {}, records: [{ id: 'fixture', provider: 'foreign', model: 'fixture', priceList: 'synthetic-parser-fixture', origin: 'foreign', currency: 'USD', source: { url: 'https://example.invalid/synthetic', checkedAt: '2026-11-16' }, required, cost }], selection: { fixture: 'fixture' } });
  if (!result.models.fixture) throw new Error(JSON.stringify(result.diagnostics));
  return result.models.fixture.billing_expr;
}
const token = expression(cost);
const fixed = expression({ per_image: 0.2 }, ['per_image']);
const task = compileTask({ plugin: 'doubao', model: 'doubao-seedance-2-0-fast-260128', tiers: [{ name: 'base', charges: [{ usageKey: 'tokens', amount: 3, unit: 'per_million_tokens', currency: 'USD' }] }] });
if (task.status !== 'ready') throw new Error(JSON.stringify(task));
const vectors = [
  ...[199999, 200000, 200001].map(len => ({ name: `threshold-${len}`, expression: token, tokens: { P: 1000, C: 50, Len: len, CC: 10, CC1h: 20, Img: 30, ImgCR: 40, ImgO: 60 }, expected: len <= 200000 ? 45500 : 72800, tier: len <= 200000 ? '0_200k' : '200k_plus' })),
  { name: 'short-cache-TTL', expression: token, tokens: { CC: 1 }, expected: 28 },
  { name: 'one-hour-cache-TTL', expression: token, tokens: { CC1h: 1 }, expected: 42 },
  { name: 'image-input', expression: token, tokens: { Img: 1 }, expected: 35 },
  { name: 'image-cache-read', expression: token, tokens: { ImgCR: 1 }, expected: 7 },
  { name: 'image-output', expression: token, tokens: { ImgO: 1 }, expected: 280 },
  // Original USD 0.2 / image converts once to CNY 1.4; three images = 4.2 CNY.
  { name: 'fixed-three-images', expression: fixed, imageCount: 3, expected: 4200000 },
  { name: 'task-per-million-tokens', expression: task.expression, usage: { tokens: 1000 }, expected: 0.021, task: true, groupRatio: 0.8, expectedQuota: 8400 },
  { name: 'token-quota-one', expression: expression({input: 3, output: 15}), tokens: {P: 1000}, expected: 21000, groupRatio: 1, expectedQuota: 10500 },
  { name: 'token-quota-point-eight', expression: expression({input: 3, output: 15}), tokens: {P: 1000}, expected: 21000, groupRatio: 0.8, expectedQuota: 8400 },
];
mkdirSync(join(directory, 'cmd/cny-expression-check'), { recursive: true });
writeFileSync(join(directory, 'vectors.json'), JSON.stringify(vectors));
writeFileSync(join(directory, 'cmd/cny-expression-check/main.go'), `package main
import (
 "encoding/json"
 "fmt"
 "math"
 "os"
 b "github.com/QuantumNous/new-api/pkg/billingexpr"
)
type vector struct {
 Name string
 Expression string
 Tokens b.TokenParams
 ImageCount *int
 Usage map[string]any
 Expected float64
 Tier string
 Task bool
 GroupRatio float64
 ExpectedQuota *int
}
func main() {
 data, err := os.ReadFile("vectors.json"); if err != nil { panic(err) }
 var vectors []vector; if err := json.Unmarshal(data, &vectors); err != nil { panic(err) }
 results := make([]map[string]any,0,len(vectors))
 for _, v := range vectors {
  req := b.RequestInput{Usage:v.Usage,ImageCount:v.ImageCount}
  var amount float64; var trace b.TraceResult; var err error
  if v.Usage != nil || v.ImageCount != nil { amount,trace,err = b.RunExprWithRequest(v.Expression,v.Tokens,req) } else { amount,trace,err = b.RunExpr(v.Expression,v.Tokens) }
  if err != nil { panic(fmt.Sprintf("%s: %v",v.Name,err)) }
  if math.Abs(amount-v.Expected) > 0.000000001 { panic(fmt.Sprintf("%s: got %v want %v",v.Name,amount,v.Expected)) }
  if v.Tier != "" && trace.MatchedTier != v.Tier { panic(fmt.Sprintf("%s: got tier %s want %s",v.Name,trace.MatchedTier,v.Tier)) }
  result := map[string]any{"name":v.Name,"amount":amount,"matchedTier":trace.MatchedTier}
  if v.ExpectedQuota != nil {
   quota,err := b.ComputeTieredQuotaWithRequest(&b.BillingSnapshot{ExprString:v.Expression,ExprHash:b.ExprHashString(v.Expression),GroupRatio:v.GroupRatio,QuotaPerUnit:500000,ExprVersion:1,TaskUsageBilling:v.Task},v.Tokens,req)
   if err != nil || quota.ActualQuotaAfterGroup != *v.ExpectedQuota { panic(fmt.Sprintf("%s quota: %+v %v",v.Name,quota,err)) }
   result["quota"] = quota.ActualQuotaAfterGroup
  }
  results=append(results,result)
 }
 if err:=json.NewEncoder(os.Stdout).Encode(results);err!=nil{panic(err)}
}
`);
try {
  const output = execFileSync(values.go, ['run', './cmd/cny-expression-check'], { cwd: directory, encoding: 'utf8', env: { ...process.env, GOCACHE: join(tmpdir(), 'cny-go-build-cache') }, timeout: 120000 });
  process.stdout.write(JSON.stringify({ kind: 'offline-official-parser', commit: COMMIT, directory, status: 'passed', results: JSON.parse(output), nativeInstance: false }) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ kind: 'offline-official-parser', commit: COMMIT, directory, status: 'failed-or-unavailable', nativeInstance: false, error: error.message }) + '\n');
  process.exitCode = 1;
}
