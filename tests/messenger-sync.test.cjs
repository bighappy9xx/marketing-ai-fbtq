const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const core=require('../functions/chatbot-core'),{storeHistory,messageKey,registerMessengerHistory}=require('../functions/messenger-history'),{recordMessage,registerMetaWebhook}=require('../functions/meta-webhook');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const page={pageId:'123456',ownerUid:'owner',pageName:'Trang thử',model:'openai',active:true,pagePhotoUrl:'https://example.test/page.jpg',pagePhotoCheckedAtMs:Date.now()},peer={id:'654321',name:'Khách thử'},threadId=core.key(page.pageId,peer.id);
function database(){const data=new Map(),snap=path=>({exists:data.has(path),data:()=>data.has(path)?structuredClone(data.get(path)):undefined});let chain=Promise.resolve();const ref=path=>({path,id:path.split('/').at(-1),get:async()=>snap(path),set:async(v,o)=>data.set(path,o?.merge?{...data.get(path),...v}:structuredClone(v)),create:async v=>{if(data.has(path))throw Error('exists');data.set(path,structuredClone(v));},update:async v=>data.set(path,{...data.get(path),...v})});const db={doc:ref,runTransaction:fn=>{const p=chain.then(()=>fn({get:async r=>snap(r.path),create:(r,v)=>{if(data.has(r.path))throw Error('exists');data.set(r.path,structuredClone(v));},set:(r,v,o)=>data.set(r.path,o?.merge?{...data.get(r.path),...structuredClone(v)}:structuredClone(v)),update:(r,v)=>data.set(r.path,{...data.get(r.path),...structuredClone(v)})}));chain=p.catch(()=>{});return p;}};data.set('workspaces/fbtq/pages/'+page.pageId,{...page});return {db,data};}
const msg=(id,from,at,text='Xin chào')=>({id,from:{id:from},created_time:new Date(at).toISOString(),message:text});
test('signed webhook starts the bot from a saved incoming message without waiting for profile refresh',async()=>{
 const {db,data}=database(),secret='test-app-secret',now=Date.now(),replies=[];
 let unblockProfile;
 const profilePending=new Promise(resolve=>{unblockProfile=resolve;});
 let notifyReply;
 const replyStarted=new Promise(resolve=>{notifyReply=resolve;});
 const handler=registerMetaWebhook({
  db,onRequest:(_,fn)=>fn,META_VERIFY_TOKEN:{value:()=>''},META_APP_SECRET:{value:()=>secret},
  META_TOKEN_ENCRYPTION_KEY:{value:()=>''},decryptToken:()=>{throw Error('profile unavailable');},
  logger:{info(){},error(){}},
  replyToIncoming:async(id,message,config)=>{
   assert.equal(data.get('workspaces/fbtq/messages/'+id).message,message.message);
   assert.equal(data.get('workspaces/fbtq/inbox/'+threadId).lastIncomingMessageId,id);
   assert.equal(config.pageId,page.pageId);
   replies.push(id);
   notifyReply();
   await profilePending;
  }
 });
 const entry={id:page.pageId,messaging:[{sender:{id:peer.id},timestamp:now,message:{mid:'fast-webhook',text:'Xin chào'}}]};
 const body={object:'page',entry:[entry]},rawBody=Buffer.from(JSON.stringify(body));
 const request={method:'POST',body,rawBody,get:()=> 'sha256='+crypto.createHmac('sha256',secret).update(rawBody).digest('hex')};
 const res=response(),delivery=handler(request,res);
 await Promise.race([replyStarted,delivery.then(()=>assert.fail('The webhook did not start the bot'))]);
 assert.deepEqual(replies,[messageKey(threadId,'fast-webhook')]);
 unblockProfile();
 await delivery;
 assert.equal(res.statusCode,200);
 await handler(request,response());
 assert.equal(replies.length,1);
});
test('history is idempotent, keeps original time, never reopens 24h or replaces newer live content/handoff',async()=>{const q=database(),old=Date.now()-3*86400000;const args={db:q.db,page,peer,metaConversationId:'t_history',rows:[msg('old1',peer.id,old),msg('old2',page.pageId,old+1000)],nextCursor:'older'};assert.equal((await storeHistory(args)).imported,2);assert.equal((await storeHistory(args)).imported,0);const t=q.data.get('workspaces/fbtq/inbox/'+threadId);assert.equal(t.lastIncomingAtMs,old);assert.equal(core.eligible(t),false);assert.equal(t.unread,false);assert.equal(t.historyHasMore,true);assert.equal(t.historyCursor,'older');const incoming=q.data.get('workspaces/fbtq/messages/'+messageKey(threadId,'old1'));assert.equal(incoming.historical,true);assert.equal(incoming.source,'meta_history');assert.equal(incoming.createdAt.getTime(),old);assert.equal(t.lastIncomingMessageId,undefined);Object.assign(t,{humanPaused:true,optedOut:true,lastMessageAtMs:Date.now(),message:'TIN MỚI',historyCursor:'already-progressed'});await storeHistory({...args,rows:[msg('evenolder',peer.id,old-1000)]});const after=q.data.get('workspaces/fbtq/inbox/'+threadId);assert.equal(after.message,'TIN MỚI');assert.equal(after.humanPaused,true);assert.equal(after.optedOut,true);assert.equal(after.historyCursor,'already-progressed');});
test('live events are deduplicated and keep correct order; outgoing echoes do not open response windows',async()=>{const q=database(),at=Date.now()-1000,event={sender:{id:peer.id},recipient:{id:page.pageId},timestamp:at,message:{mid:'live1',text:'Tin mới'}};assert.equal(await recordMessage(q.db,page,event),true);assert.equal(await recordMessage(q.db,page,event),false);await recordMessage(q.db,page,{...event,timestamp:at-1000,message:{mid:'live0',text:'Tin đến trễ'}});let t=q.data.get('workspaces/fbtq/inbox/'+threadId);assert.equal(t.message,'Tin mới');assert.equal(t.lastIncomingAtMs,at);assert.equal(t.lastIncomingMessageId,messageKey(threadId,'live1'));await recordMessage(q.db,page,{sender:{id:page.pageId},recipient:{id:peer.id},timestamp:at+500,message:{mid:'echo',is_echo:true,text:'Trả lời từ Meta'}});t=q.data.get('workspaces/fbtq/inbox/'+threadId);assert.equal(t.message,'Trả lời từ Meta');assert.equal(t.direction,'outgoing');assert.equal(t.lastIncomingAtMs,at);assert.equal([...q.data.values()].filter(v=>v.conversationId===threadId&&v.createdAt).length,3);});
function response(){return {statusCode:0,body:null,status(code){this.statusCode=code;return this;},send(body){this.body=body;return this;},sendStatus(code){this.statusCode=code;return this;}};}
test('webhook rejects bad signatures, verifies challenge, records signed message and ignores inactive pages',async()=>{const q=database(),secret='server-app-secret',handler=registerMetaWebhook({db:q.db,onRequest:(_,fn)=>fn,META_VERIFY_TOKEN:{value:()=> 'verify'},META_APP_SECRET:{value:()=> secret},logger:{info:()=>{},error:()=>{}}});let res=response();await handler({method:'GET',query:{'hub.mode':'subscribe','hub.verify_token':'verify','hub.challenge':'challenge'}},res);assert.equal(res.statusCode,200);assert.equal(res.body,'challenge');const body={object:'page',entry:[{id:page.pageId,messaging:[{sender:{id:peer.id},timestamp:Date.now(),message:{mid:'signed',text:'Xin chào'}}]}]},rawBody=Buffer.from(JSON.stringify(body)),signature='sha256='+crypto.createHmac('sha256',secret).update(rawBody).digest('hex');res=response();await handler({method:'POST',body,rawBody,get:()=> 'bad'},res);assert.equal(res.statusCode,401);assert.equal(q.data.size,1);res=response();await handler({method:'POST',body,rawBody,get:()=>signature},res);assert.equal(res.statusCode,200);assert.ok(q.data.get('workspaces/fbtq/pages/'+page.pageId).lastWebhookAt);q.data.get('workspaces/fbtq/pages/'+page.pageId).active=false;const before=q.data.size;body.entry[0].messaging[0].message.mid='should-ignore';const next=Buffer.from(JSON.stringify(body));await handler({method:'POST',body,rawBody:next,get:()=> 'sha256='+crypto.createHmac('sha256',secret).update(next).digest('hex')},response());assert.equal(q.data.size,before);});
function service(graph){const q=database();const api=registerMessengerHistory({db:q.db,onCall:(_,fn)=>fn,HttpsError,owner:async(req,id)=>{if(req.auth?.uid!=='owner'||id!==page.pageId)throw new HttpsError('permission-denied','owner required');return {auth:{uid:'owner',profile:{role:req.auth.role||'director'}},page:{...page},ref:q.db.doc('workspaces/fbtq/pages/'+page.pageId)};},graph,decryptToken:()=> 'private-page-token',META_TOKEN_ENCRYPTION_KEY:{value:()=> 'server-key'},META_APP_SECRET:{value:()=> 'private-app-secret'},META_VERIFY_TOKEN:{value:()=> 'test-verify'}});return {...q,...api};}
const req=data=>({auth:{uid:'owner'},data:{pageId:page.pageId,...data}});
test('sync requires owner, bounds history, paginates and releases lock on Meta failure',async()=>{const calls=[],at=Date.now()-10000,q=service(async path=>{calls.push(path);if(path.includes('/conversations?'))return {data:[{id:'t_one',participants:{data:[{id:page.pageId},peer]}}],paging:{next:'must-not-fetch-this-url',cursors:{after:'next-pages'}}};return {data:[msg('sync1',peer.id,at)],...(path.includes('after=older-messages')?{}:{paging:{next:'not-used',cursors:{after:'older-messages'}}})};});await assert.rejects(q.syncFacebookInbox({auth:{uid:'other'},data:{pageId:page.pageId}}),{code:'permission-denied'});let r=await q.syncFacebookInbox(req());assert.equal(r.imported,1);assert.equal(r.nextCursor,'next-pages');assert.ok(calls[0].includes('limit=5'));assert.ok(calls[1].includes('limit=25'));assert.equal(calls.filter(p=>!p.includes('first_name')&&!p.includes('fields=profile_pic')).length,2);await q.syncFacebookInbox(req({threadId}));assert.ok(calls.at(-1).includes('after=older-messages'));assert.equal(q.data.get('workspaces/fbtq/pages/'+page.pageId).syncLockUntil,0);await assert.rejects(q.syncFacebookInbox(req({threadId:'f'.repeat(64)})),{code:'permission-denied'});q.data.get('workspaces/fbtq/pages/'+page.pageId).syncLockUntil=Date.now()+100000;await assert.rejects(q.syncFacebookInbox(req()),{code:'resource-exhausted'});const failing=service(async()=>{throw Error('Meta denied');});await assert.rejects(failing.syncFacebookInbox(req()),/Meta denied/);assert.equal(failing.data.get('workspaces/fbtq/pages/'+page.pageId).syncLockUntil,0);assert.ok(!JSON.stringify(r).includes('private-page-token'));});
test('connection checks only return safe diagnostics and do not send any messages',async()=>{const previous=process.env.META_APP_ID;process.env.META_APP_ID='999999';const previousUrl=process.env.META_WEBHOOK_URL;process.env.META_WEBHOOK_URL='https://example.test/webhook';try{const calls=[],q=service(async(path,token)=>{calls.push(path);if(path.includes('/subscribed_apps'))return {data:[{id:'999999',subscribed_fields:['messages']}]};if(path==='999999/subscriptions')return {data:[{object:'page',active:true,callback_url:'https://example.test/webhook',fields:[{name:'messages'}]}]};if(path.includes('/conversations?'))return {data:[]};return {id:page.pageId};});const result=await q.checkMessengerConnection(req());assert.deepEqual(result.checks.map(c=>c.status),['ok','warning','warning','warning']);assert.equal(result.lastWebhookAtMs,0);assert.ok(!JSON.stringify(result).includes('private'));assert.equal(calls.length,4);assert.ok(!calls.some(p=>/\/messages(?:\?|$)/.test(p)));}finally{process.env.META_APP_ID=previous;process.env.META_WEBHOOK_URL=previousUrl;}});

