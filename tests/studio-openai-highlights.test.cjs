const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function moduleURL(file){const source=fs.readFileSync(file,'utf8').replace(/from ['"](\.\/[^'"]+)['"]/g,(_m,spec)=>'from '+JSON.stringify(moduleURL(path.resolve(path.dirname(file),spec.split('?')[0]))));return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');}
const load=()=>import(moduleURL(path.join(__dirname,'../studio-openai-highlights.js')));
const m=(start=2,end=12)=>({start,end,hook:'Hook',summary:'Nội dung',reason:'Trọn ý',title:'Tiêu đề',description:'Mô tả',hashtags:['#Video'],transitions:[{at:start,advice:'Cắt thẳng'}],music:[],subtitles:[]});
test('video chunks preserve absolute source offsets and do not upload raw video',async()=>{
 const {analyzeOpenAIHighlights}=await load(),calls=[],windows=[],progress=[];
 const result=await analyzeOpenAIHighlights({blob:new Blob(['local video']),clip:{type:'video',in:30,duration:360},options:{minDuration:10,maxDuration:60},getUserId:()=> 'u',onProgress:p=>progress.push(p),prepare:async r=>{windows.push(r);return new Blob(['compressed']);},readPart:async()=>({frames:[{at:5,base64:'/9j/AAAA'}],audio:{base64:'wav',duration:180}}),call:async(name,data)=>{calls.push({name,data});return name==='transcribeStudioAudio'?{segments:[{start:2,end:12,text:'speech'}]}:{note:'sampled',model:'gpt-6-luna',moments:[m()]};}});
 assert.ok(windows.every(w=>w.end-w.start<=180));assert.equal(windows[0].start,30);assert.equal(windows.at(-1).end,390);assert.equal(calls.length,windows.length*2);assert.equal(calls[1].data.blob,undefined);assert.equal(result.moments[0].start,32);assert.equal(result.moments[0].transitions[0].at,32);assert.equal(progress.at(-1).percent,100);assert.match(result.note,/ảnh mẫu/);
});
test('abort or changed account prevents subsequent provider calls',async()=>{
 const {analyzeOpenAIHighlights}=await load();let uid='u',calls=0;const controller=new AbortController();controller.abort();
 const args={blob:new Blob(['local']),clip:{type:'video',in:0,duration:20},getUserId:()=>uid,prepare:async()=>{uid='other';return new Blob(['compressed']);},readPart:async()=>{throw Error('must not read');},call:async()=>{calls++;}};
 await assert.rejects(analyzeOpenAIHighlights({...args,signal:controller.signal}),{name:'AbortError'});await assert.rejects(analyzeOpenAIHighlights(args),/Tài khoản đã thay đổi/);assert.equal(calls,0);
});
