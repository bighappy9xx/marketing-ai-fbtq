importScripts('./messenger-notification-format.js?v=20261119-desktop-banners');

const cacheName='fbtq-messenger-push-v1';
const bindingKey=new URL('./messenger-push-device',self.registration.scope).href;
const inboxUrl=new URL('./#inbox',self.registration.scope).href;
const pendingLocal=new Set();
const isWorkspaceUrl=(url,scope)=>url.origin===scope.origin&&['','index.html','workspace','workspace.html'].some(path=>url.pathname===scope.pathname+path);

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function showIncoming(payload,fromTab=false){
    if(typeof payload?.owner!=='string'||!(/^[a-f0-9]{64}$/).test(payload.device||'')||!(/^[a-f0-9]{64}$/).test(payload.id||''))return;
    const cache=await caches.open(cacheName);
    const binding=await (await cache.match(bindingKey))?.json();
    if(binding?.owner!==payload.owner||binding.device!==payload.device)return;
    const {title,options}=globalThis.fbtqMessengerNotification(self.registration.scope,{
      id:payload.id,preview:binding.showPreview===true?payload.preview:null,
      test:payload.test===true,timestamp:Number.isFinite(payload.timestamp)?payload.timestamp:undefined,
    });
    const {tag}=options;
    if(fromTab&&pendingLocal.has(tag))return;
    if(fromTab)pendingLocal.add(tag);
    try{
      if(fromTab&&(await self.registration.getNotifications?.({tag}))?.length)return;
      await self.registration.showNotification(title,options);
      if(payload.test===true&&!fromTab){
        const clients=await self.clients.matchAll({type:'window'});
        clients.forEach(client=>client.postMessage({type:'fbtq-messenger-test-displayed',device:payload.device,id:payload.id}));
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
  if(!isWorkspaceUrl(source,scope))return;
  event.waitUntil(showIncoming(event.data,true));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const scope=new URL(self.registration.scope);
    const client=windows.find(window=>isWorkspaceUrl(new URL(window.url),scope));
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
