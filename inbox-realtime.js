export const chatTime=value=>value?.toMillis?.()||(value?.seconds?value.seconds*1000:value instanceof Date?value.getTime():Number(value)||0);
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function messengerAvatar(thread,classes='avatar avatar-lilac'){
 const name=thread?.senderName||'Khách hàng',initials=name.split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();let photo='';
 try{const u=new URL(thread?.senderPhotoUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('access_token'))photo=u.href;}catch{}
 return `<span class="${classes}"><span>${escapeText(initials)}</span>${photo?`<img src="${escapeText(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-messenger-photo>`:''}</span>`;
}
export function initAutomaticInbox({state,callFunction,isVisible,onStatus,now=Date.now}){
 let busy=false,last=-Infinity,owner='',nextPage=0,failures=0,generation=0;
 async function tick(){
  const uid=state.user?.uid||'';if(owner!==uid){owner=uid;last=-Infinity;nextPage=0;failures=0;generation++;}
  if(!uid||!state.firebase||!isVisible()||busy||now()-last<Math.min(300000,5000*2**failures))return;
  const pages=(state.pages||[]).filter(p=>p.active!==false&&(!p.ownerUid||p.ownerUid===uid));if(!pages.length)return;
  const page=pages[nextPage++%pages.length],run=generation;busy=true;last=now();onStatus('syncing','Đang tự đồng bộ…');
  try{const result=await callFunction('syncFacebookInbox',{pageId:page.pageId,automatic:true},{timeout:125000});if(run!==generation||state.user?.uid!==uid)return;failures=0;onStatus('live',result.conversations===0&&!result.skipped?'Chờ tin mới · Meta chưa trả hội thoại':'Tự cập nhật · '+new Date(now()).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));}
  catch(error){if(run!==generation||state.user?.uid!==uid)return;failures=Math.min(failures+1,3);onStatus('error',error.message||'Chưa đồng bộ được. Sẽ thử lại.');}
  finally{busy=false;}
 }
 const timer=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);window.addEventListener('online',tick);
 return {tick,reset(){generation++;owner='';last=-Infinity;nextPage=0;failures=0;onStatus('waiting','Tự cập nhật khi mở hộp thư');},stop(){clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('online',tick);}};
}