test('legacy automatic sync requests never fetch from Meta',async()=>{let reads=0;const q=service(async()=>{reads++;return {data:[]};});assert.deepEqual(await q.syncFacebookInbox(req({automatic:true})),{skipped:true,conversations:0,imported:0});assert.equal(reads,0);await assert.rejects(q.syncFacebookInbox(req({automatic:true,cursor:'older'})),{code:'invalid-argument'});});
test('profile enrichment keeps messages working without profile permission, caches and filters unsafe photos',async()=>{const {enrichProfile,profileFields}=require('../functions/messenger-profile');assert.deepEqual(profileFields({first_name:'An',last_name:'Nguyen',profile_pic:'javascript:alert(1)'}),{senderName:'An Nguyen'});assert.deepEqual(profileFields({profile_pic:'https://example.test/a?access_token=secret'}),{});const q=database();await recordMessage(q.db,page,{sender:{id:peer.id},timestamp:Date.now(),message:{mid:'profile1',text:'Xin chào'}});let count=0;const graph=async()=>{count++;return {first_name:'An',last_name:'Nguyen',profile_pic:'https://example.test/a.jpg'};};await enrichProfile({db:q.db,page,peerId:peer.id,graph,token:'secret'});await enrichProfile({db:q.db,page,peerId:peer.id,graph,token:'secret'});assert.equal(count,2);const ref=q.data.get('workspaces/fbtq/inbox/'+threadId);assert.equal(ref.senderName,'An Nguyen');assert.equal(ref.senderPhotoUrl,'https://example.test/a.jpg');ref.profileCheckedAtMs=0;await enrichProfile({db:q.db,page,peerId:peer.id,graph:async()=>{throw Error('permission denied');}});assert.equal(ref.message,'Xin chào');assert.equal(q.data.get('workspaces/fbtq/inbox/'+threadId).senderPhotoUrl,'https://example.test/a.jpg');});

