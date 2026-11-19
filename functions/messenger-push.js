const {createHash}=require('node:crypto');
const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const webPush=require('web-push');

const devices='messengerPushDevices';
const maxDevices=10;
const subscriptionLifetime=90*24*60*60*1000;
const isPushService=host=>host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='push.services.mozilla.com'||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');

function normalizeSubscription(input){
  if(typeof input?.endpoint!=='string'||input.endpoint.length>2048)throw Error('Địa chỉ thông báo không hợp lệ.');
  const endpoint=new URL(input.endpoint);
  const port=endpoint.port;
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||port||endpoint.hash||!isPushService(endpoint.hostname))throw Error('Dịch vụ thông báo của trình duyệt chưa được hỗ trợ.');
  const {p256dh,auth}=input.keys||{};
  if(typeof p256dh!=='string'||!/^[a-zA-Z0-9_-]{87}$/.test(p256dh)||Buffer.from(p256dh,'base64url')[0]!==4||typeof auth!=='string'||!/^[a-zA-Z0-9_-]{22}$/.test(auth)){
    throw Error('Khóa đăng ký thông báo không hợp lệ.');
  }
  return {endpoint:endpoint.href,keys:{p256dh,auth}};
}

function shouldNotify(before,after,now=Date.now()){
  if(!after?.ownerUid||after.direction!=='incoming'||after.historical===true)return false;
  if(!['meta_webhook','meta_sync_live'].includes(after.source))return false;
  if(before&&before.historical!==true)return false;
  const at=after.createdAt?.toMillis?.()??(after.createdAt instanceof Date?after.createdAt.getTime():0);
  return at>now-120000&&at<=now+5000;
}

function registerMessengerPush({db,onCall,HttpsError,requireSignedIn,MESSENGER_WEB_PUSH_VAPID,logger}){
  const vapid=()=>JSON.parse(MESSENGER_WEB_PUSH_VAPID.value());
  const callable=(options,handler)=>onCall({invoker:'public',...options},handler);
  const config=callable({secrets:[MESSENGER_WEB_PUSH_VAPID]},async request=>{
    await requireSignedIn(request);
    return {publicKey:vapid().publicKey};
  });
  const register=callable({},async request=>{
    const {uid}=await requireSignedIn(request);
    let subscription;
    try{subscription=normalizeSubscription(request.data?.subscription);}
    catch(error){throw new HttpsError('invalid-argument',error.message);}
    const id=createHash('sha256').update(subscription.endpoint).digest('hex');
    const ref=db.collection(devices).doc(id);
    await db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      const existing=await tx.get(db.collection(devices).where('ownerUid','==',uid).limit(maxDevices));
      if(existing.size>=maxDevices&&current.data()?.ownerUid!==uid)throw new HttpsError('resource-exhausted','Tài khoản đã đạt giới hạn thiết bị nhận thông báo.');
      tx.set(ref,{ownerUid:uid,subscription,updatedAtMs:Date.now()});
    });
    return {id};
  });
  const unregister=callable({},async request=>{
    const uid=request.auth?.uid,id=request.data?.id;
    if(!uid)throw new HttpsError('unauthenticated','Vui lòng đăng nhập.');
    if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new HttpsError('invalid-argument','Thiết bị không hợp lệ.');
    const ref=db.collection(devices).doc(id);
    await db.runTransaction(async tx=>{
      if((await tx.get(ref)).data()?.ownerUid===uid)tx.delete(ref);
    });
    return {ok:true};
  });
  const deliver=onDocumentWritten({document:'workspaces/fbtq/messages/{messageId}',secrets:[MESSENGER_WEB_PUSH_VAPID],retry:false,timeoutSeconds:30},async event=>{
    const before=event.data?.before.data(),message=event.data?.after.data();
    if(!shouldNotify(before,message))return;
    const uid=message.ownerUid;
    const subscriptions=await db.collection(devices).where('ownerUid','==',uid).limit(maxDevices).get();
    if(subscriptions.empty)return;
    const owner=await db.doc(`users/${uid}`).get();
    if(owner.data()?.approved!==true)return;
    const vapidDetails={subject:'https://mediafbtq-6e1bb.web.app/',...vapid()};
    async function removeIfUnchanged(doc){
      await db.runTransaction(async tx=>{
        const current=await tx.get(doc.ref);
        if(current.exists&&current.updateTime.isEqual(doc.updateTime))tx.delete(doc.ref);
      });
    }
    await Promise.all(subscriptions.docs.map(async doc=>{
      const saved=doc.data();
      if(saved.updatedAtMs<Date.now()-subscriptionLifetime)return removeIfUnchanged(doc);
      try{
        const subscription=normalizeSubscription(saved.subscription);
        const payload=JSON.stringify({owner:uid,device:doc.id,id:event.params.messageId});
        await webPush.sendNotification(subscription,payload,{vapidDetails,TTL:120,urgency:'high',timeout:8000});
      }catch(error){
        if([404,410].includes(error.statusCode))return removeIfUnchanged(doc);
        logger.warn('Messenger web push failed',{status:Number(error.statusCode)||0});
      }
    }));
  });
  return {getMessengerPushConfig:config,registerMessengerPushDevice:register,unregisterMessengerPushDevice:unregister,notifyMessengerIncoming:deliver};
}
module.exports={normalizeSubscription,shouldNotify,registerMessengerPush};
