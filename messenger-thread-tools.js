const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initThreadTools({page,state,callFunction,openModal,closeModal,showToast,onChange}){
 const bar=document.createElement('div');bar.className='messenger-thread-bar';bar.hidden=true;page.querySelector('.chat-header').append(bar);const root=document.createElement('div');root.className='messenger-thread-tools';root.hidden=true;bar.append(root);
 const flags=[['unread','Chưa đọc'],['needsReply','Cần trả lời'],['orderCreated','Đã tạo đơn'],['starred','Gắn sao']];
 let pending=new Set();
 async function save(thread,patch){const uid=state.user?.uid,key=uid+':'+thread.id;if(!uid||pending.has(key))return;pending.add(key);root.querySelectorAll('input,button').forEach(el=>el.disabled=true);
  try{await callFunction('updateMessengerThreadMetadata',{pageId:thread.pageId,threadId:thread.id,patch});if(state.user?.uid!==uid)return;Object.assign(thread,patch);for(const row of state.inboxThreads)if(row.id===thread.id)Object.assign(row,patch);if(state.activeThread?.id===thread.id)Object.assign(state.activeThread,patch);onChange?.();}
  catch(e){if(state.user?.uid===uid)showToast(e.message||'Chưa lưu được thông tin lọc.','error');throw e;}finally{pending.delete(key);render(state.activeThread);}
 }
 function render(thread){bar.hidden=root.hidden=!thread;if(!thread)return;const color=page.querySelector('[data-thread-color]');if(color&&color.parentElement!==bar)bar.prepend(color);root.innerHTML=flags.map(([key,label])=>`<label title="Lưu trạng thái để lọc hội thoại"><input type="checkbox" data-thread-flag="${key}" ${thread[key]===true||key==='needsReply'&&thread[key]===undefined&&thread.direction==='incoming'?'checked':''}>${label}</label>`).join('')+'<button type="button" data-thread-metadata>SĐT & đánh giá</button><button type="button" data-thread-sync '+(!state.firebase||state.chatHistoryRequest?'disabled':'')+'>'+ (state.chatHistoryRequest?.threadId===thread.id&&state.chatHistoryRequest.recent?'Đang tải…':'Cập nhật tin gần đây')+'</button>';root.querySelectorAll('input').forEach(el=>el.disabled=pending.has((state.user?.uid||'')+':'+thread.id));
  root.onchange=e=>{const field=e.target.dataset.threadFlag;if(field)save(thread,{[field]:e.target.checked}).catch(()=>{});};
  root.querySelector('[data-thread-sync]').onclick=()=>state.chatbotHistoryRecent?.();
  root.querySelector('[data-thread-metadata]').onclick=()=>{const owner=state.user?.uid;openModal('Thông tin dùng cho bộ lọc',`<p>${esc(thread.senderName||'Khách hàng')} · ${esc(thread.pageName||'Fanpage')}</p><div class="modal-fields"><label>Số điện thoại<input name="phone" maxlength="30" value="${esc(thread.phone||thread.detectedPhone||'')}" placeholder="Nhập số điện thoại khách hàng"></label><label>Đánh giá khách hàng<select name="rating">${[0,5,4,3,2,1].map(n=>`<option value="${n}" ${Number(thread.rating||0)===n?'selected':''}>${n?n+' sao':'Chưa có đánh giá'}</option>`).join('')}</select></label><p>Dùng các ô tick cạnh màu đánh dấu để cập nhật trạng thái. Tin nhắn mới và câu trả lời sẽ tự cập nhật trạng thái cần trả lời.</p></div>`,'Lưu thông tin',async f=>{if(state.user?.uid!==owner)throw Error('Tài khoản đã thay đổi.');await save(thread,{phone:f.get('phone'),rating:Number(f.get('rating'))});closeModal();});};
 }
 state.renderThreadTools=render;
 return {render};
}
