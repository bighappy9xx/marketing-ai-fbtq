const crypto=require('node:crypto'),core=require('./chatbot-core');
const stamp=value=>value?.toMillis?.()||(value?.seconds?value.seconds*1000:value instanceof Date?value.getTime():Number(value)||0);
const messageKey=(thread,mid)=>crypto.createHash('sha256').update(`${thread}:${mid}`).digest('hex');
function normalizedMessages(rows,pageId,peerId){return (rows||[]).flatMap(m=>{
 const at=Date.parse(m.created_time),from=String(m.from?.id||'');
 if(typeof m.id!=='string'||!m.id||!Number.isFinite(at)||at<=0||![pageId,peerId].includes(from))return [];
 const attachments=(m.attachments?.data||[]).slice(0,10).map(a=>({type:String(a.mime_type||'attachment').slice(0,80),url:[a.file_url,a.image_data?.url,a.video_data?.url,a.url].find(u=>typeof u==='string'&&u.startsWith('https://'))||''}));
 return [{metaMessageId:m.id,at,direction:from===pageId?'outgoing':'incoming',message:String(m.message||'[Tệp đính kèm]').slice(0,10000),attachments}];
});}
async function storeHistory({db,page,peer,metaConversationId,rows,nextCursor,older=false,now=Date.now()}){
 const threadId=core.key(page.pageId,peer.id),threadRef=db.doc(`workspaces/fbtq/inbox/${threadId}`),messages=normalizedMessages(rows,page.pageId,peer.id).sort((a,b)=>a.at-b.at);
 if(!messages.length)return {threadId,imported:0};
 return db.runTransaction(async tx=>{
  const thread=await tx.get(threadRef),old=thread.data()||{},existing=[];
  for(const m of messages)existing.push(await tx.get(db.doc(`workspaces/fbtq/messages/${messageKey(threadId,m.metaMessageId)}`)));
  let imported=0;
  messages.forEach((m,i)=>{if(existing[i].exists)return;const {at,...fields}=m;tx.create(db.doc(`workspaces/fbtq/messages/${messageKey(threadId,m.metaMessageId)}`),{...fields,pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,conversationId:threadId,senderId:peer.id,createdAt:new Date(at),source:'meta_history',historical:true});imported++;});
  const latest=messages.at(-1),lastIncoming=Math.max(Number(old.lastIncomingAtMs)||0,...messages.filter(m=>m.direction==='incoming'&&m.at<=now).map(m=>m.at),0);
  const patch={pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,model:page.model||'openai',senderId:peer.id,senderName:String(peer.name||old.senderName||'').slice(0,160),conversationId:threadId,metaConversationId,historyInitialized:true,lastIncomingAtMs:lastIncoming,optedOut:old.optedOut===true||messages.some(m=>m.direction==='incoming'&&core.isOptOut(m.message))};
  if(!thread.exists||latest.at>=Math.max(Number(old.lastMessageAtMs)||0,stamp(old.receivedAt))){Object.assign(patch,{message:latest.message,direction:latest.direction,lastMessageAtMs:latest.at,receivedAt:new Date(latest.at)});}
  if(!thread.exists)patch.unread=false;
  if(older||!old.historyInitialized){patch.historyCursor=nextCursor||'';patch.historyHasMore=!!nextCursor;}
  tx.set(threadRef,patch,{merge:true});return {threadId,imported};
 });
}
function registerMessengerHistory({db,onCall,HttpsError,owner,graph,decryptToken,META_TOKEN_ENCRYPTION_KEY,META_APP_SECRET}){
 const out={},secrets=[META_TOKEN_ENCRYPTION_KEY];
 out.checkMessengerConnection=onCall({invoker:'public',secrets:[...secrets,META_APP_SECRET],timeoutSeconds:90,memory:'256MiB'},async req=>{
  const {page}=await owner(req,req.data?.pageId),token=decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()),appId=process.env.META_APP_ID||'',checks=[];
  const check=async(key,label,work)=>{try{checks.push({key,label,...await work()});}catch(error){checks.push({key,label,status:'error',detail:error instanceof HttpsError?error.message:'Meta chưa cho phép kiểm tra. Kiểm tra token, quyền và trạng thái App.'});}};
  await check('page','Fanpage và token',async()=>{const data=await graph(`${page.pageId}?fields=id,name`,token);return {status:data.id===page.pageId?'ok':'error',detail:data.id===page.pageId?'Meta xác nhận token của đúng Fanpage.':'Token không khớp Fanpage.'};});
  await check('pageSubscription','Fanpage đăng ký ứng dụng',async()=>{const data=await graph(`${page.pageId}/subscribed_apps?fields=id,subscribed_fields`,token),app=(data.data||[]).find(a=>a.id===appId),ok=app?.subscribed_fields?.includes('messages');return {status:ok?'ok':'warning',detail:ok?'Trang đã đăng ký messages cho đúng Meta App.':'Chưa xác nhận Trang đăng ký messages cho Meta App này.'};});
  await check('appSubscription','Ứng dụng đăng ký webhook Page',async()=>{const data=await graph(`${appId}/subscriptions`,`${appId}|${META_APP_SECRET.value()}`),sub=(data.data||[]).find(s=>s.object==='page'),fields=(sub?.fields||[]).map(f=>typeof f==='string'?f:f.name),ok=sub?.active!==false&&fields.includes('messages')&&sub?.callback_url===process.env.META_WEBHOOK_URL;return {status:ok?'ok':'warning',detail:ok?'Webhook Page/messages đang trỏ đúng máy chủ.':'Trong Meta → Messenger/Webhooks, Verify & Save đúng Callback URL và đăng ký trường messages.'};});
  await check('history','Quyền đọc hội thoại',async()=>{const data=await graph(`${page.pageId}/conversations?platform=messenger&fields=id&limit=1`,token);return {status:data.data?.length?'ok':'warning',detail:data.data?.length?'Meta cho phép đọc hội thoại; có thể đồng bộ lịch sử.':'Meta trả về 0 hội thoại trong phạm vi App được phép đọc. Kiểm tra vai trò thử nghiệm, quyền và App Review.'};});
  return {pageId:page.pageId,checks,lastWebhookAtMs:stamp(page.lastWebhookAt),note:'Nếu App chưa Publish/Live hoặc thiếu mức truy cập, khách ngoài nhóm thử có thể chưa được nhận qua API. Dùng tài khoản thử có vai trò hợp lệ; hoàn tất các yêu cầu Meta để phục vụ khách thật.'};
 });
 out.syncFacebookInbox=onCall({invoker:'public',secrets,timeoutSeconds:120,memory:'256MiB'},async req=>{
  const {page,ref,auth}=await owner(req,req.data?.pageId),{cursor='',threadId=''}=req.data||{};
  if(typeof cursor!=='string'||cursor.length>4000||typeof threadId!=='string'||threadId&&!/^[a-f0-9]{64}$/.test(threadId))throw new HttpsError('invalid-argument','Yêu cầu đồng bộ không hợp lệ.');
  const now=Date.now(),jobId=crypto.randomUUID(),automatic=req.data?.automatic===true;
  if(automatic&&(cursor||threadId))throw new HttpsError('invalid-argument','Đồng bộ tự động chỉ lấy hội thoại gần đây.');
  let skipped=false;
  await db.runTransaction(async tx=>{const snap=await tx.get(ref),data=snap.data();if(!data||data.ownerUid!==auth.uid)throw new HttpsError('permission-denied','Fanpage không thuộc tài khoản.');if(automatic&&now-(data.lastAutoSyncAtMs||0)<60000){skipped=true;return;}if(data.syncLockUntil>now)throw new HttpsError('resource-exhausted','Fanpage đang đồng bộ. Đợi hoàn tất trước khi thử lại.');tx.update(ref,{syncLockUntil:now+150000,syncJobId:jobId,...(automatic?{lastAutoSyncAtMs:now}:{})});});
  if(skipped)return {skipped:true,imported:0,conversations:0};
  try{
   const token=decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()),fields='id,message,from,to,created_time,attachments';
   let threads,nextCursor='';
   if(threadId){const snap=await db.doc(`workspaces/fbtq/inbox/${threadId}`).get(),t=snap.data();if(!t||t.pageId!==page.pageId||t.ownerUid!==auth.uid||!t.metaConversationId)throw new HttpsError('permission-denied','Hội thoại không thuộc Fanpage đã chọn hoặc chưa được đồng bộ.');if(!t.historyCursor)return {conversations:0,imported:0,hasMore:false,errors:[]};threads=[{id:t.metaConversationId,peer:{id:t.senderId,name:t.senderName},after:t.historyCursor}];}
   else{const data=await graph(`${page.pageId}/conversations?${new URLSearchParams({platform:'messenger',fields:'id,participants,updated_time',limit:'5',...(cursor?{after:cursor}:{})})}`,token);threads=(data.data||[]).slice(0,5).map(c=>{const peers=(c.participants?.data||[]).filter(p=>p.id!==page.pageId&&/^\d{5,30}$/.test(p.id));return {...c,peer:peers.length===1?peers[0]:null};});nextCursor=data.paging?.next?data.paging?.cursors?.after||'':'';}
   const fetched=await Promise.allSettled(threads.map(async t=>{if(!t.peer)throw Error('Không xác định được người tham gia.');const data=await graph(`${encodeURIComponent(t.id)}/messages?${new URLSearchParams({fields,limit:'25',...(t.after?{after:t.after}:{})})}`,token);return {t,data};}));
   let imported=0,conversations=0;const errors=[];
   for(const result of fetched){if(result.status==='rejected'){errors.push('Meta chưa cho phép đọc một hội thoại; kiểm tra quyền và phạm vi App.');continue;}const {t,data}=result.value;const saved=await storeHistory({db,page,peer:t.peer,metaConversationId:t.id,rows:data.data,nextCursor:data.paging?.next?data.paging?.cursors?.after||'':'',older:!!threadId});imported+=saved.imported;conversations++;}
   await Promise.allSettled(fetched.filter(r=>r.status==='fulfilled').map(r=>require('./messenger-profile').enrichProfile({db,page,peerId:r.value.t.peer.id,graph,token})));
   await ref.set({lastHistorySyncAt:new Date(),lastHistorySyncCount:imported},{merge:true});return {conversations,imported,nextCursor,hasMore:!!nextCursor,errors,limitConversations:5,limitMessages:25,note:'Chỉ tải dữ liệu Meta cho phép. Tin lịch sử không kích hoạt bot tự động hoặc làm mới cửa sổ gửi 24 giờ.'};
  }finally{await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.data()?.syncJobId===jobId)tx.update(ref,{syncLockUntil:0});}).catch(()=>{});}
 });
 return out;
}
module.exports={registerMessengerHistory,normalizedMessages,storeHistory,messageKey,stamp};
