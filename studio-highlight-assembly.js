// All times are seconds. Source ranges come from AI, never from timeline pixels.
export function assembleHighlights({clips,tracks,mediaId,sourceDuration,templateId,moments,keepLayers=true,newId=()=>crypto.randomUUID()}){
 const fail=message=>{throw Error(message);};
 if(!Array.isArray(clips)||!Array.isArray(tracks)||!Number.isFinite(sourceDuration)||sourceDuration<=0||!Array.isArray(moments)||!moments.length||moments.length>500)fail('Chọn từ 1 đến 500 khoảnh khắc hợp lệ để tạo timeline.');
 if(clips.some(c=>c.locked||tracks.find(t=>t.id===c.trackId)?.locked))fail('Timeline có lớp hoặc đoạn đang khoá. Mở khoá trước khi tạo timeline mới.');
 if(clips.some(c=>![c.start,c.duration,c.in??0].every(Number.isFinite)||c.start<0||c.duration<=0||(c.in??0)<0))fail('Timeline có đoạn không hợp lệ. Kiểm tra thời lượng trước khi ghép.');
 const template=clips.find(c=>c.id===templateId&&c.mediaId===mediaId&&c.type==='video')||clips.find(c=>c.mediaId===mediaId&&c.type==='video');
 if(!template||!tracks.some(t=>t.id===template.trackId))fail('Video nguồn không còn trên timeline. Thêm lại video rồi thử lại.');
 const selected=moments.map(m=>({...m})).sort((a,b)=>a.start-b.start);
 selected.forEach((m,i)=>{if(![m.start,m.end].every(Number.isFinite)||m.start<0||m.end>sourceDuration+.00001||m.end-m.start<.1||i&&m.start<selected[i-1].end-.00001)fail('Khoảnh khắc bị trùng hoặc vượt thời lượng file nguồn.');});
 const candidates=clips.filter(c=>c.type==='video'&&c.mediaId===mediaId&&c.trackId===template.trackId),offset=template.start-(template.in||0);
 const ids=new Set(),next=[],segments=[];let cursor=0;
 function add(original,start,end,outputStart,sourceIn){
  if(end-start<.000001)return;
  const id=newId();if(!id||ids.has(id))fail('Không tạo được mã đoạn cắt duy nhất. Hãy thử lại.');ids.add(id);
  const part={...structuredClone(original),id,start:outputStart,duration:end-start};
  if(sourceIn!==undefined)part.in=sourceIn;
  else if(['audio','video'].includes(part.type))part.in=(original.in||0)+start-original.start;
  const left=Math.max(0,start-original.start),right=Math.max(0,original.start+original.duration-end);
  part.fadeIn=Math.min(part.duration,Math.max(0,(original.fadeIn||0)-left));
  part.fadeOut=Math.min(part.duration,Math.max(0,(original.fadeOut||0)-right));
  next.push(part);if(next.length>10000)fail('Timeline sau ghép có quá nhiều lớp. Giảm số đoạn hoặc bỏ giữ lớp phụ.');
 }
 for(const moment of selected){
  const duration=moment.end-moment.start,windows=[];
  if(keepLayers){
   let sourceAt=moment.start;
   while(sourceAt<moment.end-.000001){
    const matches=candidates.filter(c=>(c.in||0)<=sourceAt+.000001&&(c.in||0)+c.duration>sourceAt+.000001);
    const aligned=matches.filter(c=>Math.abs(c.start-(c.in||0)-offset)<.00001);
    const choices=aligned.length?aligned:matches;
    if(choices.length!==1)fail(choices.length?'Video nguồn xuất hiện nhiều lần ở mốc này. Bỏ chọn giữ lớp phụ để ghép trực tiếp file gốc.':'Một khoảnh khắc không còn đủ trên timeline. Bỏ chọn giữ lớp phụ để dựng lại từ file gốc.');
    const c=choices[0],end=Math.min(moment.end,(c.in||0)+c.duration),start=c.start+sourceAt-(c.in||0);
    windows.push({clip:c,start,end:start+end-sourceAt,sourceIn:sourceAt,outputStart:cursor+sourceAt-moment.start});sourceAt=end;
   }
  }else windows.push({clip:template,start:template.start+moment.start-(template.in||0),end:template.start+moment.end-(template.in||0),sourceIn:moment.start,outputStart:cursor});
  for(const w of windows){
   const base={...w.clip,name:(moment.number?'Đoạn '+moment.number+' · ':'')+(moment.title||w.clip.name||'Video'),sourceDuration,...(!keepLayers?{fadeIn:0,fadeOut:0}:{})};
   add(base,w.start,w.end,w.outputStart,w.sourceIn);
   if(keepLayers)for(const c of clips){
    // The selected source track is replaced; other tracks keep their alignment.
    if(c.trackId===template.trackId&&c.type==='video')continue;
    const start=Math.max(c.start,w.start),end=Math.min(c.start+c.duration,w.end);
    if(end>start+.000001)add(c,start,end,w.outputStart+start-w.start);
   }
  }
  segments.push({number:moment.number,title:moment.title||'',sourceStart:moment.start,sourceEnd:moment.end,start:cursor,end:cursor+duration});cursor+=duration;
 }
 const nextTracks=structuredClone(tracks);nextTracks.find(t=>t.id===template.trackId).hidden=false;
 return {clips:next,tracks:nextTracks,duration:cursor,segments,selectedId:next[0].id,trackId:template.trackId};
}
