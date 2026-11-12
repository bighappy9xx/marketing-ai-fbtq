const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {registerContentReviewAI,validateIssues}=require('../functions/content-review-ai');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const core=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../content-review-ai.js'),'utf8')).toString('base64'));
function service({banned=[],output={issues:[]},key='secret',role='employee',approved=true}={}){
  const data=new Map([['workspaces/fbtq/settings/bot',{banned}]]);let queue=Promise.resolve(),calls=0,hold=null,last;
  const db={doc:p=>({path:p,get:async()=>({exists:data.has(p),data:()=>data.get(p)})}),runTransaction:fn=>{const p=queue.then(()=>fn({get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),set:(ref,value)=>data.set(ref.path,value),update:(ref,value)=>data.set(ref.path,{...data.get(ref.path),...value})}));queue=p.catch(()=>{});return p;}};
  const api=registerContentReviewAI({db,onCall:(_opts,fn)=>fn,HttpsError,requireSignedIn:async req=>{if(!req.auth)throw new HttpsError('unauthenticated','Login');return{uid:req.auth.uid,profile:{role,approved}};},OPENAI_API_KEY:{value:()=>key},generate:async(...args)=>{calls++;last=args;if(hold)await hold;if(output instanceof Error)throw output;return typeof output==='string'?output:JSON.stringify(output);}});
  return {...api,data,get calls(){return calls;},get last(){return last;},pause(p){hold=p;}};
}
const req=text=>({auth:{uid:'staff'},data:{text}});
test('server bounds authentication, input, secret access and policy before paid calls',async()=>{
  const api=service();await assert.rejects(api.reviewContentAI({}),{code:'unauthenticated'});
  for(const text of ['',null,'x'.repeat(8001)])await assert.rejects(api.reviewContentAI(req(text)),{code:'invalid-argument'});
  await assert.rejects(service({approved:false}).reviewContentAI(req('Nội dung')),{code:'permission-denied'});
  await assert.rejects(service({key:''}).reviewContentAI(req('Nội dung')),{code:'failed-precondition'});
  await assert.rejects(service({banned:['x'.repeat(201)]}).reviewContentAI(req('Nội dung')),{code:'failed-precondition'});assert.equal(api.calls,0);
});
test('company terms cannot be waived by empty model output; cache is policy-specific',async()=>{
  const api=service({banned:['Cam kết 100%']});const result=await api.reviewContentAI(req('CAM KET 100% hiệu quả.'));
  assert.equal(result.blocked,true);assert.deepEqual(result.companyMatches,['Cam kết 100%']);assert.equal(api.last[2].format.strict,true);
  assert.equal(JSON.parse(api.last[0]).article,'CAM KET 100% hiệu quả.');assert.equal(api.last[2].maxTokens,6000);
  assert.deepEqual(await api.reviewContentAI(req('CAM KET 100% hiệu quả.')),result);assert.equal(api.calls,1);
  api.data.set('workspaces/fbtq/settings/bot',{banned:[]});assert.equal((await api.reviewContentAI(req('CAM KET 100% hiệu quả.'))).blocked,false);assert.equal(api.calls,2);
});
test('AI discoveries block only banned phrases; spelling keeps a safe replacement and exact offsets',async()=>{
  const text='😀 Sản phẫm cam kết khỏi.',api=service({output:{issues:[{quote:'Sản phẫm',occurrence:1,type:'spelling',reason:'Sai dấu.',replacement:'Sản phẩm'},{quote:'cam kết khỏi',occurrence:1,type:'banned',reason:'Cam kết chữa bệnh tuyệt đối.',replacement:'hỗ trợ chăm sóc'}]}});
  const result=await api.reviewContentAI(req(text));assert.equal(result.blocked,true);assert.equal(text.slice(result.issues[0].start,result.issues[0].end),'Sản phẫm');
  const spelling=service({output:{issues:[{quote:'phẫm',occurrence:1,type:'spelling',reason:'Sai dấu.',replacement:'phẩm'}]}});assert.equal((await spelling.reviewContentAI(req(text))).blocked,false);
});
test('invalid, hallucinated or truncated results never become a clean pass; locks are released',async()=>{
  for(const output of ['not JSON',{issues:[{quote:'not in article',occurrence:1,type:'banned',reason:'x',replacement:''}]},{issues:[{quote:'test',occurrence:0,type:'spelling',reason:'x',replacement:'text'}]},new HttpsError('unavailable','timeout')]){
    const api=service({output});await assert.rejects(api.reviewContentAI(req('test')),{code:'unavailable'});assert.equal(api.data.get('contentReviewAIUsage/staff').lockUntil,0);
  }
  const result=validateIssues('test test',{issues:[{quote:'test',occurrence:2,type:'spelling',reason:'Typo',replacement:'text'}]},HttpsError);assert.equal(result[0].start,5);
});
test('per-user lock and daily limits prevent simultaneous or unlimited paid checks',async()=>{
  const api=service();let release;api.pause(new Promise(r=>release=r));const first=api.reviewContentAI(req('bài đầu'));
  while(!api.calls)await new Promise(r=>setTimeout(r,1));await assert.rejects(api.reviewContentAI(req('bài khác')),{code:'resource-exhausted'});release();await first;assert.equal(api.calls,1);
  const usage=api.data.get('contentReviewAIUsage/staff');api.data.set('contentReviewAIUsage/staff',{...usage,count:120});await assert.rejects(api.reviewContentAI(req('chạm giới hạn')),{code:'resource-exhausted'});
});
test('Vietnamese red marks preserve emoji, combining marks, repeated words and escape HTML',async()=>{
  const {companyIssues,highlightContent}=await core(),text='😀 CAM KẾT và cam kết <script>alert(1)</script>',issues=companyIssues(text,['cam kết']);
  assert.equal(issues.length,2);assert.equal(text.slice(issues[0].start,issues[0].end),'CAM KẾT');assert.equal(text.slice(issues[1].start,issues[1].end),'cam kết');
  const html=highlightContent(text,[...issues,{start:3,end:6}]);assert.equal((html.match(/<mark /g)||[]).length,2);assert.ok(html.includes('&lt;script&gt;'));assert.equal(html.includes('<script>'),false);
});
