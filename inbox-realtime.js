export function pageAvatar(page){const photo=page?.pagePhotoUrl;let url='';try{const u=new URL(photo);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('access_token'))url=u.href;}catch{}return `<span class="fanpage-avatar"><span>f</span>${url?'<img src="'+escapeText(url)+'" alt="Ảnh Fanpage" loading="lazy" referrerpolicy="no-referrer">':''}</span><span class="fanpage-avatar-name">${escapeText(page?.pageName||'Fanpage')}</span>`;}
export const chatTime=value=>value?.toMillis?.()||(value?.seconds?value.seconds*1000:value instanceof Date?value.getTime():Number(value)||0);
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function messengerAvatar(thread,classes='avatar avatar-lilac'){
 const name=thread?.senderName||'Khách hàng',initials=name.split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();let photo='';
 try{const u=new URL(thread?.senderPhotoUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('access_token'))photo=u.href;}catch{}
 const hint=thread?.profileStatus==='restricted'?'Meta chưa cấp quyền ảnh đại diện':thread?.profileStatus==='unavailable'?'Chưa tải được ảnh đại diện':!photo?'Chưa có ảnh đại diện từ Meta':'';
 return `<span class="${classes}" ${hint?'title="'+escapeText(hint)+'"':''}><span>${escapeText(initials)}</span>${photo?`<img src="${escapeText(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-messenger-photo data-profile-thread="${escapeText(thread?.id||'')}" data-profile-page="${escapeText(thread?.pageId||'')}">`:''}</span>`;
}
export function initAutomaticInbox({state,callFunction,canSync,isForeground=()=>true,onStatus,now=Date.now}){
 let owner='',generation=0,jobs=new Map();
 async function tick(){
  const uid=state.user?.uid||'';if(owner!==uid){owner=uid;jobs=new Map();generation++;}
  if(!uid||!state.firebase||!canSync())return;
  const run=generation,pages=(state.pages||[]).filter(p=>p.active!==false&&(!p.ownerUid||p.ownerUid===uid)&&p.pageId!==state.messengerFullSyncPage);
  const period=isForeground()?5000:15000;
  const due=pages.filter(p=>{const job=jobs.get(p.pageId);return !job||!job.busy&&now()-job.last>=Math.min(300000,period*2**job.failures);});if(!due.length)return;
  onStatus?.('syncing','Realtime đang bật · Kiểm tra dự phòng 5 giây');
  const results=await Promise.all(due.map(async page=>{const job=jobs.get(page.pageId)||{failures:0};Object.assign(job,{busy:true,last:now()});jobs.set(page.pageId,job);
   try{const result=await callFunction('syncFacebookInbox',{pageId:page.pageId,automatic:true},{timeout:125000});if(run!==generation||state.user?.uid!==uid)return null;
    if(!state.inboxPageColorPending?.(page.pageId)&&typeof result.pageInboxColor==='string'&&page.inboxColor!==result.pageInboxColor){page.inboxColor=result.pageInboxColor;state.repaintPageColors?.();state.chatbotPagesChanged?.();}
    if(result.pagePhotoUrl&&page.pagePhotoUrl!==result.pagePhotoUrl){page.pagePhotoUrl=result.pagePhotoUrl;state.chatbotPagesChanged?.();}job.failures=0;return {ok:true};
   }catch(error){if(run!==generation||state.user?.uid!==uid)return null;job.failures=Math.min(job.failures+1,3);return {error:error.message||'Chưa đồng bộ được. Sẽ thử lại.'};}finally{job.busy=false;}
  }));
  if(run!==generation||state.user?.uid!==uid)return;const failed=results.find(r=>r?.error);onStatus?.(failed?'error':'live',failed?failed.error:'Realtime · Dự phòng 5 giây · '+new Date(now()).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
 }
 const timer=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);window.addEventListener('online',tick);
 return {tick,reset(){generation++;owner='';jobs=new Map();onStatus?.('waiting','Realtime · Dự phòng mỗi 5 giây');},stop(){clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('online',tick);}};
}
