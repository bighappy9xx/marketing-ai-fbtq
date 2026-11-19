const cacheName='fbtq-messenger-push-v1';
const bindingKey=new URL('./messenger-push-device',self.registration.scope).href;
const inboxUrl=new URL('./#inbox',self.registration.scope).href;

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    const payload=event.data?.json();
    if(typeof payload?.owner!=='string'||!(/^[a-f0-9]{64}$/).test(payload.device||'')||!(/^[a-f0-9]{64}$/).test(payload.id||''))return;
    const cache=await caches.open(cacheName);
    const binding=await (await cache.match(bindingKey))?.json();
    if(binding?.owner!==payload.owner||binding.device!==payload.device)return;
    await self.registration.showNotification('Tin Nhắn Messenger Mới',{
      body:'Bạn có tin nhắn mới trong Hộp Thư Chatbot AI.',
      icon:new URL('./apple-touch-icon.png',self.registration.scope).href,
      tag:'fbtq-message-'+payload.id,
    });
  })());
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
