const crypto=require('node:crypto');
const key=(page,sender)=>crypto.createHash('sha256').update(`${page}:${sender}`).digest('hex');
function eligible(thread,now=Date.now()){
  const last=Number(thread?.lastIncomingAtMs||0);
  return !!last&&last<=now&&now-last<86400000&&!thread.optedOut&&!thread.humanPaused;
}
function normalize(text){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').trim();}
function isOptOut(text){return /^(stop|huy|huy dang ky|dung nhan tin)$/.test(normalize(text));}
function pickScript(text,scripts=[]){const value=normalize(text);return scripts.find(s=>s.enabled!==false&&s.text&&Array.isArray(s.keywords)&&s.keywords.some(k=>normalize(k)&&value.includes(normalize(k))));}
function settings(input={}){
  if(!['off','script','ai','hybrid'].includes(input.mode))throw new Error('Chọn chế độ trả lời hợp lệ.');
  const scripts=(input.scripts||[]).slice(0,30).map(s=>({title:String(s.title||'').slice(0,120),keywords:String(s.keywords||'').split(',').map(k=>k.trim()).filter(Boolean).slice(0,20),text:String(s.text||'').trim().slice(0,2000),enabled:true}));
  return {mode:input.mode,model:input.model==='openai'?'openai':'gemini',instructions:String(input.instructions||'').slice(0,6000),scripts};
}
module.exports={key,eligible,isOptOut,pickScript,settings};
