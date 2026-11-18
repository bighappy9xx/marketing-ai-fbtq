export const SPEECH_MODELS=['gemini-3.8-flash-lite-tts','gemini-3.8-flash-tts'];
const voices={Aoede:'Warm, light Northern Vietnamese accent.',Kore:'Warm, expressive Southern Vietnamese accent.',Zephyr:'Natural, clear Northern Vietnamese accent.',Callirrhoe:'Steady, clear standard Northern Vietnamese pronunciation.',Sulafat:'Warm, conversational Vietnamese delivery.'};

export async function synthesizeGeminiSpeech({firebase,text,voice='Aoede',model=SPEECH_MODELS[0],signal,timeoutMs=95000,call}){
 text=String(text||'').trim();
 if(!text||Array.from(text).length>1800)throw Error('Nhập từ 1 đến 1.800 ký tự cho mỗi lần tạo giọng đọc.');
 if(!Object.hasOwn(voices,voice)||!SPEECH_MODELS.includes(model))throw Error('Chọn giọng đọc và mô hình Gemini TTS hợp lệ.');
 if(!call&&(!firebase?.ai||!firebase?.aiMod))throw Error('Gemini chưa kết nối. Kiểm tra Firebase AI Logic trong Cài đặt.');
 const controller=new AbortController();let timer,rejectAbort;
 const cancelled=new Promise((_,reject)=>{rejectAbort=reject;});
 const abort=()=>{const error=signal?.reason||new DOMException('Đã dừng tạo giọng đọc.','AbortError');controller.abort(error);rejectAbort(error);};
 if(signal?.aborted)throw signal.reason||new DOMException('Đã dừng tạo giọng đọc.','AbortError');
 signal?.addEventListener('abort',abort,{once:true});
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=Error('Gemini tạo giọng đọc quá thời gian chờ. Không tự gửi lại; hãy thử đoạn ngắn hơn.');controller.abort(error);reject(error);},timeoutMs);});
 const work=async()=>{
  let response;
  if(call){
   const data=await call('synthesizeFreeSpeech',{text,voice,model},{timeout:timeoutMs});
   response={inlineDataParts:()=>[{inlineData:{mimeType:data?.mimeType,data:data?.audioContent}}]};
  }else{
  const instance=firebase.aiMod.getGenerativeModel(firebase.ai,{model,generationConfig:{responseModalities:[firebase.aiMod.ResponseModality.AUDIO],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}},languageCode:'vi-VN'}}},{timeout:timeoutMs});
  // Gemini 3.8 receives the transcript separately from delivery instructions and returns a complete WAV.
  ({response}=await instance.generateContent([{text,speechMetadata:{style:voices[voice]+' Speak clearly at a natural, steady pace.'}}],{signal:controller.signal,timeout:timeoutMs}));
  }
  if(controller.signal.aborted)throw controller.signal.reason;
  const finish=response?.candidates?.[0]?.finishReason;
  if(response?.promptFeedback?.blockReason||(finish&&finish!=='STOP'))throw Error('Gemini chưa hoàn tất giọng đọc hoặc đã chặn nội dung. Hãy kiểm tra văn bản.');
  const audio=response?.inlineDataParts?.()?.find(part=>/^audio\/(?:wav|x-wav)(?:;|$)/i.test(part.inlineData?.mimeType||''))?.inlineData;
  if(!audio?.data)throw Error('Gemini chưa trả về tệp WAV. Kiểm tra quyền dùng model TTS và thử đoạn ngắn hơn.');
  const bytes=Uint8Array.from(atob(audio.data),c=>c.charCodeAt(0));
  const tag=(start,end)=>String.fromCharCode(...bytes.subarray(start,end));
  if(bytes.length<44||tag(0,4)!=='RIFF'||tag(8,12)!=='WAVE')throw Error('Tệp âm thanh Gemini trả về không hợp lệ. Hãy thử lại sau.');
  return new Blob([bytes],{type:'audio/wav'});
 };
 try{return await Promise.race([work(),deadline,cancelled]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
