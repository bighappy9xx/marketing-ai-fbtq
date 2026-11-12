export const OPENAI_BACKEND_METHODS=new Set(['generateContentOpenAI','askAssistantOpenai','checkOpenAIConnection','getStudioAISetup','generateStudioImage','transcribeStudioAudio']);
export function normalizeOpenAIBackend(value){
  const text=String(value||'').trim();if(!text)return '';
  let url;try{url=new URL(text);}catch{throw Error('Nhập URL HTTPS của backend OpenAI do bạn quản lý.');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||/(^|\.)(openai\.com|googleapis\.com)$/.test(url.hostname))throw Error('Dùng URL HTTPS của backend riêng, không dùng URL nhà cung cấp hoặc API key.');
  return url.href.replace(/\/$/,'');
}
export function createOpenAIBackendClient({getURL,getFirebase,getUserId,fetchImpl=fetch}){
  return {configured:()=>!!getURL(),async call(name,data={},options={}){
    if(!OPENAI_BACKEND_METHODS.has(name))throw Error('Chức năng không hỗ trợ qua backend OpenAI.');
    const base=normalizeOpenAIBackend(getURL());if(!base)throw Error('Chưa cấu hình URL backend OpenAI.');
    const uid=getUserId(),user=getFirebase()?.auth?.currentUser;
    if(!uid||user?.uid!==uid)throw Error('Đăng nhập Firebase trước khi sử dụng OpenAI.');
    const token=await user.getIdToken();if(getUserId()!==uid)throw Error('Tài khoản đã thay đổi.');
    let response;try{response=await fetchImpl(base+'/'+name,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data),signal:AbortSignal.timeout(options.timeout||200000)});}catch{throw Error('Không kết nối được backend OpenAI. Kiểm tra URL, ALLOWED_ORIGINS và trạng thái Worker.');}
    const payload=await response.json().catch(()=>null);if(getUserId()!==uid)throw Error('Tài khoản đã thay đổi.');
    if(!response.ok||payload?.error){const error=new Error(payload?.error?.message||'Backend OpenAI chưa trả phản hồi hợp lệ (HTTP '+response.status+').');error.code='functions/'+(payload?.error?.code||'unavailable');throw error;}
    if(!payload||!Object.hasOwn(payload,'data'))throw Error('Backend OpenAI trả sai định dạng. Kiểm tra đúng URL Worker của hệ thống.');
    return payload.data;
  }};
}
