const crypto=require('node:crypto'),core=require('./chatbot-core');
const {messageKey,stamp}=require('./messenger-history');
async function recordMessage(db,page,event,now=Date.now()){
 const echo=event.message?.is_echo===true,peer=String((echo?event.recipient:event.sender)?.id||''),at=Math.min(now,Number(event.timestamp)||now);
 if(!/^\d{5,30}$/.test(peer)||peer===page.pageId||!event.message)return false;
 const text=String(event.message.text||'[Đã nhận tệp đính kèm]').slice(0,10000),threadId=core.key(page.pageId,peer),mid=String(event.message.mid||`${event.timestamp}:${peer}:${text}`),id=messageKey(threadId,mid);
 const threadRef=db.doc(`workspaces/fbtq/inbox/${threadId}`),messageRef=db.doc(`workspaces/fbtq/messages/${id}`),direction=echo?'outgoing':'incoming';
 const attachments=(event.message.attachments||[]).slice(0,10).map(a=>({type:String(a.type||'attachment').slice(0,80),url:typeof a.payload?.url==='string'&&a.payload.url.startsWith('https://')?a.payload.url:''}));
 return db.runTransaction(async tx=>{
  const thread=await tx.get(threadRef),message=await tx.get(messageRef);if(message.exists){if(echo&&attachments.some(a=>a.url))tx.update(messageRef,{attachments:attachments.map((a,i)=>({...a,...(message.data().attachments?.[i]?.preview?{preview:message.data().attachments[i].preview}:{})}))});return false;}const old=thread.data()||{};
  const patch={pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,model:page.model||'openai',conversationId:threadId,senderId:peer};
  if(at>=Math.max(Number(old.lastMessageAtMs)||0,stamp(old.receivedAt)))Object.assign(patch,{message:text,direction,attachments,receivedAt:new Date(at),lastMessageAtMs:at});
  if(!echo){patch.lastIncomingAtMs=Math.max(Number(old.lastIncomingAtMs)||0,at);patch.optedOut=old.optedOut===true||core.isOptOut(text);patch.unread=true;if(at>=(Number(old.lastIncomingAtMs)||0))patch.lastIncomingMessageId=id;}
  tx.set(threadRef,patch,{merge:true});tx.create(messageRef,{pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,conversationId:threadId,senderId:peer,message:text,direction,attachments,metaMessageId:mid,source:echo?'meta_echo':'meta_webhook',createdAt:new Date(at)});return true;
 });
}
function registerMetaWebhook({db,onRequest,META_VERIFY_TOKEN,META_APP_SECRET,META_TOKEN_ENCRYPTION_KEY,decryptToken,logger}){
 return onRequest({invoker:'public',secrets:[META_VERIFY_TOKEN,META_APP_SECRET,...(META_TOKEN_ENCRYPTION_KEY?[META_TOKEN_ENCRYPTION_KEY]:[])],timeoutSeconds:60,memory:'256MiB'},async(req,res)=>{
  if(req.method==='GET'){if(req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===META_VERIFY_TOKEN.value()&&typeof req.query['hub.challenge']==='string')return res.status(200).send(req.query['hub.challenge']);return res.sendStatus(403);}
  if(req.method!=='POST')return res.sendStatus(405);
  const signature=req.get('x-hub-signature-256')||'',raw=req.rawBody||Buffer.from(JSON.stringify(req.body||{})),expected='sha256='+crypto.createHmac('sha256',META_APP_SECRET.value()).update(raw).digest('hex');
  if(!/^sha256=[a-f0-9]{64}$/i.test(signature)||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return res.sendStatus(401);
  if(req.body?.object!=='page')return res.sendStatus(200);
  try{let stored=0;for(const entry of req.body.entry||[]){const pageId=String(entry.id||'');if(!/^\d{5,30}$/.test(pageId))continue;const ref=db.doc(`workspaces/fbtq/pages/${pageId}`),snap=await ref.get(),page=snap.data();if(!page||page.active!==true)continue;const before=stored;for(const event of entry.messaging||[])if(event.message&&await recordMessage(db,{...page,pageId},event))stored++;await ref.set({lastWebhookAt:new Date(),lastWebhookMessageCount:stored-before},{merge:true});if(META_TOKEN_ENCRYPTION_KEY){try{const token=decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value());const peers=[...new Set((entry.messaging||[]).filter(e=>e.message&&!e.message.is_echo).map(e=>String(e.sender?.id||'')))].filter(id=>/^\d{5,30}$/.test(id)&&id!==pageId).slice(0,3);const graph=async(path,access)=>{const r=await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION||'v26.0'}/${path}`,{headers:{Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(7000)});if(!r.ok){const e=Error('profile-unavailable');if([400,401,403].includes(r.status))e.code='permission-denied';throw e;}return r.json();};await Promise.allSettled(peers.map(peerId=>require('./messenger-profile').enrichProfile({db,page:{...page,pageId},peerId,graph,token})));}catch{}}}logger.info('Meta webhook processed',{storedMessages:stored});return res.sendStatus(200);}
  catch{logger.error('Meta webhook event processing failed');return res.sendStatus(500);}
 });
}
module.exports={registerMetaWebhook,recordMessage};
