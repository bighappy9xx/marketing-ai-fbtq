import {faqMarkup, bindFaqEditor} from './chatbot-faq-ui.js?v=20261119-faq-reply-scripts';
import {initMessengerMenus} from './messenger-menu.js?v=20261119-inbox-expanded-details';
import {initThreadTools} from './messenger-thread-tools.js?v=20261118-blue-chatbot-menu';
import {initInboxNotifications} from './inbox-notifications.js?v=20261118-blue-chatbot-menu';
import {initBroadcastWorkspace} from './messenger-broadcast-ui.js?v=20261118-blue-chatbot-menu';
import {initScriptSearch} from './messenger-script-search.js?v=20261118-blue-chatbot-menu';
import {messengerAvatar,initAutomaticInbox,pageAvatar} from './inbox-realtime.js?v=20261118-blue-chatbot-menu';
import {initMessengerSync} from './messenger-sync-ui.js?v=20261118-blue-chatbot-menu';
import {initInboxTools} from './inbox-workspace.js?v=20261118-blue-chatbot-menu';
export function initChatbotWorkspace({state,callFunction,openModal,closeModal,esc,showToast,connectPageAdvanced,renderConnectedPages,onFilterChange,onOpenInbox=()=>{},onOpenSoundSettings=()=>{}}){
  const $=s=>document.querySelector(s);let callbackBusy=false,recoveredOwner='',selection=null;
  const page=$('#page-inbox');
  page?.classList.add('messenger-workspace');
  const toolbar=document.createElement('section');toolbar.className='chatbot-toolbar';
  toolbar.innerHTML='<div><b>Trung tâm Chatbot & Fanpage</b><small>Facebook → Fanpage → Webhook → Kịch bản / AI → Hội thoại</small></div><div><button class="btn btn-primary" data-bot-setup>Kết nối Facebook</button><button type="button" class="btn btn-secondary" data-bot-sync>↻ Đồng bộ tin nhắn</button><button class="btn btn-secondary" data-bot-config>AI & Kịch bản</button><button class="btn btn-secondary" data-bot-bulk>Nhắn tin hàng loạt</button></div>';
  page?.querySelector('.page-heading')?.after(toolbar);
  toolbar.classList.add('messenger-topbar');
  toolbar.querySelector('div:first-child').innerHTML='<span class="messenger-brand-icon"><svg class="nav-svg" aria-hidden="true"><use href="icons.svg#message-circle"></use></svg></span><div><b>FBTQ INBOX</b><small>Không gian chăm sóc khách hàng</small></div>';
  const navigation=document.createElement('nav');navigation.className='messenger-navigation';navigation.setAttribute('aria-label','Chức năng hộp thư');navigation.innerHTML='<button type="button" class="selected" data-inbox-tab="conversations">Hội thoại</button><button type="button" data-inbox-tab="bulk">Gửi Tin Nhắn Hàng Loạt</button>';toolbar.querySelector('div:first-child').after(navigation);
  navigation.onclick=e=>{if(e.target.closest('[data-inbox-menu],[data-bot-status]'))return;const tab=e.target.closest('[data-inbox-tab]')?.dataset.inboxTab;if(tab==='bulk'){navigation.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===e.target.closest('button')));broadcast();}else{bulkWorkspace.close();navigation.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.inboxTab==='conversations'));search.focus();}};
  const selectionNotice=document.createElement('div');selectionNotice.className='chatbot-setup-status';selectionNotice.hidden=true;toolbar.after(selectionNotice);
  toolbar.querySelector('[data-bot-config]').textContent='✦ Cấu hình AI';toolbar.querySelector('[data-bot-bulk]').textContent='Gửi hàng loạt';toolbar.querySelector('[data-bot-setup]').textContent='+ Fanpage';
  const scriptSearch=initScriptSearch({state,showToast}),pageScripts=new Map(),profileChecks=new Map();
  const customer=document.createElement('section');customer.className='messenger-customer';page?.querySelector('.chat-settings')?.prepend(customer);
  const quick=document.createElement('div');quick.className='messenger-quick-replies';quick.setAttribute('aria-label','Câu trả lời nhanh');page?.querySelector('.chat-compose')?.before(quick);
  const botSwitch=document.createElement('button');
  botSwitch.type='button';
  botSwitch.dataset.botStatus='';
  botSwitch.setAttribute('role','switch');
  botSwitch.setAttribute('aria-label','Trạng Thái BOT');
  botSwitch.innerHTML='<span>Trạng Thái BOT</span><span class="bot-status-track" aria-hidden="true"></span><span data-bot-state aria-hidden="true"></span>';
  navigation.append(botSwitch);
  const pendingBotUpdates=new Set();
  const botThreadKey=thread=>JSON.stringify([state.user?.uid,thread?.pageId,thread?.senderId]);

  function renderBotSwitch(thread){
    const ready=Boolean(state.firebase&&state.user&&thread?.pageId&&thread.senderId);
    const enabled=ready&&thread.humanPaused!==true;
    const pending=ready&&pendingBotUpdates.has(botThreadKey(thread));
    botSwitch.disabled=!ready||pending;
    botSwitch.setAttribute('aria-checked',String(enabled));
    botSwitch.setAttribute('aria-busy',String(pending));
    botSwitch.querySelector('[data-bot-state]').textContent=pending?'Đang lưu…':!ready?'Chọn hội thoại':enabled?'Bật':'Tắt';
    botSwitch.title=ready?'Bật bot theo cấu hình Fanpage hoặc chuyển hội thoại cho nhân viên.':'Chọn hội thoại để bật hoặc tắt bot.';
  }

  botSwitch.onclick=async()=>{
    const thread=state.activeThread;
    const uid=state.user?.uid;
    if(botSwitch.disabled||!uid||!thread)return;
    const key=botThreadKey(thread);
    const paused=thread.humanPaused!==true;
    pendingBotUpdates.add(key);
    renderBotSwitch(thread);
    try{
      await callFunction('setChatbotHandoff',{pageId:thread.pageId,recipientId:thread.senderId,paused});
      if(state.user?.uid!==uid)return;
      const latestThread=state.inboxThreads.find(row=>botThreadKey(row)===key);
      if(latestThread)latestThread.humanPaused=paused;
      if(state.activeThread&&botThreadKey(state.activeThread)===key){
        state.activeThread.humanPaused=paused;
        details();
      }
      showToast(paused?'Đã tắt bot cho hội thoại.':'Đã bật bot theo cấu hình Fanpage.');
    }catch(error){
      if(state.user?.uid===uid)showToast(error.message||'Chưa cập nhật được trạng thái bot.','error');
    }finally{
      pendingBotUpdates.delete(key);
      renderBotSwitch(state.activeThread);
    }
  };

  function details(){const t=state.activeThread;
    renderBotSwitch(t);
    state.currentMessengerScripts=[...(pageScripts.get(state.user?.uid+':'+t?.pageId)?.scripts||[]),...(state.scripts||[])];
    if(t&&state.firebase&&state.user){const uid=state.user.uid,key=uid+':'+t.pageId,cached=pageScripts.get(key);if(!cached||Date.now()-cached.at>30000){pageScripts.set(key,{at:Date.now(),scripts:cached?.scripts||[]});callFunction('getPageChatbot',{pageId:t.pageId,includeFaqReplies:true}).then(config=>{if(state.user?.uid!==uid)return;const replies=[...(config.faqReplies||[]),...(config.scripts||[])];pageScripts.set(key,{at:Date.now(),scripts:replies});if(state.activeThread?.pageId===t.pageId){state.currentMessengerScripts=[...replies,...(state.scripts||[])];renderQuick();scriptSearch.refresh();}}).catch(()=>{});}
     if(/^[a-f0-9]{64}$/.test(t.id)&&Date.now()-(profileChecks.get(uid+':'+t.id)||0)>60000&&state.pages.some(p=>p.pageId===t.pageId)){profileChecks.set(uid+':'+t.id,Date.now());callFunction('refreshMessengerProfiles',{pageId:t.pageId,threadIds:[t.id]},{timeout:125000}).catch(()=>{});}}

    customer.innerHTML=t?`<div class="messenger-customer-heading">THÔNG TIN KHÁCH HÀNG</div><span class="messenger-customer-avatar">${messengerAvatar(t)}</span><h3>${esc(t.senderName||'Khách '+String(t.senderId||'').slice(-4))}</h3><p>Messenger · ${esc(t.pageName||'Fanpage')}</p><dl><dt>ID khách hàng</dt><dd>${esc(t.senderId||'—')}</dd><dt>Fanpage</dt><dd>${esc(t.pageName||t.pageId||'—')}</dd><dt>Xử lý hội thoại</dt><dd>${t.humanPaused?'Nhân viên tiếp nhận':'Theo cấu hình Fanpage'}</dd><dt>Cửa sổ phản hồi</dt><dd>${t.optedOut?'Khách đã dừng nhận tin':t.lastIncomingAtMs&&Date.now()-t.lastIncomingAtMs<86400000?'Còn trong 24 giờ':'Chờ tin mới từ khách'}</dd></dl>`:'<div class="messenger-customer-empty"><span>♙</span><b>Thông tin khách hàng</b><p>Chọn một hội thoại để xem thông tin.</p></div>';
    renderQuick();
  }
  function renderQuick(){quick.innerHTML=(state.currentMessengerScripts||[]).slice(0,6).map((s,i)=>`<button type="button" data-quick-reply="${i}" title="${esc(s.text)}">${esc(s.title||'Trả lời nhanh')}${s.image?' ▧':''}</button>`).join('');}
  quick.onclick=async e=>{const button=e.target.closest('[data-quick-reply]');if(!button)return;try{await state.applyMessengerScript?.(state.currentMessengerScripts[Number(button.dataset.quickReply)]);}catch(error){showToast(error.message,'error');}};
  state.chatbotDetails=details;details();
  toolbar.querySelector('[data-bot-setup]').onclick=()=>openSetup();toolbar.querySelector('[data-bot-config]').onclick=()=>configure();toolbar.querySelector('[data-bot-bulk]').onclick=()=>broadcast();
  const search=page?.querySelector('.inbox-search input')||document.createElement('input');search.className='chatbot-search';search.placeholder='Tìm khách hàng, Fanpage hoặc nội dung…';search.setAttribute('aria-label','Tìm hội thoại');if(!search.isConnected)page?.querySelector('.inbox-list')?.prepend(search);page?.querySelector('.inbox-filter')?.remove();page?.querySelectorAll('.chat-compose .icon-button,.chat-header .dots-button').forEach(el=>el.remove());
  const inboxTools=initInboxTools({page,state,search,callFunction,showToast,onChange:()=>onFilterChange?.()});state.filterInboxThreads=threads=>inboxTools.filter(threads);
  const hint=page?.querySelector('.chat-settings>p');if(hint)hint.textContent='Chọn AI, kịch bản hoặc kết hợp theo từng Trang. Có thể chuyển hội thoại cho nhân viên.';
  const oldToggle=$('#botToggle');if(oldToggle){const next=oldToggle.cloneNode(true);next.className='btn btn-secondary';next.setAttribute('role','button');next.tabIndex=0;next.textContent='Cấu hình';oldToggle.replaceWith(next);next.onclick=()=>navigation.querySelector('[data-inbox-menu="0"]')?.click();next.onkeydown=e=>{if(e.key==='Enter')next.click();};}
  async function guarded(work){try{if(!state.firebase||!state.user)throw new Error('Đăng nhập Firebase để sử dụng Chatbot.');return await work();}catch(e){showToast(e.message,'error');}}
  async function refresh(){const result=await callFunction('listMyPages',{});state.pages=result.pages||[];renderConnectedPages();onFilterChange?.();return state.pages;}
  const syncUI=initMessengerSync({state,callFunction,openModal,esc,showToast,refresh});toolbar.querySelector('[data-bot-sync]').onclick=()=>syncUI.openSync();
  state.chatbotPagesChanged=()=>{renderConnectedPages();onFilterChange?.();};
  const settings=document.querySelector('#page-chatbot-settings');
  settings.querySelector('[data-hub-ai]').onclick=configure;settings.querySelector('[data-hub-connect]').onclick=()=>openSetup();settings.querySelector('[data-hub-sync]').onclick=()=>syncUI.openSync();settings.querySelector('[data-settings-scripts]').onclick=()=>document.querySelector('#manageScripts').click();settings.querySelector('[data-settings-banned]').onclick=()=>document.querySelector('#manageBanned').click();
  settings.querySelector('[data-hub-sound]').onclick=onOpenSoundSettings;
  const menus=initMessengerMenus({page,navigation,cards:[...settings.querySelectorAll('.glass-settings-card')].slice(0,2)});
  botSwitch.addEventListener('click',()=>menus.close());
  initThreadTools({page,state,callFunction,openModal,closeModal,showToast,onChange:onFilterChange});

  const exitExpanded=document.createElement('button');exitExpanded.type='button';exitExpanded.className='messenger-exit-expanded';exitExpanded.textContent='Thu gọn ⛶';exitExpanded.onclick=()=>document.querySelector('#inboxExpand')?.click();toolbar.append(exitExpanded);
  async function choosePage(action){await guarded(async()=>{const pages=await refresh();if(!pages.length)return openSetup();openModal('Chọn Fanpage','<div class="modal-fields"><div class="fanpage-selector-photos">'+pages.map(p=>pageAvatar(p)).join('')+'</div><label>Fanpage<select name="pageId">'+pages.map(p=>`<option value="${esc(p.pageId)}">${esc(p.pageName)}</option>`).join('')+'</select></label></div>','Tiếp tục',async f=>{await action(f.get('pageId'));});});}
  async function openSetup(forceLogin=false){await guarded(async()=>{if(callbackBusy)return showToast('Đang hoàn tất đăng nhập Facebook. Chờ danh sách Fanpage.');if(!forceLogin&&await resumeSelection())return;const setup=await callFunction('getChatbotSetup',{}).catch(error=>({configured:false,error:error.message||'Chưa kết nối được máy chủ Chatbot.'}));await refresh().catch(error=>console.warn('Không tải được Fanpage',error.code));openModal('Bắt đầu sử dụng Chatbot Facebook',`<div class="chatbot-connect-intro"><span class="chatbot-facebook-mark">f</span><h3>Kết nối Facebook của bạn</h3><p>Đăng nhập Facebook → Chọn Fanpage → Xác nhận kết nối</p><small>Không cần nhập Page Token. Sau khi kết nối, chọn AI hoặc kịch bản để bật trả lời tự động.</small></div>${setup.error?'<p class="chatbot-error">Chưa sẵn sàng: '+esc(setup.error)+'</p>':''}<p><a href="FACEBOOK-CONNECT.md" target="_blank" rel="noopener noreferrer">Hướng dẫn chi tiết kết nối Messenger ↗</a></p><div class="meta-login-help"><b>Người khác báo “Ứng dụng không hoạt động”?</b><p>Mở Meta App → Xuất bản/Publish và thông báo cần xử lý. Kiểm tra App đang Live, Facebook Login đã bật và quyền Trang đã được duyệt cho người ngoài nhóm thử. Nếu App bị vô hiệu hóa, quản trị phải xử lý cảnh báo/kháng nghị trong Meta. Trạng thái này không sửa được bằng đổi URL website.</p><a href="https://developers.facebook.com/apps/${esc(setup.appId||'1679762183550015')}/" target="_blank" rel="noopener noreferrer">Mở đúng Meta App ↗</a><p>Để thử trước khi xuất bản: thêm tài khoản vào App roles và chấp nhận lời mời; quyền quản lý Fanpage không thay thế vai trò trong App.</p></div><details class="chatbot-admin-setup"><summary>Hướng dẫn quản trị — chỉ cấu hình lần đầu</summary><ol class="chatbot-steps"><li><b>Chạy trình cài đặt máy chủ</b><p>Trong Terminal của thư mục dự án: <code>node scripts/setup-messenger.cjs</code>. Nhập App ID và App Secret kín; trình cài đặt tạo/giữ Verify Token, giữ khóa mã hóa cũ và triển khai Functions.</p></li><li><b>Tạo ứng dụng Meta</b><p>Thêm Messenger và Facebook Login, khai báo tên miền HTTPS, URL chính sách riêng tư và xoá dữ liệu.</p><a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">Mở Meta for Developers ↗</a></li><li><b>Khai báo liên kết website</b><p>App ID: ${esc(setup.appId||'Chưa cấu hình trên máy chủ')}</p><p>OAuth Redirect URI: <code>${esc(setup.redirectUri||'Chưa cấu hình')}</code></p></li><li><b>Bật Webhook</b><p>Callback URL: <code>${esc(setup.webhookUrl||'Chưa cấu hình')}</code></p><p>Verify Token do quản trị đặt bằng Secret Manager; đăng ký trường messages và messaging_postbacks.</p></li><li><b>Cấp quyền và chọn Fanpage</b><p>pages_show_list, pages_messaging, pages_manage_metadata, pages_read_engagement. Hoàn tất App Review / quyền truy cập phù hợp và xác minh doanh nghiệp nếu Meta yêu cầu trước khi phục vụ khách thật.</p></li><li><b>Chọn AI/kịch bản và gửi thử</b><p>Nhắn tin từ tài khoản thử nghiệm đến Fanpage; tin mới xuất hiện trong hộp thư. Chỉ bật tự động sau khi duyệt cấu hình.</p></li></ol></details><div class="chatbot-setup-status">${setup.configured?'Máy chủ đã khai báo cấu hình; vẫn cần Verify & Save webhook và quyền Meta hợp lệ.':'Quản trị viên cần hoàn tất cấu hình ứng dụng trước khi đăng nhập Facebook.'} ${setup.missing?.length?'Còn thiếu: '+esc(setup.missing.join(', '))+'.':''} ${state.pages.length} Fanpage đã kết nối.</div><div class="modal-fields"><button type="button" class="btn btn-primary" id="chatbotFacebookLogin" ${setup.configured?'':'disabled'}>Đăng nhập Facebook & chọn Fanpage</button><button type="button" class="btn btn-secondary" id="chatbotAdvanced">Kết nối bằng Page Token (nâng cao)</button></div>`,'',null);
      $('#chatbotFacebookLogin').onclick=()=>guarded(async()=>{const result=await callFunction('beginFacebookLogin',{});sessionStorage.setItem('fbtq_meta_login',JSON.stringify({state:result.state,uid:state.user.uid}));location.assign(result.url);});$('#chatbotAdvanced').onclick=connectPageAdvanced;
  });}
  function cachedSelection(){try{const data=JSON.parse(sessionStorage.getItem('fbtq_meta_candidates')||'null');return data?.uid===state.user?.uid?data:null;}catch{return null;}}
  function rememberSelection(result){selection=result;try{sessionStorage.setItem('fbtq_meta_candidates',JSON.stringify({...result,uid:state.user.uid}));}catch{}selectionNotice.hidden=false;selectionNotice.innerHTML=`<b>Facebook đã cấp ${result.pages.length} Fanpage. Chọn Trang để hoàn tất kết nối.</b> <button type="button" class="btn btn-primary" data-bot-pick-pages>Chọn Fanpage (${result.pages.length})</button>`;selectionNotice.querySelector('button').onclick=()=>guarded(()=>resumeSelection());}
  function clearSelection(){selection=null;selectionNotice.hidden=true;selectionNotice.replaceChildren();try{sessionStorage.removeItem('fbtq_meta_candidates');}catch{}}
  async function resumeSelection(){const uid=state.user?.uid;if(!uid)return false;const cached=cachedSelection(),result=await callFunction('getFacebookPageSelection',cached?.sessionId?{sessionId:cached.sessionId}:{});if(state.user?.uid!==uid)return true;if(!result?.sessionId){clearSelection();return false;}rememberSelection(result);await pickCandidates(result);return true;}
  async function pickCandidates(result){
    onOpenInbox();
    if(!result.pages.length){openModal('Chưa có Fanpage để chọn','<div data-fanpage-selection><p>Facebook đã đăng nhập nhưng chưa trả về Trang có quyền nhắn tin. Kiểm tra tài khoản quản lý Fanpage, các quyền pages_show_list / pages_messaging / pages_manage_metadata và tài sản được cấp trong cấu hình Facebook Login for Business.</p><p>Đăng nhập lại sau khi điều chỉnh quyền trong Meta.</p><button type="button" class="btn btn-primary" data-page-login-again>Đăng nhập lại Facebook</button></div>','',null);$('[data-page-login-again]').onclick=()=>{clearSelection();openSetup(true);};return;}
    openModal('Chọn Fanpage để kết nối',`<div data-fanpage-selection class="modal-fields"><p>Đã tìm thấy <b>${result.pages.length} Fanpage</b>. Chọn từ 1 đến 10 Trang mỗi lần. Chưa bật trả lời tự động.</p><label>Tìm Fanpage<input type="search" data-page-search placeholder="Nhập tên hoặc Page ID"></label><div data-page-choices>${result.pages.map(p=>`<label class="chatbot-page-choice"><input type="checkbox" name="pageIds" value="${esc(p.pageId)}">${pageAvatar(p)}<span>${esc(p.pageName)}<small>${esc(p.pageId)}</small></span></label>`).join('')}</div><p data-page-count role="status">Đã chọn 0/10 Trang</p></div>`,'Phê duyệt kết nối',async f=>{const ids=f.getAll('pageIds');if(!ids.length||ids.length>10)throw new Error('Chọn từ 1 đến 10 Fanpage.');const uid=state.user?.uid,added=await callFunction('addFacebookPages',{sessionId:result.sessionId,pageIds:ids});if(state.user?.uid!==uid)return;clearSelection();await refresh();closeModal();showToast(added.results.map(p=>p.ok?'Đã kết nối '+p.pageId:p.pageId+': '+p.error).join(' · '));});
    const form=$('#activeModalForm'),checks=[...form.querySelectorAll('[name=pageIds]')];
    form.querySelector('[data-page-search]').oninput=e=>{const term=e.target.value.toLocaleLowerCase('vi');checks.forEach(check=>{const row=check.closest('label'),visible=row.textContent.toLocaleLowerCase('vi').includes(term);row.hidden=!visible;row.style.setProperty('display',visible?'flex':'none','important');});};
    checks.forEach(check=>check.onchange=()=>{const count=checks.filter(c=>c.checked).length;form.querySelector('[data-page-count]').textContent='Đã chọn '+count+'/10 Trang';checks.forEach(c=>c.disabled=!c.checked&&count>=10);});
  }
  async function configure(){
    await choosePage(async pageId=>{
      const config=await callFunction('getPageChatbot',{pageId,includeFaqs:true});
      const modes=[['off','Tắt — nhân viên trả lời'],['script','Kịch bản trả lời theo FAQ'],['ai','AI tự động dựa trên FAQ'],['hybrid','Ưu tiên kịch bản, AI khi không khớp']];
      openModal('AI & Kịch bản — '+config.pageName,`<div class="modal-fields">
        <label>Chế độ tự động<select name="mode">${modes.map(([id,label])=>`<option value="${id}" ${config.mode===id?'selected':''}>${label}</option>`).join('')}</select></label>
        <label>Mô hình<select name="model">${(config.availableModels||['openai','gemini']).map(model=>`<option value="${esc(model)}" ${config.model===model?'selected':''}>${model==='openai'?'OpenAI':'Gemini'}</option>`).join('')}</select></label>
        <label>Thông tin và hướng dẫn tư vấn<textarea name="instructions" maxlength="6000" placeholder="Sản phẩm, giá đã duyệt, giờ làm việc, cách chuyển nhân viên…">${esc(config.instructions)}</textarea></label>
        <p>Khi phê duyệt chế độ tự động, bot được phép trả lời tin nhắn mới theo cấu hình này. Khách nhắn STOP hoặc HỦY ĐĂNG KÝ sẽ ngừng nhận tin.</p>
        ${faqMarkup}
        ${config.lastError?'<p class="chatbot-error">Lỗi gần nhất: '+esc(config.lastError)+'</p>':''}
        </div>`,'Lưu & áp dụng',async form=>{
          const faqChanges=JSON.parse(form.get('faqChanges')||'{}');
          await callFunction('savePageChatbot',{pageId,mode:form.get('mode'),model:form.get('model'),instructions:form.get('instructions'),...faqChanges});
          pageScripts.delete(state.user?.uid+':'+pageId);
          closeModal();
          details();
          showToast('Đã áp dụng cấu hình chatbot.');
        });
      bindFaqEditor(document.querySelector('.chatbot-faq'),{faqs:config.faqs||[],faqRevision:config.faqRevision||0,esc});
    });
  }
  const bulkWorkspace=initBroadcastWorkspace({page,state,callFunction,refreshPages:refresh,openModal,closeModal,showToast});
  function broadcast(){bulkWorkspace.open();}

  const callbackTimer=setInterval(async()=>{
    if(!state.user||!state.firebase){recoveredOwner='';return;}if(callbackBusy)return;
    const uid=state.user.uid,params=new URLSearchParams(location.search),code=params.get('code'),nonce=params.get('state');
    if(!code&&!params.has('error')){if(recoveredOwner!==uid){recoveredOwner=uid;callbackBusy=true;try{await resumeSelection();}catch(e){console.warn('Chưa khôi phục được bước chọn Fanpage',e.code||'request-failed');}finally{callbackBusy=false;}}return;}
    callbackBusy=true;recoveredOwner=uid;
    try{let pending;try{pending=JSON.parse(sessionStorage.getItem('fbtq_meta_login')||'null');}catch{}if(!pending||pending.uid!==uid||pending.state!==nonce)throw new Error('Phiên Facebook không khớp tài khoản. Kết nối lại.');if(params.has('error'))throw new Error('Đã huỷ hoặc từ chối kết nối Facebook.');history.replaceState(null,'',location.pathname+'#inbox');onOpenInbox();const result=await callFunction('finishFacebookLogin',{code,state:nonce});if(state.user?.uid!==uid)return;try{sessionStorage.removeItem('fbtq_meta_login');}catch{}rememberSelection(result);await pickCandidates(result);}
    catch(e){if(state.user?.uid===uid){history.replaceState(null,'',location.pathname+'#inbox');openModal('Chưa hoàn tất kết nối Fanpage',`<p class="chatbot-error">${esc(e.message||'Không lấy được danh sách Trang.')}</p><p>Nhấn + Fanpage để khôi phục danh sách nếu Facebook đã cấp quyền thành công.</p>`,'',null);}}
    finally{callbackBusy=false;}
  },1000);
  const inboxNotices=initInboxNotifications({page,state,callFunction,showToast});
  const liveStatus=document.createElement('span');liveStatus.className='messenger-live-status';liveStatus.setAttribute('role','status');liveStatus.textContent='Tự cập nhật khi mở hộp thư';page.querySelector('.inbox-list-heading')?.append(liveStatus);
  const autoInbox=initAutomaticInbox({state,callFunction,isVisible:()=>document.visibilityState==='visible'&&page.classList.contains('active')&&!page.classList.contains('broadcast-active')&&!document.querySelector('[data-messenger-sync]'),onStatus:(status,text)=>{liveStatus.dataset.status=status;liveStatus.textContent=text;liveStatus.title=text;}});
  const brokenProfiles=new Map();
  document.addEventListener('error',async e=>{const img=e.target;if(!img?.matches?.('[data-messenger-photo]'))return;const {profileThread:threadId,profilePage:pageId}=img.dataset;img.remove();const uid=state.user?.uid,key=uid+':'+threadId;if(!uid||!state.firebase||!/^[a-f0-9]{64}$/.test(threadId||'')||Date.now()-(brokenProfiles.get(key)||0)<300000||!state.pages.some(p=>p.pageId===pageId))return;brokenProfiles.set(key,Date.now());try{await callFunction('refreshMessengerProfiles',{pageId,threadIds:[threadId]},{timeout:125000});}catch{ /* The fallback remains visible; diagnostics/manual refresh can show the reason. */ }},true);
  function reset(){menus.close();inboxNotices.reset();bulkWorkspace.reset();scriptSearch.reset();pageScripts.clear();profileChecks.clear();state.currentMessengerScripts=[];autoInbox.reset();clearSelection();recoveredOwner='';if(document.querySelector('[data-fanpage-selection],[data-messenger-sync]'))closeModal();try{sessionStorage.removeItem('fbtq_meta_login');}catch{}}
  return {openSetup,configure,reset,openSync:syncUI.openSync};
}
