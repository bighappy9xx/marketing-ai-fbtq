const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'../studio-highlight-assembly.js')).toString('base64'));
function setup(){return {tracks:[{id:'v',kind:'mixed',hidden:true},{id:'text',kind:'text'},{id:'audio',kind:'audio'}],clips:[{id:'source',type:'video',mediaId:'file',trackId:'v',start:5,in:10,duration:80,sourceDuration:100,x:.1,opacity:.8,volume:.7,aiTranscript:{sourceIn:10,segments:[{start:1,end:2,text:'Giữ nguyên bản thoại'}]}},{id:'title',type:'text',trackId:'text',start:20,in:0,duration:30,text:'Tiêu đề gốc'},{id:'song',type:'audio',mediaId:'music',trackId:'audio',start:0,in:2,duration:100,sourceDuration:120},{id:'outside',type:'shape',trackId:'text',start:90,in:0,duration:5}],mediaId:'file',sourceDuration:100,templateId:'source',moments:[{number:'02',start:40,end:50,title:'Đoạn sau'},{number:'01',start:15,end:25,title:'Đoạn trước'}]};}
const counter=()=>{let n=0;return()=> 'new-'+ ++n;};
test('selected source intervals form one gapless chronological timeline and preserve all input',async()=>{
 const {assembleHighlights}=await load(),args=setup(),before=structuredClone(args),next=assembleHighlights({...args,newId:counter()});
 assert.deepEqual(args,before);assert.equal(next.duration,20);assert.deepEqual(next.segments.map(s=>[s.sourceStart,s.start,s.end]),[[15,0,10],[40,10,20]]);
 const video=next.clips.filter(c=>c.type==='video');assert.deepEqual(video.map(c=>[c.in,c.start,c.duration]),[[15,0,10],[40,10,10]]);assert.ok(video.every(c=>c.x===.1&&c.opacity===.8&&c.volume===.7&&c.aiTranscript.segments[0].text==='Giữ nguyên bản thoại'));
 assert.equal(new Set(next.clips.map(c=>c.id)).size,next.clips.length);assert.equal(next.tracks[0].hidden,false);assert.ok(next.clips.every(c=>c.start>=0&&c.start+c.duration<=20));
});
test('text and audio trim and ripple in sync; discarded source portions leave no trailing clips',async()=>{
 const {assembleHighlights}=await load(),next=assembleHighlights({...setup(),newId:counter()});
 assert.deepEqual(next.clips.filter(c=>c.type==='audio').map(c=>[c.start,c.in,c.duration]),[[0,12,10],[10,37,10]]);
 assert.deepEqual(next.clips.filter(c=>c.type==='text').map(c=>[c.start,c.duration,c.text]),[[10,10,'Tiêu đề gốc']]);assert.equal(next.clips.some(c=>c.id==='outside'||c.start>=20),false);
});
test('existing source splits are mapped without losing per-piece edits',async()=>{
 const {assembleHighlights}=await load(),args=setup();args.clips=[{...args.clips[0],duration:20},{...args.clips[0],id:'split',start:25,in:30,duration:20,opacity:.4},args.clips[2]];args.moments=[{start:25,end:35}];
 const next=assembleHighlights({...args,newId:counter()});assert.equal(next.duration,10);assert.deepEqual(next.clips.filter(c=>c.type==='video').map(c=>[c.start,c.in,c.duration,c.opacity]),[[0,25,5,.8],[5,30,5,.4]]);
});
test('source-only assembly can rebuild a portion previously removed from the timeline',async()=>{
 const {assembleHighlights}=await load(),args=setup();args.clips[0].duration=5;args.moments=[{start:70,end:80}];
 assert.throws(()=>assembleHighlights({...args,newId:counter()}),/không còn đủ/);const next=assembleHighlights({...args,keepLayers:false,newId:counter()});assert.equal(next.clips.length,1);assert.equal(next.clips[0].in,70);assert.equal(next.clips[0].start,0);assert.equal(next.clips[0].duration,10);
});
test('bad ranges, locked clips/tracks, ambiguous mapping and duplicate IDs cannot change the project',async()=>{
 const {assembleHighlights}=await load();
 for(const change of [a=>a.moments=[],a=>a.moments=[{start:-1,end:10}],a=>a.moments=[{start:99,end:110}],a=>a.moments=[{start:10,end:20},{start:15,end:25}],a=>a.clips[3].locked=true,a=>a.tracks[0].locked=true]){const args=setup();change(args);const before=structuredClone(args);assert.throws(()=>assembleHighlights({...args,newId:counter()}));assert.deepEqual(args,before);}
 assert.throws(()=>assembleHighlights({...setup(),newId:()=> 'duplicate'}),/duy nhất/);
 const args=setup();args.templateId='alternate';args.clips.push({...args.clips[0],id:'alternate',in:90,start:100,duration:10});args.clips.push({...args.clips[0],id:'duplicate',start:200});assert.throws(()=>assembleHighlights({...args,newId:counter()}),/nhiều lần/);
});
