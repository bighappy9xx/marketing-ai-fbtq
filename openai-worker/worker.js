import {Buffer} from 'node:buffer';
import openaiModule from '../functions/openai-api.js';
import studioModule from '../functions/studio-ai.js';
import assistantModule from '../functions/assistant-ai.js';
import {quotaDatabase} from './quota.js';

class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const roles=['employee','accountant','department_manager','branch_manager','director'];
const managers=['department_manager','branch_manager','director'];
const methods=new Set(['generateContentOpenAI','askAssistantOpenai','checkOpenAIConnection','getStudioAISetup','generateStudioImage','transcribeStudioAudio']);
const statusFor=code=>({'unauthenticated':401,'permission-denied':403,'not-found':404,'invalid-argument':400,'failed-precondition':412,'resource-exhausted':429,'unavailable':503}[code]||500);
async function readJSON(request,maxBytes){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new HttpsError('invalid-argument','Chỉ nhận JSON.');
  if(Number(request.headers.get('content-length'))>maxBytes)throw new HttpsError('invalid-argument','Yêu cầu API quá lớn.');
  const reader=request.body?.getReader();if(!reader)throw new HttpsError('invalid-argument','Yêu cầu trống.');
  let size=0,parts=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpsError('invalid-argument','Yêu cầu API quá lớn.');}parts.push(value);}}finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new HttpsError('invalid-argument','JSON không hợp lệ.');}
}
function fields(document){return Object.fromEntries(Object.entries(document?.fields||{}).map(([key,value])=>[key,value.stringValue??value.booleanValue??value.integerValue??value.arrayValue?.values?.map(v=>v.stringValue)]));}
async function identity(token,env,fetchImpl){
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw new HttpsError('unauthenticated','Phiên Firebase không hợp lệ. Đăng nhập lại.');}
  const now=Date.now()/1000,project=env.FIREBASE_PROJECT_ID;
  if(claims.aud!==project||claims.iss!==`https://securetoken.google.com/${project}`||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+30)throw new HttpsError('unauthenticated','Phiên Firebase không hợp lệ hoặc đã hết hạn.');
  // Google validates the ID token; never trust the decoded claims on their own.
  const verification=await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(12000)});
  if(!verification.ok)throw new HttpsError('unauthenticated','Không xác minh được Firebase. Đăng nhập lại; quản trị viên kiểm tra Firebase Web API key của backend.');
  const user=(await verification.json()).users?.[0];
  if(!user||user.disabled||user.localId!==claims.sub||!Number.isFinite(claims.auth_time)||claims.auth_time>now+30||Number(user.validSince||0)>claims.auth_time)throw new HttpsError('unauthenticated','Tài khoản Firebase không hợp lệ, đã bị khoá hoặc phiên đã bị thu hồi.');
  const base=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/`;
  async function document(path,optional=false){
    const response=await fetchImpl(base+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});
    if(optional&&response.status===404)return {};
    if(!response.ok)throw new HttpsError('permission-denied','Không đọc được hồ sơ hoặc cấu hình Firebase theo quyền tài khoản.');
    return fields(await response.json());
  }
  const profile=await document('users/'+encodeURIComponent(user.localId));
  if(profile.approved===false||!roles.includes(profile.role))throw new HttpsError('permission-denied','Tài khoản chưa được cấp quyền dùng OpenAI.');
  return {uid:user.localId,profile,document};
}
async function limited(db,uid,work){
  const ref=db.doc('openAIRequests/'+uid),id=crypto.randomUUID(),now=Date.now(),day=new Date().toISOString().slice(0,10);
  await db.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.exists?snap.data():{},count=old.day===day?old.count||0:0;if(old.lockUntil>now)throw new HttpsError('resource-exhausted','Một yêu cầu OpenAI đang chạy. Đợi hoàn thành.');if(count>=120)throw new HttpsError('resource-exhausted','Đã đạt 120 yêu cầu OpenAI hôm nay.');tx.set(ref,{day,count:count+1,jobId:id,lockUntil:now+240000});});
  try{return await work();}finally{await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data().jobId===id)tx.update(ref,{lockUntil:0});}).catch(()=>{});}
}
export function createWorker({fetchImpl=fetch}={}){return {async fetch(request,env){
  const origin=request.headers.get('Origin')||'',allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(allowed.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'});
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
    if(!origin||!allowed.includes(origin))throw new HttpsError('permission-denied','Website không được phép sử dụng backend OpenAI này.');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')throw new HttpsError('invalid-argument','Chỉ nhận POST.');
    const name=new URL(request.url).pathname.replace(/^\//,'');if(!methods.has(name))throw new HttpsError('not-found','Chức năng OpenAI không được hỗ trợ.');
    if(!env.FIREBASE_PROJECT_ID||!env.FIREBASE_WEB_API_KEY)throw new HttpsError('failed-precondition','Backend chưa cấu hình Firebase project và Web API key.');
    const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];if(!token)throw new HttpsError('unauthenticated','Đăng nhập Firebase trước khi dùng OpenAI.');
    const auth=await identity(token,env,fetchImpl),data=await readJSON(request,name==='transcribeStudioAudio'?9*1024**2:65536);
    if(!data||typeof data!=='object'||Array.isArray(data))throw new HttpsError('invalid-argument','Dữ liệu API không hợp lệ.');
    const db=quotaDatabase(env.QUOTA_DB,HttpsError),secret={value:()=>env.OPENAI_API_KEY||''},none={value:()=>''},onCall=(_options,handler)=>handler,requireSignedIn=async()=>auth;
    const requireManager=async()=>{if(!managers.includes(auth.profile.role))throw new HttpsError('permission-denied','Chỉ quản lý mới có thể kiểm tra cấu hình API.');return auth;};
    const integration=openaiModule.createOpenAIIntegration({onCall,HttpsError,requireManager,OPENAI_API_KEY:secret,fetchImpl,model:()=>env.OPENAI_MODEL||'gpt-6-luna'});
    const assistant=assistantModule.registerAssistantAI({onCall,HttpsError,requireSignedIn,generateWithProvider:(_provider,prompt,system,_keys,options)=>integration.generate(prompt,system,{...options,model:env.ASSISTANT_OPENAI_MODEL||env.OPENAI_MODEL||'gpt-6-luna'}),GEMINI_API_KEY:none,OPENAI_API_KEY:secret,ANTHROPIC_API_KEY:none});
    const studio=studioModule.registerStudioAI({db,onCall,HttpsError,requireSignedIn,OPENAI_API_KEY:secret,fetchImpl});
    const handlers={...studio,askAssistantOpenai:assistant.askAssistantOpenai,checkOpenAIConnection:integration.checkOpenAIConnection,generateContentOpenAI:async()=>{
      const {prompt,tone='Thân thiện, gần gũi',length='Tiêu chuẩn'}=data;
      if(typeof prompt!=='string'||prompt.trim().length<3||prompt.length>5000||typeof tone!=='string'||tone.length>100||!['Tiêu chuẩn','Ngắn gọn','Chi tiết'].includes(length))throw new HttpsError('invalid-argument','Prompt cần 3–5.000 ký tự và giọng điệu/độ dài hợp lệ.');
      const settings=await auth.document('workspaces/fbtq/settings/bot',true);
      const system='Bạn là trợ lý nội dung marketing FBTQ. Viết tiếng Việt tự nhiên. Không tự thêm giá, ưu đãi, số liệu, cam kết sức khoẻ hoặc tài chính thiếu căn cứ. Chỉ trả nội dung có thể chỉnh sửa. Giọng thương hiệu: '+String(settings.brandVoice||'Thân thiện, rõ ràng, tích cực.').slice(0,2000)+'. Giọng điệu: '+tone+'. Độ dài: '+length;
      return {content:await integration.generate(prompt.trim(),system,{maxTokens:length==='Chi tiết'?1500:900}),provider:'openai'};
    }};
    if(name==='checkOpenAIConnection')await requireManager();
    if(name!=='getStudioAISetup'&&!secret.value())throw new HttpsError('failed-precondition','Backend chưa lưu secret OPENAI_API_KEY.');
    const work=()=>handlers[name]({auth:{uid:auth.uid},data});
    return respond({data:await (name==='getStudioAISetup'?work():limited(db,auth.uid,work))});
  }catch(error){const code=error instanceof HttpsError?error.code:'unavailable',message=error instanceof HttpsError?error.message:'Backend OpenAI chưa xử lý được yêu cầu. Kiểm tra cấu hình, kết nối và cơ sở dữ liệu D1.';return respond({error:{code,message}},statusFor(code));}
}};}
export default createWorker();
