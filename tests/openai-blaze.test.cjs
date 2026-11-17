const {test}=require('node:test'),assert=require('node:assert/strict');
const {textPolicy,requireAIAccount}=require('../functions/ai-policy');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
function store(){const data=new Map();let queue=Promise.resolve();return {data,doc:path=>({path}),runTransaction:fn=>{const p=queue.then(()=>fn({get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),set:(ref,value)=>data.set(ref.path,value),update:(ref,value)=>data.set(ref.path,{...data.get(ref.path),...value})}));queue=p.catch(()=>{});return p;}};}
test('paid task policy and active account checks are server-owned',()=>{
 assert.equal(textPolicy('reply').maxTokens,300);assert.equal(textPolicy('review').effort,'low');
 for(const auth of [{uid:'new',profile:{}},{uid:'blocked',profile:{approved:false,role:'director'}},{uid:'unknown',profile:{approved:true,role:'owner'}}])assert.throws(()=>requireAIAccount(auth,HttpsError),{code:'permission-denied'});
 requireAIAccount({uid:'staff',profile:{approved:true,role:'employee'}},HttpsError);
});
test('usage gate locks concurrent jobs, preserves other users and resets on Vietnam day boundary',async()=>{
 const db=store();let clock=Date.parse('2026-11-17T23:59:58+07:00');const gate=require('../functions/ai-usage').createAIUsageGate({db,HttpsError,now:()=>clock});
 let release;const first=gate('u1','content',2,()=>new Promise(r=>release=r));while(!release)await new Promise(r=>setTimeout(r,1));
 await assert.rejects(gate('u1','content',2,async()=>{}),{code:'resource-exhausted'});assert.equal(await gate('u2','content',2,async()=> 'other'),'other');release('done');assert.equal(await first,'done');
 await assert.rejects(gate('u1','content',2,async()=>{throw Error('provider failure');}),/provider failure/);assert.equal(db.data.get('openaiUsage/u1_content').lockUntil,0);
 await assert.rejects(gate('u1','content',2,async()=>{}),{code:'resource-exhausted'});clock+=3000;assert.equal(await gate('u1','content',2,async()=> 'new day'),'new day');
});
const moment=()=>({start:2,end:12,hook:'Một câu mở đầu',summary:'Nội dung đã ghi nhận',reason:'Nội dung trọn ý',title:'Tiêu đề',description:'Mô tả',hashtags:['#Video'],transitions:[],music:[],subtitles:[]});
function highlights(output){let paid=0,captured;const api=require('../functions/studio-highlights-openai').registerOpenAIHighlights({onCall:(_opts,fn)=>fn,HttpsError,requireSignedIn:async req=>{if(!req.auth)throw new HttpsError('unauthenticated','Login');return {uid:req.auth.uid,profile:{role:'employee',approved:req.approved!==false}};},OPENAI_API_KEY:{},withUsage:(_u,_k,_n,work)=>work(),generate:async(...args)=>{paid++;captured=args;return JSON.stringify(output);}});return {...api,get paid(){return paid;},get captured(){return captured;}};}
const payload=()=>({duration:60,frames:[{at:10,base64:'/9j/AAAA'}],segments:[{start:2,end:12,text:'Nội dung được nghe trong video'}],options:{minDuration:10,maxDuration:30}});
test('video analysis rejects bad input before billing and sends bounded low-detail images',async()=>{
 const api=highlights({note:'Ảnh mẫu và lời thoại',moments:[moment()]});await assert.rejects(api.analyzeStudioHighlightsOpenAI({data:payload()}),{code:'unauthenticated'});
 await assert.rejects(api.analyzeStudioHighlightsOpenAI({auth:{uid:'u'},approved:false,data:payload()}),{code:'permission-denied'});
 for(const edit of [p=>p.duration=181,p=>p.frames=Array(9).fill(p.frames[0]),p=>p.frames[0].base64='https://attacker.test/image',p=>p.segments[0].end=100]){const p=payload();edit(p);await assert.rejects(api.analyzeStudioHighlightsOpenAI({auth:{uid:'u'},data:p}),{code:'invalid-argument'});}assert.equal(api.paid,0);
 assert.equal((await api.analyzeStudioHighlightsOpenAI({auth:{uid:'u'},data:payload()})).moments.length,1);assert.equal(api.paid,1);assert.equal(api.captured[0][0].content.find(p=>p.type==='input_image').detail,'low');assert.match(api.captured[1],/không suy diễn/);assert.equal(api.captured[2].task,'highlights');
});
test('hallucinated, overlapping and out-of-range cuts cannot be applied',async()=>{
 for(const output of [{note:'',moments:[]},{note:'Bad',moments:[{...moment(),start:-1}]},{note:'Bad',moments:[moment(),moment()]},{note:'Bad',moments:[{...moment(),music:[{at:50,advice:'Outside'}]}]}])await assert.rejects(highlights(output).analyzeStudioHighlightsOpenAI({auth:{uid:'u'},data:payload()}),{code:'unavailable'});
});
