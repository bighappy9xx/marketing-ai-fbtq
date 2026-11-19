const cacheName='fbtq-messenger-push-v1';
const bindingKey=new URL('./messenger-push-device',import.meta.url).href;
const notificationIcon=new URL('./apple-touch-icon.png',import.meta.url).href;
const notificationTag=id=>'fbtq-message-'+id;

export function initMessengerPush({state,callFunction,showToast}){
  const button=document.querySelector('[data-messenger-push-toggle]');
  const previews=document.querySelector('[data-messenger-push-preview]');
  const status=document.querySelector('[data-messenger-push-status]');
  const testButton=document.querySelector('[data-messenger-push-test]');
  const testStatus=document.querySelector('[data-messenger-push-test-status]');
  const reconnectButton=document.querySelector('[data-messenger-push-reconnect]');
  if(!button||!previews||!status||!testButton||!testStatus||!reconnectButton)return {refresh(){},disable(){},notifyBackground(){}};
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const supported=window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&'caches' in window;
  let owner='',ready,binding=null,busy=false,testing,needsReconnect=false,renewal;
  const isExpired=error=>error?.details?.reason==='expired-push-subscription';
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
    testButton.disabled=busy||!active||Boolean(testing);
    reconnectButton.hidden=!active;
    reconnectButton.disabled=busy||Boolean(testing);
    status.textContent=ios&&!standalone?'Trên iPhone hoặc iPad, thêm website vào Màn hình chính rồi mở từ biểu tượng.':!supported?'Trình duyệt này chưa hỗ trợ thông báo nền.':Notification.permission==='denied'?'Thông báo đang bị chặn. Hãy cho phép trong cài đặt của trình duyệt hoặc thiết bị.':active?(needsReconnect?'Đăng ký Web Push đã hết hiệu lực. Hãy bấm Kết Nối Lại Thiết Bị.':'Đang bật trên thiết bị này.'):'Bật trên từng máy tính hoặc điện thoại bạn muốn nhận thông báo.';
  }
  async function prepare(){
    const [registration,config]=await Promise.all([worker(),callFunction('getMessengerPushConfig',{})]);
    const encoded=config.publicKey.replace(/-/g,'+').replace(/_/g,'/');
    const key=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
    const active=registration.active?registration:await navigator.serviceWorker.ready;
    return {registration:active,key};
  }
  async function connectDevice(registration,key,uid,showPreview,{renew=false,existing=null,replaces}={}){
    let subscription=existing||await registration.pushManager.getSubscription();
    if(renew&&subscription){
      await subscription.unsubscribe();
      subscription=null;
    }
    subscription||=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    if(state.user?.uid!==uid)return;
    const result=await callFunction('registerMessengerPushDevice',{subscription:subscription.toJSON(),showPreview,...(replaces?{replaces}:{})});
    if(state.user?.uid!==uid)return;
    const next={owner:uid,device:result.id,showPreview};
    await writeBinding(next);
    if(state.user?.uid!==uid)return;
    binding=next;
    needsReconnect=false;
    render();
    return next;
  }
  function renewDevice(uid){
    if(state.user?.uid!==uid)return;
    if(renewal?.uid===uid)return renewal.promise;
    needsReconnect=true;
    render();
    const operation={uid};
    operation.promise=(async()=>{
      const current=binding||await readBinding();
      await ready?.catch(()=>{if(state.user?.uid===uid)ready=undefined;});
      if(state.user?.uid!==uid)return;
      const {registration,key}=await (ready||=prepare());
      if(state.user?.uid!==uid)return;
      return connectDevice(registration,key,uid,current?.owner===uid&&current.showPreview===true,{renew:true,replaces:current?.owner===uid?current.device:undefined});
    })().finally(()=>{if(renewal===operation)renewal=undefined;});
    renewal=operation;
    return operation.promise;
  }
  function refresh(){
    const uid=state.user?.uid||'';
    if(owner===uid)return;
    owner=uid;
    clearTimeout(testing?.timeout);
    testing=undefined;
    testStatus.textContent='';
    ready=undefined;
    binding=null;
    needsReconnect=false;
    render();
    if(!uid||!supported||ios&&!standalone)return;
    readBinding().then(current=>{
      if(current?.owner===uid&&owner===uid&&state.user?.uid===uid&&!binding){binding=current;render();}
    }).catch(()=>{});
    ready=prepare();
    ready.then(async({registration,key})=>{
      const current=await readBinding();
      const subscription=await registration.pushManager.getSubscription();
      if(owner!==uid||state.user?.uid!==uid)return;
      if(current?.owner!==uid||Notification.permission!=='granted')return;
      try{await connectDevice(registration,key,uid,current.showPreview===true,{existing:subscription});}
      catch(error){if(isExpired(error)&&state.user?.uid===uid)await renewDevice(uid);else throw error;}
    }).catch(()=>{});
  }
  async function disable(){
    if(!supported||ios&&!standalone)return;
    const uid=state.user?.uid;
    if(!uid)return;
    const current=binding||await readBinding();
    if(!current||current.owner!==uid)return;
    binding=null;
    needsReconnect=false;
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
  function finishTest(message){
    clearTimeout(testing?.timeout);
    testing=undefined;
    testStatus.textContent=message;
    showToast(message);
    render();
  }
  if(supported)navigator.serviceWorker.addEventListener('message',event=>{
    if(!testing||event.data?.type!=='fbtq-messenger-test-displayed'||testing.device!==event.data.device||testing.id!==event.data.id)return;
    finishTest('Trình duyệt đã nhận Web Push và chuyển thông báo tới hệ điều hành. Nếu chưa thấy pop-up, kiểm tra Biểu ngữ và chế độ Không làm phiền.');
  });
  testButton.addEventListener('click',async()=>{
    if(testing||binding?.owner!==owner||!owner)return;
    const run={device:binding.device,owner,id:Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')};
    testing=run;
    testStatus.textContent='Đang kiểm tra pop-up trên thiết bị và đường gửi Web Push…';
    render();
    const local=(async()=>{
      const registration=await navigator.serviceWorker.getRegistration();
      if(!registration?.active||testing!==run||state.user?.uid!==run.owner)return false;
      await registration.showNotification('Thông Báo Thử FBTQ',{
        body:'Thiết bị này đã nhận thông báo từ Chatbot AI.',
        icon:notificationIcon,
        tag:notificationTag(run.id),
        renotify:false,
      });
      return true;
    })().catch(()=>false);
    try{
      const sendTest=()=>callFunction('testMessengerPushDevice',{id:run.device,testId:run.id},{timeout:20000});
      const remote=sendTest().catch(async error=>{
        if(!isExpired(error)||testing!==run)throw error;
        testStatus.textContent='Đăng ký Web Push đã hết hiệu lực. Đang tự kết nối lại thiết bị…';
        const renewed=await renewDevice(run.owner);
        if(testing!==run||!renewed)throw error;
        run.device=renewed.device;
        return sendTest();
      });
      const [,displayed]=await Promise.all([remote,local]);
      if(testing!==run)return;
      testStatus.textContent=displayed?'Đã yêu cầu hệ điều hành hiện pop-up thử. Đang chờ trình duyệt xác nhận Web Push…':'Đang chờ trình duyệt xác nhận Web Push…';
      run.timeout=setTimeout(()=>{
        if(testing===run)finishTest(displayed?'Trình duyệt đã yêu cầu hệ điều hành hiện pop-up thử. Web Push chưa được trình duyệt xác nhận.':'Dịch vụ đã nhận yêu cầu nhưng trình duyệt chưa hiển thị. Kiểm tra quyền thông báo của website và thiết bị.');
      },12000);
    }catch(error){
      const displayed=await local;
      if(testing===run)finishTest((displayed?'Đã yêu cầu hiện pop-up trực tiếp. ':'')+(error.message||'Chưa gửi được Web Push thử.'));
    }
  });
  reconnectButton.addEventListener('click',async()=>{
    if(busy||testing||!owner||binding?.owner!==owner)return;
    const uid=owner;
    busy=true;
    testStatus.textContent='Đang làm mới đăng ký thông báo…';
    render();
    try{
      const device=await renewDevice(uid);
      if(device&&state.user?.uid===uid)testStatus.textContent='Đã đăng ký lại Web Push trên thiết bị này.';
    }catch(error){
      if(state.user?.uid===uid)testStatus.textContent=error.message||'Chưa kết nối lại được thiết bị.';
    }finally{busy=false;render();}
  });
  async function notifyBackground(rows){
    const away=()=>document.hidden||!document.querySelector('#page-inbox')?.classList.contains('active');
    if(!supported||!away()||Notification.permission!=='granted')return;
    const uid=state.user?.uid;
    if(!uid)return;
    try{
      const [current,registration]=await Promise.all([readBinding(),navigator.serviceWorker.getRegistration()]);
      if(current?.owner!==uid||state.user?.uid!==uid||!away()||!registration?.active)return;
      for(const row of rows){
        if(row.ownerUid!==uid||row.direction!=='incoming'||row.historical===true||row.source!=='meta_webhook')continue;
        const at=row.createdAt?.toMillis?.()??(row.createdAt?.seconds*1000);
        if(!(at>Date.now()-120000&&at<=Date.now()+5000))continue;
        const body=String(row.message||'').replace(/\s+/gu,' ').trim();
        const attachment=row.attachments?.some(item=>item.type==='image')?'Đã gửi một hình ảnh':'Đã gửi tệp đính kèm';
        const preview=current.showPreview===true?{title:row.pageName,body:!body||/^\[(?:Đã nhận tệp đính kèm|Tệp đính kèm)\]$/i.test(body)?attachment:body}:undefined;
        if(!/^[a-f0-9]{64}$/.test(row.id||''))continue;
        const tag=notificationTag(row.id);
        if((await registration.getNotifications?.({tag}))?.length)continue;
        if(state.user?.uid!==uid||!away())return;
        await registration.showNotification(String(preview?.title||'Tin Nhắn Messenger Mới').trim().slice(0,100)||'Tin Nhắn Messenger Mới',{
          body:preview?.body.slice(0,240)||'Bạn có tin nhắn mới trong Hộp Thư Chatbot AI.',
          icon:notificationIcon,
          tag,
          renotify:false,
        });
      }
    }catch{/* Web Push can still deliver the notification. */}
  }
  render();
  return {refresh,disable,notifyBackground};
}
