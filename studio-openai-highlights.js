import {highlightOptions,validateHighlights} from './studio-highlights-core.js?v=20261117-openai-blaze';
import {MAX_STUDIO_VIDEO_BYTES,videoWindows,prepareVideoSegment,checkVideoTask} from './studio-video-preparation.js?v=20261112-wide-studio';
import {audioPayload} from './studio-audio-payload.js?v=20261117-openai-blaze';
function eventOnce(target,event,signal){return new Promise((resolve,reject)=>{
 const done=(error)=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
 const ok=()=>done(),bad=()=>done(Error('Không đọc được khung hình video.')),abort=()=>done(new DOMException('Đã dừng phân tích.','AbortError'));
 const timer=setTimeout(bad,20000);target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
});}
export async function readOpenAIVideoPart(blob,duration,signal){
 const api=await import('./vendor/mediabunny/mediabunny-1.65.2.mjs'),input=new api.Input({source:new api.BlobSource(blob),formats:api.ALL_FORMATS});
 let hasAudio;try{hasAudio=!!await input.getPrimaryAudioTrack();}finally{input.dispose();}
 const video=document.createElement('video'),url=URL.createObjectURL(blob),frames=[];
 video.muted=true;video.playsInline=true;video.preload='auto';
 try{
  const ready=eventOnce(video,'loadeddata',signal);video.src=url;video.load();await ready;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.max(2,Math.round(512*video.videoHeight/video.videoWidth));
  if(canvas.height>512){canvas.width=Math.round(512*video.videoWidth/video.videoHeight);canvas.height=512;}
  const ctx=canvas.getContext('2d');
  for(let i=0;i<8;i++){
   checkVideoTask(signal);const at=Math.max(0,Math.min(duration-.05,(i+.5)*duration/8));
   if(Math.abs(video.currentTime-at)>.01){const seeked=eventOnce(video,'seeked',signal);video.currentTime=at;await seeked;}
   ctx.drawImage(video,0,0,canvas.width,canvas.height);frames.push({at,base64:canvas.toDataURL('image/jpeg',.65).split(',')[1]});
  }
 }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
 checkVideoTask(signal);
 return {frames,audio:hasAudio?await audioPayload(blob,{in:0,duration}):null};
}
// OpenAI text models do not accept a raw video. Upload only sampled low-resolution
// images and the selected audio; retain local source offsets for accurate editing.
export async function analyzeOpenAIHighlights({blob,clip,options,call,getUserId,signal,onProgress=()=>{},prepare=prepareVideoSegment,readPart=readOpenAIVideoPart}){
 const config=highlightOptions(options),uid=getUserId();
 const guard=()=>{checkVideoTask(signal);if(!uid||getUserId()!==uid)throw Error('Tài khoản đã thay đổi.');};guard();
 if(!clip||clip.type!=='video'||!Number.isFinite(clip.duration)||clip.duration<config.minDuration||!Number.isFinite(clip.in||0)||(clip.in||0)<0||!blob||blob.size<=0||blob.size>MAX_STUDIO_VIDEO_BYTES)throw Error('Chọn video hợp lệ, tối đa 8 GB mỗi file.');
 const windows=videoWindows(clip.in||0,clip.duration,config.minDuration,Math.min(config.maxDuration,90)),moments=[],notes=[];let model='';
 // videoWindows with a maximum of 90 seconds guarantees windows <=180 seconds.
 for(let i=0;i<windows.length;i++){
  guard();const range=windows[i],duration=range.end-range.start;
  const progress=(phase,n)=>onProgress({phase,index:i+1,total:windows.length,percent:100*(i+n)/windows.length});
  progress('prepare',0);const part=await prepare({blob,start:range.start,end:range.end,signal,onProgress:n=>progress('prepare',n*.35)});guard();
  const payload=await readPart(part,duration,signal);guard();progress('analyze',.4);
  const transcript=payload.audio?await call('transcribeStudioAudio',payload.audio):{segments:[]};guard();progress('analyze',.65);
  const data=await call('analyzeStudioHighlightsOpenAI',{duration,frames:payload.frames,segments:transcript.segments,options:config});guard();
  const valid=validateHighlights(data,{in:0,duration},config);model=data.model;
  for(const m of valid.moments){const shifted={...m,start:m.start+range.start,end:m.end+range.start};for(const key of ['transitions','music','subtitles'])shifted[key]=m[key].map(c=>({...c,at:c.at+range.start}));if(!moments.some(other=>shifted.start<other.end&&shifted.end>other.start))moments.push(shifted);}
  if(data.note)notes.push(data.note);progress('analyze',1);
 }
 guard();onProgress({phase:'done',index:windows.length,total:windows.length,percent:100});moments.sort((a,b)=>a.start-b.start);
 return {moments:moments.map((m,i)=>({...m,number:String(i+1).padStart(2,'0')})),note:'OpenAI: phân tích ảnh mẫu và lời thoại qua '+windows.length+' phần, không xem liên tục mọi khung hình. '+[...new Set(notes)].join(' ').slice(0,1300),model,options:config};
}
