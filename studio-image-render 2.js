import {STUDIO_FONT_FAMILIES} from './studio-fonts.js?v=20261109-free-resources';
import {botanicalPath} from './studio-botanical-render.js?v=20261109-free-resources';
// Image styling is shared by the preview and the exported PNG/video.
export function drawStyledText(ctx,c,w,h,frameWidth){
 const size=(c.fontSize||56)*frameWidth/1280,lineHeight=size*(c.lineHeight||1.2),padding=8;
 const family=STUDIO_FONT_FAMILIES.includes(c.fontFamily)?c.fontFamily:'Arial';
 ctx.font=`${c.italic?'italic ':''}${c.bold===false?'400':'700'} ${size}px "${family}"`;
 ctx.fillStyle=c.color||'#ffffff';ctx.textBaseline='top';ctx.textAlign=c.textAlign||'left';
 const left=-w/2+padding,right=w/2-padding,available=Math.max(1,w-padding*2),lines=[];
 for(const paragraph of String(c.text||'').split('\n')){
  let line='';for(const word of paragraph.split(/\s+/)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>available){lines.push(line);line=word;}else line=next;}lines.push(line);
 }
 const anchor=c.textAlign==='center'?0:c.textAlign==='right'?right:left;
 lines.forEach((line,i)=>{const y=-h/2+padding+i*lineHeight;ctx.fillText(line,anchor,y,available);const length=Math.min(available,ctx.measureText(line).width),x=c.textAlign==='center'?-length/2:c.textAlign==='right'?right-length:left;
  if(c.underline||c.strike){ctx.save();ctx.strokeStyle=c.color||'#ffffff';ctx.lineWidth=Math.max(1,size/24);for(const offset of [c.underline?size*.99:null,c.strike?size*.5:null])if(offset!==null){ctx.beginPath();ctx.moveTo(x,y+offset);ctx.lineTo(x+length,y+offset);ctx.stroke();}ctx.restore();}
 });
}
export function drawStyledShape(ctx,c,w,h){
 if(['leaf','lotus','bowl','yinyang','bamboo','sprig'].includes(c.shape)){botanicalPath(ctx,c.shape,w,h,c.color||'#547c51');return;}
 ctx.fillStyle=c.color||'#347cff';ctx.beginPath();
 if(c.shape==='ellipse')ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);
 else if(c.shape==='triangle'){ctx.moveTo(0,-h/2);ctx.lineTo(w/2,h/2);ctx.lineTo(-w/2,h/2);ctx.closePath();}
 else if(c.shape==='roundrect')ctx.roundRect(-w/2,-h/2,w,h,Math.min(w,h)*.15);
 else ctx.rect(-w/2,-h/2,w,h);
 ctx.fill();if(c.borderWidth>0){ctx.lineWidth=c.borderWidth;ctx.strokeStyle=c.borderColor||'#ffffff';ctx.stroke();}
}
export function imageFilter(c){return `brightness(${c.brightness??1}) contrast(${c.contrast??1}) grayscale(${c.grayscale??0}) blur(${c.blur||0}px)`;}
