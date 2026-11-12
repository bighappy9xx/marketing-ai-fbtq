export function timecode(value){
  const ms=Math.round(Math.max(0,Number(value)||0)*1000),seconds=Math.floor(ms/1000);
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':')+(ms%1000?'.'+String(ms%1000).padStart(3,'0'):'');
}
export function highlightSourceKey(uid,clip){return JSON.stringify([uid,clip?.id,clip?.mediaId,clip?.in||0,clip?.duration,clip?.start]);}
export function highlightOptions({count=null,minDuration=10,maxDuration=60,platform='TikTok / Reels / Shorts',goal=''}={}){
  if(count!==null&&(!Number.isInteger(count)||count<1||count>10))throw Error('Số khoảnh khắc nội bộ không hợp lệ.');
  if(![minDuration,maxDuration].every(Number.isFinite)||minDuration<5||maxDuration>180||minDuration>maxDuration)throw Error('Thời lượng clip cần từ 5 đến 180 giây; tối thiểu không vượt tối đa.');
  if(!['TikTok / Reels / Shorts','TikTok','Facebook Reels','YouTube Shorts'].includes(platform)||typeof goal!=='string'||goal.length>1000)throw Error('Nền tảng hoặc mục tiêu nội dung không hợp lệ.');
  return {count,minDuration,maxDuration,platform,goal:goal.trim()};
}
export function validateHighlights(data,clip,options){
  const fail=()=>{throw Error('Gemini trả mốc cắt hoặc nội dung chưa hợp lệ. Hãy phân tích lại.');};
  if(!data||!Array.isArray(data.moments)||data.moments.length>(options.count??10)||typeof data.note!=='string'||data.note.length>1500)fail();
  const lower=clip.in||0,upper=lower+clip.duration,rows=[];
  for(const row of data.moments){
    if(!row||![row.start,row.end].every(Number.isFinite)||row.start<lower||row.end>upper||row.end-row.start<options.minDuration-.001||row.end-row.start>options.maxDuration+.001)fail();
    for(const key of ['hook','summary','reason','title','description'])if(typeof row[key]!=='string'||!row[key].trim()||row[key].length>(key==='description'?2000:key==='title'?160:1200))fail();
    if(!Array.isArray(row.hashtags)||row.hashtags.length>12||row.hashtags.some(t=>typeof t!=='string'||!/^#[\p{L}\p{N}_]{1,79}$/u.test(t)))fail();
    for(const key of ['transitions','music','subtitles']){
      if(!Array.isArray(row[key])||row[key].length>6)fail();
      for(const cue of row[key])if(!cue||!Number.isFinite(cue.at)||cue.at<row.start||cue.at>row.end||typeof cue.advice!=='string'||!cue.advice.trim()||cue.advice.length>700)fail();
    }
    if(rows.some(other=>row.start<other.end&&row.end>other.start))fail();
    rows.push({...row,hashtags:[...new Set(row.hashtags)]});
  }
  if(!rows.length&&!data.note.trim())fail();
  return {moments:rows.sort((a,b)=>a.start-b.start).map((row,i)=>({...row,number:String(i+1).padStart(2,'0')})),note:data.note};
}
export function splitHighlight(clips,sourceId,moment,newId){
  const source=clips.find(c=>c.id===sourceId);
  if(!source||source.type!=='video'||source.locked)throw Error('Đoạn nguồn không còn hợp lệ hoặc đang khoá.');
  const lower=source.in||0,upper=lower+source.duration;
  if(![moment.start,moment.end].every(Number.isFinite)||moment.start<lower||moment.end>upper||moment.end-moment.start<.1)throw Error('Điểm cắt vượt đoạn nguồn.');
  const start=moment.start-lower<.1?lower:moment.start,end=upper-moment.end<.1?upper:moment.end;
  const boundaries=[lower,...(start>lower?[start]:[]),...(end<upper?[end]:[]),upper],parts=[];let selectedId='';
  for(let i=0;i<boundaries.length-1;i++){
    const part={...structuredClone(source),id:i===0?source.id:newId(),in:boundaries[i],duration:boundaries[i+1]-boundaries[i],start:source.start+boundaries[i]-lower};
    if(boundaries[i]===start)selectedId=part.id;parts.push(part);
  }
  return {clips:clips.flatMap(c=>c.id===sourceId?parts:[structuredClone(c)]),selectedId};
}
export function highlightReport(plan){
  return ['KẾ HOẠCH CLIP NGẮN · '+plan.sourceName,'Timecode theo file nguồn. '+(plan.note||''),...plan.moments.map(m=>[
    '\nĐOẠN '+m.number+' · '+timecode(m.start)+' → '+timecode(m.end),
    'Hook: '+m.hook,'Nội dung: '+m.summary,'Lý do: '+m.reason,'Tiêu đề: '+m.title,'Mô tả: '+m.description,'Hashtag: '+m.hashtags.join(' '),
    ...['transitions','music','subtitles'].map((key,i)=>['Chuyển cảnh','Nhạc nền','Phụ đề'][i]+': '+m[key].map(c=>timecode(c.at)+' — '+c.advice).join(' | '))
  ].join('\n'))].join('\n');
}
export function highlightCSV(plan){
  const cell=value=>'"'+(/^[=+\-@\t\r\n]/.test(String(value))?"'":'')+String(value).replace(/"/g,'""')+'"';
  const header=['STT','Timecode Start (nguồn)','Timecode End (nguồn)','Hook','Tóm tắt','Lý do chọn','Title','Description','Hashtag','Chuyển cảnh','Nhạc nền','Phụ đề'];
  return '\uFEFF'+[header,...plan.moments.map(m=>[m.number,timecode(m.start),timecode(m.end),m.hook,m.summary,m.reason,m.title,m.description,m.hashtags.join(' '),...['transitions','music','subtitles'].map(k=>m[k].map(c=>timecode(c.at)+' '+c.advice).join(' | '))])].map(row=>row.map(cell).join(',')).join('\r\n');
}
