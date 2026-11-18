const crypto=require('node:crypto');
const key=(page,sender)=>crypto.createHash('sha256').update(`${page}:${sender}`).digest('hex');
function eligible(thread,now=Date.now()){
  const last=Number(thread?.lastIncomingAtMs||0);
  return !!last&&last<=now&&now-last<86400000&&!thread.optedOut&&!thread.humanPaused;
}
function normalize(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').trim();}
function isOptOut(text){return /^(stop|huy|huy dang ky|dung nhan tin)$/.test(normalize(text));}
function pickScript(text,scripts=[]){const value=normalize(text);return scripts.find(s=>s.enabled!==false&&(s.text||s.image)&&Array.isArray(s.keywords)&&s.keywords.some(k=>normalize(k)&&value.includes(normalize(k))));}
function scriptImage(value,max){if(!value)return '';if(typeof value!=='string'||!value.startsWith('data:image/jpeg;base64,'))throw new Error('Ảnh kịch bản cần được tối ưu về JPG.');require('./messenger-image').decodeImage(value.slice(23),'image/jpeg',max);return value;}
function settings(input={}){
  if(!['off','script','ai','hybrid'].includes(input.mode))throw new Error('Chọn chế độ trả lời hợp lệ.');
  const scripts=(input.scripts||[]).slice(0,30).map(s=>({title:String(s.title||'').slice(0,120),keywords:String(s.keywords||'').slice(0,2000).split(',').map(k=>k.trim().slice(0,80)).filter(Boolean).slice(0,20),text:String(s.text||'').trim().slice(0,2000),image:scriptImage(s.image,150000),imagePreview:scriptImage(s.imagePreview,40000),enabled:true}));
  if(scripts.reduce((n,s)=>n+s.image.length+s.imagePreview.length,0)>500000)throw new Error('Tổng ảnh kịch bản quá lớn. Giảm kích thước hoặc số ảnh.');
  return {mode:input.mode,model:input.model==='openai'?'openai':'gemini',instructions:String(input.instructions||'').slice(0,6000),scripts};
}
module.exports={key,eligible,isOptOut,pickScript,settings};