test('image sender enforces ownership/window, validates bytes, sends multipart once and persists private preview',async()=>{const {decodeImage,registerMessengerImage}=require('../functions/messenger-image');assert.throws(()=>decodeImage('PHN2Zz48L3N2Zz4=','image/jpeg'));const jpeg=Buffer.from([255,216,255,224,0,1,2,3,255,217]).toString('base64');let sent=0;const q=database();await recordMessage(q.db,page,{sender:{id:peer.id},timestamp:Date.now(),message:{mid:'image-window',text:'Ảnh sản phẩm'}});const send=registerMessengerImage({db:q.db,onCall:(_,fn)=>fn,HttpsError,owner:async r=>{if(r.auth?.uid!=='owner')throw new HttpsError('permission-denied','owner');return {page};},decryptToken:()=> 'private-token',graphUrl:p=>'https://graph.facebook.com/v26.0/'+p,META_TOKEN_ENCRYPTION_KEY:{value:()=> 'key'},FieldValue:{serverTimestamp:()=>new Date()},fetchImage:async(url,opts)=>{sent++;assert.ok(url.endsWith('/messages'));assert.equal(opts.headers.Authorization,'Bearer private-token');assert.equal(opts.body.get('messaging_type'),'RESPONSE');assert.equal(opts.body.get('filedata').type,'image/jpeg');return {ok:true,json:async()=>({message_id:'image-result'})};}});const data={pageId:page.pageId,recipientId:peer.id,requestId:'image-request-123456',mimeType:'image/jpeg',imageBase64:jpeg,previewBase64:jpeg};await assert.rejects(send({auth:{uid:'other'},data}),{code:'permission-denied'});await assert.rejects(send({auth:{uid:'owner'},data:{...data,imageBase64:'bad'}}),{code:'invalid-argument'});const result=await send({auth:{uid:'owner'},data});assert.equal(result.messageId,'image-result');assert.equal(sent,1);await assert.rejects(send({auth:{uid:'owner'},data}),{code:'already-exists'});assert.equal(sent,1);const saved=q.data.get('workspaces/fbtq/messages/'+messageKey(threadId,'image-result'));assert.ok(saved.attachments[0].preview.startsWith('data:image/jpeg;base64,'));assert.ok(!JSON.stringify(saved).includes('private-token'));q.data.get('workspaces/fbtq/inbox/'+threadId).optedOut=true;await assert.rejects(send({auth:{uid:'owner'},data:{...data,requestId:'another-request-123'}}),{code:'failed-precondition'});});
test('outgoing image echo adds full URL without duplicating a sent image',async()=>{const q=database(),id=messageKey(threadId,'img-echo');q.data.set('workspaces/fbtq/messages/'+id,{ownerUid:'owner',attachments:[{type:'image',preview:'private-preview'}]});assert.equal(await recordMessage(q.db,page,{sender:{id:page.pageId},recipient:{id:peer.id},timestamp:Date.now(),message:{mid:'img-echo',is_echo:true,attachments:[{type:'image',payload:{url:'https://example.test/full.jpg'}}]}}),false);assert.equal(q.data.get('workspaces/fbtq/messages/'+id).attachments[0].url,'https://example.test/full.jpg');});


