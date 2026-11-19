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
 assert.equal(shouldNotify(null,{...live,source:'meta_sync_live'},now),false);
 for(const patch of [{historical:true},{direction:'outgoing'},{source:'meta_history'},{createdAt:new Date(now-130000)},{ownerUid:''}]){
  assert.equal(shouldNotify(null,{...live,...patch},now),false);
 }
});

test('service worker only shows notifications for the currently bound device and opens the inbox',async()=>{
 const handlers={},shown=[],opened=[],device='d'.repeat(64),id='a'.repeat(64);
 let binding={owner:'active',device},closed=false;
 const self={addEventListener:(name,fn)=>{handlers[name]=fn;},registration:{scope:'https://example.test/workspace/',showNotification:(...args)=>shown.push(args),getNotifications:async({tag})=>shown.filter(([,options])=>options.tag===tag)},clients:{matchAll:async()=>[],openWindow:url=>opened.push(url)}};
 const caches={open:async()=>({match:async()=>binding&&{json:async()=>binding}})};
 const context=vm.createContext({self,caches,URL,Notification:{maxActions:1}});
 context.importScripts=url=>{
  assert.match(url,/messenger-notification-format\.js/);
  vm.runInContext(fs.readFileSync(require.resolve('../messenger-notification-format.js'),'utf8'),context);
 };
 vm.runInContext(fs.readFileSync(require.resolve('../messenger-push-worker.js'),'utf8'),context);
 const run=(name,args)=>new Promise((resolve,reject)=>handlers[name]({...args,waitUntil:promise=>Promise.resolve(promise).then(resolve,reject)}));
 const preview={title:'Fanpage Thử',body:'Nội dung riêng tư'};
 const timestamp=Date.now()-500;
 const notify=owner=>run('push',{data:{json:()=>({owner,device,id,preview,timestamp})}});
 await notify('previous');
 assert.equal(shown.length,0);
 await notify('active');
 assert.equal(shown.length,1);
 assert.doesNotMatch(shown[0][1].body,/riêng tư/);
 assert.equal(shown[0][1].tag,'fbtq-message-'+id);
 assert.equal(shown[0][1].timestamp,timestamp);
 assert.equal(shown[0][1].icon,'https://example.test/workspace/assets/fbtq-app-192.png');
 assert.equal(shown[0][1].badge,'https://example.test/workspace/assets/fbtq-notification-badge.png');
 assert.equal(shown[0][1].actions[0].action,'open-inbox');
 binding.showPreview=true;
 await notify('active');
 assert.equal(shown[1][0],preview.title);
 assert.equal(shown[1][1].body,preview.body);
 const tabMessage={owner:'active',device,id,type:'fbtq-messenger-background',preview};
 const source={url:'https://example.test/workspace/#inbox',visibilityState:'hidden'};
 await run('message',{data:tabMessage,source});
 assert.equal(shown.length,2);
 handlers.message({data:{...tabMessage,id:'b'.repeat(64)},source:{...source,visibilityState:'visible'},waitUntil(){assert.fail('The visible tab should not request a fallback alert');}});
 await run('message',{data:{...tabMessage,id:'b'.repeat(64)},source});
 assert.equal(shown.length,3);
 assert.equal(shown[2][1].renotify,false);
 binding=null;
 await notify('active');
 assert.equal(shown.length,3);
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
 let approved=true,showPreview=false;
 const db={
  doc(path){assert.equal(path,'users/owner');return {get:async()=>({data:()=>({approved})})};},
  collection(name){
   assert.equal(name,'messengerPushDevices');
   return {where(field,operator,uid){
    assert.deepEqual([field,operator,uid],['ownerUid','==','owner']);
    return {limit(n){assert.equal(n,10);return {get:async()=>({empty:false,docs:[{id:device,data:()=>({subscription,showPreview,updatedAtMs:Date.now()})}]})};}};
   }};
  }
 };
 const {notifyMessengerIncoming}=registerMessengerPush({db,onCall:(_,handler)=>handler,requireSignedIn(){},MESSENGER_WEB_PUSH_VAPID:{value:()=>JSON.stringify({})},logger:{warn(){assert.fail('Unexpected push error');}}});
 const message={ownerUid:'owner',direction:'incoming',source:'meta_webhook',createdAt:new Date(),pageName:' Fanpage Thử ',message:'Nội dung\nriêng tư',senderName:'Khách hàng'};
 const event={params:{messageId:id},data:{before:{data:()=>undefined},after:{data:()=>message}}};
 await notifyMessengerIncoming.run(event);
 approved=false;
 await notifyMessengerIncoming.run(event);
 assert.deepEqual(sent,[{owner:'owner',device,id,timestamp:message.createdAt.getTime()}]);
 approved=true;
 showPreview=true;
 await notifyMessengerIncoming.run(event);
 assert.deepEqual(sent[1],{owner:'owner',device,id,timestamp:message.createdAt.getTime(),preview:{title:'Fanpage Thử',body:'Nội dung riêng tư'}});
});

