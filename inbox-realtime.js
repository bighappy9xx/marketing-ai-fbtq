export function pageAvatar(page){const photo=page?.pagePhotoUrl;let url='';try{const u=new URL(photo);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('access_token'))url=u.href;}catch{}return `<span class="fanpage-avatar"><span>f</span>${url?'<img src="'+escapeText(url)+'" alt="Ảnh Fanpage" loading="lazy" referrerpolicy="no-referrer">':''}</span><span class="fanpage-avatar-name">${escapeText(page?.pageName||'Fanpage')}</span>`;}
export const chatTime=value=>value?.toMillis?.()||(value?.seconds?value.seconds*1000:value instanceof Date?value.getTime():Number(value)||0);
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function messengerAvatar(thread,classes='avatar avatar-lilac'){
 const name=thread?.senderName?.trim()||'Khách hàng',initials=name.split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();let photo='';
 try{const u=new URL(thread?.senderPhotoUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('access_token'))photo=u.href;}catch{}
 const hint=photo?'':thread?.profileStatus==='restricted'?'Meta chưa cấp quyền ảnh đại diện':thread?.profileStatus==='unavailable'?'Chưa tải được ảnh đại diện':!photo?'Chưa có ảnh đại diện từ Meta':'';
 return `<span class="${classes}" ${hint?'title="'+escapeText(hint)+'"':''}><span>${escapeText(initials)}</span>${photo?`<img src="${escapeText(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-messenger-photo data-profile-thread="${escapeText(thread?.id||'')}" data-profile-page="${escapeText(thread?.pageId||'')}">`:''}</span>`;
}
