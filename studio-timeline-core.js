export const bounded=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
export const uid=()=>globalThis.crypto.randomUUID();
export const defaultTracks=()=>[
 {id:'base',name:'Video chính',kind:'visual',hidden:false,muted:false},
 {id:'overlay',name:'Ảnh / video chồng',kind:'visual',hidden:false,muted:false},
 {id:'text',name:'Chữ',kind:'text',hidden:false,muted:false},
 {id:'fx',name:'Hiệu ứng',kind:'effect',hidden:false,muted:false},
 {id:'audio',name:'Âm thanh',kind:'audio',hidden:false,muted:false}
];
export const endOf=c=>Number(c.start)+Number(c.duration);
export const durationOf=clips=>clips.reduce((n,c)=>Math.max(n,endOf(c)),0);
export function activeAt(clips,tracks,time){return tracks.filter(t=>!t.hidden).flatMap(t=>clips.filter(c=>c.trackId===t.id&&!c.hidden&&time>=c.start&&time<endOf(c)).map(c=>({...c,trackMuted:!!t.muted})));}
export function compatible(track,clip){return track.kind==='mixed'||track.kind==='auto'||(track.kind==='visual'?['video','image','shape'].includes(clip.type):track.kind==='audio'?clip.type==='audio':track.kind===clip.type);}
export function placeClip(clip,track,start){if(!track||!compatible(track,clip))throw Error('Loại tư liệu không phù hợp với lớp này.');return {...clip,trackId:track.id,start:Math.max(0,Number(start)||0)};}
export function splitAt(clips,id,time,newId){const i=clips.findIndex(c=>c.id===id),c=clips[i];if(!c)throw Error('Chọn đoạn cần tách.');const local=time-c.start;if(local<.1||c.duration-local<.1)throw Error('Đầu phát phải cách hai mép đoạn ít nhất 0,1 giây.');return [...clips.slice(0,i),{...c,duration:local},{...c,id:newId,start:time,duration:c.duration-local,in:(Number(c.in)||0)+(['video','audio'].includes(c.type)?local:0)},...clips.slice(i+1)];}
export function trimClip(c,start,sourceIn,duration){start=Number(start);sourceIn=Number(sourceIn);duration=Number(duration);if(![start,sourceIn,duration].every(Number.isFinite)||start<0||sourceIn<0||duration<.1)throw Error('Thời điểm và thời lượng không hợp lệ (tối thiểu 0,1 giây).');if(['video','audio'].includes(c.type)&&sourceIn+duration>c.sourceDuration+.001)throw Error('Điểm cắt vượt quá thời lượng file gốc.');return {...c,start,in:sourceIn,duration};}
export function opacityAt(c,time){const p=time-c.start,fadeIn=Math.min(Number(c.fadeIn)||0,c.duration/2),fadeOut=Math.min(Number(c.fadeOut)||0,c.duration/2);return bounded(c.opacity??1,0,1)*Math.min(1,fadeIn?p/fadeIn:1,fadeOut?(c.duration-p)/fadeOut:1);}
export function fit(sw,sh,w,h,cover=false){const k=cover?Math.max(w/sw,h/sh):Math.min(w/sw,h/sh);return {x:(w-sw*k)/2,y:(h-sh*k)/2,w:sw*k,h:sh*k};}
export function hitClip(clips,tracks,time,x,y){for(const c of activeAt(clips,tracks,time).reverse()){if(c.locked||!['video','image','text','shape'].includes(c.type))continue;const dx=x-c.x-c.w/2,dy=y-c.y-c.h/2,a=-(c.rotation||0)*Math.PI/180,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(rx)<=c.w/2&&Math.abs(ry)<=c.h/2)return c.id;}return '';}
export function migrateVideo(project){const value=project.value||project;let cursor=0;const tracks=value.tracks?.length?structuredClone(value.tracks):defaultTracks();const clips=(value.clips||[]).map(c=>{const d=Number(c.duration)>0&&c.type==='image'?c.duration:['video','audio'].includes(c.type)?(c.out!==undefined?c.out-(c.in||0):c.duration):c.duration;const result={...c,trackId:c.trackId||'base',start:c.start??cursor,duration:d||3,in:c.in||0,x:c.x??0,y:c.y??0,w:c.w??1,h:c.h??1,opacity:c.opacity??1,volume:c.volume??1};cursor=endOf(result);return result;});return {...value,tracks,clips};}
export function outputMime(Recorder){return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>Recorder?.isTypeSupported(t))||'';}
