import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateCny} from '../.cache/cny-build/cny/generate.js';
const quote=(cost,extra={})=>({id:'domestic-standard',provider:'domestic',model:'same',priceList:'standard',origin:'domestic',currency:'CNY',source:{url:'https://example.org/official',checkedAt:'2026-11-16'},required:['input','output'],cost,...extra});
const run=(records,selection={'same':'domestic-standard'},upstream={})=>generateCny({records,selection,upstream});
test('G: domestic original CNY completely replaces upstream cost before selection',()=>{
 const r=run([quote({input:20,output:100})],undefined,{providers:{domestic:{id:'domestic',models:{same:{id:'same',cost:{input:1,output:2,cache_read:99}}}}}});
 assert.deepEqual(r.catalog[0].cnyCost,{input:20,output:100,currency:'CNY'});
 assert.equal(r.models.same.billing_expr,'tier("standard", p * 20 + c * 100)');
});
test('G: raw USD converts once, all official lists survive priority aggregation',()=>{
 const records=[quote({input:13,output:68}),quote({input:3,output:15},{id:'foreign',provider:'foreign',origin:'foreign',currency:'USD'})];
 const a=run(records,{same:'foreign'});
 assert.equal(a.catalog.length,2);
 assert.deepEqual(a.catalog[1].cnyCost,{input:21,output:105,currency:'CNY'});
 assert.equal(a.models.same.billing_expr,'tier("standard", p * 21 + c * 105)');
 assert.deepEqual(a,run(records,{same:'foreign'}));
 assert.equal(run(records).models.same.billing_expr,'tier("standard", p * 13 + c * 68)');
});
test('G: incomplete, mixed currency and missing official CNY cannot publish',()=>{
 for(const record of [quote({input:20}),quote({input:20,output:100,cache_read:{amount:1,currency:'USD'}}),quote({input:1.9437,output:10.1671},{currency:'USD'})]) {
  const r=run([record]);assert.deepEqual(r.models,{});assert.equal(r.diagnostics[0].status,'incomplete');
 }
});
test('G: image modalities, explicit cache TTL prices and context thresholds are preserved',()=>{
 const r=run([quote({input:3,output:15,input_image:5,output_image:40,cache_read_image:1,cache_write:4,cache_write_1h:6,tiers:[{tier:{size:200000},input:6,output:30,input_image:10}]},{origin:'foreign',currency:'USD'})]);
 assert.equal(r.models.same.billing_expr,'len <= 200000 ? tier("0_200k", p * 21 + cc * 28 + cc1h * 42 + img * 35 + img_cr * 7 + c * 105 + img_o * 280) : tier("200k_plus", p * 42 + cc * 28 + cc1h * 42 + img * 70 + img_cr * 7 + c * 210 + img_o * 280)');
 assert.equal(r.catalog[0].cnyCost.tiers[0].tier.size,200000);
});
test('G: public generator routes selected task and tool prices into independent native partitions',()=>{
 const r=run([quote({}, {kind:'task',model:'doubao-seedance-1-5-pro-251215',required:[],task:{plugin:'doubao',model:'doubao-seedance-1-5-pro-251215',tiers:[{name:'base',charges:[{usageKey:'tokens',amount:2,unit:'per_million_tokens',currency:'USD'}]}]},tools:[{key:'web_search',amount:1,unit:'per_thousand_calls',currency:'USD'}],origin:'foreign',currency:'USD'})],{'doubao-seedance-1-5-pro-251215':'domestic-standard'});
 assert.deepEqual(r.models,{});
 assert.equal(r.plugins['doubao-seedance-1-5-pro-251215'].doubao,'tier("base", u("tokens") * 14 / 1000000)');
 assert.equal(r.tools.web_search,7);
});
test('G: malformed thresholds and absent task schemas block the selected new price',()=>{
 for(const record of [quote({input:20,output:100,tiers:[{tier:{size:-1},input:30}]}),quote({}, {kind:'task',required:[]})]) {
 const r=run([record]);assert.equal(r.diagnostics[0].status,'incomplete');assert.deepEqual(r.models,{});assert.deepEqual(r.plugins,{});
 }
});
test('G/S: unselected records retain capability diagnostics and explicit exclusion identity',()=>{
 const r=run([quote({input:20,output:100}),quote({input:1,output:2,per_image:.2},{id:'mixed-shape'})]);
 assert.equal(r.catalog[1].diagnostic.status,'unsupported-shape');
 assert.ok(r.exclusions.some(x=>x.id==='mixed-shape'));
});
test('G: snapshot override replaces entire cost before building, retains upstream model metadata',()=>{
 const r=run([quote({input:20,output:100})],undefined,{providers:{domestic:{id:'domestic',models:{same:{id:'same',name:'upstream title',cost:{input:1,output:2,cache_read:99}}}}}});
 assert.equal(r.catalog[0].snapshotModel.name,'upstream title');
 assert.deepEqual(r.catalog[0].snapshotModel.cost,{input:20,output:100,currency:'CNY'});
});
test('G: incomplete tool blocks every partition from that official record',()=>{
 const r=run([quote({input:20,output:100},{tools:[{key:'web_search',amount:1,unit:'per_thousand_calls',currency:'CNY'},{key:'file_search',unit:'per_thousand_calls',currency:'CNY'}]})]);
 assert.equal(r.diagnostics[0].status,'incomplete');assert.deepEqual(r.models,{});assert.deepEqual(r.tools,{});
});
test('G: pinned upstream deletions and invalid native plugin names cannot publish',()=>{
 const deleted=run([quote({input:20,output:100},{upstreamKey:{provider:'domestic',model:'removed'}})]);
 assert.equal(deleted.diagnostics[0].status,'incomplete');assert.deepEqual(deleted.models,{});
 const r=run([quote({}, {kind:'task',model:'doubao-seedance-1-5-pro-251215',required:[],task:{plugin:'doubao',model:'doubao-seedance-1-5-pro-251215',tiers:[{name:'base',charges:[{usageKey:'tokens',amount:2,unit:'per_million_tokens',currency:'CNY'}]}]}})]);
 assert.deepEqual(r.plugins,{});assert.ok(r.exclusions.some(x=>x.status==='unsupported-shape'));
});
test('G: conflicting tool prices within a single quote are rejected, never last-win',()=>{
 const r=run([quote({}, {kind:'tool',required:[],tools:[{key:'web_search',amount:1,unit:'per_thousand_calls',currency:'CNY'},{key:'web_search',amount:99,unit:'per_thousand_calls',currency:'CNY'}]})]);
 assert.deepEqual(r.tools,{});assert.equal(r.diagnostics[0].status,'incomplete');
});
test('G: malformed nested JSON produces item diagnostics without losing other valid records',()=>{
 for(const malformed of [{kind:'task',task:{plugin:'doubao',model:'x'}},{required:{}},{cost:{input:1,output:2,tiers:{}}},{tools:[null]}]) {
  const r=run([quote({input:20,output:100},{id:'bad',...malformed}),quote({input:13,output:68})]);
  assert.equal(r.catalog[0].diagnostic.status,'incomplete');assert.equal(r.models.same.billing_expr,'tier("standard", p * 13 + c * 68)');
 }
});
test('QA F1: fixed image price with extra Token or scheduled charges is explicitly unsupported',()=>{
 for(const cost of [{per_image:.2,output_image:40},{per_image:.2,schedule:{timezone:'UTC',fallback:'base',windows:[{name:'peak',hours:['01:00-02:00'],input:5}]}}]) {
  const r=run([quote(cost,{required:['per_image',...(cost.output_image!==undefined?['output_image']:[])]})]);
  assert.equal(r.diagnostics[0].status,'unsupported-shape');
  assert.deepEqual(r.models,{});
  assert.ok(r.exclusions.some(x=>x.id==='domestic-standard'));
 }
});
test('QA F2: duplicate thresholds inside a schedule window cannot silently overwrite prices',()=>{
 const r=run([quote({input:1,output:2,schedule:{timezone:'UTC',fallback:'base',windows:[{name:'peak',hours:['01:00-02:00'],input:5,tiers:[{tier:{size:10},input:5},{tier:{size:10},input:100}]}]}})]);
 assert.equal(r.diagnostics[0].status,'incomplete');
 assert.ok(r.diagnostics[0].fields.some(x=>x.includes('schedule.windows.0.tiers')));
 assert.deepEqual(r.models,{});
});
