const cacheName='fbtq-messenger-push-v1';
const bindingKey=new URL('./messenger-push-device',self.registration.scope).href;
const inboxUrl=new URL('./#inbox',self.registration.scope).href;
const pendingLocal=new Set();

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function showIncoming(payload,fromTab=false){
    if(typeof payload?.owner!=='string'||!(/^[a-f0-9]{64}$/).test(payload.device||'')||!(/^[a-f0-9]{64}$/).test(payload.id||''))return;
    const cache=await caches.open(cacheName);
    const binding=await (await cache.match(bindingKey))?.json();
    if(binding?.owner!==payload.owner||binding.device!==payload.device)return;
    const tag='fbtq-message-'+payload.id;
    if(fromTab&&pendingLocal.has(tag))return;
    const preview=binding.showPreview===true?payload.preview:null;
    const title=payload.test===true?'Thông Báo Thử FBTQ':typeof preview?.title==='string'&&preview.title.trim()?preview.title.slice(0,100):'Tin Nhắn Messenger Mới';
    const body=payload.test===true?'Thiết bị này đã nhận thông báo từ Chatbot AI.':typeof preview?.body==='string'&&preview.body.trim()?preview.body.slice(0,240):'Bạn có tin nhắn mới trong Hộp Thư Chatbot AI.';
    if(fromTab)pendingLocal.add(tag);
    try{
      if(fromTab&&(await self.registration.getNotifications?.({tag}))?.length)return;
      await self.registration.showNotification(title,{
        body,
        icon:new URL('./apple-touch-icon.png',self.registration.scope).href,
        tag,
        renotify:false,
      });
      if(payload.test===true&&!fromTab){
        const clients=await self.clients.matchAll({type:'window'});
        clients.forEach(client=>client.postMessage({type:'fbtq-messenger-test-displayed',device:payload.device}));
      }
    }finally{
      if(fromTab)pendingLocal.delete(tag);
    }
}
self.addEventListener('push',event=>{
  event.waitUntil(showIncoming(event.data?.json()));
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='fbtq-messenger-background'||!event.source?.url||event.source.visibilityState==='visible')return;
  const source=new URL(event.source.url),scope=new URL(self.registration.scope);
  if(source.origin!==scope.origin||!(source.pathname===scope.pathname||source.pathname===scope.pathname+'index.html'))return;
  event.waitUntil(showIncoming(event.data,true));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const scope=new URL(self.registration.scope);
    const client=windows.find(window=>{
      const url=new URL(window.url);
      return url.origin===scope.origin&&(url.pathname===scope.pathname||url.pathname===scope.pathname+'index.html');
    });
    if(client){
      const target=new URL(client.url);
      target.hash='inbox';
      const focused=await client.focus();
      if(new URL(focused.url).hash!=='#inbox')await focused.navigate(target.href);
      return;
    }
    await self.clients.openWindow(inboxUrl);
  })());
});
