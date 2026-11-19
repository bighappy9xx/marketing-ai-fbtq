const crypto=require('node:crypto'),core=require('./chatbot-core');
const {messageKey,stamp}=require('./messenger-history');
async function storeWebhookMessage(db,page,event,now=Date.now()){
 const echo=event.message?.is_echo===true,peer=String((echo?event.recipient:event.sender)?.id||''),at=Math.min(now,Number(event.timestamp)||now);
 if(!/^\d{5,30}$/.test(peer)||peer===page.pageId||!event.message)return false;
 const text=String(event.message.text||'[Đã nhận tệp đính kèm]').slice(0,10000),threadId=core.key(page.pageId,peer),mid=String(event.message.mid||`${event.timestamp}:${peer}:${text}`),id=messageKey(threadId,mid);
 const threadRef=db.doc(`workspaces/fbtq/inbox/${threadId}`),messageRef=db.doc(`workspaces/fbtq/messages/${id}`),direction=echo?'outgoing':'incoming';
 const attachments=(event.message.attachments||[]).slice(0,10).map(a=>({type:String(a.type||'attachment').slice(0,80),url:typeof a.payload?.url==='string'&&a.payload.url.startsWith('https://')?a.payload.url:''}));
 return db.runTransaction(async tx=>{
  const thread=await tx.get(threadRef),message=await tx.get(messageRef);
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
  if(!response.ok){
   const error=Error('profile-unavailable');
   if([400,401,403].includes(response.status))error.code='permission-denied';
   throw error;
  }
  return response.json();
 };
 await Promise.allSettled(peers.map(peerId=>require('./messenger-profile').enrichProfile({db,page,peerId,graph,token,force:true})));
}
function registerMetaWebhook({db,onRequest,META_VERIFY_TOKEN,META_APP_SECRET,META_TOKEN_ENCRYPTION_KEY,decryptToken,logger,replyToIncoming,replySecrets=[]}){
 const secrets=[...new Set([META_VERIFY_TOKEN,META_APP_SECRET,...(META_TOKEN_ENCRYPTION_KEY?[META_TOKEN_ENCRYPTION_KEY]:[]),...replySecrets])];
 return onRequest({invoker:'public',secrets,timeoutSeconds:120,memory:'256MiB'},async(req,res)=>{
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
   const page={...config,pageId},events=entry.messaging||[],incoming=[];
   let stored=0;
   for(const event of events){
    if(!event.message)continue;
    const saved=await storeWebhookMessage(db,page,event);
    if(!saved)continue;
    stored++;
    if(saved.message.direction==='incoming')incoming.push(saved);
   }
   const replies=replyToIncoming?incoming.map(({id,message})=>replyToIncoming(id,message,page)):[];
   const diagnostics=ref.set({lastWebhookAt:new Date(),lastWebhookMessageCount:stored},{merge:true});
   const profile=Promise.resolve().then(()=>{
    if(META_TOKEN_ENCRYPTION_KEY)return refreshProfiles(db,page,events,decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()));
   });
   const results=await Promise.allSettled([...replies,diagnostics,profile]);
   if(results.slice(0,-1).some(result=>result.status==='rejected'))throw new Error('Webhook processing failed');
   return stored;
  }
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
