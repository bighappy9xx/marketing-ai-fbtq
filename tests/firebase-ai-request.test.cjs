const {test}=require('node:test'),assert=require('node:assert/strict');
const api=()=>import('../firebase-ai-request.js');
function service(handler){const calls=[];return{calls,ai:{},aiMod:{ThinkingLevel:{MINIMAL:'MINIMAL',LOW:'LOW'},getGenerativeModel:(_ai,params,defaults)=>({generateContent:async(prompt,options)=>{const call={params,defaults,prompt,options};calls.push(call);return handler(call,calls.length);}})}};}
const answer=(text='OK')=>({response:{candidates:[{finishReason:'STOP'}],text:()=>text}});
test('fast text uses Flash-Lite MINIMAL; quality uses Flash LOW without invalid thinkingBudget',async()=>{
 const {requestGemini,FAST_GEMINI_MODEL,QUALITY_GEMINI_MODEL}=await api(),s=service(()=>answer());
 assert.equal((await requestGemini(s,{generationConfig:{maxOutputTokens:256}},'OK',{model:FAST_GEMINI_MODEL})).content,'OK');await requestGemini(s,{},'review');
 assert.equal(s.calls[0].params.model,FAST_GEMINI_MODEL);assert.equal(s.calls[0].params.generationConfig.thinkingConfig.thinkingLevel,'MINIMAL');assert.equal(s.calls[1].params.model,QUALITY_GEMINI_MODEL);assert.equal(s.calls[1].params.generationConfig.thinkingConfig.thinkingLevel,'LOW');assert.equal(s.calls[0].params.generationConfig.thinkingConfig.thinkingBudget,undefined);assert.ok(s.calls[0].options.signal instanceof AbortSignal);
});
test('timeout aborts a hung request and never starts a fallback or accepts a late result',async()=>{
 const {requestGemini,FAST_GEMINI_MODEL,QUALITY_GEMINI_MODEL}=await api();let complete;const s=service(()=>new Promise(r=>complete=r));
 const work=requestGemini(s,{},'wait',{model:FAST_GEMINI_MODEL,fallbackModel:QUALITY_GEMINI_MODEL,timeoutMs:15});await assert.rejects(work,error=>error.code==='ai/timeout'&&/không tự gửi lặp/.test(error.message));assert.equal(s.calls.length,1);assert.equal(s.calls[0].options.signal.aborted,true);complete(answer('late'));await new Promise(r=>setImmediate(r));assert.equal(s.calls.length,1);
});
test('only a definitive overload triggers a single sequential fallback within the shared deadline',async()=>{
 const {requestGemini,FAST_GEMINI_MODEL,QUALITY_GEMINI_MODEL}=await api(),s=service((_c,n)=>{if(n===1)throw Error('503 Service Unavailable');return answer('fallback');});
 const result=await requestGemini(s,{generationConfig:{responseMimeType:'application/json'}},'data',{model:FAST_GEMINI_MODEL,fallbackModel:QUALITY_GEMINI_MODEL,timeoutMs:1000});assert.equal(result.model,QUALITY_GEMINI_MODEL);assert.equal(s.calls.length,2);assert.ok(s.calls[1].options.timeout<=s.calls[0].options.timeout);assert.equal(s.calls[1].params.generationConfig.responseMimeType,'application/json');
 for(const error of [Error('Timeout has expired.'),Error('429 quota'),Error('App Check invalid token'),Error('403 permission denied')]){const blocked=service(()=>{throw error;});await assert.rejects(requestGemini(blocked,{},'data',{model:FAST_GEMINI_MODEL,fallbackModel:QUALITY_GEMINI_MODEL}));assert.equal(blocked.calls.length,1);}
});
test('cancellation during SDK preparation releases the caller without waiting for its own deadline',async()=>{
 const {requestGemini}=await api(),controller=new AbortController(),s=service(()=>new Promise(()=>{}));const work=requestGemini(s,{},'wait',{signal:controller.signal,timeoutMs:1000});controller.abort(new DOMException('cancel','AbortError'));await assert.rejects(work,e=>e.name==='AbortError');assert.equal(s.calls[0].options.signal.aborted,true);
});
test('empty, blocked and truncated responses never count as success',async()=>{
 const {requestGemini}=await api();for(const response of [{text:()=>''},{promptFeedback:{blockReason:'SAFETY'},text:()=> 'blocked'},{candidates:[{finishReason:'MAX_TOKENS'}],text:()=> 'partial'}]){const s=service(()=>({response}));await assert.rejects(requestGemini(s,{},'test'));assert.equal(s.calls.length,1);}
});
test('simultaneous connection checks share one short real request and do not cache success indefinitely',async()=>{
 const {checkFirebaseGemini}=await import('../firebase-ai-studio.js');let complete;const s=service(()=>new Promise(r=>complete=r));s.appCheck={};const options={getFirebase:()=>s,getUserId:()=> 'staff'};
 const first=checkFirebaseGemini(options),second=checkFirebaseGemini(options);assert.equal(s.calls.length,1);assert.equal(s.calls[0].params.model,'gemini-3.5-flash-lite');assert.ok(s.calls[0].options.timeout<=20000);assert.equal(s.calls[0].params.generationConfig.maxOutputTokens,256);complete(answer());assert.equal((await first).connected,true);assert.equal((await second).connected,true);
 const third=checkFirebaseGemini(options);assert.equal(s.calls.length,2);complete(answer());await third;
});
