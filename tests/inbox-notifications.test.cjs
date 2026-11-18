const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const modulePromise=import('data:text/javascript;base64,'+fs.readFileSync(require.resolve('../inbox-notifications.js')).toString('base64'));
test('new-message gate ignores startup, history, outgoing, duplicates and foreign accounts',async()=>{
 const {createIncomingSoundGate}=await modulePromise,now=1000000,gate=createIncomingSoundGate({now:()=>now});
 const row=(id,extra={})=>({id,ownerUid:'u',pageId:'p',direction:'incoming',source:'meta_webhook',createdAt:now,...extra});
 assert.deepEqual(gate.inspect('u',[row('cached')],{fromCache:true}),[]);
 assert.deepEqual(gate.inspect('u',[row('cached'),row('startup')]),[]);
 assert.deepEqual(gate.inspect('u',[row('new')]),['new']);assert.deepEqual(gate.inspect('u',[row('new')]),[]);
 for(const extra of [{historical:true,createdAt:now-10000},{source:'meta_history',createdAt:now-10000},{direction:'outgoing'},{ownerUid:'other'},{createdAt:now+10000}])assert.deepEqual(gate.inspect('u',[row(JSON.stringify(extra),extra)]),[]);
 assert.deepEqual(gate.inspect('u',[row('filtered')],{pageIds:['other']}),['filtered']);
 assert.deepEqual(gate.inspect('u',[row('late-live',{createdAt:now-100000})]),['late-live']);
 assert.deepEqual(gate.inspect('u',[row('sync-live',{historical:true,source:'meta_history'})]),['sync-live']);
 assert.deepEqual(gate.inspect('u',[],{changes:[{type:'modified',message:row('modified')}]}),[]);
 assert.deepEqual(gate.inspect('v',[row('account-change',{ownerUid:'v'})]),[]);
 assert.deepEqual(gate.inspect('v',[],{changes:[{type:'added',message:row('v-new',{ownerUid:'v',createdAt:{seconds:1000}})}]}),['v-new']);
});
test('Page colors accept arbitrary RGB safely and keep stable defaults',async()=>{const {fanpageColor}=await modulePromise;assert.equal(fanpageColor({pageId:'p',inboxColor:'#f012ab'}),'#F012AB');assert.equal(fanpageColor({pageId:'p',inboxColor:'url(evil)'}),fanpageColor({pageId:'p'}));assert.match(fanpageColor({pageId:'p'}),/^#[A-F0-9]{6}$/);});