test('missing profiles retry after a short cache, fallback photo request bypasses name field failure, manual refresh is owner scoped',async()=>{const {enrichProfile,registerProfileRefresh}=require('../functions/messenger-profile'),q=database();await recordMessage(q.db,page,{sender:{id:peer.id},timestamp:Date.now(),message:{mid:'missing-photo',text:'Chào'}});const path='workspaces/fbtq/inbox/'+threadId;let now=Date.now(),requests=0;const denied=async()=>{requests++;throw new HttpsError('permission-denied','not allowed');};assert.equal((await enrichProfile({db:q.db,page,peerId:peer.id,graph:denied,now})).status,'restricted');assert.equal(requests,3);assert.equal(q.data.get(path).profileRetryAtMs,now+900000);await enrichProfile({db:q.db,page,peerId:peer.id,graph:denied,now:now+1000});assert.equal(requests,3);const graph=async p=>{requests++;if(p.includes('first_name'))throw new HttpsError('permission-denied','name denied');return {profile_pic:'https://example.test/restored.jpg'};};assert.equal((await enrichProfile({db:q.db,page,peerId:peer.id,graph,now:now+61000,force:true})).status,'ready');assert.equal(q.data.get(path).senderPhotoUrl,'https://example.test/restored.jpg');assert.equal(requests,6);const refresh=registerProfileRefresh({db:q.db,onCall:(_,fn)=>fn,HttpsError,owner:async req=>{if(req.auth?.uid!=='owner')throw new HttpsError('permission-denied','owner');return {page};},graph,decryptToken:()=> 'private-token',META_TOKEN_ENCRYPTION_KEY:{value:()=> 'key'}});await assert.rejects(refresh({auth:{uid:'other'},data:{pageId:page.pageId,threadIds:[threadId]}}),{code:'permission-denied'});await assert.rejects(refresh({auth:{uid:'owner'},data:{pageId:page.pageId,threadIds:['f'.repeat(64)]}}),{code:'permission-denied'});const result=await refresh({auth:{uid:'owner'},data:{pageId:page.pageId,threadIds:[threadId]}});assert.equal(result.results[0].status,'ready');assert.equal(result.results[0].cached,true);assert.ok(!JSON.stringify(result).includes('private-token'));});
test('filter reply state follows new messages while unchanged history preserves manual status',async()=>{
 const q=database(),at=Date.now()-3000,event={sender:{id:peer.id},timestamp:at,message:{mid:'filter-new',text:'Tin mới'}};await recordMessage(q.db,page,event);let t=q.data.get('workspaces/fbtq/inbox/'+threadId);assert.equal(t.needsReply,true);
 t.needsReply=false;await storeHistory({db:q.db,page,peer,metaConversationId:'t',rows:[msg('filter-new',peer.id,at)],nextCursor:''});assert.equal(q.data.get('workspaces/fbtq/inbox/'+threadId).needsReply,false);
 await recordMessage(q.db,page,{...event,timestamp:at+1000,message:{mid:'filter-new2',text:'Tin tiếp theo'}});assert.equal(q.data.get('workspaces/fbtq/inbox/'+threadId).needsReply,true);
 await recordMessage(q.db,page,{sender:{id:page.pageId},recipient:{id:peer.id},timestamp:at+2000,message:{mid:'filter-echo',is_echo:true,text:'Đã trả lời'}});assert.equal(q.data.get('workspaces/fbtq/inbox/'+threadId).needsReply,false);
});

