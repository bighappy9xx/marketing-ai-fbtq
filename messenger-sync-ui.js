export function initMessengerSync({state,callFunction,openModal,esc,showToast,refresh}){
 async function openSync(){
  try{
   if(!state.user||!state.firebase)throw Error('Đăng nhập Firebase trước khi kiểm tra Messenger.');
   const uid=state.user.uid,pages=await refresh();if(state.user?.uid!==uid)return;if(!pages.length)throw Error('Kết nối ít nhất một Fanpage trước khi đồng bộ.');
   openModal('Đồng bộ & kiểm tra Messenger',`<div class="modal-fields" data-messenger-sync><label>Fanpage<select data-sync-page>${pages.map(p=>`<option value="${esc(p.pageId)}">${esc(p.pageName||p.pageId)}</option>`).join('')}</select></label><p>Tin cũ cần tải từ Meta. Mỗi lượt tối đa 5 hội thoại, 25 tin gần nhất mỗi hội thoại; có thể tải thêm. Tin lịch sử không kích hoạt bot hoặc làm mới cửa sổ gửi 24 giờ.</p><div class="messenger-sync-actions"><button type="button" class="btn btn-secondary" data-check-messenger>Kiểm tra kết nối</button><button type="button" class="btn btn-primary" data-sync-messenger>Tải lịch sử gần đây</button><button type="button" class="btn btn-secondary" data-sync-more hidden>Tải thêm hội thoại</button></div><div data-sync-status role="status" aria-live="polite">Nếu App chưa xuất bản hoặc thiếu quyền truy cập, Meta có thể không trả hội thoại của khách ngoài nhóm thử.</div></div>`,'',null);
   const root=document.querySelector('[data-messenger-sync]'),select=root.querySelector('[data-sync-page]'),status=root.querySelector('[data-sync-status]'),buttons=[...root.querySelectorAll('button')];let cursor='',busy=false;
   select.onchange=()=>{cursor='';root.querySelector('[data-sync-more]').hidden=true;status.textContent='Chọn Kiểm tra kết nối hoặc Tải lịch sử cho Fanpage này.';};
   async function run(check=false,more=false){if(busy)return;busy=true;buttons.forEach(b=>b.disabled=true);select.disabled=true;const pageId=select.value;status.textContent=check?'Đang kiểm tra token, đăng ký webhook và quyền hội thoại…':'Đang tải lịch sử Meta; không gửi tin nhắn…';
    try{const result=await callFunction(check?'checkMessengerConnection':'syncFacebookInbox',{pageId,...(!check&&more&&cursor?{cursor}:{})},{timeout:125000});if(!root.isConnected||state.user?.uid!==uid)return;
     if(check){status.innerHTML='<ul class="messenger-checks">'+result.checks.map(c=>`<li><b>${c.status==='ok'?'✓':c.status==='warning'?'!':'×'} ${esc(c.label)}</b><p>${esc(c.detail)}</p></li>`).join('')+'</ul><p>'+esc(result.lastWebhookAtMs?'Lần nhận sự kiện gần nhất: '+new Date(result.lastWebhookAtMs).toLocaleString('vi-VN'):'Máy chủ chưa ghi nhận sự kiện tin nhắn cho Fanpage này.')+'</p><p>'+esc(result.note)+'</p>';}
     else{cursor=result.nextCursor||'';root.querySelector('[data-sync-more]').hidden=!cursor;status.innerHTML=`<p><b>Đã xử lý ${Number(result.conversations)||0} hội thoại, thêm ${Number(result.imported)||0} tin nhắn.</b></p>${!result.conversations?'<p>Meta chưa trả về hội thoại trong phạm vi quyền hiện tại. Bấm Kiểm tra kết nối và thử bằng tài khoản có vai trò trong App.</p>':''}<p>${esc(result.note||'')}</p>${(result.errors||[]).map(e=>'<p class="chatbot-error">'+esc(e)+'</p>').join('')}`;showToast('Đã tải '+(Number(result.imported)||0)+' tin nhắn từ Meta.');}
    }catch(error){if(root.isConnected&&state.user?.uid===uid)status.innerHTML='<p class="chatbot-error" role="alert">'+esc(error.message||'Không xử lý được yêu cầu.')+'</p>';}
    finally{busy=false;if(root.isConnected){buttons.forEach(b=>b.disabled=false);select.disabled=false;}}
   }
   root.querySelector('[data-check-messenger]').onclick=()=>run(true);root.querySelector('[data-sync-messenger]').onclick=()=>run();root.querySelector('[data-sync-more]').onclick=()=>run(false,true);
  }catch(error){showToast(error.message,'error');}
 }
 async function loadOlder(){const thread=state.activeThread,uid=state.user?.uid,button=document.querySelector('[data-load-history]');if(!thread||!uid)return;button&&(button.disabled=true);try{const result=await callFunction('syncFacebookInbox',{pageId:thread.pageId,threadId:thread.id},{timeout:125000});if(state.user?.uid===uid)showToast('Đã tải thêm '+(Number(result.imported)||0)+' tin nhắn cũ.');}catch(e){if(state.user?.uid===uid)showToast(e.message,'error');}finally{if(button?.isConnected)button.disabled=false;}}
 state.chatbotHistoryMore=loadOlder;
 return {openSync};
}
