// Offline frame rendering: never records real-time playback. Output is streamed to disk.
import {opacityAt,endOf} from './studio-timeline-core.js?v=20261109-free-resources';
export const EXPORT_FPS=30;
export const AUDIO_RATE=48000;
export function* clipFrameTimes(clip,origin=0,fps=EXPORT_FPS){
 for(let i=Math.ceil(clip.start*fps);i<Math.ceil(endOf(clip)*fps);i++){
  const t=i/fps;if(t>=clip.start&&t<endOf(clip))yield origin+(clip.in||0)+t-clip.start;
 }
}
export function exportBitrate(width,height){return Math.min(24000000,Math.max(4000000,Math.round(width*height*30*.1)));}
export async function probeHardware(api,width,height,withAudio){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width%2||height%2)throw Error('Xuất H.264 cần chiều rộng và cao là số chẵn (px).');
 const options={width,height,frameRate:EXPORT_FPS,bitrate:exportBitrate(width,height),hardwareAcceleration:'prefer-hardware',latencyMode:'quality'};
 if(!await api.canEncodeVideo('avc',options))throw Error('Máy/trình duyệt chưa hỗ trợ cấu hình H.264 ưu tiên phần cứng này. Bật tăng tốc đồ hoạ trong Chrome/Edge rồi mở lại trình duyệt, hoặc chọn Xuất tương thích.');
 if(withAudio&&!await api.canEncodeAudio('aac',{sampleRate:AUDIO_RATE,numberOfChannels:2,bitrate:192000}))throw Error('Trình duyệt chưa hỗ trợ mã hoá âm thanh AAC. Dùng Chrome/Edge trên Windows/macOS hoặc chọn Xuất tương thích.');
 return options;
}
// Mix only the overlapping part of one decoded buffer into a small output block.
export function mixAudioBuffer(output,blockStart,wrapped,clip,origin=0,rate=AUDIO_RATE){
 const {buffer,timestamp}=wrapped,offset=clip.start-(clip.in||0)-origin;
 const start=timestamp+offset,end=start+buffer.length/buffer.sampleRate;
 const first=Math.max(0,Math.ceil((Math.max(start,clip.start)-blockStart)*rate));
 const last=Math.min(output[0].length,Math.ceil((Math.min(end,endOf(clip))-blockStart)*rate));
 const channels=output.map((_,i)=>buffer.getChannelData(Math.min(i,buffer.numberOfChannels-1)));
 for(let i=first;i<last;i++){
  const t=blockStart+i/rate,pos=Math.max(0,(t-start)*buffer.sampleRate),a=Math.min(buffer.length-1,Math.floor(pos)),b=Math.min(buffer.length-1,a+1),fraction=pos-a;
  const gain=(clip.volume??1)*opacityAt(clip,t);
  for(let ch=0;ch<output.length;ch++)output[ch][i]+=(channels[ch][a]+(channels[ch][b]-channels[ch][a])*fraction)*gain;
 }
}
export async function exportHardware({clips,tracks,resources,canvas,paintFrame,fileHandle,check,onProgress=()=>{},api:injected}){
 const api=injected||await import('./vendor/mediabunny/mediabunny-1.65.2.mjs');
 const duration=Math.max(0,...clips.map(endOf));
 if(!duration||!Number.isFinite(duration))throw Error('Dự án chưa có nội dung hợp lệ.');
 const visible=clips.filter(c=>!c.hidden&&tracks.some(t=>t.id===c.trackId&&!t.hidden));
 const audible=visible.filter(c=>['video','audio'].includes(c.type)&&(c.volume??1)>0&&!tracks.find(t=>t.id===c.trackId)?.muted);
 const inputs=new Map(),videos=new Map(),audios=[];let output,writable,finished=false;
 const assert=()=>check?.();
 try{
  assert();const options=await probeHardware(api,canvas.width,canvas.height,false);assert();
  // Each resource is read on demand from its Blob, rather than copied into an ArrayBuffer.
  for(const c of visible.filter(c=>['video','audio'].includes(c.type))){
   assert();let source=inputs.get(c.mediaId);
   if(!source){const r=resources.get(c.mediaId);if(!r?.blob)throw Error('Thiếu tư liệu gốc: '+c.name);
    const input=new api.Input({source:new api.BlobSource(r.blob),formats:api.ALL_FORMATS});
    source={input};inputs.set(c.mediaId,source);
    source.origin=Math.max(0,await input.getFirstTimestamp());
    source.video=await input.getPrimaryVideoTrack();source.audio=await input.getPrimaryAudioTrack();
   }
   if(c.type==='video'){
    if(!source.video||!await source.video.canDecode())throw Error('Không giải mã được video: '+c.name+'. Hãy chuyển file nguồn sang MP4 H.264.');
    const iterator=new api.CanvasSink(source.video,{poolSize:2}).canvasesAtTimestamps(clipFrameTimes(c,source.origin));videos.set(c.id,iterator);
   }
   if(audible.includes(c)&&source.audio){
    if(!await source.audio.canDecode())throw Error('Không giải mã được âm thanh: '+c.name);
    if(await source.audio.getNumberOfChannels()>2)throw Error('File '+c.name+' có âm thanh nhiều hơn 2 kênh. Chuyển âm thanh nguồn sang stereo trước khi xuất.');
    const iterator=new api.AudioBufferSink(source.audio).buffers(source.origin+(c.in||0),source.origin+(c.in||0)+c.duration);
    audios.push({clip:c,origin:source.origin,iterator,pending:null,done:false});
   }else if(c.type==='audio'&&!source.audio)throw Error('File âm thanh không có track đọc được: '+c.name);
  }
  if(audios.length)await probeHardware(api,canvas.width,canvas.height,true);
  assert();writable=await fileHandle.createWritable();
  // Keep the real file transaction open until finalize and session checks succeed.
  // A muxer's cancel may close its stream; closing a partially written real file would commit it.
  const transaction=new WritableStream({write:chunk=>writable.write(chunk),close(){},abort:reason=>writable.abort(reason)});
  output=new api.Output({format:new api.Mp4OutputFormat({fastStart:'fragmented',minimumFragmentDuration:1}),target:new api.StreamTarget(transaction,{chunked:true,chunkSize:2**20})});
  const video=new api.CanvasSource(canvas,{codec:'avc',...options,keyFrameInterval:2});
  output.addVideoTrack(video,{frameRate:EXPORT_FPS});
  const audio=audios.length?new api.AudioBufferSource({codec:'aac',bitrate:192000}):null;
  if(audio)output.addAudioTrack(audio);
  await output.start();const frames=Math.ceil(duration*EXPORT_FPS);let frame=0;
  const started=performance.now();
  // Interleave one second of audio and video so the muxer cannot accumulate a whole movie.
  for(let sample=0;sample<Math.ceil(duration*AUDIO_RATE);sample+=AUDIO_RATE){
   assert();const start=sample/AUDIO_RATE,end=Math.min(duration,start+1);
   if(audio){
    const count=Math.min(AUDIO_RATE,Math.ceil(duration*AUDIO_RATE)-sample),mixed=[new Float32Array(count),new Float32Array(count)];
    for(const state of audios){
     const c=state.clip;if(c.start>=end||endOf(c)<=start)continue;
     while(!state.done){
      assert();if(!state.pending){const next=await state.iterator.next();state.done=next.done;if(state.done)break;state.pending=next.value;}
      const wrapped=state.pending,bufferStart=wrapped.timestamp+c.start-(c.in||0)-state.origin;
      if(bufferStart>=end)break;
      mixAudioBuffer(mixed,start,wrapped,c,state.origin);
      if(bufferStart+wrapped.buffer.length/wrapped.buffer.sampleRate>end)break;
      state.pending=null;
     }
    }
    // Saturate only after summing all layers; keep silence in gaps and for muted tracks.
    for(const channel of mixed)for(let i=0;i<channel.length;i++)channel[i]=Math.max(-1,Math.min(1,channel[i]));
    const buffer=new AudioBuffer({numberOfChannels:2,length:count,sampleRate:AUDIO_RATE});
    mixed.forEach((data,ch)=>buffer.copyToChannel(data,ch));await audio.add(buffer);
   }
   while(frame<frames&&frame/EXPORT_FPS<end){
    assert();const t=frame/EXPORT_FPS,images=new Map();
    for(const c of visible)if(c.type==='video'&&t>=c.start&&t<endOf(c)){
     const result=await videos.get(c.id).next();assert();
     if(result.done||!result.value)throw Error('Thiếu khung hình trong '+c.name+' tại '+t.toFixed(2)+'s.');
     images.set(c.id,result.value.canvas);
    }
    await paintFrame(t,images);assert();await video.add(t,Math.min(1/EXPORT_FPS,duration-t));frame++;
    if(frame%15===0){onProgress({progress:frame/frames,speed:t/Math.max(.001,(performance.now()-started)/1000)});await new Promise(r=>setTimeout(r,0));}
   }
  }
  assert();video.close();audio?.close();await output.finalize();assert();await writable.close();finished=true;
  const file=await fileHandle.getFile();onProgress({progress:1,speed:duration/Math.max(.001,(performance.now()-started)/1000)});return file;
 }finally{
  if(!finished){try{await output?.cancel();}catch{}try{await writable?.abort();}catch{}}
  for(const iterator of [...videos.values(),...audios.map(a=>a.iterator)])try{await iterator.return?.();}catch{}
  for(const source of inputs.values())source.input.dispose();
 }
}