test('popup waits for server confirmation and recognizes promoted live messages',async()=>{
 const source=fs.readFileSync(require.resolve('../inbox-notifications.js'),'utf8');
 const {createIncomingPopupGate}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const now=Date.now(),gate=createIncomingPopupGate({now:()=>now}),message=(id,patch={})=>({id,ownerUid:'a',direction:'incoming',source:'meta_webhook',createdAt:{toMillis:()=>now-100},...patch});
 const baseline=message('baseline'),history=message('history',{historical:true,source:'meta_history'}),live=message('live');
 assert.deepEqual(gate.inspect('a',[baseline,history]),[]);
 assert.deepEqual(gate.inspect('a',[baseline,history,live],{fromCache:true}),[]);
 assert.deepEqual(gate.inspect('a',[baseline,history,live]),[live]);
 assert.deepEqual(gate.inspect('a',[baseline,history,live]),[]);
 const promoted=message('history'),outgoing=message('echo',{direction:'outgoing'}),old=message('old',{createdAt:{toMillis:()=>now-130000}});
 assert.deepEqual(gate.inspect('a',[baseline,promoted,live,outgoing,old]),[promoted]);
 assert.deepEqual(gate.inspect('b',[live]),[]);
});

test('test push checks device ownership and rate limit before sending',async t=>{
 const webPush=require('../functions/node_modules/web-push');
 const {registerMessengerPush}=require('../functions/messenger-push');
 const id='a'.repeat(64),owner='owner',keys={p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),auth:Buffer.alloc(16).toString('base64url')};
 const device={ownerUid:owner,subscription:{endpoint:'https://fcm.googleapis.com/push/example',keys}};
 const send=t.mock.method(webPush,'sendNotification',async(_,body)=>{
  const payload=JSON.parse(body);
  assert.equal(payload.test,true);
  assert.equal(payload.device,id);
  assert.equal(payload.owner,owner);
  assert.match(payload.id,/^[a-f0-9]{64}$/);
 });
 const db={collection:()=>({doc:()=>({})}),runTransaction:fn=>fn({get:async()=>({data:()=>device}),update:(_,patch)=>Object.assign(device,patch)})};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const {testMessengerPushDevice}=registerMessengerPush({db,onCall:(_,handler)=>handler,HttpsError,requireSignedIn:async request=>({uid:request.auth.uid}),MESSENGER_WEB_PUSH_VAPID:{value:()=>JSON.stringify({})},logger:{warn(){}}});
 await assert.rejects(testMessengerPushDevice({auth:{uid:'other'},data:{id}}),{code:'failed-precondition'});
 assert.deepEqual(await testMessengerPushDevice({auth:{uid:owner},data:{id}}),{accepted:true});
 await assert.rejects(testMessengerPushDevice({auth:{uid:owner},data:{id}}),{code:'resource-exhausted'});
 assert.equal(send.mock.callCount(),1);
});

test('expired provider subscriptions are retired and cannot be silently registered again',async t=>{
 const {createHash}=require('node:crypto');
 const webPush=require('../functions/node_modules/web-push');
 const {registerMessengerPush}=require('../functions/messenger-push');
 const owner='owner',keys={p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),auth:Buffer.alloc(16).toString('base64url')};
 const old={endpoint:'https://fcm.googleapis.com/push/old',keys},fresh={...old,endpoint:'https://fcm.googleapis.com/push/fresh'};
 const hash=s=>createHash('sha256').update(s.endpoint).digest('hex');
 const oldId=hash(old),freshId=hash(fresh),records=new Map([[oldId,{ownerUid:owner,subscription:old}]]);
 const send=t.mock.method(webPush,'sendNotification',async subscription=>{
  if(subscription.endpoint===old.endpoint)throw Object.assign(new Error('expired'),{statusCode:410});
 });
 const db={
  collection:()=>({doc:id=>id,where:()=>({limit:()=>({query:true})})}),
  runTransaction:fn=>fn({
   get:async ref=>ref?.query?{size:[...records.values()].filter(row=>row.ownerUid===owner).length}:{data:()=>records.get(ref)},
   update:(id,patch)=>records.set(id,{...records.get(id),...patch}),
   set:(id,data)=>records.set(id,data),
   delete:id=>records.delete(id),
  }),
 };
 class HttpsError extends Error{constructor(code,message,details){super(message);Object.assign(this,{code,details});}}
 const push=registerMessengerPush({db,onCall:(_,handler)=>handler,HttpsError,requireSignedIn:async request=>({uid:request.auth.uid}),MESSENGER_WEB_PUSH_VAPID:{value:()=>'{}'},logger:{warn(){}}});
 const request=data=>({auth:{uid:owner},data});
 const expired={code:'failed-precondition',details:{reason:'expired-push-subscription'}};
 await assert.rejects(push.testMessengerPushDevice(request({id:oldId})),expired);
 assert.equal(records.get(oldId).status,'expired');
 assert.equal(records.get(oldId).subscription,undefined);
 await assert.rejects(push.registerMessengerPushDevice(request({subscription:old})),expired);
 assert.deepEqual(await push.registerMessengerPushDevice(request({subscription:fresh,replaces:oldId,showPreview:true})),{id:freshId,showPreview:true});
 assert.deepEqual(await push.testMessengerPushDevice(request({id:freshId})),{accepted:true});
 assert.equal(send.mock.callCount(),2);
});
