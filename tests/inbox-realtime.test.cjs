const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('auto sync honors the manual sync guard, limits rate, backs off and ignores stale account responses',async()=>{
 const old={document:global.document,window:global.window,setInterval:global.setInterval,clearInterval:global.clearInterval};
 global.document={addEventListener(){},removeEventListener(){}};global.window={addEventListener(){},removeEventListener(){}};global.setInterval=()=>0;global.clearInterval=()=>{};
 try{const mod=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(require.resolve('../inbox-realtime.js'))).toString('base64'));const status=[],calls=[],state={user:{uid:'a'},firebase:{},pages:[{pageId:'123456',active:true,ownerUid:'a'}]};let now=100000,visible=false,reject=false,release;
 const auto=mod.initAutomaticInbox({state,canSync:()=>visible,now:()=>now,onStatus:(...s)=>status.push(s),callFunction:async(name,data)=>{calls.push(data);if(release===true)return new Promise(r=>release=r);if(reject)throw Error('permission');return {conversations:1};}});
 await auto.tick();assert.equal(calls.length,0);visible=true;await auto.tick();assert.equal(calls.length,1);assert.equal(calls[0].automatic,true);await auto.tick();assert.equal(calls.length,1);now+=5000;reject=true;await auto.tick();assert.equal(status.at(-1)[0],'error');now+=5000;await auto.tick();assert.equal(calls.length,2);now+=5000;reject=false;release=true;const pending=auto.tick();await Promise.resolve();state.user={uid:'b'};auto.reset();release({conversations:1});await pending;assert.notEqual(status.at(-1)[0],'live');auto.stop();
 assert.ok(mod.messengerAvatar({senderName:'<Khách>',senderPhotoUrl:'javascript:alert(1)'}).includes('&lt;'));assert.ok(!mod.messengerAvatar({senderPhotoUrl:'javascript:alert(1)'}).includes('<img'));assert.equal(mod.chatTime({seconds:12}),12000);
 }finally{Object.assign(global,old);}
});
test('each active Page polls concurrently every five seconds regardless of picker; slow Page does not block others',async()=>{
 const old={document:global.document,window:global.window,setInterval:global.setInterval,clearInterval:global.clearInterval};global.document={addEventListener(){},removeEventListener(){}};global.window={addEventListener(){},removeEventListener(){}};global.setInterval=()=>0;global.clearInterval=()=>{};
 try{const mod=await import('data:text/javascript;base64,'+fs.readFileSync(require.resolve('../inbox-realtime.js')).toString('base64'));let now=10000,release;const calls=[],state={user:{uid:'a'},firebase:{},inboxSelectedPageIds:[],pages:[{pageId:'p1'},{pageId:'p2'}]},auto=mod.initAutomaticInbox({state,canSync:()=>true,now:()=>now,onStatus(){},callFunction:async(_,data)=>{calls.push(data.pageId);if(data.pageId==='p1')return new Promise(r=>release=r);return {};}});
 const pending=auto.tick();await Promise.resolve();assert.deepEqual(calls,['p1','p2']);now+=4999;await auto.tick();assert.equal(calls.length,2);now++;await auto.tick();assert.deepEqual(calls,['p1','p2','p2']);release({});await pending;auto.stop();}finally{Object.assign(global,old);}
});

test('auto sync keeps polling connected pages when the inbox is in the background',async()=>{
 const old={document:global.document,window:global.window,setInterval:global.setInterval,clearInterval:global.clearInterval};
 global.document={addEventListener(){},removeEventListener(){}};global.window={addEventListener(){},removeEventListener(){}};global.setInterval=()=>0;global.clearInterval=()=>{};
 try{
  const mod=await import('data:text/javascript;base64,'+fs.readFileSync(require.resolve('../inbox-realtime.js')).toString('base64'));
  let now=100000,foreground=false;const times=[];
  const auto=mod.initAutomaticInbox({state:{user:{uid:'a'},firebase:{},pages:[{pageId:'123456',ownerUid:'a'}]},canSync:()=>true,isForeground:()=>foreground,now:()=>now,callFunction:async()=>{times.push(now);return {};}});
  await auto.tick();
  now+=5000;await auto.tick();
  now+=10000;await auto.tick();
  foreground=true;now+=5000;await auto.tick();
  assert.deepEqual(times,[100000,115000,120000]);
  auto.stop();
 }finally{Object.assign(global,old);}
});
