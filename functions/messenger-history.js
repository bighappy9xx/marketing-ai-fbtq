const crypto=require('node:crypto'),core=require('./chatbot-core');
const stamp=value=>value?.toMillis?.()||(value?.seconds?value.seconds*1000:value instanceof Date?value.getTime():Number(value)||0);
const messageKey=(thread,mid)=>crypto.createHash('sha256').update(`${thread}:${mid}`).digest('hex');
const MESSENGER_FIELDS=['messages','messaging_postbacks','message_echoes'];
function normalizedMessages(rows,pageId,peerId){return (rows||[]).flatMap(m=>{
 const at=Date.parse(m.created_time),from=String(m.from?.id||'');
 if(typeof m.id!=='string'||!m.id||!Number.isFinite(at)||at<=0||![pageId,peerId].includes(from))return [];
 const attachments=(m.attachments?.data||[]).slice(0,10).map(a=>({type:String(a.mime_type||(a.image_data?'image':'attachment')).slice(0,80),url:[a.file_url,a.image_data?.url,a.video_data?.url,a.url].find(u=>typeof u==='string'&&u.startsWith('https://'))||''}));
 return [{metaMessageId:m.id,at,direction:from===pageId?'outgoing':'incoming',message:String(m.message||'[Tệp đính kèm]').slice(0,10000),attachments}];
});}
async function storeHistory({db,page,peer,metaConversationId,rows,nextCursor,older=false,now=Date.now()}){
 const threadId=core.key(page.pageId,peer.id),threadRef=db.doc(`workspaces/fbtq/inbox/${threadId}`),messages=[...new Map(normalizedMessages(rows,page.pageId,peer.id).map(message=>[message.metaMessageId,message])).values()].sort((a,b)=>a.at-b.at);
 if(!messages.length){if(older)await db.runTransaction(async tx=>{const s=await tx.get(threadRef);if(s.exists&&s.data().ownerUid===page.ownerUid)tx.update(threadRef,{historyCursor:nextCursor||'',historyHasMore:!!nextCursor});});return {threadId,imported:0};}
 return db.runTransaction(async tx=>{
  const thread=await tx.get(threadRef),old=thread.data()||{},existing=[];
  for(const m of messages)existing.push(await tx.get(db.doc(`workspaces/fbtq/messages/${messageKey(threadId,m.metaMessageId)}`)));
  const latest=messages.at(-1);
  let imported=0;
  messages.forEach((m,i)=>{if(existing[i].exists){if(m.attachments.some(a=>a.url)&&!existing[i].data()?.attachments?.some(a=>a.url))tx.update(db.doc(`workspaces/fbtq/messages/${messageKey(threadId,m.metaMessageId)}`),{attachments:m.attachments});return;}const {at,...fields}=m;tx.create(db.doc(`workspaces/fbtq/messages/${messageKey(threadId,m.metaMessageId)}`),{...fields,pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,conversationId:threadId,senderId:peer.id,createdAt:new Date(at),source:'meta_history',historical:true});imported++;});
  const lastIncoming=Math.max(Number(old.lastIncomingAtMs)||0,...messages.filter(m=>m.direction==='incoming'&&m.at<=now).map(m=>m.at),0);
  const canonicalName=!older&&typeof peer.name==='string'?peer.name.trim().slice(0,160):'';
  const patch={pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,model:page.model||'openai',senderId:peer.id,conversationId:threadId,metaConversationId,historyInitialized:true,lastIncomingAtMs:lastIncoming,optedOut:old.optedOut===true||messages.some(m=>m.direction==='incoming'&&core.isOptOut(m.message))};
  if(canonicalName)Object.assign(patch,{senderName:canonicalName,profileNameSource:'conversation',profileNameCheckedAtMs:now});
  if(!thread.exists||latest.at>=Math.max(Number(old.lastMessageAtMs)||0,stamp(old.receivedAt))){Object.assign(patch,{message:latest.message,direction:latest.direction,lastMessageAtMs:latest.at,receivedAt:new Date(latest.at)});if(!thread.exists||latest.at>Math.max(Number(old.lastMessageAtMs)||0,stamp(old.receivedAt)))patch.needsReply=latest.direction==='incoming';if(thread.exists&&latest.at>(Number(old.lastMessageAtMs)||stamp(old.receivedAt))&&latest.direction==='incoming')patch.unread=true;}
  if(!thread.exists)patch.unread=false;
  if(older||!old.historyInitialized){patch.historyCursor=nextCursor||'';patch.historyHasMore=!!nextCursor;}
  tx.set(threadRef,patch,{merge:true});return {threadId,imported};
 });
}
function registerMessengerHistory({db,onCall,HttpsError,owner,graph,decryptToken,META_TOKEN_ENCRYPTION_KEY,META_APP_SECRET,META_VERIFY_TOKEN}){
 const out={},secrets=[META_TOKEN_ENCRYPTION_KEY];
 out.checkMessengerConnection=onCall({invoker:'public',secrets:[...secrets,META_APP_SECRET,...(META_VERIFY_TOKEN?[META_VERIFY_TOKEN]:[])],timeoutSeconds:120,memory:'256MiB'},async req=>{
  const {page,auth}=await owner(req,req.data?.pageId),token=decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()),appId=process.env.META_APP_ID||'',checks=[];
  const appToken=`${appId}|${META_APP_SECRET.value()}`,callback=process.env.META_WEBHOOK_URL;
  const readApp=async()=>(await graph(`${appId}/subscriptions`,appToken)).data?.find(s=>s.object==='page');
  const readPage=async()=>(await graph(`${page.pageId}/subscribed_apps?fields=id,subscribed_fields`,token)).data?.find(a=>a.id===appId);
  const appFields=sub=>(sub?.fields||[]).map(f=>typeof f==='string'?f:f.name).filter(Boolean);
  if(req.data?.repairEchoes===true){
   const [app,pageSub]=await Promise.all([readApp(),readPage()]);
   if(!callback||!appId||!app||app.active===false||app.callback_url!==callback||!appFields(app).includes('messages')||!META_VERIFY_TOKEN)throw new HttpsError('failed-precondition','Kiểm tra webhook Page/messages và Callback URL trong Meta trước khi bật đồng bộ tin gửi.');
   if(!pageSub?.subscribed_fields?.includes('messages'))throw new HttpsError('failed-precondition','Fanpage chưa đăng ký messages với đúng Meta App. Kiểm tra kết nối Fanpage trước khi bật đồng bộ tin gửi.');
   if(!appFields(app).includes('message_echoes')&&auth.profile?.role!=='director')throw new HttpsError('permission-denied','Nhờ Giám đốc bật đồng bộ tin gửi cho ứng dụng Meta trước.');
   if(!appFields(app).includes('message_echoes'))await graph(`${appId}/subscriptions`,appToken,{object:'page',callback_url:callback,verify_token:META_VERIFY_TOKEN.value(),fields:[...new Set([...appFields(app),'message_echoes'])].join(',')});
   if(!pageSub.subscribed_fields.includes('message_echoes'))await graph(`${page.pageId}/subscribed_apps`,token,{subscribed_fields:[...new Set([...pageSub.subscribed_fields,'message_echoes'])]});
  }
  const check=async(key,label,work)=>{try{checks.push({key,label,...await work()});}catch(error){checks.push({key,label,status:'error',detail:error instanceof HttpsError?error.message:'Meta chưa cho phép kiểm tra. Kiểm tra token, quyền và trạng thái App.'});}};
  await check('page','Fanpage và token',async()=>{const data=await graph(`${page.pageId}?fields=id,name`,token);return {status:data.id===page.pageId?'ok':'error',detail:data.id===page.pageId?'Meta xác nhận token của đúng Fanpage.':'Token không khớp Fanpage.'};});
  await check('pageSubscription','Fanpage đăng ký ứng dụng',async()=>{const fields=(await readPage())?.subscribed_fields||[],incoming=fields.includes('messages'),echoes=fields.includes('message_echoes');return {status:incoming&&echoes?'ok':'warning',detail:incoming?(echoes?'Fanpage đã đăng ký nhận cả tin đến và tin gửi.':'Fanpage đã đăng ký tin đến, còn thiếu message_echoes cho tin gửi.'):'Chưa xác nhận Trang đăng ký messages cho Meta App này.'};});
  await check('appSubscription','Ứng dụng đăng ký webhook Page',async()=>{const sub=await readApp(),fields=appFields(sub),ok=!!callback&&sub?.active!==false&&sub?.callback_url===callback&&fields.includes('messages'),echoes=fields.includes('message_echoes');return {status:ok&&echoes?'ok':'warning',detail:ok?(echoes?'Webhook nhận tin đến và tin gửi từ Meta.':'Ứng dụng còn thiếu message_echoes cho tin gửi.'):'Trong Meta → Messenger/Webhooks, xác nhận đúng Callback URL và đăng ký trường messages.'};});
  await check('history','Quyền đọc hội thoại',async()=>{const data=await graph(`${page.pageId}/conversations?platform=messenger&fields=id&limit=1`,token);return {status:data.data?.length?'ok':'warning',detail:data.data?.length?'Meta cho phép đọc hội thoại; có thể đồng bộ lịch sử.':'Meta trả về 0 hội thoại trong phạm vi App được phép đọc. Kiểm tra vai trò thử nghiệm, quyền và App Review.'};});
  return {pageId:page.pageId,checks,lastWebhookAtMs:stamp(page.lastWebhookAt),note:'Nếu App chưa Publish/Live hoặc thiếu mức truy cập, khách ngoài nhóm thử có thể chưa được nhận qua API. Dùng tài khoản thử có vai trò hợp lệ; hoàn tất các yêu cầu Meta để phục vụ khách thật.'};
 });
 out.syncFacebookInbox=onCall({invoker:'public',secrets,timeoutSeconds:120,memory:'256MiB'},async req=>{
  const {page,ref,auth}=await owner(req,req.data?.pageId),{cursor='',threadId=''}=req.data||{};
  if(typeof cursor!=='string'||cursor.length>4000||typeof threadId!=='string'||threadId&&!/^[a-f0-9]{64}$/.test(threadId))throw new HttpsError('invalid-argument','Yêu cầu đồng bộ không hợp lệ.');
  const now=Date.now(),jobId=crypto.randomUUID(),automatic=req.data?.automatic===true,recent=req.data?.recent===true;
  if(recent&&(!threadId||cursor||automatic))throw new HttpsError('invalid-argument','Chọn đúng một hội thoại để cập nhật tin nhắn gần đây.');
  if(automatic){
   if(cursor||threadId)throw new HttpsError('invalid-argument','Đồng bộ tự động đã tắt.');
   return {skipped:true,imported:0,conversations:0};
  }
  await db.runTransaction(async tx=>{
   const data=(await tx.get(ref)).data();
   if(!data||data.ownerUid!==auth.uid)throw new HttpsError('permission-denied','Fanpage không thuộc tài khoản.');
   if(data.syncLockUntil>now)throw new HttpsError('resource-exhausted','Fanpage đang đồng bộ. Đợi hoàn tất trước khi thử lại.');
   tx.update(ref,{syncLockUntil:now+150000,syncJobId:jobId});
  });
  try{
   const token=decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()),fields='id,message,from,to,created_time,attachments';
   let threads,nextCursor='',olderCursor='',historyThreads=[];
   let pagePhotoUrl=page.pagePhotoUrl||'';if(!pagePhotoUrl||Date.now()-(page.pagePhotoCheckedAtMs||0)>86400000){try{const photo=await graph(`${page.pageId}?fields=picture`,token);const url=require('./messenger-profile').profileFields({profile_pic:photo.picture?.data?.url}).senderPhotoUrl;if(typeof url==='string'&&url.startsWith('https://')){pagePhotoUrl=url;await ref.update({pagePhotoUrl,pagePhotoCheckedAtMs:Date.now()});}}catch{}}
   if(threadId){
    const t=(await db.doc(`workspaces/fbtq/inbox/${threadId}`).get()).data();
    if(!t||t.pageId!==page.pageId||t.ownerUid!==auth.uid||!/^\d{5,30}$/.test(t.senderId)||core.key(page.pageId,t.senderId)!==threadId)throw new HttpsError('permission-denied','Hội thoại không thuộc Fanpage đã chọn.');
    if(recent){
     let id=t.metaConversationId,peer={id:t.senderId};
     if(!id){
      const data=await graph(`${page.pageId}/conversations?${new URLSearchParams({platform:'messenger',user_id:peer.id,fields:'id,participants',limit:'5'})}`,token);
      const match=data.data?.find(item=>item.id&&item.participants?.data?.some(p=>p.id===peer.id));
      if(!match)throw new HttpsError('not-found','Meta chưa trả về hội thoại này. Kiểm tra quyền đọc hội thoại của Fanpage.');
      id=match.id;
      peer=match.participants.data.find(p=>p.id===peer.id);
     }
     let after='',imported=0;
     const seen=new Set();
     for(let batch=0;batch<4;batch++){
      const data=await graph(`${encodeURIComponent(id)}/messages?${new URLSearchParams({fields,limit:'25',...(after?{after}:{})})}`,token);
      const nextCursor=data.paging?.next?data.paging?.cursors?.after||'':'';
      imported+=(await storeHistory({db,page,peer,metaConversationId:id,rows:data.data,nextCursor})).imported;
      if(!nextCursor||seen.has(nextCursor))break;
      seen.add(nextCursor);
      after=nextCursor;
     }
     return {conversations:1,imported,errors:[]};
    }
    if(!t.metaConversationId||!t.historyCursor)return {conversations:0,imported:0,hasMore:false,errors:[]};
    threads=[{id:t.metaConversationId,peer:{id:t.senderId,name:t.senderName},after:t.historyCursor}];
   }
   else{const data=await graph(`${page.pageId}/conversations?${new URLSearchParams({platform:'messenger',fields:'id,participants',limit:'5',...(cursor?{after:cursor}:{})})}`,token);threads=(data.data||[]).slice(0,5).map(c=>{const peers=(c.participants?.data||[]).filter(p=>p.id!==page.pageId&&/^\d{5,30}$/.test(p.id));return {...c,peer:peers.length===1?peers[0]:null};});nextCursor=data.paging?.next?data.paging?.cursors?.after||'':'';}
   const fetched=await Promise.allSettled(threads.map(async t=>{if(!t.peer)throw Error('Không xác định được người tham gia.');const data=await graph(`${encodeURIComponent(t.id)}/messages?${new URLSearchParams({fields,limit:'25',...(t.after?{after:t.after}:{})})}`,token);return {t,data};}));
   let imported=0,conversations=0;const errors=[];
   for(const result of fetched){if(result.status==='rejected'){errors.push('Meta chưa cho phép đọc một hội thoại; kiểm tra quyền và phạm vi App.');continue;}const {t,data}=result.value;const messageCursor=data.paging?.next?data.paging?.cursors?.after||'':'';if(threadId&&messageCursor&&messageCursor===t.after)throw new HttpsError('unavailable','Meta trả lại mốc lịch sử cũ. Dừng tải để tránh lặp; thử lại sau.');olderCursor=messageCursor;const saved=await storeHistory({db,page,peer:t.peer,metaConversationId:t.id,rows:data.data,nextCursor:messageCursor,older:!!threadId});historyThreads.push({threadId:saved.threadId,hasMore:!!messageCursor});imported+=saved.imported;conversations++;}
   await Promise.allSettled(fetched.filter(r=>r.status==='fulfilled').map(r=>require('./messenger-profile').enrichProfile({db,page,peerId:r.value.t.peer.id,graph,token})));
   await ref.set({lastHistorySyncAt:new Date(),lastHistorySyncCount:imported},{merge:true});return {conversations,imported,nextCursor,hasMore:threadId?!!olderCursor:!!nextCursor,historyThreads,pagePhotoUrl,pageInboxColor:/^#[a-f0-9]{6}$/i.test(page.inboxColor||'')?page.inboxColor:'',errors,limitConversations:5,limitMessages:25,note:'Chỉ tải dữ liệu Meta cho phép. Tin lịch sử không kích hoạt bot tự động hoặc làm mới cửa sổ gửi 24 giờ.'};
  }finally{await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.data()?.syncJobId===jobId)tx.update(ref,{syncLockUntil:0});}).catch(()=>{});}
 });
 return out;
}
module.exports={registerMessengerHistory,normalizedMessages,storeHistory,messageKey,stamp,MESSENGER_FIELDS};
