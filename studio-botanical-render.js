export function botanicalPath(ctx,kind,w,h,color){
 ctx.save();ctx.scale(w,h);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.025;ctx.lineCap='round';
 const leaf=(x,y,angle,scale)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.beginPath();ctx.moveTo(0,.3);ctx.bezierCurveTo(-.45,.02,-.25,-.35,0,-.5);ctx.bezierCurveTo(.25,-.35,.45,.02,0,.3);ctx.fill();if(kind==='lotus'){ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=.025;ctx.stroke();}ctx.restore();};
 if(kind==='leaf'){leaf(0,.05,-.3,1);ctx.beginPath();ctx.moveTo(-.1,.46);ctx.quadraticCurveTo(.08,.03,.08,-.26);ctx.stroke();}
 if(kind==='sprig'||kind==='bamboo'){ctx.beginPath();ctx.moveTo(-.15,.45);ctx.quadraticCurveTo(.2,0,.05,-.45);ctx.stroke();for(let i=0;i<4;i++){const y=.3-i*.2;leaf(-.08,y,-.9,.32);leaf(.15,y-.07,.9,.28);}if(kind==='bamboo'){ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(-.2,.45);ctx.lineTo(-.2,-.46);ctx.stroke();}}
 if(kind==='lotus'){for(const angle of [-1.1,1.1,-.6,.6,0])leaf(0,.18,angle,.8);ctx.beginPath();ctx.ellipse(0,.4,.4,.04,0,0,Math.PI);ctx.stroke();}
 if(kind==='bowl'){ctx.beginPath();ctx.moveTo(-.47,-.07);ctx.quadraticCurveTo(-.37,.43,0,.43);ctx.quadraticCurveTo(.37,.43,.47,-.07);ctx.closePath();ctx.fill();for(const x of [-.19,.04,.25]){ctx.beginPath();ctx.moveTo(x,-.17);ctx.bezierCurveTo(x-.12,-.27,x+.12,-.37,x,-.48);ctx.stroke();}}
 if(kind==='yinyang'){ctx.beginPath();ctx.arc(0,0,.46,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,.46,-Math.PI/2,Math.PI/2);ctx.arc(0,.23,.23,Math.PI/2,-Math.PI/2,true);ctx.arc(0,-.23,.23,Math.PI/2,-Math.PI/2);ctx.fill();ctx.beginPath();ctx.arc(0,.23,.055,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(0,-.23,.055,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
