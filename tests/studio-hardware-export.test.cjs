const {test}=require('node:test'),assert=require('node:assert/strict');
const api=()=>import('../studio-hardware-export.js');
test('offline frame schedule respects trimmed source, fractional clip edges and long timelines',async()=>{
 const {clipFrameTimes,exportBitrate}=await api();
 const frames=[...clipFrameTimes({start:.05,duration:.1,in:12},2)];
 assert.equal(frames.length,3);assert.ok(Math.abs(frames[0]-(14+2/30-.05))<1e-9);
 let count=0;for(const t of clipFrameTimes({start:0,duration:1860,in:0})){assert.ok(t<1860);count++;}
 assert.equal(count,55800);assert.equal(exportBitrate(1920,1080),6220800);
});
test('probe requests hardware preference, rejects unsupported codecs and odd dimensions without silent fallback',async()=>{
 const {probeHardware}=await api();let config;
 const mock={canEncodeVideo:async(c,o)=>{assert.equal(c,'avc');config=o;return true;},canEncodeAudio:async()=>false};
 await probeHardware(mock,1920,1080,false);assert.equal(config.hardwareAcceleration,'prefer-hardware');assert.equal(config.latencyMode,'quality');
 await assert.rejects(probeHardware(mock,1920,1080,true),/AAC/);
 await assert.rejects(probeHardware(mock,1919,1080,false),/số chẵn/);
 await assert.rejects(probeHardware({...mock,canEncodeVideo:async()=>false},1920,1080,false),/chưa hỗ trợ/);
});
test('audio mixing retains source trim, stereo/mono, gaps, volume and fades across block boundaries',async()=>{
 const {mixAudioBuffer}=await api();
 const mono={numberOfChannels:1,length:4,sampleRate:4,getChannelData:()=>new Float32Array([1,1,1,1])};
 const output=[new Float32Array(8),new Float32Array(8)];
 const clip={start:1,duration:1,in:3,volume:.5,opacity:1,fadeIn:.5};
 mixAudioBuffer(output,0,{buffer:mono,timestamp:3},clip,0,4);
 assert.deepEqual([...output[0]],[0,0,0,0,0,.25,.5,.5]);assert.deepEqual(output[0],output[1]);
 const next=[new Float32Array(4),new Float32Array(4)];mixAudioBuffer(next,1,{buffer:mono,timestamp:3},clip,0,4);
 assert.deepEqual([...next[0]],[0,.25,.5,.5]);
});
test('automatic encoder tries hardware then CPU, while explicit hardware never silently switches',async()=>{
 const {probeHardware}=await api(),calls=[];
 const mock={canEncodeVideo:async(c,o)=>{calls.push(o.hardwareAcceleration);return o.hardwareAcceleration==='prefer-software';}};
 const options=await probeHardware(mock,1280,720,false,'auto');assert.equal(options.hardwareAcceleration,'prefer-software');assert.deepEqual(calls,['prefer-hardware','prefer-software']);
 calls.length=0;await assert.rejects(probeHardware(mock,1280,720,false,'hardware'));assert.deepEqual(calls,['prefer-hardware']);
 calls.length=0;await probeHardware(mock,1280,720,false,'software');assert.deepEqual(calls,['prefer-software']);
});
test('setup reports hardware, CPU and audio independently, including invalid project dimensions',async()=>{
 const {inspectExportSupport}=await import('../studio-export-settings.js');
 const mock={canEncodeVideo:async(c,o)=>o.hardwareAcceleration==='prefer-software',canEncodeAudio:async()=>false};
 const result=await inspectExportSupport(mock,1920,1080);assert.equal(result.hardware,false);assert.equal(result.software,true);assert.equal(result.audio,false);assert.match(result.reason,/chưa hỗ trợ/);
 const odd=await inspectExportSupport(mock,1919,1080);assert.equal(odd.hardware,false);assert.equal(odd.software,false);assert.match(odd.reason,/số chẵn/);
 const broken=await inspectExportSupport({...mock,canEncodeAudio:async()=>{throw Error('unavailable');}},1280,720);assert.equal(broken.software,true);assert.equal(broken.audio,false);
});
function mockPipeline({cancelAt=Infinity,missingFrame=false}={}){
 const calls={timestamps:[],writes:0,disposed:0,cancelled:0,aborted:0,painted:[],audio:[]};let checked=0;
 const file=new Blob(['mp4'],{type:'video/mp4'});
 class Input{async getFirstTimestamp(){return 2;}async getPrimaryVideoTrack(){return{canDecode:async()=>true};}async getPrimaryAudioTrack(){return null;}dispose(){calls.disposed++;}}
 class CanvasSink{canvasesAtTimestamps(times){return(async function*(){for(const t of times){calls.timestamps.push(t);yield missingFrame?null:{canvas:{t}};}})();}}
 class Output{constructor(){calls.created=true;}addVideoTrack(){}addAudioTrack(){}async start(){calls.started=true;}async finalize(){calls.finalized=true;}async cancel(){calls.cancelled++;}}
 class CanvasSource{constructor(c,options){calls.options=options;}async add(t,d){calls.writes++;assert.ok(d>0);}close(){calls.closed=true;}}
 const injected={Input,BlobSource:class{},ALL_FORMATS:[],CanvasSink,Output,CanvasSource,Mp4OutputFormat:class{},StreamTarget:class{},canEncodeVideo:async()=>true};
 const options={api:injected,clips:[{id:'v',mediaId:'m',type:'video',name:'source',trackId:'base',start:0,duration:.1,in:5}],tracks:[{id:'base'}],resources:new Map([['m',{blob:file}]]),canvas:{width:1280,height:720},fileHandle:{createWritable:async()=>({write:async()=>{},close:async()=>calls.committed=true,abort:async()=>calls.aborted++}),getFile:async()=>file},check:()=>{if(++checked>=cancelAt)throw new DOMException('cancel','AbortError');},paintFrame:async(t,images)=>{assert.ok(images.has('v'));calls.painted.push(t);}};
 return{options,calls,file};
}
test('pipeline encodes offline timestamps and finalizes streamed file rather than playing timeline',async()=>{
 const {exportHardware}=await api(),{options,calls,file}=mockPipeline();assert.equal(await exportHardware(options),file);
 assert.equal(calls.writes,3);assert.deepEqual(calls.painted,[0,1/30,2/30]);assert.equal(calls.timestamps[0],7);
 assert.equal(calls.options.hardwareAcceleration,'prefer-hardware');assert.equal(calls.finalized,true);assert.equal(calls.disposed,1);assert.equal(calls.cancelled,0);
});
test('cancellation and missing decoded frames abort file and dispose input without finalizing',async()=>{
 const {exportHardware}=await api();
 for(const setup of [{cancelAt:7},{missingFrame:true}]){
  const {options,calls}=mockPipeline(setup);await assert.rejects(exportHardware(options));assert.equal(calls.finalized,undefined);assert.equal(calls.disposed,1);assert.equal(calls.cancelled,1);assert.equal(calls.aborted,1);
 }
});
test('audio is mixed in bounded blocks, retains the pending decoded buffer across blocks, and excludes muted layers',async()=>{
 const {exportHardware}=await api(),{options,calls}=mockPipeline();
 const previous=global.AudioBuffer;
 class TestBuffer{constructor({numberOfChannels,length,sampleRate}){this.numberOfChannels=numberOfChannels;this.length=length;this.sampleRate=sampleRate;this.data=Array.from({length:numberOfChannels},()=>new Float32Array(length));}getChannelData(i){return this.data[i];}copyToChannel(data,i){this.data[i].set(data);}}
 global.AudioBuffer=TestBuffer;
 try{
  const base=options.api.Input;
  options.api.Input=class extends base{async getPrimaryAudioTrack(){return{canDecode:async()=>true,getNumberOfChannels:async()=>2};}};
  options.api.canEncodeAudio=async()=>true;
  options.api.AudioBufferSink=class{buffers(){return(async function*(){const buffer=new TestBuffer({numberOfChannels:2,length:96000,sampleRate:48000});buffer.data.forEach(c=>c.fill(.25));yield{timestamp:7,buffer};})();}};
  options.api.AudioBufferSource=class{async add(buffer){calls.audio.push(buffer);}close(){}};
  options.clips[0].duration=1.2;options.clips[0].volume=.5;
  options.tracks.push({id:'muted',muted:true});options.clips.push({...options.clips[0],id:'silent',type:'audio',trackId:'muted'});
  await exportHardware(options);assert.equal(calls.writes,36);assert.deepEqual(calls.audio.map(b=>b.length),[48000,9600]);
  for(const b of calls.audio)for(const ch of b.data)assert.ok(ch.every(v=>v===.125));
 }finally{global.AudioBuffer=previous;}
});
