const test=require('node:test'),assert=require('node:assert/strict');
const users=[{uid:'a',name:'An',branch:'A'},{uid:'b',name:'Bình',branch:'A'},{uid:'c',name:'Chi',branch:'B'}];
const revenue=[{createdBy:'a',createdByName:'An',revenue:100,reportDate:'2026-11-01'},{createdBy:'a',createdByName:'An',revenue:50,reportDate:'2026-11-02'},{createdBy:'b',createdByName:'Bình',revenue:200,reportDate:'2026-11-03'},{createdBy:'c',createdByName:'Chi',revenue:999,reportDate:'2026-11-03'},{createdBy:'a',revenue:10000,reportDate:'2026-10-03'}];
const workflow={requests:[{id:'l1',createdBy:'a',type:'leave',status:'pending',date:'2026-10-01'},{id:'l2',createdBy:'b',type:'leave',status:'approved',date:'2026-11-02'},{id:'l3',createdBy:'c',type:'leave',status:'pending',date:'2026-11-01'},{id:'p',createdBy:'a',type:'proposal',status:'pending'},{id:'old',createdBy:'a',type:'leave',status:'pending',legacy:true}],advances:[{id:'f1',createdBy:'a',status:'pending',amount:50,date:'2026-11-01'},{id:'f2',createdBy:'c',status:'approved',amount:100,date:'2026-11-01'}]};
const reviews=[{id:'r1',createdBy:'a',title:'Video A',status:'pending',editHistory:[{action:'submitted',at:'2026-11-01'}]},{id:'r2',createdBy:'b',title:'Video B',createdByName:'Bình',status:'approved',editHistory:[{action:'approved',at:'2026-11-02',actorName:'Quản lý'},{action:'revision_requested',at:'2026-10-03'}]},{id:'r3',createdBy:'c',status:'pending'}];
const base={users,revenue,workflow,reviews,awards:[{uid:'c',name:'Chi',score:10,rank:1},{uid:'a',name:'An',score:9,rank:2}],range:{start:'2026-11-01',end:'2026-11-30'}};
test('manager overview honors branch/user filters and keeps old pending work visible',async()=>{
  const {overviewHubModel}=await import('../overview-hub.js');const model=overviewHubModel({...base,user:{uid:'boss',branch:'A'},role:'branch_manager'});
  assert.deepEqual(model.ranking.map(r=>r.uid),['b','a']);assert.equal(model.ranking[1].revenue,150);assert.equal(model.pending.leaves,1);assert.equal(model.leaves.length,2);assert.equal(model.leaves[0].id,'l1');assert.equal(model.events.length,1);assert.equal(model.events[0].title,'Video B');assert.equal(model.awards.length,1);assert.equal(model.pending.advances,1);assert.equal(model.approvedFunds,0);
  const filtered=overviewHubModel({...base,user:{uid:'boss',branch:'A'},role:'branch_manager',selectedUser:'b'});assert.equal(filtered.ranking.length,1);assert.equal(filtered.pending.reviews,0);assert.equal(filtered.leaves.length,1);
});
test('employee sees public rankings, but only their own operational records',async()=>{
  const {overviewHubModel}=await import('../overview-hub.js');const model=overviewHubModel({...base,user:users[0],role:'employee'});
  assert.equal(model.ranking.length,3);assert.equal(model.awards.length,2);assert.equal(model.pending.reviews,1);assert.equal(model.leaves.length,1);assert.equal(model.advances.length,1);assert.equal(model.events.length,0);assert.equal(model.publicBoards,true);
});
test('director filters and accountant finance access are applied without leaking requests',async()=>{
  const {overviewHubModel}=await import('../overview-hub.js');const director=overviewHubModel({...base,user:{uid:'d'},role:'director',selectedBranch:'b'});assert.equal(director.ranking[0].uid,'c');assert.equal(director.pending.leaves,1);
  const accountant=overviewHubModel({...base,user:{uid:'acc'},role:'accountant'});assert.equal(accountant.approvedFunds,100);assert.equal(accountant.pending.advances,1);assert.equal(accountant.leaves.length,0);
  assert.equal(overviewHubModel({...base,user:null,role:'employee'}).ranking.length,0);
});
