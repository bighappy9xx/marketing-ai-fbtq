const cacheName='fbtq-messenger-push-v1';
const bindingKey=new URL('./messenger-push-device',import.meta.url).href;

export function initMessengerPush({state,callFunction,showToast}){
  const button=document.querySelector('[data-messenger-push-toggle]');
  const previews=document.querySelector('[data-messenger-push-preview]');
  const status=document.querySelector('[data-messenger-push-status]');
  if(!button||!previews||!status)return {refresh(){},disable(){},notifyBackground(){}};
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const supported=window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&'caches' in window;
  let owner='',ready,binding=null,busy=false;
  const worker=()=>navigator.serviceWorker.register(new URL('./messenger-push-worker.js',import.meta.url),{updateViaCache:'none'});
  const readBinding=async()=>{
    const cache=await caches.open(cacheName);
    return (await (await cache.match(bindingKey))?.json())||null;
  };
  async function writeBinding(value){
    const cache=await caches.open(cacheName);
    if(value)await cache.put(bindingKey,new Response(JSON.stringify(value)));
    else await cache.delete(bindingKey);
  }
  function render(){
    const granted=supported&&Notification.permission==='granted';
    const active=granted&&binding?.owner===owner&&!!owner;
    button.textContent=active?'Tắt Thông Báo Trên Thiết Bị Này':'Bật Thông Báo Trên Thiết Bị Này';
    button.setAttribute('aria-pressed',String(active));
    button.disabled=busy||!owner||!supported||ios&&!standalone;
    previews.checked=active&&binding.showPreview===true;
    previews.disabled=busy||!active;
    status.textContent=ios&&!standalone?'Trên iPhone hoặc iPad, thêm website vào Màn hình chính rồi mở từ biểu tượng.':!supported?'Trình duyệt này chưa hỗ trợ thông báo nền.':Notification.permission==='denied'?'Thông báo đang bị chặn. Hãy cho phép trong cài đặt của trình duyệt hoặc thiết bị.':active?'Đang bật trên thiết bị này.':'Bật trên từng máy tính hoặc điện thoại bạn muốn nhận thông báo.';
  }
  async function prepare(){
    const [registration,config]=await Promise.all([worker(),callFunction('getMessengerPushConfig',{})]);
    const encoded=config.publicKey.replace(/-/g,'+').replace(/_/g,'/');
    const key=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
    const active=registration.active?registration:await navigator.serviceWorker.ready;
    return {registration:active,key};
  }
  function refresh(){
    const uid=state.user?.uid||'';
    if(owner===uid)return;
    owner=uid;
    ready=undefined;
    binding=null;
    render();
    if(!uid||!supported||ios&&!standalone)return;
    ready=prepare();
    ready.then(async({registration})=>{
      const current=await readBinding();
      const subscription=await registration.pushManager.getSubscription();
      if(owner!==uid||state.user?.uid!==uid)return;
      if(current?.owner!==uid||!subscription||Notification.permission!=='granted')return;
      const showPreview=current.showPreview===true;
      const result=await callFunction('registerMessengerPushDevice',{subscription:subscription.toJSON(),showPreview});
      if(owner!==uid||state.user?.uid!==uid)return;
      binding={owner:uid,device:result.id,showPreview};
      await writeBinding(binding);
      render();
    }).catch(()=>{});
  }
  async function disable(){
    if(!supported||ios&&!standalone)return;
    const uid=state.user?.uid;
    if(!uid)return;
    const current=binding||await readBinding();
    if(!current||current.owner!==uid)return;
    binding=null;
    await writeBinding(null);
    render();
    const registration=await navigator.serviceWorker.getRegistration();
    const subscription=await registration?.pushManager.getSubscription();
    await Promise.allSettled([subscription?.unsubscribe(),callFunction('unregisterMessengerPushDevice',{id:current.device},{timeout:2500})]);
  }
  button.addEventListener('click',async()=>{
    if(busy||!owner)return;
    busy=true;
    render();
    const uid=owner;
    try{
      if(binding?.owner===uid){await disable();return;}
      const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
      if(permission!=='granted'||state.user?.uid!==uid)return;
      await ready?.catch(()=>{ready=undefined;});
      const {registration,key}=await (ready||=prepare());
      if(state.user?.uid!==uid)return;
      const previous=await readBinding();
      const existing=await registration.pushManager.getSubscription();
      const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      if(state.user?.uid!==uid){if(!existing)await subscription.unsubscribe();return;}
      try{
        const result=await callFunction('registerMessengerPushDevice',{subscription:subscription.toJSON(),showPreview:false});
        if(state.user?.uid!==uid){if(!existing)await subscription.unsubscribe();return;}
        binding={owner:uid,device:result.id,showPreview:false};
        await writeBinding(binding);
      }catch(error){
        if(!previous||!existing)await subscription.unsubscribe();
        throw error;
      }
    }catch(error){showToast(error.message||'Chưa bật hoặc tắt được thông báo. Hãy thử lại.','error');}
    finally{busy=false;render();}
  });
  previews.addEventListener('change',async()=>{
    if(busy||binding?.owner!==owner||!owner)return;
    const uid=owner,showPreview=previews.checked;
    busy=true;
    render();
    try{
      if(!showPreview){
        binding={...binding,showPreview:false};
        await writeBinding(binding);
      }
      const registration=await navigator.serviceWorker.getRegistration();
      const subscription=await registration?.pushManager.getSubscription();
      if(!subscription)throw Error('Hãy bật lại thông báo trên thiết bị này.');
      if(state.user?.uid!==uid)return;
      const result=await callFunction('registerMessengerPushDevice',{subscription:subscription.toJSON(),showPreview});
      if(state.user?.uid!==uid)return;
      binding={owner:uid,device:result.id,showPreview};
      await writeBinding(binding);
    }catch(error){showToast(error.message||'Chưa lưu được tùy chọn xem trước.','error');}
    finally{busy=false;render();}
  });
  async function notifyBackground(rows){
    if(!supported||!document.hidden||Notification.permission!=='granted')return;
    const uid=state.user?.uid;
    if(!uid)return;
    try{
      const [current,registration]=await Promise.all([readBinding(),navigator.serviceWorker.getRegistration()]);
      if(current?.owner!==uid||state.user?.uid!==uid||!document.hidden||!registration?.active)return;
      for(const row of rows){
        if(row.ownerUid!==uid||row.direction!=='incoming'||row.historical===true||!['meta_webhook','meta_sync_live'].includes(row.source))continue;
        const at=row.createdAt?.toMillis?.()??(row.createdAt?.seconds*1000);
        if(!(at>Date.now()-120000&&at<=Date.now()+5000))continue;
        const body=String(row.message||'').replace(/\s+/gu,' ').trim();
        const attachment=row.attachments?.some(item=>item.type==='image')?'Đã gửi một hình ảnh':'Đã gửi tệp đính kèm';
        const preview=current.showPreview===true?{title:row.pageName,body:!body||/^\[(?:Đã nhận tệp đính kèm|Tệp đính kèm)\]$/i.test(body)?attachment:body}:undefined;
        registration.active.postMessage({type:'fbtq-messenger-background',owner:uid,device:current.device,id:row.id,preview});
      }
    }catch{/* Web Push can still deliver the notification. */}
  }
  render();
  return {refresh,disable,notifyBackground};
}
