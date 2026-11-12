export const MAX_STUDIO_VIDEO_BYTES=8*1024**3;
export const INLINE_VIDEO_BYTES=12*1024**2;
export function checkVideoTask(signal){if(signal?.aborted)throw new DOMException('Đã dừng phân tích video.','AbortError');}
// Overlapping windows cover the full file, including hooks near window boundaries.
export function videoWindows(start,duration,minDuration=10,maxDuration=60){
  if(![start,duration,minDuration,maxDuration].every(Number.isFinite)||start<0||duration<=0)throw Error('Thời lượng video không hợp lệ.');
  const length=Math.max(180,maxDuration*2),overlap=Math.min(maxDuration,length/2),end=start+duration,windows=[];
  let cursor=start;
  while(cursor<end){const stop=Math.min(end,cursor+length);windows.push({start:cursor,end:stop});if(stop>=end)break;cursor=stop-overlap;}
  return windows;
}
export async function prepareVideoSegment({blob,start,end,signal,onProgress=()=>{},api:injected}){
  checkVideoTask(signal);const api=injected||await import('./vendor/mediabunny/mediabunny-1.65.2.mjs');
  const input=new api.Input({source:new api.BlobSource(blob),formats:api.ALL_FORMATS});let conversion;
  const abort=()=>{conversion?.cancel().catch(()=>{});};
  try{
    const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();checkVideoTask(signal);
    if(!video||!await video.canDecode())throw Error('Trình duyệt chưa giải mã được video này. Dùng MP4 H.264 hoặc WebM trên Chrome/Edge.');
    const width=await video.getDisplayWidth(),height=await video.getDisplayHeight(),scale=Math.min(1,640/Math.max(width,height));
    const target=new api.BufferTarget(),output=new api.Output({format:new api.WebMOutputFormat(),target});
    const origin=Math.max(0,await input.getFirstTimestamp());
    conversion=await api.Conversion.init({input,output,trim:{start:origin+start,end:origin+end},video:{codec:'vp8',width:Math.max(2,Math.round(width*scale/2)*2),height:Math.max(2,Math.round(height*scale/2)*2),fit:'contain',frameRate:12,bitrate:220000,forceTranscode:true},audio:{codec:'opus',bitrate:48000,numberOfChannels:1,sampleRate:24000,forceTranscode:true}});
    if(!conversion.isValid||!conversion.utilizedTracks.includes(video)||audio&&!conversion.utilizedTracks.includes(audio))throw Error('Không nén được đầy đủ hình ảnh/âm thanh. Dùng Chrome/Edge và video MP4 H.264 hoặc WebM.');
    signal?.addEventListener('abort',abort,{once:true});checkVideoTask(signal);
    conversion.onProgress=value=>{onProgress(value);};await conversion.execute();checkVideoTask(signal);
    const result=new Blob([target.buffer],{type:'video/webm'});
    if(result.size<=0||result.size>INLINE_VIDEO_BYTES)throw Error('Phần video sau nén vẫn vượt giới hạn AI. Hãy nén video nguồn thêm rồi thử lại.');
    return result;
  }finally{signal?.removeEventListener('abort',abort);if(signal?.aborted)await conversion?.cancel().catch(()=>{});input.dispose();}
}
