const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const crypto = require('node:crypto');

initializeApp();
const db = getFirestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const META_TOKEN_ENCRYPTION_KEY = defineSecret('META_TOKEN_ENCRYPTION_KEY');
const META_VERIFY_TOKEN = defineSecret('META_VERIFY_TOKEN');
const META_APP_SECRET = defineSecret('META_APP_SECRET');
const GRAPH_VERSION = () => process.env.META_GRAPH_VERSION || 'v26.0';

async function requireSignedIn(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Vui lòng đăng nhập để tiếp tục.');
  const snap = await db.doc(`users/${request.auth.uid}`).get();
  const profile = snap.exists ? snap.data() : {};
  return {...request.auth, profile};
}
async function requireManager(request) {
  const auth = await requireSignedIn(request);
  if (!['director','branch_manager','department_manager'].includes(auth.profile.role || auth.token.role)) {
    throw new HttpsError('permission-denied', 'Chức năng này dành cho quản lý.');
  }
  return auth;
}
async function requireDirector(request) {
  const auth = await requireSignedIn(request);
  if ((auth.profile.role || auth.token.role) !== 'director') throw new HttpsError('permission-denied', 'Chỉ Giám đốc có thể thay đổi phân quyền.');
  return auth;
}
function cleanProvider(provider) {
  if (!['gemini','openai','claude'].includes(provider)) throw new HttpsError('invalid-argument', 'Mô hình AI không hợp lệ.');
  return provider;
}
function textFromResponse(provider, data) {
  if (provider === 'gemini') return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
  if (provider === 'openai') {
    if (typeof data?.output_text === 'string') return data.output_text.trim();
    return (data?.output || []).flatMap(item => item.content || []).filter(part => part.type === 'output_text').map(part => part.text).join('\n').trim();
  }
  return (data?.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n').trim();
}
async function generateWithProvider(provider, prompt, system, secrets, options={}) {
  cleanProvider(provider);
  const maxTokens = options.maxTokens || 1100;
  let url, headers={'Content-Type':'application/json'}, body, key;
  if (provider === 'gemini') {
    key = secrets.gemini;
    if (!key) throw new HttpsError('failed-precondition', 'Quản trị viên chưa cấu hình Gemini API key.');
    const model = options.model || 'gemini-3.8-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    headers['x-goog-api-key'] = key;
    body = {systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.75,maxOutputTokens:maxTokens}};
  } else if (provider === 'openai') {
    key = secrets.openai;
    if (!key) throw new HttpsError('failed-precondition', 'Quản trị viên chưa cấu hình OpenAI API key.');
    url = 'https://api.openai.com/v1/responses';
    headers.Authorization = `Bearer ${key}`;
    body = {model:options.model||'gpt-6-luna',instructions:system,input:prompt,max_output_tokens:maxTokens};
  } else {
    key = secrets.claude;
    if (!key) throw new HttpsError('failed-precondition', 'Quản trị viên chưa cấu hình Anthropic API key.');
    url = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    body = {model:options.model||'claude-sonnet-5',max_tokens:maxTokens,system,messages:[{role:'user',content:prompt}]};
  }
  let response;
  try { response = await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(55000)}); }
  catch (error) { logger.error('Provider request failed',{provider,error:String(error)}); throw new HttpsError('unavailable','Không kết nối được mô hình AI. Thử lại sau.'); }
  const data = await response.json().catch(()=>({}));
  if (!response.ok) { logger.error('Provider returned error',{provider,status:response.status}); throw new HttpsError('unavailable',`Mô hình ${provider} chưa trả lời. Kiểm tra API key và quyền sử dụng.`); }
  const content=textFromResponse(provider,data);
  if (!content) throw new HttpsError('unavailable','Mô hình AI không trả về nội dung.');
  return content;
}
async function readBotSettings() {
  const snap=await db.doc('workspaces/fbtq/settings/bot').get();
  return snap.exists?snap.data():{};
}
function contentCallable(provider, secret) {
  return onCall({secrets:[secret],timeoutSeconds:60,memory:'256MiB'},async request=>{
    await requireSignedIn(request);
    const {prompt,tone='Thân thiện, gần gũi',length='Tiêu chuẩn',model=provider}=request.data||{};
    if(typeof prompt!=='string'||prompt.trim().length<3||prompt.length>5000)throw new HttpsError('invalid-argument','Prompt cần từ 3 đến 5.000 ký tự.');
    if(cleanProvider(model)!==provider)throw new HttpsError('invalid-argument','Hãy chọn đúng mô hình AI cho chức năng này.');
    const settings=await readBotSettings();
    const voice=settings.brandVoice||'Thân thiện, rõ ràng, tích cực. Không tự tạo số liệu, giá bán hoặc cam kết chưa có trong yêu cầu.';
    const system=`Bạn là trợ lý nội dung marketing của công ty FBTQ. Viết bằng tiếng Việt tự nhiên. Giọng thương hiệu: ${voice}.\nGiọng điệu mong muốn: ${tone}. Độ dài: ${length}. Viết độc lập, không tự mặc định một nền tảng cụ thể.\nTuân thủ chính sách quảng cáo và tránh khẳng định sức khoẻ, tài chính hoặc kết quả tuyệt đối. Không tự thêm thông tin giá, ưu đãi, tồn kho hay số liệu nếu người dùng không cung cấp. Chỉ trả về nội dung có thể chỉnh sửa, không giải thích quy trình.`;
    const content=await generateWithProvider(provider,prompt.trim(),system,{[provider]:secret.value()},{maxTokens:length==='Chi tiết'?1500:900});
    return {content,provider};
  });
}

