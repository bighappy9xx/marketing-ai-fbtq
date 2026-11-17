// Server-only OpenAI integration. Never return credentials or provider error bodies.
const {textPolicy,publicPolicy,requireAIAccount}=require('./ai-policy');
module.exports.createOpenAIIntegration = function ({onCall,HttpsError,requireManager,OPENAI_API_KEY,fetchImpl=fetch,model=()=>textPolicy('content').model,withUsage=(_uid,_kind,_limit,work)=>work()}) {
  async function generate(prompt,instructions,options={}) {
    const key=OPENAI_API_KEY.value();
    if(!key)throw new HttpsError('failed-precondition','Chưa cấu hình OPENAI_API_KEY trên backend.');
    const selected=options.model||model(),policy=textPolicy(options.task);
    const modern=/^gpt-(?:5|6)(?:[.-]|$)/.test(selected);
    const body={model:selected,instructions,input:prompt,max_output_tokens:options.maxTokens||policy.maxTokens,store:false,
      ...(modern?{reasoning:{effort:options.effort||policy.effort},text:{verbosity:'low',...(options.format?{format:options.format}:{})}}:options.format?{text:{format:options.format}}:{})};
    let response;
    try {
      response=await fetchImpl('https://api.openai.com/v1/responses',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(55000)
      });
    } catch {
      throw new HttpsError('unavailable','Không kết nối được OpenAI. Hãy thử lại sau.');
    }
    const data=await response.json().catch(()=>({}));
    if(!response.ok) {
      if(response.status===401)throw new HttpsError('failed-precondition','OpenAI API key không hợp lệ hoặc đã bị thu hồi. Cập nhật secret OPENAI_API_KEY của backend rồi thử lại.');
      if(response.status===403)throw new HttpsError('permission-denied','OpenAI từ chối truy cập. Kiểm tra quyền của API key, project và model.');
      if(response.status===404)throw new HttpsError('failed-precondition','Model OpenAI không tồn tại hoặc project chưa được cấp quyền. Kiểm tra OPENAI_MODEL ở máy chủ.');
      if(response.status===429)throw new HttpsError('resource-exhausted','OpenAI đã chạm hạn mức. Kiểm tra API billing, số dư và giới hạn yêu cầu rồi thử lại.');
      throw new HttpsError('unavailable','OpenAI chưa xử lý được yêu cầu. Kiểm tra model và thử lại sau.');
    }
    if(data.status==='incomplete')throw new HttpsError('unavailable','OpenAI chưa hoàn thành phản hồi. Thử yêu cầu ngắn hơn hoặc tăng giới hạn token trên máy chủ.');
    const content=(Array.isArray(data.output)?data.output:[]).flatMap(item=>Array.isArray(item.content)?item.content:[]).filter(part=>part.type==='output_text'&&typeof part.text==='string').map(part=>part.text).join('\n').trim();
    if(!content)throw new HttpsError('unavailable','OpenAI không trả về văn bản. Hãy đổi yêu cầu hoặc kiểm tra model.');
    return content;
  }
  const checkOpenAIConnection=onCall({secrets:[OPENAI_API_KEY],timeoutSeconds:75,memory:'256MiB'},async request=>{
    const auth=await requireManager(request);
    requireAIAccount(auth,HttpsError);
    const selectedModel=model();
    await withUsage(auth?.uid,'connection',20,()=>generate('Trả lời đúng một từ: OK.','Bạn đang kiểm tra kết nối API.',{model:selectedModel,task:'check',maxTokens:64}));
    return {connected:true,model:selectedModel,policies:publicPolicy()};
  });
  return {generate,checkOpenAIConnection};
};