test('manual history stays silent unless a recent signed webhook confirms the same incoming message',async()=>{
 const {db,data}=database(),now=Date.now(),at=now-1200;
 const path='workspaces/fbtq/messages/'+messageKey(threadId,'confirmed');
 await storeHistory({db,page,peer,metaConversationId:'manual',rows:[msg('confirmed',peer.id,at)],now});
 assert.equal(data.get(path).historical,true);
 const event={sender:{id:peer.id},timestamp:at,message:{mid:'confirmed',text:'Xin chào'}};
 assert.equal(await recordMessage(db,page,event,now),true);
 assert.equal(data.get(path).source,'meta_webhook');
 assert.equal(data.get(path).historical,false);
 assert.equal(await recordMessage(db,page,event,now),false);
});

test('uses the exact Messenger participant name even when Meta withholds the avatar',async()=>{
 const {enrichProfile}=require('../functions/messenger-profile');
 const {db,data}=database();
 await recordMessage(db,page,{sender:{id:peer.id},timestamp:Date.now(),message:{mid:'identity',text:'Xin chào'}});
 const calls=[];
 const graph=async endpoint=>{
  calls.push(endpoint);
  if(endpoint.includes('/conversations?')){
   assert.equal(new URL('https://graph.test/'+endpoint).searchParams.get('user_id'),peer.id);
   return {data:[{participants:{data:[{id:page.pageId,name:'Trang thử'},{id:'987654',name:'Người khác'},{id:peer.id,name:'Mai Anh'}]}}]};
  }
  throw Object.assign(new HttpsError('permission-denied','Restricted'),{details:{reason:'messenger-profile-restricted'}});
 };
 const result=await enrichProfile({db,page,peerId:peer.id,graph,token:'test'});
 const thread=data.get('workspaces/fbtq/inbox/'+threadId);
 assert.equal(thread.senderName,'Mai Anh');
 assert.equal(thread.profileNameSource,'conversation');
 assert.equal(thread.senderPhotoUrl,undefined);
 assert.equal(result.status,'restricted');
 assert.equal(result.nameUpdated,true);
 assert.equal(calls.length,2);
});