// Deploy only the provider the company has configured. Each callable receives
// just its own secret, so enabling one model does not require the other keys.
exports.generateContentGemini = contentCallable('gemini',GEMINI_API_KEY);
exports.generateContentOpenAI = contentCallable('openai',OPENAI_API_KEY);
exports.generateContentClaude = contentCallable('claude',ANTHROPIC_API_KEY);

const TTS_VOICES = {
  Aoede:'Speak Vietnamese with a clear, soft Northern Vietnamese accent and a warm, light delivery.',
  Kore:'Speak Vietnamese with an expressive Southern Vietnamese accent and a warm, emotional delivery.',
  Zephyr:'Speak Vietnamese in a natural Northern Vietnamese accent, bright, clear, and friendly.',
  Callirrhoe:'Use standard Northern Vietnamese pronunciation with a steady, easy-to-understand delivery.',
  Sulafat:'Use a warm, conversational, interactive speaking style in Vietnamese.'
};
exports.synthesizeSpeech = onCall({secrets:[GEMINI_API_KEY],timeoutSeconds:60,memory:'256MiB'},async request=>{
  await requireSignedIn(request);
  const {text,voice='Aoede'}=request.data||{};
  if(typeof text!=='string'||!text.trim())throw new HttpsError('invalid-argument','Nhập văn bản cần chuyển thành giọng đọc.');
  if(Array.from(text.trim()).length>1800)throw new HttpsError('invalid-argument','Văn bản tối đa 1.800 ký tự mỗi lần tạo. Hãy chia nội dung dài thành nhiều đoạn.');
  if(!Object.hasOwn(TTS_VOICES,voice))throw new HttpsError('invalid-argument','Giọng đọc Gemini không hợp lệ.');
  const apiKey=GEMINI_API_KEY.value();
  if(!apiKey)throw new HttpsError('failed-precondition','Quản trị viên chưa cấu hình GEMINI_API_KEY từ Google AI Studio.');
  const url='https://generativelanguage.googleapis.com/v1beta/interactions';
  let response;
  try{
    response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({model:'gemini-3.8-flash-tts',input:[{type:'user_input',content:[{type:'text',text:text.trim(),annotations:[{type:'speech_metadata',style:TTS_VOICES[voice]}]}]}],response_format:{type:'audio',mime_type:'audio/wav'},generation_config:{speech_config:[{voice}]} }),signal:AbortSignal.timeout(55000)});
  }catch(error){logger.error('Gemini TTS request failed');throw new HttpsError('unavailable','Không kết nối được Gemini TTS. Hãy thử lại sau.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    logger.error('Gemini TTS returned an error',{status:response.status,reason:data.error?.status||'unknown'});
    if(response.status===401||response.status===403)throw new HttpsError('failed-precondition','Gemini API Key không hợp lệ, chưa bật quyền Gemini API hoặc project chưa được cấp quyền cho model TTS.');
    if(response.status===429)throw new HttpsError('resource-exhausted','Đã vượt hạn mức Gemini API. Hãy kiểm tra quota và billing của Google AI Studio.');
    throw new HttpsError('unavailable','Gemini TTS chưa tạo được âm thanh. Kiểm tra API Key, model và nội dung yêu cầu.');
  }
  const audioContent=data.output_audio?.data;
  if(typeof audioContent!=='string'||!audioContent)throw new HttpsError('unavailable','Gemini TTS chưa trả về tệp âm thanh.');
  return {audioContent,mimeType:data.output_audio.mime_type||'audio/wav',voice};
});

