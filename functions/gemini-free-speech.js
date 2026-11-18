const {requireAIAccount}=require('./ai-policy');
const SOURCE_PROJECT='gen-lang-client-0906214986';
const MODELS=['gemini-3.8-flash-lite-tts','gemini-3.8-flash-tts'];
const VOICES={Aoede:'Warm, light Northern Vietnamese accent.',Kore:'Warm, expressive Southern Vietnamese accent.',Zephyr:'Natural, clear Northern Vietnamese accent.',Callirrhoe:'Steady, clear standard Northern Vietnamese pronunciation.',Sulafat:'Warm, conversational Vietnamese delivery.'};
function speechRequest(text,voice,model){return {model,input:[{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style:VOICES[voice]+' Speak clearly at a natural, steady pace.'}]}]}],response_format:{type:'audio',mime_type:'audio/wav'},generation_config:{speech_config:[{voice}]}};}
function readAudio(data){
 const audio=data.output_audio||(data.steps||[]).filter(s=>s.type==='model_output').flatMap(s=>s.content||[]).filter(p=>p.type==='audio').at(-1);
 if(data.status&&data.status!=='completed')throw Error('Incomplete audio');
 if(typeof audio?.data!=='string'||audio.data.length>12*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(audio.data))throw Error('Invalid audio');
 const bytes=Buffer.from(audio.data,'base64');
 if(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Invalid WAV');
 return {audioContent:audio.data,mimeType:'audio/wav'};
}
function registerFreeSpeech({onCall,HttpsError,requireSignedIn,GEMINI_FREE_API_KEY,withUsage,fetchImpl=fetch}){
 return onCall({secrets:[GEMINI_FREE_API_KEY],timeoutSeconds:90,memory:'256MiB',invoker:'public'},async request=>{
  const auth=await requireSignedIn(request);requireAIAccount(auth,HttpsError);
  const {text,voice='Aoede',model=MODELS[0]}=request.data||{};
  if(typeof text!=='string'||!text.trim()||Array.from(text.trim()).length>1800||!Object.hasOwn(VOICES,voice)||!MODELS.includes(model))throw new HttpsError('invalid-argument','Văn bản từ 1 đến 1.800 ký tự; chọn giọng và model TTS hợp lệ.');
  const key=GEMINI_FREE_API_KEY.value();if(!key)throw new HttpsError('failed-precondition','Chưa lưu GEMINI_FREE_API_KEY của project '+SOURCE_PROJECT+'.');
  return withUsage(auth.uid,'gemini_free_speech',20,async()=>{
   let response;try{response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(speechRequest(text.trim(),voice,model)),signal:AbortSignal.timeout(80000)});}catch{throw new HttpsError('unavailable','Không kết nối được Gemini Free TTS. Không tự gửi lại; hãy thử đoạn ngắn hơn.');}
   const data=await response.json().catch(()=>({}));
   if(!response.ok){
    const raw=String(data.error?.message||'');
    if(response.status===402||/prepay(?:ment)?.*(?:depleted|exhausted|required)/i.test(raw))throw new HttpsError('failed-precondition','Gemini Free: key đang thuộc project yêu cầu thanh toán. Dùng key từ '+SOURCE_PROJECT+' ở Free Tier, không liên kết Billing. Không tự chuyển sang API trả phí.');
    if(response.status===429)throw new HttpsError('resource-exhausted','Gemini Free đã chạm quota. Chờ hạn mức phục hồi; không tự chuyển sang trả phí.');
    if([401,403,404].includes(response.status))throw new HttpsError('failed-precondition','Gemini Free chưa cho phép yêu cầu: kiểm tra key của '+SOURCE_PROJECT+', xác minh project và quyền dùng model TTS.');
    throw new HttpsError('unavailable','Gemini Free TTS chưa xử lý được yêu cầu. Không tự gửi lại.');
   }
   let audio;try{audio=readAudio(data);}catch{throw new HttpsError('unavailable','Gemini Free chưa trả về tệp WAV hoàn chỉnh.');}
   return {...audio,voice,model,sourceProject:SOURCE_PROJECT};
  });
 });
}
module.exports={registerFreeSpeech,speechRequest,readAudio,SOURCE_PROJECT,MODELS};
