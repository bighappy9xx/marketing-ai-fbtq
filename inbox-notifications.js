export function messengerDesktopPlatform(browser){
  const platform=[browser.userAgentData?.platform,browser.platform,browser.userAgent].filter(Boolean).join(' ');
  if(/iPhone|iPad|iPod|Android/i.test(platform))return '';
  if(/Windows|Win32|Win64/i.test(platform))return 'windows';
  if(/Mac/i.test(platform)&&!(browser.maxTouchPoints>1))return 'macos';
  return '';
}

const palette=['#3884D8','#9B68D8','#25A58B','#E69048','#D86593','#639D55','#6C7BD7','#B8874C'];
export function fanpageColor(page){if(/^#[a-f0-9]{6}$/i.test(page?.inboxColor||''))return page.inboxColor.toUpperCase();let hash=0;for(const char of String(page?.pageId||''))hash=(hash*31+char.charCodeAt(0))>>>0;return palette[hash%palette.length];}
const millis=value=>value?.toMillis?.()||(value?.seconds?value.seconds*1000:Number(value)||0);
export function createIncomingPopupGate({now=Date.now}={}){
 let uid='',ready=false,seen=new Set();
 function reset(){uid='';ready=false;seen.clear();}
 return {reset,inspect(owner,rows,{fromCache=false}={}){
  if(uid!==owner){reset();uid=owner;}
  if(!owner||fromCache)return [];
  const received=[],time=now();
  for(const row of rows){
   if(seen.has(row.id)||row.ownerUid!==owner||row.direction!=='incoming'||row.historical===true||row.source!=='meta_webhook')continue;
   seen.add(row.id);
   const at=millis(row.createdAt);
   if(ready&&at>time-120000&&at<=time+5000)received.push(row);
  }
  ready=true;
  return received;
 }};
}
export function initInboxNotifications({page,state,callFunction,showToast,onOpenMessage=()=>{}}){
 const incomingGate=createIncomingPopupGate(),controls=document.createElement('div');controls.className='inbox-notification-controls';controls.innerHTML='<button type="button" data-inbox-sound aria-pressed="false">🔔 Bật âm báo</button><small data-inbox-sound-status></small>';document.querySelector('.chatbot-sound-settings').append(controls);const button=controls.querySelector('button'),status=controls.querySelector('small');
 const banners=document.createElement('div');banners.className='messenger-browser-banners';banners.dataset.desktopPlatform=messengerDesktopPlatform(navigator);banners.setAttribute('aria-live','polite');banners.setAttribute('aria-relevant','additions');document.body.append(banners);
 let uid='',enabled=true,context=null,unlocking=null,generation=0,nextToneAt=0;const tabId=globalThis.crypto?.randomUUID?.()||Math.random().toString(36),colorRequests=new Map();
 const preferenceKey=()=> 'fbtq_inbox_sound_v1_'+uid;
 function render(){const running=context?.state==='running';button.textContent=!enabled?'🔕 Âm báo: tắt':running?'🔔 Âm báo: bật':'🔔 Bật âm báo';button.setAttribute('aria-pressed',String(enabled&&running));button.title='Âm báo mọi tin khách mới từ tất cả Fanpage; không reo khi tải lịch sử cũ. Nhấn để bật/tắt.';status.textContent=enabled&&!running?'Chạm để cho phép phát âm thanh':'';}
 function sync(){const next=state.user?.uid||'';if(next!==uid){generation++;nextToneAt=0;uid=next;incomingGate.reset();banners.replaceChildren();enabled=true;try{enabled=localStorage.getItem(preferenceKey())!=='off';}catch{}const old=context;context=null;unlocking=null;old?.close?.().catch?.(()=>{});}render();}
 async function unlock(){sync();if(!uid||!enabled)return false;if(context?.state==='running')return true;if(unlocking)return unlocking;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){status.textContent='Trình duyệt chưa hỗ trợ âm báo.';return false;}const run=generation,owner=uid;try{context||=new Audio();const current=context;unlocking=Promise.resolve(current.resume()).then(()=>{if(run!==generation||owner!==uid)return false;render();return current.state==='running';}).catch(()=>{if(run===generation)status.textContent='Bấm Bật âm báo để cho phép phát tiếng.';return false;}).finally(()=>{if(run===generation)unlocking=null;});return await unlocking;}catch{status.textContent='Chưa bật được âm thanh. Bấm để thử lại.';return false;}}
 function tone(){if(!enabled||context?.state!=='running')return;const time=context.currentTime;for(const [i,freq]of [880,1174.66].entries()){const oscillator=context.createOscillator(),gain=context.createGain(),at=time+i*.115;oscillator.type='sine';oscillator.frequency.setValueAtTime(freq,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.075,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.11);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.12);}}
 async function gesture(e){if(e.target?.closest?.('[data-inbox-sound]'))return;sync();if(enabled&&uid&&context?.state!=='running')await unlock();}
 document.addEventListener('pointerdown',gesture);document.addEventListener('keydown',gesture);
 button.onclick=async()=>{sync();if(!uid)return showToast('Đăng nhập để dùng âm báo.','error');if(enabled&&context?.state==='running'){enabled=false;try{localStorage.setItem(preferenceKey(),'off');}catch{}render();return;}enabled=true;try{localStorage.setItem(preferenceKey(),'on');}catch{}if(await unlock())tone();render();};
 window.addEventListener('storage',e=>{if(uid&&e.key===preferenceKey()){enabled=e.newValue!=='off';render();}});
 function showIncomingBanner(row){
  const owner=uid,card=document.createElement('article');
  card.className='messenger-browser-banner';
  card.innerHTML='<button type="button" class="messenger-browser-banner-open"><img src="assets/fbtq-app-192.png" alt="" width="42" height="42"><span><strong></strong><small></small></span></button><button type="button" class="messenger-browser-banner-close" aria-label="Đóng thông báo">×</button>';
  card.querySelector('strong').textContent=row.pageName||'Tin Nhắn Messenger Mới';
  const text=String(row.message||'').replace(/\s+/gu,' ').trim();
  const attachment=row.attachments?.some(item=>item.type==='image')?'Đã gửi một hình ảnh':'Đã gửi tệp đính kèm';
  card.querySelector('small').textContent=(!text||/^\[(?:Đã nhận tệp đính kèm|Tệp đính kèm)\]$/i.test(text)?attachment:text).slice(0,180);
  card.querySelector('.messenger-browser-banner-open').onclick=()=>{
   card.remove();
   if(state.user?.uid===owner)onOpenMessage(row);
  };
  card.querySelector('.messenger-browser-banner-close').onclick=()=>card.remove();
  banners.prepend(card);
  if(banners.childElementCount>3)banners.lastElementChild.remove();
  setTimeout(()=>card.remove(),8000);
 }
 function notify(rows,info={}){
  sync();
  const arrivals=incomingGate.inspect(uid,rows,info);
  if(arrivals.length){
   if(document.hidden)state.inboxNotifyBackground?.(arrivals);
   else arrivals.slice(-3).forEach(showIncomingBanner);
  }
  const ids=arrivals.map(row=>row.id);if(!ids.length)return;
  if(!enabled||context?.state!=='running')return;const owner=uid,run=generation,key='fbtq_inbox_sound_claims_'+uid;let shared=true;
  try{const previous=JSON.parse(localStorage.getItem(key)||'[]'),claims=Array.isArray(previous)?previous:[];for(const messageId of ids)if(!claims.some(c=>c.messageId===messageId))claims.push({messageId,tabId});localStorage.setItem(key,JSON.stringify(claims.slice(-500)));}catch{shared=false;}
  setTimeout(()=>{if(uid!==owner||run!==generation||!enabled)return;let claims=[];if(shared){try{claims=JSON.parse(localStorage.getItem(key)||'[]');}catch{shared=false;}}
   for(const messageId of ids){if(shared&&!claims.some(c=>c.messageId===messageId&&c.tabId===tabId))continue;const delay=Math.max(0,nextToneAt-Date.now());nextToneAt=Date.now()+delay+300;setTimeout(()=>{if(uid===owner&&run===generation)tone();},delay);}
  },80);
 }
 function paintColors(){page.querySelectorAll('.conversation[data-page-id]').forEach(row=>row.style.setProperty('--fanpage-color',fanpageColor(state.pages.find(p=>p.pageId===row.dataset.pageId)||{pageId:row.dataset.pageId})));const header=page.querySelector('.chat-header');if(header)header.style.setProperty('--fanpage-color',state.activeThread?fanpageColor(state.pages.find(p=>p.pageId===state.activeThread.pageId)||{pageId:state.activeThread.pageId}):'transparent');}
 async function setColor(pageId,value){sync();if(!uid||!/^#[a-f0-9]{6}$/i.test(value)&&value!=='')return;const owner=uid,run=generation,p=state.pages.find(p=>p.pageId===pageId);if(!p)return showToast('Tải lại danh sách Fanpage trước khi đổi màu.','error');if(document.activeElement?.matches?.('[data-page-color]'))document.activeElement.blur();const previous=p.inboxColor||'',request=Symbol();colorRequests.set(pageId,request);p.inboxColor=value.toUpperCase();paintColors();
  try{await callFunction('setMessengerPageColor',{pageId,color:value});if(run!==generation||uid!==owner||colorRequests.get(pageId)!==request)return;state.chatbotPagesChanged?.();}
  catch(e){if(run===generation&&uid===owner&&colorRequests.get(pageId)===request){p.inboxColor=previous;paintColors();state.chatbotPagesChanged?.();showToast(e.message,'error');}}finally{if(colorRequests.get(pageId)===request)colorRequests.delete(pageId);}
 }
 state.inboxPageColorPending=id=>colorRequests.has(id);state.inboxNotifyMessages=notify;state.inboxSoundRefresh=sync;state.inboxSetPageColor=setColor;state.repaintPageColors=paintColors;sync();
 return {reset(){generation++;nextToneAt=0;uid='';incomingGate.reset();banners.replaceChildren();colorRequests.clear();const old=context;context=null;unlocking=null;old?.close?.().catch?.(()=>{});enabled=true;render();},paintColors};
}
