import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildArtifact,verifyArtifact,semanticDiff} from '../.cache/cny-build/cny/artifact.js';
const input={sourceSha:'d9f6cf3d1b643ac186f1be82dfcab754505a9343',data:{providers:{}},quotes:[],selection:{},models:{m:{billing_mode:'tiered_expr',billing_expr:'tier("base", p * 21)'}},plugins:{m:{doubao:'tier("base", u("tokens") * 21 / 1000000)'}},tools:{web_search:7},exclusions:[{id:'missing',status:'incomplete',fields:['input']}]};
test('S: fixed identity binds all partitions, exclusions and source; noise is not a price change',()=>{
 const a=buildArtifact(input,'2026-11-16'); const b=buildArtifact({...input,description:'new description'},'2026-11-17');
 assert.equal(a.id,b.id);assert.equal(verifyArtifact(a),true);assert.equal(a.manifest.complete,false);
 assert.deepEqual(semanticDiff(a,b),[]);
 const altered=structuredClone(a);altered.tools.web_search=8;assert.equal(verifyArtifact(altered),false);
});
test('S: price changes, deletions, source currency and units cannot hide behind equal expressions',()=>{
 const a=buildArtifact({...input,quotes:[{id:'q',currency:'USD',unit:'per_million_tokens',amount:3,source:{checkedAt:'2026-11-16'}}]});
 const b=buildArtifact({...input,quotes:[{id:'q',currency:'CNY',unit:'per_token',amount:3,source:{checkedAt:'2026-11-16'}}],tools:{}});
 assert.deepEqual(semanticDiff(a,b).map(x=>x.partition).sort(),['quotes','tools']);
});
