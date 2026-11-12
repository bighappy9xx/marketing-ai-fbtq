const {test}=require('node:test'),assert=require('node:assert/strict');
const {createOpenAIIntegration}=require('../functions/openai-api');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
function setup({status=200,data={output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]},key='server-secret',authorized=true,networkError=false}={}){
  let calls=[];
  const api=createOpenAIIntegration({onCall:(opts,handler)=>handler,HttpsError,requireManager:async()=>{if(!authorized)throw new HttpsError('permission-denied','Chỉ quản lý');},OPENAI_API_KEY:{value:()=>key},model:()=> 'configured-model',fetchImpl:async(url,options)=>{calls.push({url,...options});if(networkError)throw Error('private provider details');return{ok:status===200,status,json:async()=>data};}});
  return {...api,calls};
}
test('Responses API sends credentials only in server headers and extracts message text',async()=>{
  const api=setup();assert.equal(await api.generate('Xin chào','Tiếng Việt',{maxTokens:900}),'OK');
  assert.equal(api.calls[0].url,'https://api.openai.com/v1/responses');assert.equal(api.calls[0].headers.Authorization,'Bearer server-secret');
  assert.deepEqual(JSON.parse(api.calls[0].body),{model:'configured-model',instructions:'Tiếng Việt',input:'Xin chào',max_output_tokens:900,store:false});
  await api.generate('Hi','',{model:'assistant-model'});assert.equal(JSON.parse(api.calls[1].body).model,'assistant-model');
});
test('connection check requires manager and confirms a real successful response',async()=>{
  const api=setup();assert.deepEqual(await api.checkOpenAIConnection({}),{connected:true,model:'configured-model'});assert.equal(api.calls.length,1);
  const blocked=setup({authorized:false});await assert.rejects(blocked.checkOpenAIConnection({}),{code:'permission-denied'});assert.equal(blocked.calls.length,0);
  const missing=setup({key:''});await assert.rejects(missing.checkOpenAIConnection({}),{code:'failed-precondition'});assert.equal(missing.calls.length,0);
});
test('provider failures give actionable errors without exposing provider payloads or keys',async()=>{
  for(const [status,code] of [[401,'failed-precondition'],[403,'permission-denied'],[404,'failed-precondition'],[429,'resource-exhausted'],[500,'unavailable']]){
    const api=setup({status,data:{error:{message:'private provider details server-secret'}}});
    await assert.rejects(api.generate('Hi',''),error=>error.code===code&&!/private provider details|server-secret/.test(error.message));
    assert.equal(api.calls.length,1);
  }
  await assert.rejects(setup({networkError:true}).generate('Hi',''),{code:'unavailable'});
});
test('empty, malformed and incomplete results never pass the connection check',async()=>{
  for(const data of [{},{output:{}},{output:[{content:[{type:'refusal',refusal:'No'}]}]},{status:'incomplete',output:[{content:[{type:'output_text',text:'partial'}]}]}]){
    await assert.rejects(setup({data}).checkOpenAIConnection({}),{code:'unavailable'});
  }
});
