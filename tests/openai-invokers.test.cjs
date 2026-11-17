const {test}=require('node:test'),assert=require('node:assert/strict');
const {browserPolicy,repair}=require('../scripts/repair-openai-invokers.cjs');
const {FUNCTIONS}=require('../scripts/setup-openai.cjs');
test('browser transport repair preserves IAM members, conditions and concurrency etag',()=>{
 const current={version:1,etag:'keep-etag',bindings:[{role:'roles/run.invoker',members:['serviceAccount:trusted@example.test']},{role:'roles/run.viewer',members:['user:viewer@example.test']},{role:'roles/run.invoker',condition:{expression:'true'},members:['user:conditional@example.test']}]},before=structuredClone(current),next=browserPolicy(current);
 assert.deepEqual(current,before);assert.equal(next.etag,'keep-etag');assert.equal(next.version,3);assert.deepEqual(next.bindings[0].members,['serviceAccount:trusted@example.test','allUsers']);assert.deepEqual(next.bindings[1],current.bindings[1]);assert.deepEqual(next.bindings[2],current.bindings[2]);assert.equal(browserPolicy(next),null);
});
test('repair changes only the deployed OpenAI callable services and is idempotent',async()=>{
 const rows=FUNCTIONS.map(id=>({id,region:'us-central1',platform:'gcfv2',callableTrigger:{},runServiceId:id.toLowerCase()})),policies=new Map(),writes=[];
 rows.push({id:'privateUnrelatedFunction',region:'us-central1',runServiceId:'private'});
 const tools={cli:{functions:{list:async()=>rows}},run:{getIamPolicy:async s=>policies.get(s)||{etag:'existing',bindings:[]},setIamPolicy:async(s,p)=>{writes.push(s);policies.set(s,p);}}};
 await repair(tools);assert.equal(writes.length,9);assert.ok(!writes.some(s=>s.endsWith('/private')));await repair(tools);assert.equal(writes.length,9);
});
