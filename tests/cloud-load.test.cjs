const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require('node:path').join(__dirname,'../cloud-load.js'))).toString('base64'));
test('unrelated permission errors do not hide users; user errors preserve last list; stale account results are ignored',async()=>{
 const {loadIndependentCollections}=await load(),state={user:{uid:'admin'},users:[]},snap={docs:[{id:'real-id',data:()=>({uid:'forged',name:'An'})}]};
 const result=await loadIndependentCollections({state,uid:'admin',reads:[{key:'messages',load:async()=>{throw {code:'permission-denied'};}},{key:'users',idField:'uid',load:async()=>snap}]});assert.equal(result.errors.length,1);assert.equal(state.users[0].uid,'real-id');assert.equal(state.usersLoaded,true);
 await loadIndependentCollections({state,uid:'admin',reads:[{key:'users',load:async()=>{throw {code:'unavailable'};}}]});assert.equal(state.users.length,1);assert.equal(state.usersLoadError,'unavailable');
 await loadIndependentCollections({state,uid:'admin',reads:[{key:'users',idField:'uid',load:async()=>{state.user={uid:'other'};return {docs:[]};}}]});assert.equal(state.users.length,1);
});
