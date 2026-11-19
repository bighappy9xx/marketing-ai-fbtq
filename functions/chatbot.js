const crypto=require('node:crypto');
const core=require('./chatbot-core');
const {validateFaqs,relevantFaqs,findFaqReply,replyInstructions}=require('./chatbot-faq');
const {metaConfig,loginUrl}=require('./meta-config');
const {requireAIAccount}=require('./ai-policy');
module.exports.registerChatbot=function({db,onCall,onRequest,HttpsError,FieldValue,requireSignedIn,encryptToken,decryptToken,graphUrl,generateWithProvider,META_TOKEN_ENCRYPTION_KEY,META_APP_SECRET,META_VERIFY_TOKEN,GEMINI_API_KEY,OPENAI_API_KEY,logger}){
  const out={},secret=[META_TOKEN_ENCRYPTION_KEY],pages='workspaces/fbtq/pages',inbox='workspaces/fbtq/inbox',sessions='metaOAuthSessions';
  const callable=(opts,handler)=>onCall({...opts,invoker:'public'},handler);
  const signedIn=async request=>{const auth=await requireSignedIn(request);requireAIAccount(auth,HttpsError);return auth;};
  const fail=(m)=>{throw new HttpsError('failed-precondition',m);};
  async function owner(request,pageId){const auth=await signedIn(request);if(!/^\d{5,30}$/.test(String(pageId)))fail('Page ID không hợp lệ.');const ref=db.doc(`${pages}/${pageId}`),snap=await ref.get();if(!snap.exists||snap.data().ownerUid!==auth.uid)throw new HttpsError('permission-denied','Fanpage không thuộc tài khoản.');return {auth,ref,page:snap.data()};}
  async function graph(path,token,body){
    let response;try{response=await fetch(graphUrl(path),{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{throw new HttpsError('unavailable','Không kết nối được Meta. Không tự gửi lại yêu cầu.');}
    const data=await response.json().catch(()=>null);if(!data)throw new HttpsError('unavailable','Meta chưa trả về dữ liệu hợp lệ.');
    if(!response.ok){const code=Number(data.error?.code)||response.status;if(code===190)throw new HttpsError('failed-precondition','Page Token đã hết hiệu lực hoặc bị thu hồi. Kết nối lại Fanpage bằng tài khoản có quyền.');if(code===100&&Number(data.error?.error_subcode)===33&&/^\d+\?fields=(?:first_name,last_name,)?profile_pic$/.test(path))throw new HttpsError('permission-denied','Meta chưa cho phép đọc hồ sơ Messenger này.',{reason:'messenger-profile-restricted'});if([10,200,294,299].includes(code))throw new HttpsError('permission-denied',`Meta từ chối quyền (${code}). Kiểm tra pages_messaging, pages_manage_metadata, pages_read_engagement, vai trò thử nghiệm và App Review.`);if([4,17,32,613].includes(code))throw new HttpsError('resource-exhausted','Meta đang giới hạn số yêu cầu. Chờ hạn mức phục hồi.');throw new HttpsError('unavailable',`Meta từ chối yêu cầu (${code}). Kiểm tra token, quyền và tình trạng ứng dụng.`);}
    return data;
  }
  async function send(page,recipientId,text,source='manual',autoReply){
    const ref=db.doc(`${inbox}/${core.key(page.pageId,recipientId)}`),current=(await ref.get()).data();
    if(autoReply&&!canReplyTo(current,autoReply.messageId))return;
    if(!page.active||!core.eligible({...current,...(source==='manual'?{humanPaused:false}:{})}))fail('Hội thoại ngoài 24 giờ, đã dừng nhận tin hoặc đang chuyển nhân viên.');
    if(!text?.trim()||text.length>2000)fail('Tin nhắn cần từ 1 đến 2.000 ký tự.');
    const token=decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value());
    const sendingAt=Date.now();
    const result=await graph(`${page.pageId}/messages`,token,{recipient:{id:recipientId},message:{text:text.trim()},messaging_type:'RESPONSE'});
    if(autoReply){
      const acceptedAt=Date.now();
      logger?.info('Messenger automatic reply accepted',{type:autoReply.type,metaMs:acceptedAt-sendingAt,prepareMs:sendingAt-autoReply.startedAt,...(autoReply.receivedAt!==undefined?{webhookMs:acceptedAt-autoReply.receivedAt}:{})});
    }
    const message={pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,senderId:recipientId,conversationId:ref.id,direction:'outgoing',message:text.trim(),source,createdAt:FieldValue.serverTimestamp()};
    const messageRef=db.collection('workspaces/fbtq/messages').doc(result.message_id?require('./messenger-history').messageKey(ref.id,result.message_id):crypto.randomUUID());
    const patch={message:text.trim(),direction:'outgoing',needsReply:false,receivedAt:FieldValue.serverTimestamp(),lastSendStatus:'sent',lastMessageAtMs:Date.now()};
    if(autoReply){
      await db.runTransaction(async tx=>{
        const latest=(await tx.get(ref)).data();
        tx.set(messageRef,{...message,metaMessageId:result.message_id||''},{merge:true});
        if(latest?.lastIncomingMessageId===autoReply.messageId)tx.set(ref,patch,{merge:true});
      });
    }else{
      await messageRef.set({...message,metaMessageId:result.message_id||''},{merge:true});
      await ref.set(patch,{merge:true});
    }
    return {ok:true,messageId:result.message_id};
  }
  out.getChatbotSetup=callable({},async request=>{await signedIn(request);return metaConfig();});
  out.beginFacebookLogin=callable({},async request=>{const auth=await signedIn(request),config=metaConfig();if(!config.configured)fail('Cấu hình Messenger còn thiếu: '+config.missing.join(', '));const nonce=crypto.randomBytes(32).toString('hex');await db.doc(`${sessions}/${nonce}`).set({ownerUid:auth.uid,expiresAtMs:Date.now()+600000,status:'pending'});return {url:loginUrl(config,nonce),state:nonce};});
  out.getFacebookPageSelection=callable({timeoutSeconds:20},async request=>{const auth=await signedIn(request),id=request.data?.sessionId;if(id!==undefined&&(!/^[a-f0-9]{64}$/.test(id)))fail('Phiên chọn Fanpage không hợp lệ.');return require('./facebook-page-selection').findPageSelection(db,auth.uid,id);});
  out.finishFacebookLogin=callable({secrets:[...secret,META_APP_SECRET],timeoutSeconds:90},async request=>{
    const auth=await signedIn(request),{state,code}=request.data||{};if(!/^[a-f0-9]{64}$/.test(state||'')||typeof code!=='string'||!code.trim()||code.length>4000)fail('Phiên Facebook không hợp lệ.');const ref=db.doc(`${sessions}/${state}`);
    await db.runTransaction(async tx=>{const s=await tx.get(ref),d=s.data();if(!d||d.ownerUid!==auth.uid||d.status!=='pending'||d.expiresAtMs<Date.now())fail('Phiên kết nối hết hạn hoặc đã dùng.');tx.update(ref,{status:'exchanging'});});
    const tokenUrl=new URL(graphUrl('oauth/access_token'));tokenUrl.search=new URLSearchParams({client_id:process.env.META_APP_ID,client_secret:META_APP_SECRET.value(),redirect_uri:process.env.META_REDIRECT_URI,code}).toString();
    let response;try{response=await fetch(tokenUrl,{signal:AbortSignal.timeout(20000)});}catch{fail('Không kết nối được Meta để đổi mã đăng nhập. Hãy kết nối lại.');}const tokens=await response.json().catch(()=>({}));if(!response.ok||!tokens.access_token)fail('Không đổi được mã Facebook. Kết nối lại.');
    const list=[];let path='me/accounts?fields=id,name,picture,access_token,tasks&limit=100';
    for(let n=0;path&&n<10;n++){const data=await graph(path,tokens.access_token);list.push(...(data.data||[]));path=data.paging?.cursors?.after&&data.paging?.next?`me/accounts?fields=id,name,picture,access_token,tasks&limit=100&after=${encodeURIComponent(data.paging.cursors.after)}`:'';}
    const candidates=list.filter(p=>p.access_token&&p.tasks?.some(t=>['MESSAGING','MODERATE','MANAGE'].includes(t))).map(p=>({pageId:p.id,pageName:p.name,pagePhotoUrl:require('./messenger-profile').profileFields({profile_pic:p.picture?.data?.url}).senderPhotoUrl||'',...encryptToken(p.access_token,META_TOKEN_ENCRYPTION_KEY.value())}));
    await ref.update({status:'ready',candidates,expiresAtMs:Date.now()+600000});return {sessionId:state,expiresAtMs:Date.now()+600000,pages:candidates.map(({pageId,pageName,pagePhotoUrl})=>({pageId,pageName,pagePhotoUrl}))};
  });
  out.addFacebookPages=callable({secrets:secret,timeoutSeconds:120},async request=>{const auth=await signedIn(request),{sessionId,pageIds}=request.data||{};if(!/^[a-f0-9]{64}$/.test(sessionId||'')||!Array.isArray(pageIds)||!pageIds.length||pageIds.length>10)fail('Chọn 1–10 Fanpage.');const ref=db.doc(`${sessions}/${sessionId}`);let candidates;
    await db.runTransaction(async tx=>{const snap=await tx.get(ref),d=snap.data();if(!d||d.ownerUid!==auth.uid||d.status!=='ready'||d.expiresAtMs<Date.now())fail('Phiên chọn Trang hết hạn.');candidates=d.candidates.filter(p=>pageIds.includes(p.pageId));if(candidates.length!==new Set(pageIds).size)fail('Trang không có trong phiên đăng nhập.');tx.update(ref,{status:'connecting'});});
    const results=[];for(const p of candidates){try{const target=db.doc(`${pages}/${p.pageId}`);await db.runTransaction(async tx=>{const s=await tx.get(target);if(s.exists&&s.data().ownerUid!==auth.uid)throw new HttpsError('permission-denied','Trang đã thuộc tài khoản khác.');tx.set(target,{...p,ownerUid:auth.uid,active:false,mode:'off',model:'openai',updatedAt:FieldValue.serverTimestamp()},{merge:true});});await graph(`${p.pageId}/subscribed_apps`,decryptToken(p,META_TOKEN_ENCRYPTION_KEY.value()),{subscribed_fields:['messages','messaging_postbacks']});await target.update({active:true,webhookSubscribed:true});results.push({pageId:p.pageId,ok:true});}catch(e){results.push({pageId:p.pageId,ok:false,error:e.message});}}
    await ref.delete();return {results};
  });
  const faqRef=pageId=>db.doc(`${pages}/${pageId}/private/faqs`);
  out.getPageChatbot=callable({},async request=>{
    const {page}=await owner(request,request.data?.pageId);
    const includeFaqs=request.data?.includeFaqs===true;
    const includeFaqReplies=request.data?.includeFaqReplies===true;
    const faq=includeFaqs||includeFaqReplies&&page.hasChatbotFaqs?(await faqRef(page.pageId).get()).data():undefined;
    const rows=faq?.rows||[];
    const faqReplies=includeFaqReplies?rows.filter(row=>row.enabled).map(row=>({title:row.question,text:row.answer})):[];
    return {pageId:page.pageId,pageName:page.pageName,active:page.active,mode:page.mode||'off',model:page.model||'gemini',instructions:page.instructions||'',scripts:(page.scripts||[]).map(s=>({...s,keywords:s.keywords.join(', ')})),lastError:page.lastError||'',availableModels:metaConfig().availableModels,...(includeFaqs?{faqs:rows,faqRevision:faq?.revision||0}:{}),...(includeFaqReplies?{faqReplies}:{})};
  });
  out.savePageChatbot=callable({},async request=>{
    const {ref,page,auth}=await owner(request,request.data?.pageId);
    let config,rows;
    try{
      config=core.settings(request.data);
      if(request.data.faqs!==undefined)rows=validateFaqs(request.data.faqs);
    }catch(e){throw new HttpsError('invalid-argument',e.message);}
    if(['ai','hybrid'].includes(config.mode)&&!metaConfig().availableModels.includes(config.model))fail('Mô hình chatbot chưa bật trên máy chủ. Hãy chọn mô hình đang hỗ trợ.');
    if(request.data.scripts===undefined)delete config.scripts;
    const update={...config,updatedAt:FieldValue.serverTimestamp()};
    if(rows===undefined){await ref.update(update);return {ok:true};}
    const faqDocument=faqRef(page.pageId);
    await db.runTransaction(async tx=>{
      const [current,faq]=await Promise.all([tx.get(ref),tx.get(faqDocument)]);
      if(current.data()?.ownerUid!==auth.uid)throw new HttpsError('permission-denied','Fanpage không thuộc tài khoản.');
      const revision=faq.data()?.revision||0;
      if(request.data.faqRevision!==revision)throw new HttpsError('aborted','FAQ đã được cập nhật ở cửa sổ khác. Mở lại cấu hình trước khi lưu.');
      tx.update(ref,{...update,hasChatbotFaqs:rows.some(row=>row.enabled)});
      tx.set(faqDocument,{rows,revision:revision+1});
    });
    return {ok:true};
  });
  out.sendChatbotMessage=callable({secrets:secret,timeoutSeconds:60},async request=>{const {page}=await owner(request,request.data?.pageId);const {recipientId,message,requestId}=request.data||{};if(!/^\d+$/.test(recipientId||'')||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||''))fail('Yêu cầu gửi không hợp lệ.');const job=db.doc(`chatbotJobs/${page.ownerUid}_${requestId}`);try{await job.create({status:'sending',createdAt:FieldValue.serverTimestamp()});}catch{fail('Yêu cầu đã xử lý. Kiểm tra hội thoại trước khi thử lại.');}try{const result=await send(page,recipientId,message);await job.update({status:'sent'});return result;}catch(e){await job.update({status:'failed',error:e.message});throw e;}});
  out.previewChatbotBroadcast=callable({},async request=>{const {page}=await owner(request,request.data?.pageId);const rows=await db.collection(inbox).where('ownerUid','==',page.ownerUid).get();const eligible=rows.docs.map(d=>d.data()).filter(t=>t.pageId===page.pageId&&core.eligible(t)).slice(0,20);return {recipients:eligible.map(t=>({id:t.senderId,name:t.senderName||t.senderId})),limit:20};});
  out.sendChatbotBroadcast=callable({secrets:secret,timeoutSeconds:300},async request=>{const {page}=await owner(request,request.data?.pageId);const {recipientIds,message,requestId}=request.data||{};if(!Array.isArray(recipientIds)||!recipientIds.length||recipientIds.length>20||recipientIds.some(id=>!/^\d+$/.test(id))||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||'')||typeof message!=='string'||!message.trim()||message.length>2000)fail('Nội dung hoặc người nhận không hợp lệ.');const results=[];
    for(const id of new Set(recipientIds)){const job=db.doc(`chatbotJobs/${page.ownerUid}_${requestId}_${id}`);try{await job.create({status:'sending',createdAt:FieldValue.serverTimestamp()});}catch{results.push({id,status:'already_processed'});continue;}try{await send(page,id,message,'broadcast');await job.update({status:'sent'});results.push({id,status:'sent'});}catch(e){await job.update({status:'failed',error:e.message});results.push({id,status:'failed',error:e.message});break;}}
    return {results};
  });
  out.setChatbotHandoff=callable({},async request=>{const {page}=await owner(request,request.data?.pageId);const id=request.data?.recipientId;if(!/^\d+$/.test(id||''))fail('Người nhận không hợp lệ.');await db.doc(`${inbox}/${core.key(page.pageId,id)}`).set({humanPaused:request.data.paused===true},{merge:true});return {ok:true};});
  const {onDocumentCreated,onDocumentUpdated}=require('firebase-functions/v2/firestore');
  const replySecrets=[...secret,OPENAI_API_KEY,...(process.env.META_CHATBOT_GEMINI_ENABLED==='true'?[GEMINI_API_KEY]:[])];
  const replyTrigger={document:'workspaces/fbtq/messages/{messageId}',secrets:replySecrets,timeoutSeconds:120,retry:false};
  function canReplyTo(thread,messageId){
    return core.eligible(thread)&&thread.lastIncomingMessageId===messageId&&thread.direction!=='outgoing';
  }
  async function replyToIncoming(messageId,m,pageSnapshot,receivedAt){
    const startedAt=Date.now();
    if(!m||m.direction!=='incoming'||m.historical===true||m.source==='meta_history')return;
    const page=pageSnapshot??(await db.doc(`${pages}/${m.pageId}`).get()).data();
    if(!page?.active||!page.mode||page.mode==='off')return;
    const threadRef=db.doc(`${inbox}/${m.conversationId}`);
    const [thread,faq]=await Promise.all([threadRef.get(),page.hasChatbotFaqs?faqRef(page.pageId).get():undefined]);
    if(!canReplyTo(thread.data(),messageId))return;
    const job=db.doc(`chatbotJobs/auto_${messageId}`);
    try{await job.create({status:'processing',createdAt:FieldValue.serverTimestamp()});}
    catch(error){if(error.code===6||error.code==='already-exists')return;throw error;}
    try{
      const faqRows=faq?.data()?.rows||[];
      const faqReply=page.mode==='ai'?undefined:findFaqReply(faqRows,m.message);
      const script=page.mode==='ai'||faqReply?undefined:core.pickScript(m.message,page.scripts);
      let text=faqReply?.answer||script?.text;
      if(!text&&!script?.image&&['ai','hybrid'].includes(page.mode)){if(!metaConfig().availableModels.includes(page.model||'gemini'))fail('Mô hình chatbot này chưa bật trên máy chủ. Chọn OpenAI và lưu lại cấu hình.');const history=await db.collection('workspaces/fbtq/messages').where('conversationId','==',m.conversationId).orderBy('createdAt','desc').limit(6).get();const prompt=history.docs.reverse().map(d=>{const r=d.data();return `${r.direction==='incoming'?'Khách':'Trang'}: ${String(r.message||'').slice(0,1200)}`;}).join('\n');const faqs=relevantFaqs(faqRows,m.message);text=await generateWithProvider(page.model||'gemini',prompt,replyInstructions(page,faqs),{...(process.env.META_CHATBOT_GEMINI_ENABLED==='true'?{gemini:GEMINI_API_KEY.value()}:{}),openai:OPENAI_API_KEY.value()},{...(page.model==='openai'?require('./ai-policy').textPolicy('reply'):{}),task:'reply',maxTokens:300});}
      let sent=false;
      if(script?.image){
        if(canReplyTo((await threadRef.get()).data(),messageId)){
          const media=require('./messenger-image');
          await media.sendPreparedImage({db,page,recipientId:m.senderId,bytes:media.decodeImage(script.image.slice(23),'image/jpeg',150000),mimeType:'image/jpeg',preview:script.imagePreview||'',source:'auto',token:decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()),graphUrl,HttpsError,FieldValue});
          if(text)await send(page,m.senderId,text.slice(0,2000),'auto');
          sent=true;
        }
      }else if(text){
        sent=Boolean(await send(page,m.senderId,text.slice(0,2000),'auto',{messageId,startedAt,receivedAt,type:faqReply?'faq':script?'script':'ai'}));
      }
      await job.update({status:sent?'sent':'skipped'});
    }catch(e){await job.update({status:'failed',error:e.message});await db.doc(`${pages}/${m.pageId}`).set({lastError:e.message},{merge:true});}
  }
  out.autoReplyFacebook=onDocumentCreated(replyTrigger,event=>replyToIncoming(event.params.messageId,event.data?.data()));
  out.autoReplyFacebookPromoted=onDocumentUpdated(replyTrigger,event=>{
    const before=event.data?.before.data(),after=event.data?.after.data();
    if(before?.historical!==true||after?.historical!==false||after.source!=='meta_webhook')return;
    return replyToIncoming(event.params.messageId,after);
  });
  if(onRequest)out.metaWebhook=require('./meta-webhook').registerMetaWebhook({db,onRequest,META_VERIFY_TOKEN,META_APP_SECRET,META_TOKEN_ENCRYPTION_KEY,decryptToken,logger,replyToIncoming,replySecrets});
  Object.assign(out,require('./messenger-history').registerMessengerHistory({db,onCall:callable,HttpsError,owner,graph,decryptToken,META_TOKEN_ENCRYPTION_KEY,META_APP_SECRET}));
  out.sendMessengerImage=require('./messenger-image').registerMessengerImage({db,onCall:callable,HttpsError,owner,decryptToken,graphUrl,META_TOKEN_ENCRYPTION_KEY,FieldValue});
  out.refreshMessengerProfiles=require('./messenger-profile').registerProfileRefresh({db,onCall:callable,HttpsError,owner,graph,decryptToken,META_TOKEN_ENCRYPTION_KEY});
  out.setMessengerThreadColor=callable({},async req=>{const {page}=await owner(req,req.data?.pageId),{threadId,color}=req.data||{};if(!/^[a-f0-9]{64}$/.test(threadId||'')||!['','red','orange','yellow','green','blue','purple'].includes(color))throw new HttpsError('invalid-argument','Màu hội thoại không hợp lệ.');const ref=db.doc(`${inbox}/${threadId}`),snap=await ref.get();if(!snap.exists||snap.data().ownerUid!==page.ownerUid||snap.data().pageId!==page.pageId)throw new HttpsError('permission-denied','Không có quyền sửa hội thoại.');await ref.update({tagColor:color});return {ok:true};});
  Object.assign(out,require('./messenger-broadcast').registerBroadcasts({db,onCall:callable,onSchedule:require('firebase-functions/v2/scheduler').onSchedule,HttpsError,signedIn,owner,graph,send,graphUrl,decryptToken,META_TOKEN_ENCRYPTION_KEY,FieldValue}));
  out.setMessengerPageColor=callable({},async req=>{const {ref}=await owner(req,req.data?.pageId),color=req.data?.color;if(typeof color!=='string'||color!==''&&!/^#[a-f0-9]{6}$/i.test(color))throw new HttpsError('invalid-argument','Màu Fanpage cần có dạng #RRGGBB.');await ref.update({inboxColor:color.toUpperCase()});return {ok:true,color:color.toUpperCase()};});
  out.updateMessengerThreadMetadata=require('./messenger-thread-metadata').registerThreadMetadata({db,onCall:callable,HttpsError,owner});
  return out;
};
