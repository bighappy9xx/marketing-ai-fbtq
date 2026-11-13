const {test}=require('node:test'),assert=require('node:assert/strict');
function setup(output={segments:[{start:0,end:.5,text:'Xin chào'}]}){
 let uid='staff',calls=0,params,prompt,release;
 const Schema={object:x=>x,array:x=>x,number:()=>({type:'number'}),string:()=>({type:'string'})};
 const firebase={ai:{},appCheck:{},aiMod:{Schema,getGenerativeModel:(_,p)=>{params=p;return{generateContent:async input=>{calls++;prompt=input;if(release)await release;return{response:{candidates:[{finishReason:'STOP'}],text:()=>JSON.stringify(output)}};}};}}};
 return {options:{getFirebase:()=>firebase,getUserId:()=>uid},firebase,get calls(){return calls;},get params(){return params;},get prompt(){return prompt;},user:u=>uid=u,pause:p=>release=p};
}
async function wav(){const {encodeMonoWav}=await import('../studio-ai-core.js');return Buffer.from(encodeMonoWav(new Float32Array(16000))).toString('base64');}
test('Gemini transcribes inline WAV through AI Logic with bounded JSON and estimated timestamps',async()=>{
 const {transcribeFirebaseAudio}=await import('../firebase-ai-studio.js'),s=setup(),base64=await wav();
 const result=await transcribeFirebaseAudio({...s.options,base64,duration:1});assert.equal(s.calls,1);assert.equal(s.params.model,'gemini-3.8-flash');assert.equal(s.params.generationConfig.responseMimeType,'application/json');assert.equal(s.prompt[1].inlineData.mimeType,'audio/wav');assert.equal(s.prompt[1].inlineData.data,base64);assert.equal(result.provider,'gemini');assert.equal(result.timingEstimated,true);assert.deepEqual(result.words,[]);assert.equal(result.segments[0].text,'Xin chào');
});
test('invalid audio, missing App Check and malformed/overlapping timestamps cannot create a cut transcript',async()=>{
 const {transcribeFirebaseAudio,validateGeminiTranscript}=await import('../firebase-ai-studio.js'),s=setup(),base64=await wav();
 for(const input of [{base64:'bad',duration:1},{base64,duration:181},{base64,duration:2}])await assert.rejects(transcribeFirebaseAudio({...s.options,...input}));assert.equal(s.calls,0);
 s.firebase.appCheck=null;await assert.rejects(transcribeFirebaseAudio({...s.options,base64,duration:1}),/App Check/);assert.equal(s.calls,0);
 for(const segments of [[{start:-1,end:.5,text:'a'}],[{start:0,end:2,text:'a'}],[{start:0,end:.5,text:'a'},{start:.4,end:.8,text:'b'}],[{start:0,end:.5,text:''}]])assert.throws(()=>validateGeminiTranscript({segments},1));
 assert.deepEqual(validateGeminiTranscript({segments:[]},1).segments,[]);
});
test('connection checks require a real response and discard results after account changes',async()=>{
 const {checkFirebaseGemini,transcribeFirebaseAudio}=await import('../firebase-ai-studio.js'),s=setup();assert.equal((await checkFirebaseGemini(s.options)).connected,true);assert.equal(s.calls,1);
 const slow=setup();let done;slow.pause(new Promise(r=>done=r));const work=transcribeFirebaseAudio({...slow.options,base64:await wav(),duration:1});while(!slow.calls)await new Promise(r=>setTimeout(r,1));slow.user('other');done();await assert.rejects(work,/Tài khoản/);
 const broken=setup();broken.firebase.aiMod.getGenerativeModel=()=>({generateContent:async()=>{throw Error('quota');}});await assert.rejects(checkFirebaseGemini(broken.options),/quota/);
});