exports.suggestReply = onCall({secrets:[GEMINI_API_KEY,OPENAI_API_KEY],timeoutSeconds:45,memory:'256MiB'},async request=>{
  const auth=await requireSignedIn(request);const {pageId,message,model='gemini'}=request.data||{};
  if(typeof message!=='string'||message.trim().length<1||message.length>3000)throw new HttpsError('invalid-argument','Tin nhắn không hợp lệ.');
  const page=await db.doc(`workspaces/fbtq/pages/${String(pageId||'')}`).get();
  if(!page.exists||page.data().ownerUid!==auth.uid)throw new HttpsError('permission-denied','Bạn chưa kết nối Fanpage này.');
  const settings=await readBotSettings();const banned=Array.isArray(settings.banned)?settings.banned:[];const scripts=Array.isArray(settings.scripts)?settings.scripts:[];
  const system=`Bạn viết một câu trả lời chăm sóc khách hàng ngắn gọn, thân thiện bằng tiếng Việt cho Fanpage ${page.data().pageName||''}. Chỉ đề xuất câu trả lời, không tự xác nhận giá, tồn kho, giao dịch hay chính sách nếu dữ liệu không có. Không lặp lại hoặc sử dụng các cụm cấm: ${banned.join(', ')}. Kịch bản được duyệt để tham khảo: ${scripts.map(s=>`${s.title}: ${s.text}`).join('\n')}`;
  const content=await generateWithProvider(cleanProvider(model),message.trim(),system,{gemini:GEMINI_API_KEY.value(),openai:OPENAI_API_KEY.value(),claude:''},{maxTokens:250});
  return {content};
});

exports.setUserRole = onCall({timeoutSeconds:30,memory:'256MiB'},async request=>{
  const auth=await requireDirector(request);const {uidOrEmail,uid,email,role}=request.data||{};
  const identifier=String(uidOrEmail||uid||email||'').trim();
  if(!identifier||identifier.length>128||!['director','branch_manager','department_manager','accountant','employee'].includes(role))throw new HttpsError('invalid-argument','UID/email hoặc vai trò không hợp lệ.');
  const lookupByEmail=identifier.includes('@');
  if(lookupByEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier))throw new HttpsError('invalid-argument','Email chưa đúng định dạng.');
  let user;try{user=lookupByEmail?await getAuth().getUserByEmail(identifier.toLowerCase()):await getAuth().getUser(identifier)}catch(error){if(error.code==='auth/invalid-uid'||error.code==='auth/invalid-email')throw new HttpsError('invalid-argument','UID hoặc email không hợp lệ.');throw new HttpsError('not-found','Không tìm thấy tài khoản trong Firebase Authentication. Hãy kiểm tra UID/email và đảm bảo người dùng đã đăng ký.')}
  const claims={...user.customClaims,role,approved:true,workspaceId:'fbtq'};
  await getAuth().setCustomUserClaims(user.uid,claims);
  await db.doc(`users/${user.uid}`).set({email:user.email||'',name:user.displayName||user.email||user.uid,role,approved:true,updatedAt:FieldValue.serverTimestamp(),updatedBy:auth.uid},{merge:true});
  return {ok:true,uid:user.uid,role};
});

function encryptionKey(secret) {
  const raw=String(secret||'');
  if(!raw)throw new HttpsError('failed-precondition','Chưa cấu hình META_TOKEN_ENCRYPTION_KEY.');
  return /^[a-f0-9]{64}$/i.test(raw)?Buffer.from(raw,'hex'):crypto.createHash('sha256').update(raw).digest();
}
function encryptToken(token,secret) {
  const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(secret),iv);
  const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return {encryptedToken:encrypted.toString('base64'),tokenIv:iv.toString('base64'),tokenTag:cipher.getAuthTag().toString('base64')};
}
function decryptToken(data,secret) {
  const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(secret),Buffer.from(data.tokenIv,'base64'));
  decipher.setAuthTag(Buffer.from(data.tokenTag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data.encryptedToken,'base64')),decipher.final()]).toString('utf8');
}
function graphUrl(path) { return `https://graph.facebook.com/${GRAPH_VERSION()}/${path}`; }
exports.listMyPages = onCall({timeoutSeconds:20,memory:'256MiB'},async request=>{
  const auth=await requireSignedIn(request);
  const snapshot=await db.collection('workspaces/fbtq/pages').where('ownerUid','==',auth.uid).get();
  return {pages:snapshot.docs.map(doc=>{const page=doc.data();return {pageId:page.pageId||doc.id,pageName:page.pageName||'',model:page.model||'gemini',active:page.active===true}})};
});

