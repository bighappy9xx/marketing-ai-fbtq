// Shared by the service worker and the page that displays native notifications.
globalThis.fbtqMessengerNotification=(scope,{id,preview,test=false,timestamp=Date.now()})=>{
  const compact=(value,limit)=>typeof value==='string'?Array.from(value.replace(/\s+/gu,' ').trim()).slice(0,limit).join(''):'';
  const sample={title:'Fanpage FBTQ',body:'Bạn có tin nhắn mới. Bấm để mở hộp thư.'};
  const content=test?sample:preview;
  const title=compact(content?.title,100)||'Tin Nhắn Messenger Mới';
  const body=compact(content?.body,240)||'Bạn có tin nhắn mới trong Hộp Thư Chatbot AI.';
  const icon=new URL('./assets/fbtq-app-192.png',scope).href;
  const canShowActions=Number(globalThis.Notification?.maxActions)>0;
  return {title,options:{
    body,icon,badge:new URL('./assets/fbtq-notification-badge.png',scope).href,tag:'fbtq-message-'+id,timestamp,
    lang:'vi',renotify:false,
    ...(canShowActions?{actions:[{action:'open-inbox',title:'Mở hộp thư'}]}:{}),
  }};
};