test('recent sync recovers missing incoming and outgoing messages for a webhook-only thread',async()=>{
 const now=Date.now(),calls=[];
 const q=service(async path=>{
  calls.push(path);
  if(path.includes('/conversations?')){
   assert.equal(new URL('https://graph.test/'+path).searchParams.get('user_id'),peer.id);
   return {data:[{id:'other-thread',participants:{data:[{id:page.pageId},{id:'987654'}]}},{id:'right-thread',participants:{data:[{id:page.pageId},peer]}}]};
  }
  assert.ok(path.startsWith('right-thread/messages?'));
  if(path.includes('after=next-history'))return {data:[msg('prior',peer.id,now-5000)]};
  const outgoing=msg('business-suite-reply',page.pageId,now-1000,'Đã trả lời từ Meta');
  return {data:[outgoing,outgoing,msg('live',peer.id,now-2000)],paging:{next:'unused',cursors:{after:'next-history'}}};
 });
 await recordMessage(q.db,page,{sender:{id:peer.id},timestamp:now-2000,message:{mid:'live',text:'Tin tới'}});
 const args=req({threadId,recent:true});
 assert.equal((await q.syncFacebookInbox(args)).imported,2);
 assert.equal(q.data.get('workspaces/fbtq/messages/'+messageKey(threadId,'business-suite-reply')).direction,'outgoing');
 assert.equal(q.data.get('workspaces/fbtq/messages/'+messageKey(threadId,'prior')).historical,true);
 const path='workspaces/fbtq/inbox/'+threadId;
 assert.equal(q.data.get(path).lastIncomingMessageId,messageKey(threadId,'live'));
 assert.equal(q.data.get(path).historyCursor,'next-history');
 q.data.get(path).historyCursor='older-pagination-progress';
 assert.equal((await q.syncFacebookInbox(args)).imported,0);
 assert.equal(q.data.get(path).historyCursor,'older-pagination-progress');
 assert.equal(calls.filter(p=>p.includes('/conversations?')).length,1);
});

