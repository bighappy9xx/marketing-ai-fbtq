// Read timestamps from WebM files whose streaming header has no Duration.
// Matroska element IDs and timestamp units: https://www.matroska.org/technical/elements.html
export function webmDuration(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);let scale=1000000,declared=0;const last=new Map(),defaults=new Map();
 function vint(pos,keep){if(pos>=bytes.length||!bytes[pos])return null;let n=1,mask=128;while(!(bytes[pos]&mask)){n++;mask>>=1;if(n>8)return null;}if(pos+n>bytes.length)return null;let value=keep?bytes[pos]:bytes[pos]&(mask-1),unknown=!keep&&value===mask-1;for(let i=1;i<n;i++){value=value*256+bytes[pos+i];unknown=unknown&&bytes[pos+i]===255;}return {n,value,unknown};}
 const uint=(a,b)=>{let n=0;for(let p=a;p<b;p++)n=n*256+bytes[p];return n;};
 function walk(begin,end,cluster=0,depth=0){if(depth>8)return;let track=0,defaultDuration=0;for(let p=begin;p<end;){const id=vint(p,true);if(!id)return;const size=vint(p+id.n,false);if(!size)return;const a=p+id.n+size.n,b=size.unknown?end:Math.min(end,a+size.value);if(b<=a||b>bytes.length)return;
  if(id.value===0x2ad7b1)scale=uint(a,b);
  else if(id.value===0x4489&&(b-a===4||b-a===8))declared=b-a===4?view.getFloat32(a):view.getFloat64(a);
  else if(id.value===0xe7)cluster=uint(a,b);
  else if(id.value===0xd7)track=uint(a,b);
  else if(id.value===0x23e383)defaultDuration=uint(a,b);
  else if(id.value===0xa3||id.value===0xa1){const number=vint(a,false);if(number&&a+number.n+3<=b){const timestamp=cluster+view.getInt16(a+number.n),previous=last.get(number.value);if(!previous||timestamp>previous.time)last.set(number.value,{time:timestamp,step:previous?timestamp-previous.time:0});}}
  else if([0x18538067,0x1549a966,0x1654ae6b,0xae,0x1f43b675,0xa0].includes(id.value))walk(a,b,cluster,depth+1);
  p=b;
 }if(track&&defaultDuration)defaults.set(track,defaultDuration);}
 if(bytes.length<4||view.getUint32(0)!==0x1a45dfa3)return 0;walk(0,bytes.length);
 if(declared>0)return declared*scale/1e9;let result=0;for(const [track,value]of last)result=Math.max(result,value.time*scale/1e9+(defaults.get(track)||Math.min(Math.max(value.step,1),100)*scale)/1e9);return result;
}
