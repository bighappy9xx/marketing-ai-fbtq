const cacheName='fbtq-messenger-push-v1';
const bindingKey=new URL('./messenger-push-device',import.meta.url).href;

export function initMessengerPush({state,callFunction,showToast}){
  const button=document.querySelector('[data-messenger-push-toggle]');
  const status=document.querySelector('[data-messenger-push-status]');
  if(!button||!status)return {refresh(){},disable(){}};
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
      const result=await callFunction('registerMessengerPushDevice',{subscription:subscription.toJSON()});
      if(owner!==uid||state.user?.uid!==uid)return;
      binding={owner:uid,device:result.id};
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
        const result=await callFunction('registerMessengerPushDevice',{subscription:subscription.toJSON()});
        if(state.user?.uid!==uid){if(!existing)await subscription.unsubscribe();return;}
        binding={owner:uid,device:result.id};
        await writeBinding(binding);
      }catch(error){
        if(!previous||!existing)await subscription.unsubscribe();
        throw error;
      }
    }catch(error){showToast(error.message||'Chưa bật hoặc tắt được thông báo. Hãy thử lại.','error');}
    finally{busy=false;render();}
  });
  render();
  return {refresh,disable};
}