exports.connectFacebookPage = onCall({secrets:[META_TOKEN_ENCRYPTION_KEY],timeoutSeconds:35,memory:'256MiB'},async request=>{
  const auth=await requireSignedIn(request);const {pageId,pageName,pageToken,model='gemini'}=request.data||{};
  if(typeof pageId!=='string'||!/^\d{5,30}$/.test(pageId)||typeof pageName!=='string'||pageName.length>160||typeof pageToken!=='string'||pageToken.length<20)throw new HttpsError('invalid-argument','Thông tin Fanpage chưa hợp lệ.');
  if(!['gemini','openai'].includes(model))throw new HttpsError('invalid-argument','Mô hình chatbot chưa được hỗ trợ.');
  const response=await fetch(`${graphUrl(encodeURIComponent(pageId))}?fields=id,name&access_token=${encodeURIComponent(pageToken)}`,{signal:AbortSignal.timeout(15000)}).catch(()=>null);
  const meta=response&&await response.json().catch(()=>({}));
  if(!response?.ok||meta.id!==pageId)throw new HttpsError('failed-precondition','Meta không xác nhận Page ID và Page Access Token.');
  const existing=await db.doc(`workspaces/fbtq/pages/${pageId}`).get();if(existing.exists&&existing.data().ownerUid!==auth.uid)throw new HttpsError('permission-denied','Trang đã được kết nối bởi tài khoản khác.');
  const subscription=await fetch(graphUrl(`${pageId}/subscribed_apps`),{method:'POST',headers:{Authorization:`Bearer ${pageToken}`,'Content-Type':'application/json'},body:JSON.stringify({subscribed_fields:['messages','messaging_postbacks']}),signal:AbortSignal.timeout(15000)});if(!subscription.ok)throw new HttpsError('failed-precondition','Không đăng ký được webhook. Kiểm tra pages_manage_metadata.');
  const encrypted=encryptToken(pageToken,META_TOKEN_ENCRYPTION_KEY.value());
  await db.runTransaction(async tx=>{const ref=db.doc(`workspaces/fbtq/pages/${pageId}`),snap=await tx.get(ref);if(snap.exists&&snap.data().ownerUid!==auth.uid)throw new HttpsError('permission-denied','Trang đã thuộc tài khoản khác.');tx.set(ref,{pageId,pageName:meta.name||pageName,ownerUid:auth.uid,model,active:true,webhookSubscribed:true,...encrypted,connectedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});});
  return {ok:true,pageName:meta.name||pageName,message:'Đã mã hoá và lưu Page Access Token.'};
});

exports.sendPageReply = onCall({secrets:[META_TOKEN_ENCRYPTION_KEY],timeoutSeconds:35,memory:'256MiB'},async request=>{
  const auth=await requireSignedIn(request);const {pageId,recipientId,message}=request.data||{};
  if(typeof message!=='string'||!message.trim()||message.length>2000||typeof recipientId!=='string'||!/^\d+$/.test(recipientId))throw new HttpsError('invalid-argument','Tin nhắn hoặc khách nhận không hợp lệ.');
  const ref=db.doc(`workspaces/fbtq/pages/${String(pageId||'')}`);const snap=await ref.get();
  if(!snap.exists||snap.data().ownerUid!==auth.uid||snap.data().active!==true)throw new HttpsError('permission-denied','Fanpage không thuộc tài khoản của bạn.');
  const thread=await db.doc(`workspaces/fbtq/inbox/${require('./chatbot-core').key(pageId,recipientId)}`).get();if(!require('./chatbot-core').eligible({...thread.data(),humanPaused:false}))throw new HttpsError('failed-precondition','Ngoài cửa sổ 24 giờ hoặc khách đã dừng nhận tin.');
  const token=decryptToken(snap.data(),META_TOKEN_ENCRYPTION_KEY.value());const body=new URLSearchParams({recipient:JSON.stringify({id:recipientId}),message:JSON.stringify({text:message.trim()}),messaging_type:'RESPONSE',access_token:token});
  const response=await fetch(graphUrl(`${encodeURIComponent(pageId)}/messages`),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(20000)}).catch(()=>null);
  if(!response?.ok){logger.warn('Meta send message failed',{pageId,status:response?.status});throw new HttpsError('unavailable','Facebook không gửi được tin nhắn. Kiểm tra quyền pages_messaging và token.');}
  const result=await response.json().catch(()=>({}));
  const conversationId=crypto.createHash('sha256').update(`${pageId}:${recipientId}`).digest('hex');
  await db.doc(`workspaces/fbtq/inbox/${conversationId}`).set({pageId,pageName:snap.data().pageName,ownerUid:auth.uid,senderId:recipientId,conversationId,direction:'outgoing',message:message.trim(),receivedAt:FieldValue.serverTimestamp(),createdBy:auth.uid},{merge:true});
  await db.collection('workspaces/fbtq/messages').add({pageId,pageName:snap.data().pageName,ownerUid:auth.uid,senderId:recipientId,conversationId,direction:'outgoing',message:message.trim(),createdAt:FieldValue.serverTimestamp(),createdBy:auth.uid});
  return {ok:true,messageId:result.message_id||null};
});

