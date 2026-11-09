import {endOf} from './studio-timeline-core.js?v=20261109-adaptive-final';
export function timelineStep(zoom){return [1,2,5,10,15,30,60,120,300,600,1800,3600].find(s=>s*zoom>=110)||3600;}
export function rulerTime(seconds){const value=Math.max(0,Math.floor(seconds)),h=Math.floor(value/3600),m=Math.floor(value/60)%60,s=value%60;return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
export function occupiedTracks(tracks,clips){return tracks.filter(t=>t.keepEmpty||clips.some(c=>c.trackId===t.id));}
export function chooseAdaptiveTrack(tracks,clips,clip,{requestedId='',side='auto',forceNew=false}={},makeId){
 const occupied=occupiedTracks(tracks,clips),requested=occupied.find(t=>t.id===requestedId),collision=t=>clips.some(c=>c.id!==clip.id&&c.trackId===t.id&&c.start<endOf(clip)-.001&&endOf(c)>clip.start+.001);
 if(requested&&!forceNew&&['auto','inside'].includes(side)&&!collision(requested)){const track={...requested,kind:'mixed',keepEmpty:false};return{tracks:tracks.map(t=>t.id===track.id?track:t),track};}
 if(!requested&&!forceNew&&side==='append'){const base=occupied.find(t=>clips.some(c=>c.trackId===t.id&&c.type!=='audio'));if(base&&!collision(base))return {tracks,track:base};}
 let index=tracks.length;
 if(requested){const at=tracks.findIndex(t=>t.id===requested.id);index=side==='below'?at:at+1;}
 else if(side==='bottom'||clip.type==='audio'){const audio=occupied.find(t=>clips.filter(c=>c.trackId===t.id).every(c=>c.type==='audio'));if(audio&&!forceNew&&!collision(audio))return{tracks,track:audio};index=0;}
 const id=!occupied.length&&!tracks.some(t=>t.id==='base'&&clips.some(c=>c.trackId===t.id))?'base':makeId();
 const track={id,kind:'mixed',name:'',hidden:false,muted:false};const next=tracks.filter(t=>t.id!==id);index=Math.min(next.length,index);next.splice(index,0,track);return{tracks:next,track};
}
export function dropSide(element,clientY){if(!element)return 'auto';const r=element.getBoundingClientRect(),ratio=(clientY-r.top)/Math.max(1,r.height);return ratio<.25?'above':ratio>.75?'below':'inside';}
export function finalSignature(clips,tracks,frame){return JSON.stringify({clips,tracks:tracks.filter(t=>clips.some(c=>c.trackId===t.id)),frame});}