test('an outgoing message from the Page is stored once even without an echo flag',async()=>{
 const q=database(),event={sender:{id:page.pageId},recipient:{id:peer.id},timestamp:Date.now(),message:{mid:'suite-echo',text:'Trả lời'}};
 assert.equal(await recordMessage(q.db,page,event),true);
 assert.equal(await recordMessage(q.db,page,{...event,message:{...event.message,is_echo:true}}),false);
 const saved=q.data.get('workspaces/fbtq/messages/'+messageKey(threadId,'suite-echo'));
 assert.equal(saved.direction,'outgoing');
 assert.equal(saved.source,'meta_echo');
 assert.equal(q.data.get('workspaces/fbtq/inbox/'+threadId).lastIncomingAtMs,undefined);
});

test('enabling echoes preserves existing subscriptions and denies app changes for non-directors',async()=>{
 const before={id:process.env.META_APP_ID,url:process.env.META_WEBHOOK_URL};
 process.env.META_APP_ID='999999';process.env.META_WEBHOOK_URL='https://example.test/webhook';
 try{
  const appFields=['messages','feed'],pageFields=['messages','messaging_postbacks','feed'],writes=[];
  const q=service(async(path,token,body)=>{
   if(body)writes.push(path);
   if(path==='999999/subscriptions'&&body){assert.equal(body.callback_url,process.env.META_WEBHOOK_URL);appFields.splice(0,appFields.length,...body.fields.split(','));return {success:true};}
   if(path===page.pageId+'/subscribed_apps'&&body){pageFields.splice(0,pageFields.length,...body.subscribed_fields);return {success:true};}
   if(path==='999999/subscriptions')return {data:[{object:'page',active:true,callback_url:process.env.META_WEBHOOK_URL,fields:appFields.map(name=>({name}))}]};
   if(path.includes('/subscribed_apps?'))return {data:[{id:'999999',subscribed_fields:pageFields}]};
   if(path.includes('/conversations?'))return {data:[{id:'t'}]};
   return {id:page.pageId};
  });
  await assert.rejects(q.checkMessengerConnection({auth:{uid:'owner',role:'employee'},data:{pageId:page.pageId,repairEchoes:true}}),{code:'permission-denied'});
  assert.equal(writes.length,0);
  const result=await q.checkMessengerConnection(req({repairEchoes:true}));
  assert.deepEqual(appFields,['messages','feed','message_echoes']);
  assert.deepEqual(pageFields,['messages','messaging_postbacks','feed','message_echoes']);
  assert.deepEqual(result.checks.map(c=>c.status),['ok','ok','ok','ok']);
  await q.checkMessengerConnection(req({repairEchoes:true}));
  assert.equal(writes.length,2);
 }finally{
  for(const [key,value] of [['META_APP_ID',before.id],['META_WEBHOOK_URL',before.url]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