exports.metaWebhook = onRequest({secrets:[META_VERIFY_TOKEN,META_APP_SECRET],timeoutSeconds:30,memory:'256MiB'},async(req,res)=>{
  if(req.method==='GET'){
    const mode=req.query['hub.mode'];const token=req.query['hub.verify_token'];const challenge=req.query['hub.challenge'];
    if(mode==='subscribe'&&token===META_VERIFY_TOKEN.value())return res.status(200).send(challenge);
    return res.sendStatus(403);
  }
  if(req.method!=='POST')return res.sendStatus(405);
  const signature=req.get('x-hub-signature-256')||'';const raw=req.rawBody||Buffer.from(JSON.stringify(req.body||{}));
  const expected='sha256='+crypto.createHmac('sha256',META_APP_SECRET.value()).update(raw).digest('hex');
  const supplied=Buffer.from(signature);const target=Buffer.from(expected);
  if(supplied.length!==target.length||!crypto.timingSafeEqual(supplied,target))return res.sendStatus(401);
  const body=req.body||{};
  try{
    for(const entry of body.entry||[]){
      const pageId=String(entry.id||'');const pageSnap=await db.doc(`workspaces/fbtq/pages/${pageId}`).get();if(!pageSnap.exists)continue;const page=pageSnap.data();
      for(const event of entry.messaging||[]){if(!event.message||event.message.is_echo)continue;const sender=String(event.sender?.id||'');if(!sender)continue;const key=crypto.createHash('sha256').update(`${pageId}:${sender}`).digest('hex');
        const message=event.message.text||'[Đã nhận tệp đính kèm]';
        const messageId=crypto.createHash('sha256').update(`${key}:${event.message.mid||event.timestamp||Date.now()}`).digest('hex');
        const threadRef=db.doc(`workspaces/fbtq/inbox/${key}`);const oldThread=await threadRef.get();if((oldThread.data()?.lastIncomingAtMs||0)>Number(event.timestamp||0))continue;
        const optedOut=require('./chatbot-core').isOptOut(message)?true:oldThread.data()?.optedOut===true;
        await db.doc(`workspaces/fbtq/inbox/${key}`).set({lastIncomingAtMs:Math.min(Date.now(),Number(event.timestamp)||Date.now()),lastIncomingMessageId:messageId,optedOut,pageId,pageName:page.pageName,ownerUid:page.ownerUid,model:page.model||'gemini',conversationId:key,senderId:sender,message,direction:'incoming',attachments:(event.message.attachments||[]).map(a=>({type:a.type,url:a.payload?.url||''})),receivedAt:FieldValue.serverTimestamp(),unread:true},{merge:true});
        await db.collection('workspaces/fbtq/messages').doc(crypto.createHash('sha256').update(`${key}:${event.message.mid||event.timestamp||Date.now()}`).digest('hex')).set({pageId,pageName:page.pageName,ownerUid:page.ownerUid,conversationId:key,senderId:sender,message,direction:'incoming',attachments:(event.message.attachments||[]).map(a=>({type:a.type,url:a.payload?.url||''})),createdAt:FieldValue.serverTimestamp()},{merge:true});
      }
    }
    return res.sendStatus(200);
  }catch(error){logger.error('Meta webhook event processing failed',{error:String(error)});return res.sendStatus(500)}
});

Object.assign(exports,require('./chatbot').registerChatbot({db,onCall,HttpsError,FieldValue,requireSignedIn,encryptToken,decryptToken,graphUrl,generateWithProvider,META_TOKEN_ENCRYPTION_KEY,META_APP_SECRET,GEMINI_API_KEY,OPENAI_API_KEY}));

Object.assign(exports, require('./workflows').registerWorkflows({ db, onCall, HttpsError, logger }));

Object.assign(exports,require('./assistant-ai').registerAssistantAI({onCall,HttpsError,requireSignedIn,generateWithProvider,GEMINI_API_KEY,OPENAI_API_KEY,ANTHROPIC_API_KEY}));
