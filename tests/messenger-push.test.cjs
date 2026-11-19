const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {normalizeSubscription,shouldNotify}=require('../functions/messenger-push');

test('validates platform subscription endpoints and refuses untrusted destinations',()=>{
 const keys={p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),auth:Buffer.alloc(16).toString('base64url')};
 for(const host of ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2.notify.windows.com']){
  const endpoint='https://'+host+'/push/device';
  assert.deepEqual(normalizeSubscription({endpoint,keys}),{endpoint,keys});
 }
 for(const endpoint of ['https://127.0.0.1/a','https://web.push.apple.com.attacker.test/a','https://user@web.push.apple.com/a','http://fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a']){
  assert.throws(()=>normalizeSubscription({endpoint,keys}));
 }
 assert.throws(()=>normalizeSubscription({endpoint:'https://fcm.googleapis.com/a',keys:{...keys,auth:'short'}}));
});

test('only notifies for new customer messages, including live history promotions',()=>{
 const now=Date.now(),live={ownerUid:'uid',createdAt:new Date(now-500),direction:'incoming',source:'meta_webhook'};
 assert.equal(shouldNotify(null,live,now),true);
 assert.equal(shouldNotify({historical:true},live,now),true);
 assert.equal(shouldNotify(live,live,now),false);
 assert.equal(shouldNotify(null,{...live,source:'meta_sync_live'},now),true);
 for(const patch of [{historical:true},{direction:'outgoing'},{source:'meta_history'},{createdAt:new Date(now-130000)},{ownerUid:''}]){
  assert.equal(shouldNotify(null,{...live,...patch},now),false);
 }
});

test('service worker only shows notifications for the currently bound device and opens the inbox',async()=>{
 const handlers={},shown=[],opened=[],device='d'.repeat(64),id='a'.repeat(64);
 let binding={owner:'active',device},closed=false;
 const self={addEventListener:(name,fn)=>{handlers[name]=fn;},registration:{scope:'https://example.test/workspace/',showNotification:(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:url=>opened.push(url)}};
 const caches={open:async()=>({match:async()=>binding&&{json:async()=>binding}})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../messenger-push-worker.js'),'utf8'),{self,caches,URL});
 const run=(name,args)=>new Promise((resolve,reject)=>handlers[name]({...args,waitUntil:promise=>Promise.resolve(promise).then(resolve,reject)}));
 const notify=owner=>run('push',{data:{json:()=>({owner,device,id,body:'Nội dung riêng tư'})}});
 await notify('previous');
 assert.equal(shown.length,0);
 await notify('active');
 assert.equal(shown.length,1);
 assert.doesNotMatch(shown[0][1].body,/riêng tư/);
 assert.equal(shown[0][1].tag,'fbtq-message-'+id);
 binding=null;
 await notify('active');
 assert.equal(shown.length,1);
 await run('notificationclick',{notification:{close(){closed=true;}}});
 assert.equal(closed,true);
 assert.deepEqual(opened,['https://example.test/workspace/#inbox']);
});

test('delivery only targets the approved Fanpage owner and leaves customer details out of the payload',async t=>{
 const webPush=require('../functions/node_modules/web-push');
 const {registerMessengerPush}=require('../functions/messenger-push');
 const device='a'.repeat(64),id='b'.repeat(64),keys={p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),auth:Buffer.alloc(16).toString('base64url')};
 const subscription={endpoint:'https://fcm.googleapis.com/push/example',keys};
 const sent=[];
 t.mock.method(webPush,'sendNotification',async(sub,payload,options)=>{
  assert.deepEqual(sub,subscription);
  assert.equal(options.urgency,'high');
  sent.push(JSON.parse(payload));
 });
 let approved=true;
 const db={
  doc(path){assert.equal(path,'users/owner');return {get:async()=>({data:()=>({approved})})};},
  collection(name){
   assert.equal(name,'messengerPushDevices');
   return {where(field,operator,uid){
    assert.deepEqual([field,operator,uid],['ownerUid','==','owner']);
    return {limit(n){assert.equal(n,10);return {get:async()=>({empty:false,docs:[{id:device,data:()=>({subscription,updatedAtMs:Date.now()})}]})};}};
   }};
  }
 };
 const {notifyMessengerIncoming}=registerMessengerPush({db,onCall:(_,handler)=>handler,requireSignedIn(){},MESSENGER_WEB_PUSH_VAPID:{value:()=>JSON.stringify({})},logger:{warn(){assert.fail('Unexpected push error');}}});
 const message={ownerUid:'owner',direction:'incoming',source:'meta_webhook',createdAt:new Date(),message:'Nội dung riêng tư',senderName:'Khách hàng'};
 const event={params:{messageId:id},data:{before:{data:()=>undefined},after:{data:()=>message}}};
 await notifyMessengerIncoming.run(event);
 approved=false;
 await notifyMessengerIncoming.run(event);
 assert.deepEqual(sent,[{owner:'owner',device,id}]);
});
