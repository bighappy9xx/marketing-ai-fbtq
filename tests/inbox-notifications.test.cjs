const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const modulePromise=import('data:text/javascript;base64,'+fs.readFileSync(require.resolve('../inbox-notifications.js')).toString('base64'));
test('notification gate accepts only new confirmed webhook messages for the signed-in account',async()=>{
 const {createIncomingPopupGate}=await modulePromise,now=1000000,gate=createIncomingPopupGate({now:()=>now});
 const row=(id,extra={})=>({id,ownerUid:'u',pageId:'p',direction:'incoming',source:'meta_webhook',createdAt:now,...extra});
 assert.deepEqual(gate.inspect('u',[row('cached')],{fromCache:true}),[]);
 assert.deepEqual(gate.inspect('u',[row('cached'),row('startup')]),[]);
 const incoming=row('new');
 assert.deepEqual(gate.inspect('u',[incoming]),[incoming]);
 assert.deepEqual(gate.inspect('u',[incoming]),[]);
 for(const extra of [{historical:true},{source:'meta_history'},{source:'meta_sync_live'},{direction:'outgoing'},{ownerUid:'other'},{createdAt:now+10000}])assert.deepEqual(gate.inspect('u',[row(JSON.stringify(extra),extra)]),[]);
 const late=row('late-live',{createdAt:now-100000});
 assert.deepEqual(gate.inspect('u',[late]),[late]);
 assert.deepEqual(gate.inspect('v',[row('account-change',{ownerUid:'v'})]),[]);
 const next=row('v-new',{ownerUid:'v',createdAt:{seconds:1000}});
 assert.deepEqual(gate.inspect('v',[next]),[next]);
});
test('Page colors accept arbitrary RGB safely and keep stable defaults',async()=>{const {fanpageColor}=await modulePromise;assert.equal(fanpageColor({pageId:'p',inboxColor:'#f012ab'}),'#F012AB');assert.equal(fanpageColor({pageId:'p',inboxColor:'url(evil)'}),fanpageColor({pageId:'p'}));assert.match(fanpageColor({pageId:'p'}),/^#[A-F0-9]{6}$/);});
