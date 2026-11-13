export const FAST_GEMINI_MODEL='gemini-3.5-flash-lite';
export const QUALITY_GEMINI_MODEL='gemini-3.8-flash';
export function isGeminiTimeout(error){return /timeout|deadline/i.test(String(error?.code||''))||/timeout|timed out|deadline.exceeded|thời gian chờ/i.test(String(error?.message||''));}
function temporaryFailure(error){return !isGeminiTimeout(error)&&(/(?:^|\D)(500|503)(?:\D|$)|overload|high demand|service unavailable/i.test(String(error?.message||''))||['ai/server-error','ai/service-unavailable'].includes(error?.code));}
export function geminiError(error){
 const raw=String(error?.message||''),code=String(error?.code||'');let message;
 if(isGeminiTimeout(error))message='Gemini chưa phản hồi trong thời gian chờ. Yêu cầu đã được dừng chờ; không tự gửi lặp. Kiểm tra mạng, App Check và thử lại sau ít phút.';
 else if(/429|quota|resource.exhausted|rate.limit/i.test(raw+' '+code))message='Đã chạm hạn mức Gemini. Chờ quota phục hồi hoặc kiểm tra hạn mức project trong Google AI Studio; bấm liên tục sẽ không giúp nhanh hơn.';
 else if(/app.?check|attestation|invalid.*token/i.test(raw))message='App Check chưa xác thực được website. Kiểm tra site key, tên miền và tải lại trang; tăng thời gian chờ không sửa được lỗi này.';
 else if(/401|403|permission.denied/i.test(raw+' '+code))message='Gemini chưa cho phép yêu cầu. Kiểm tra Gemini Developer API, quyền truy cập và App Check của project.';
 else if(temporaryFailure(error))message='Gemini đang quá tải tạm thời. Hãy thử lại sau ít phút.';
 else if(/failed to fetch|network|offline/i.test(raw+' '+code))message='Không kết nối được Gemini. Kiểm tra mạng và thử lại.';
 else return error instanceof Error?error:Error('Gemini chưa xử lý được yêu cầu.');
 const result=Error(message);result.code=isGeminiTimeout(error)?'ai/timeout':code||'ai/request-failed';return result;
}
export async function requestGemini(firebase,params,prompt,{model=QUALITY_GEMINI_MODEL,timeoutMs=60000,fallbackModel=null,signal}={}){
 const controller=new AbortController();let timer,expired=false,rejectCancelled;
 const cancelled=new Promise((_,reject)=>{rejectCancelled=reject;});
 const abort=()=>{const reason=signal?.reason||new DOMException('Đã hủy yêu cầu.','AbortError');controller.abort(reason);rejectCancelled(reason);};
 if(signal?.aborted)throw signal.reason||new DOMException('Đã hủy yêu cầu.','AbortError');
 signal?.addEventListener('abort',abort,{once:true});
 // One deadline covers SDK preparation, App Check, network and the optional fallback.
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;const error=Error('Timeout has expired');error.code='ai/timeout';controller.abort(error);reject(error);},timeoutMs);});
 const work=async()=>{
  const started=Date.now();let lastError;
  for(const selected of [model,...(fallbackModel&&fallbackModel!==model?[fallbackModel]:[])]){
   if(controller.signal.aborted)throw controller.signal.reason||new DOMException('Đã hủy yêu cầu.','AbortError');
   const remaining=Math.max(1,timeoutMs-(Date.now()-started)),level=selected===FAST_GEMINI_MODEL?'MINIMAL':'LOW',thinkingLevel=firebase.aiMod.ThinkingLevel?.[level];
   const generationConfig={...(thinkingLevel?{thinkingConfig:{thinkingLevel}}:{}),...params.generationConfig};
   const instance=firebase.aiMod.getGenerativeModel(firebase.ai,{...params,model:selected,generationConfig},{timeout:remaining});
   try{
    const {response}=await instance.generateContent(prompt,{signal:controller.signal,timeout:remaining});
    if(controller.signal.aborted)throw controller.signal.reason||new DOMException('Đã hủy yêu cầu.','AbortError');
    const finish=response?.candidates?.[0]?.finishReason;
    if(response?.promptFeedback?.blockReason||finish&&finish!=='STOP')throw Error('Gemini chưa hoàn tất phản hồi hoặc nội dung đã bị chặn. Không dùng kết quả dở dang; thử yêu cầu ngắn hơn.');
    const content=response?.text()?.trim();if(!content)throw Error('Gemini chưa trả về nội dung. Hãy thử lại.');
    return {content,model:selected};
   }catch(error){lastError=error;if(controller.signal.aborted||!temporaryFailure(error)||selected===fallbackModel||!fallbackModel)throw error;}
  }
  throw lastError;
 };
 try{return await Promise.race([work(),deadline,cancelled]);}
 catch(error){if(signal?.aborted&&!expired)throw signal.reason||error;throw geminiError(expired?Object.assign(Error('Timeout has expired'),{code:'ai/timeout'}):error);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
