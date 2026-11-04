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
function secretValues() {
  return {gemini:GEMINI_API_KEY.value(),openai:OPENAI_API_KEY.value(),claude:ANTHROPIC_API_KEY.value()};
}

exports.generateContent = onCall({secrets:[GEMINI_API_KEY,OPENAI_API_KEY,ANTHROPIC_API_KEY],timeoutSeconds:60,memory:'256MiB'},async request=>{
  await requireSignedIn(request);
  const {prompt,platform='Facebook',tone='Thân thiện, gần gũi',length='Tiêu chuẩn',model='gemini'}=request.data||{};
  if(typeof prompt!=='string'||prompt.trim().length<3||prompt.length>5000)throw new HttpsError('invalid-argument','Prompt cần từ 3 đến 5.000 ký tự.');
  const provider=cleanProvider(model);
  const settings=await readBotSettings();
  const voice=settings.brandVoice||'Thân thiện, rõ ràng, tích cực. Không tự tạo số liệu, giá bán hoặc cam kết chưa có trong yêu cầu.';
  const system=`Bạn là trợ lý nội dung marketing của công ty FBTQ. Viết bằng tiếng Việt tự nhiên. Giọng thương hiệu: ${voice}.\nNền tảng: ${platform}. Giọng điệu mong muốn: ${tone}. Độ dài: ${length}.\nTuân thủ chính sách quảng cáo và tránh khẳng định sức khoẻ, tài chính hoặc kết quả tuyệt đối. Không tự thêm thông tin giá, ưu đãi, tồn kho hay số liệu nếu người dùng không cung cấp. Chỉ trả về nội dung có thể chỉnh sửa, không giải thích quy trình.`;
  const content=await generateWithProvider(provider,prompt.trim(),system,secretValues(),{maxTokens:length==='Chi tiết'?1500:900});
  return {content,provider};
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
  const auth=await requireDirector(request);const {email,role}=request.data||{};
  if(typeof email!=='string'||!email.includes('@')||!['director','branch_manager','department_manager','employee'].includes(role))throw new HttpsError('invalid-argument','Email hoặc vai trò không hợp lệ.');
  let user;try{user=await getAuth().getUserByEmail(email.trim().toLowerCase())}catch{throw new HttpsError('not-found','Chưa tìm thấy tài khoản. Người dùng cần đăng ký trước.')}
  const claims={...user.customClaims,role,approved:true,workspaceId:'fbtq'};
  await getAuth().setCustomUserClaims(user.uid,claims);
  await db.doc(`users/${user.uid}`).set({email:user.email,name:user.displayName||email,role,approved:true,updatedAt:FieldValue.serverTimestamp(),updatedBy:auth.uid},{merge:true});
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
exports.connectFacebookPage = onCall({secrets:[META_TOKEN_ENCRYPTION_KEY],timeoutSeconds:35,memory:'256MiB'},async request=>{
  const auth=await requireSignedIn(request);const {pageId,pageName,pageToken,model='gemini'}=request.data||{};
  if(typeof pageId!=='string'||!/^\d{5,30}$/.test(pageId)||typeof pageName!=='string'||pageName.length>160||typeof pageToken!=='string'||pageToken.length<20)throw new HttpsError('invalid-argument','Thông tin Fanpage chưa hợp lệ.');
  if(!['gemini','openai'].includes(model))throw new HttpsError('invalid-argument','Mô hình chatbot chưa được hỗ trợ.');
  const response=await fetch(`${graphUrl(encodeURIComponent(pageId))}?fields=id,name&access_token=${encodeURIComponent(pageToken)}`,{signal:AbortSignal.timeout(15000)}).catch(()=>null);
  const meta=response&&await response.json().catch(()=>({}));
  if(!response?.ok||meta.id!==pageId)throw new HttpsError('failed-precondition','Meta không xác nhận Page ID và Page Access Token.');
  const encrypted=encryptToken(pageToken,META_TOKEN_ENCRYPTION_KEY.value());
  await db.doc(`workspaces/fbtq/pages/${pageId}`).set({pageId,pageName:meta.name||pageName,ownerUid:auth.uid,model,active:true,...encrypted,connectedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return {ok:true,pageName:meta.name||pageName,message:'Đã mã hoá và lưu Page Access Token.'};
});

exports.sendPageReply = onCall({secrets:[META_TOKEN_ENCRYPTION_KEY],timeoutSeconds:35,memory:'256MiB'},async request=>{
  const auth=await requireSignedIn(request);const {pageId,recipientId,message}=request.data||{};
  if(typeof message!=='string'||!message.trim()||message.length>2000||typeof recipientId!=='string'||!/^\d+$/.test(recipientId))throw new HttpsError('invalid-argument','Tin nhắn hoặc khách nhận không hợp lệ.');
  const ref=db.doc(`workspaces/fbtq/pages/${String(pageId||'')}`);const snap=await ref.get();
  if(!snap.exists||snap.data().ownerUid!==auth.uid||snap.data().active!==true)throw new HttpsError('permission-denied','Fanpage không thuộc tài khoản của bạn.');
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
        await db.doc(`workspaces/fbtq/inbox/${key}`).set({pageId,pageName:page.pageName,ownerUid:page.ownerUid,model:page.model||'gemini',conversationId:key,senderId:sender,message,direction:'incoming',attachments:(event.message.attachments||[]).map(a=>({type:a.type,url:a.payload?.url||''})),receivedAt:FieldValue.serverTimestamp(),unread:true},{merge:true});
        await db.collection('workspaces/fbtq/messages').doc(crypto.createHash('sha256').update(`${key}:${event.message.mid||event.timestamp||Date.now()}`).digest('hex')).set({pageId,pageName:page.pageName,ownerUid:page.ownerUid,conversationId:key,senderId:sender,message,direction:'incoming',attachments:(event.message.attachments||[]).map(a=>({type:a.type,url:a.payload?.url||''})),createdAt:FieldValue.serverTimestamp()},{merge:true});
      }
    }
    return res.sendStatus(200);
  }catch(error){logger.error('Meta webhook event processing failed',{error:String(error)});return res.sendStatus(500)}
});
