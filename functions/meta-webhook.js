const crypto=require('node:crypto'),core=require('./chatbot-core');
const {messageKey,stamp}=require('./messenger-history');
async function storeWebhookMessage(db,page,event,now=Date.now()){
 const echo=event.message?.is_echo===true,peer=String((echo?event.recipient:event.sender)?.id||''),at=Math.min(now,Number(event.timestamp)||now);
 if(!/^\d{5,30}$/.test(peer)||peer===page.pageId||!event.message)return false;
 const text=String(event.message.text||'[Đã nhận tệp đính kèm]').slice(0,10000),threadId=core.key(page.pageId,peer),mid=String(event.message.mid||`${event.timestamp}:${peer}:${text}`),id=messageKey(threadId,mid);
 const threadRef=db.doc(`workspaces/fbtq/inbox/${threadId}`),messageRef=db.doc(`workspaces/fbtq/messages/${id}`),direction=echo?'outgoing':'incoming';
 const attachments=(event.message.attachments||[]).slice(0,10).map(a=>({type:String(a.type||'attachment').slice(0,80),url:typeof a.payload?.url==='string'&&a.payload.url.startsWith('https://')?a.payload.url:''}));
 return db.runTransaction(async tx=>{
  const [thread,message]=await Promise.all([tx.get(threadRef),tx.get(messageRef)]);
  const previous=message.data();
  const promote=message.exists&&!echo&&previous?.source==='meta_history'&&previous.historical===true&&at>now-30000;
  if(message.exists&&!promote){if(echo&&attachments.some(a=>a.url))tx.update(messageRef,{attachments:attachments.map((a,i)=>({...a,...(message.data().attachments?.[i]?.preview?{preview:message.data().attachments[i].preview}:{})}))});return false;}const old=thread.data()||{};
  const patch={pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,model:page.model||'openai',conversationId:threadId,senderId:peer};
  if(at>=Math.max(Number(old.lastMessageAtMs)||0,stamp(old.receivedAt)))Object.assign(patch,{message:text,direction,attachments,receivedAt:new Date(at),lastMessageAtMs:at,needsReply:!echo});
  if(!echo){patch.lastIncomingAtMs=Math.max(Number(old.lastIncomingAtMs)||0,at);patch.optedOut=old.optedOut===true||core.isOptOut(text);patch.unread=true;if(at>=(Number(old.lastIncomingAtMs)||0))patch.lastIncomingMessageId=id;}
  tx.set(threadRef,patch,{merge:true});
  const messageData={pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,conversationId:threadId,senderId:peer,message:text,direction,attachments,metaMessageId:mid,source:echo?'meta_echo':'meta_webhook',createdAt:new Date(at)};
  if(promote)tx.update(messageRef,{source:'meta_webhook',historical:false});
  else tx.create(messageRef,messageData);
  return {id,message:promote?{...previous,source:'meta_webhook',historical:false}:messageData};
 });
}
async function recordMessage(db,page,event,now){
 return Boolean(await storeWebhookMessage(db,page,event,now));
}
async function refreshProfiles(db,page,events,token){
 const peers=[...new Set(events.filter(e=>e.message&&!e.message.is_echo).map(e=>String(e.sender?.id||'')))].filter(id=>/^\d{5,30}$/.test(id)&&id!==page.pageId).slice(0,3);
 const graph=async(path,access)=>{
  const response=await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION||'v26.0'}/${path}`,{headers:{Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(7000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok){
   const error=Error('profile-unavailable');
   if([401,403].includes(response.status)||[10,200,294,299].includes(Number(data?.error?.code)))error.code='permission-denied';
   if(Number(data?.error?.code)===100&&Number(data?.error?.error_subcode)===33){
    error.code='permission-denied';
    error.details={reason:'messenger-profile-restricted'};
   }
   throw error;
  }
  return data;
 };
 await Promise.allSettled(peers.map(peerId=>require('./messenger-profile').enrichProfile({db,page,peerId,graph,token,force:true})));
}
function registerMetaWebhook({db,onRequest,META_VERIFY_TOKEN,META_APP_SECRET,META_TOKEN_ENCRYPTION_KEY,decryptToken,logger,replyToIncoming,replySecrets=[]}){
 const secrets=[...new Set([META_VERIFY_TOKEN,META_APP_SECRET,...(META_TOKEN_ENCRYPTION_KEY?[META_TOKEN_ENCRYPTION_KEY]:[]),...replySecrets])];
 return onRequest({invoker:'public',secrets,minInstances:1,timeoutSeconds:120,memory:'256MiB'},async(req,res)=>{
  if(req.method==='GET'){if(req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===META_VERIFY_TOKEN.value()&&typeof req.query['hub.challenge']==='string')return res.status(200).send(req.query['hub.challenge']);return res.sendStatus(403);}
  if(req.method!=='POST')return res.sendStatus(405);
  const signature=req.get('x-hub-signature-256')||'',raw=req.rawBody||Buffer.from(JSON.stringify(req.body||{})),expected='sha256='+crypto.createHmac('sha256',META_APP_SECRET.value()).update(raw).digest('hex');
  if(!/^sha256=[a-f0-9]{64}$/i.test(signature)||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return res.sendStatus(401);
  if(req.body?.object!=='page')return res.sendStatus(200);
  async function processEntry(entry){
   const pageId=String(entry.id||'');
   if(!/^\d{5,30}$/.test(pageId))return 0;
   const ref=db.doc(`workspaces/fbtq/pages/${pageId}`),config=(await ref.get()).data();
   if(config?.active!==true)return 0;
   const page={...config,pageId},events=entry.messaging||[];
   let stored=0;
   // Preserve ordering within an inbox thread while unrelated customers run in parallel.
   const groups=new Map();
   for(const event of events){
    if(!event.message)continue;
    const peer=String((event.message.is_echo?event.recipient:event.sender)?.id||'');
    if(!groups.has(peer))groups.set(peer,[]);
    groups.get(peer).push(event);
   }
   const writes=[...groups.values()].map(async group=>{
    let latest;
    for(const event of group){
     const saved=await storeWebhookMessage(db,page,event);
     if(!saved)continue;
     stored++;
     if(saved.message.direction==='incoming'&&(!latest||stamp(saved.message.createdAt)>=stamp(latest.message.createdAt)))latest=saved;
    }
    return latest;
   });
   const deliveries=Promise.allSettled(writes.map(async write=>{
    const latest=await write;
    if(latest&&replyToIncoming)await replyToIncoming(latest.id,latest.message,page,receivedAt);
   }));
   await Promise.allSettled(writes);
   const diagnostics=ref.set({lastWebhookAt:new Date(),lastWebhookMessageCount:stored},{merge:true});
   const profile=Promise.resolve().then(()=>{
    if(META_TOKEN_ENCRYPTION_KEY)return refreshProfiles(db,page,events,decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()));
   });
   const [status,,replies]=await Promise.allSettled([diagnostics,profile,deliveries]);
   if(status.status==='rejected'||replies.value.some(result=>result.status==='rejected'))throw new Error('Webhook processing failed');
   return stored;
  }
  const receivedAt=Date.now();
  try{
   const results=await Promise.allSettled((req.body.entry||[]).map(processEntry));
   if(results.some(result=>result.status==='rejected'))throw new Error('Webhook entry failed');
   logger.info('Meta webhook processed',{storedMessages:results.reduce((sum,result)=>sum+result.value,0)});
   return res.sendStatus(200);
  }
  catch{logger.error('Meta webhook event processing failed');return res.sendStatus(500);}
 });
}
module.exports={registerMetaWebhook,recordMessage};
