const {test}=require('node:test'),assert=require('node:assert/strict');
const core=()=>import('../studio-highlights-core.js');
const source=()=>({id:'v',mediaId:'m',type:'video',start:25,in:40,duration:100,sourceDuration:200,trackId:'base',volume:.7});
const moment=(start=50,end=70)=>({start,end,hook:'Bạn có biết cách này?',summary:'Giải thích một mẹo trong video.',reason:'Có câu hỏi mở và minh hoạ rõ.',title:'Một mẹo hữu ích',description:'Tóm tắt đúng nội dung.',hashtags:['#MeoHay'],transitions:[{at:start,advice:'Cắt thẳng vào hành động.'}],music:[{at:start+1,advice:'Nhạc nhẹ, giảm dưới lời thoại.'}],subtitles:[{at:start+2,advice:'Nhấn từ khoá có trong lời thoại.'}]});
test('timecodes preserve hours and subsecond boundaries and validate user clip options',async()=>{
  const c=await core();assert.equal(c.timecode(3661.25),'01:01:01.250');assert.equal(c.timecode(59.9996),'00:01:00');assert.equal(c.timecode(0),'00:00:00');
  assert.equal(c.highlightOptions().count,3);for(const options of [{count:0},{count:1.5},{count:11},{minDuration:40,maxDuration:10},{maxDuration:181}])assert.throws(()=>c.highlightOptions(options));
});
test('model results use source bounds, accept fewer moments and reject unsafe or fabricated ranges',async()=>{
  const c=await core(),options=c.highlightOptions({count:3,minDuration:10,maxDuration:60});
  const result=c.validateHighlights({moments:[moment(90,110),moment()],note:'Chỉ có 2 đoạn trọn ý.'},source(),options);assert.equal(result.moments[0].number,'01');assert.equal(result.moments[0].start,50);
  for(const moments of [[moment(0,20)],[moment(130,150)],[moment(50,55)],[moment(),moment(60,80)],[{...moment(),start:NaN}],[{...moment(),subtitles:[{at:80,advice:'outside'}]}],[{...moment(),hashtags:['not a hashtag']}]])assert.throws(()=>c.validateHighlights({moments,note:''},source(),options));
  assert.deepEqual(c.validateHighlights({moments:[],note:'Không có đoạn phù hợp.'},source(),options).moments,[]);
});
test('reversible cut splits only the source and preserves source offsets, overlays and original input',async()=>{
  const c=await core(),video=source(),other={id:'overlay',type:'text',start:25,duration:100,text:'Giữ nguyên'},input=[video,other],before=structuredClone(input);let n=0;
  const result=c.splitHighlight(input,'v',moment(),()=> 'new-'+(++n));assert.deepEqual(input,before);assert.deepEqual(result.clips.filter(c=>c.type==='video').map(c=>[c.in,c.start,c.duration]),[[40,25,10],[50,35,20],[70,55,70]]);assert.equal(result.selectedId,'new-1');assert.deepEqual(result.clips.at(-1),other);assert.equal(result.clips.filter(c=>c.type==='video').reduce((s,c)=>s+c.duration,0),100);
  assert.throws(()=>c.splitHighlight([{...video,locked:true}],'v',moment(),()=>''));assert.throws(()=>c.splitHighlight(input,'v',moment(0,10),()=>''));
});
test('reports include metadata and all editing cues, CSV quotes formulas and malicious HTML stays plain text',async()=>{
  const c=await core(),plan={sourceName:'Video',note:'',moments:[{...moment(),number:'01',title:'=SUM(A1)',description:'Line 1\n"Line 2"'}]};
  assert.match(c.highlightReport(plan),/Phụ đề: 00:00:52/);assert.match(c.highlightReport(plan),/#MeoHay/);const csv=c.highlightCSV(plan);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=SUM(A1)"));assert.ok(csv.includes('""Line 2""'));
});
function sdkFixture(){
  let uid='staff',called=0,params,parts,opts,output={moments:[moment()],note:''},hold;
  const S={object:x=>x,array:x=>x,number:()=>({}),string:()=>({})};
  const firebase={ai:{},appCheck:{},aiMod:{Schema:S,getGenerativeModel:(_ai,p,o)=>{params=p;opts=o;return{generateContent:async input=>{called++;parts=input;if(hold)await hold;return{response:{candidates:[{finishReason:'STOP'}],text:()=>JSON.stringify(output)}};}};}}};
  return {args:{blob:new Blob(['video bytes'],{type:'video/mp4'}),clip:source(),options:{count:2,minDuration:10,maxDuration:60},getFirebase:()=>firebase,getUserId:()=>uid},user:x=>uid=x,pause:x=>hold=x,result:x=>output=x,get calls(){return called;},get params(){return params;},get parts(){return parts;},get opts(){return opts;}};
}
test('Gemini receives real inline video and source offsets with schema; no OpenAI dependency',async()=>{
  const {analyzeStudioHighlights}=await import('../studio-highlights-ai.js'),f=sdkFixture(),result=await analyzeStudioHighlights(f.args);
  assert.equal(f.calls,1);assert.equal(f.params.model,'gemini-3.8-flash');assert.equal(f.params.generationConfig.responseMimeType,'application/json');assert.equal(f.opts.timeout,120000);assert.equal(f.parts[1].inlineData.data,Buffer.from('video bytes').toString('base64'));assert.deepEqual(f.parts[1].videoMetadata,{startOffset:'40s',endOffset:'140s'});assert.equal(JSON.parse(f.parts[0]).requestedCount,2);assert.equal(result.moments.length,1);
});
test('oversize video, invalid selection, missing App Check and account switch cannot produce a plan',async()=>{
  const {analyzeStudioHighlights,HIGHLIGHT_MAX_BYTES}=await import('../studio-highlights-ai.js');
  const f=sdkFixture();await assert.rejects(analyzeStudioHighlights({...f.args,blob:new Blob([new Uint8Array(HIGHLIGHT_MAX_BYTES+1)],{type:'video/mp4'})}),/12 MB/);await assert.rejects(analyzeStudioHighlights({...f.args,clip:{...source(),type:'audio'}}),/đoạn video/);await assert.rejects(analyzeStudioHighlights({...f.args,getFirebase:()=>({})}),/App Check/);assert.equal(f.calls,0);
  let release;f.pause(new Promise(r=>release=r));const pending=analyzeStudioHighlights(f.args);while(!f.calls)await new Promise(r=>setTimeout(r,1));f.user('other');release();await assert.rejects(pending,/Tài khoản/);
});
