const {test}=require('node:test'),assert=require('node:assert/strict');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
function service(output={text:'Bài viết mới chưa công bố giá.',improvements:['Câu rõ ý hơn.']}){
 const data=new Map([['workspaces/fbtq/settings/bot',{banned:['chữa'],brandVoice:'Thân thiện'}]]);let queue=Promise.resolve(),calls=0,hold,last;
 const db={doc:path=>({path,get:async()=>({exists:data.has(path),data:()=>data.get(path)})}),runTransaction:fn=>{const p=queue.then(()=>fn({get:async r=>({exists:data.has(r.path),data:()=>data.get(r.path)}),set:(r,v)=>data.set(r.path,v),update:(r,v)=>data.set(r.path,{...data.get(r.path),...v})}));queue=p.catch(()=>{});return p;}};
 const api=require('../functions/content-review-ai').registerContentReviewAI({db,HttpsError,onCall:(_opts,fn)=>fn,requireSignedIn:async req=>{if(!req.auth)throw new HttpsError('unauthenticated','Login');return {uid:req.auth.uid,profile:{approved:req.approved!==false,role:'employee'}};},OPENAI_API_KEY:{value:()=> 'server-key'},generate:async(...args)=>{calls++;last=args;if(hold)await hold;return typeof output==='string'?output:JSON.stringify(output);}});
 return {...api,data,get calls(){return calls;},get last(){return last;},pause(p){hold=p;}};
}
const req=(text='Bài gốc chưa công bố giá.',goal='')=>({auth:{uid:'u'},data:{action:'improve',text,goal}});
test('rewrite uses the protected existing callable, bounded output and policy-specific caching',async()=>{
 const s=service();await assert.rejects(s.reviewContentAI({data:req().data}),{code:'unauthenticated'});await assert.rejects(s.reviewContentAI({...req(),approved:false}),{code:'permission-denied'});assert.equal(s.calls,0);
 const result=await s.reviewContentAI(req());assert.equal(result.text,'Bài viết mới chưa công bố giá.');assert.deepEqual(result.companyMatches,[]);assert.equal(s.last[2].task,'rewrite');assert.equal(s.last[2].effort,'none');assert.equal(s.last[2].maxTokens,6000);assert.match(s.last[1],/giữ thông tin|giữ nguyên|thông tin đã|thông tin/);assert.equal(JSON.parse(s.last[0]).article,req().data.text);
 assert.deepEqual(await s.reviewContentAI(req()),result);assert.equal(s.calls,1);await s.reviewContentAI(req(undefined,'Ngắn gọn'));assert.equal(s.calls,2);
 assert.equal(s.data.has('contentReviewAIUsage/u'),false);assert.equal(s.data.get('contentImproveAIUsage/u').lockUntil,0);
});
test('malformed proposals and invalid mode/goal fail without a clean applied result',async()=>{
 for(const output of ['not JSON',{text:'',improvements:[]},{text:'x'.repeat(8001),improvements:[]},{text:'Bài mới',improvements:[null]}]){const s=service(output);await assert.rejects(s.reviewContentAI(req()),{code:'unavailable'});assert.equal(s.data.get('contentImproveAIUsage/u').lockUntil,0);}
 const s=service();await assert.rejects(s.reviewContentAI(req(undefined,'x'.repeat(801))),{code:'invalid-argument'});await assert.rejects(s.reviewContentAI({auth:{uid:'u'},data:{action:'publish',text:'Bài gốc'}}),{code:'invalid-argument'});assert.equal(s.calls,0);
});
test('rewrites cannot bypass daily limits or parallel job locks; exact banned words remain visible',async()=>{
 const s=service({text:'chưa và chữa.',improvements:['Bản đề xuất vẫn cần kiểm tra.']});let release;s.pause(new Promise(r=>release=r));const first=s.reviewContentAI(req());while(!s.calls)await new Promise(r=>setTimeout(r,1));await assert.rejects(s.reviewContentAI(req('Bài khác')),{code:'resource-exhausted'});release();assert.deepEqual((await first).companyMatches,['chữa']);
 s.data.set('contentImproveAIUsage/u',{...s.data.get('contentImproveAIUsage/u'),count:20});await assert.rejects(s.reviewContentAI(req('Bài mới khác nữa')),{code:'resource-exhausted'});
});
