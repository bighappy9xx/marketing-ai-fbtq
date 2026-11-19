const {createHash,randomBytes}=require('node:crypto');
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

function notificationPreview(message){
  const compact=(value,max)=>typeof value==='string'?value.replace(/\s+/gu,' ').trim().slice(0,max):'';
  const title=compact(message.pageName,100)||'Tin Nhắn Messenger Mới';
  const attachment = message.attachments?.some(item=>item.type==='image')?'Đã gửi một hình ảnh':'Đã gửi tệp đính kèm';
  const text=compact(message.message,240);
  const body=!text||/^\[(?:Đã nhận tệp đính kèm|Tệp đính kèm)\]$/i.test(text)?attachment:text;
  return {title,body};
}

function registerMessengerPush({db,onCall,HttpsError,requireSignedIn,MESSENGER_WEB_PUSH_VAPID,logger}){
  const vapid=()=>JSON.parse(MESSENGER_WEB_PUSH_VAPID.value());
  const callable=(options,handler)=>onCall({invoker:'public',...options},handler);
  const expiredError=()=>new HttpsError('failed-precondition','Đăng ký thông báo của trình duyệt đã hết hiệu lực.',{reason:'expired-push-subscription'});
  async function markExpired(ref,saved){
    await db.runTransaction(async tx=>{
      const current=(await tx.get(ref)).data();
      if(current?.ownerUid===saved.ownerUid&&current?.subscription?.endpoint===saved.subscription.endpoint){
        tx.set(ref,{status:'expired',expiredAt:new Date()});
      }
    });
  }
  const config=callable({secrets:[MESSENGER_WEB_PUSH_VAPID]},async request=>{
    await requireSignedIn(request);
    return {publicKey:vapid().publicKey};
  });
  const register=callable({},async request=>{
    const {uid}=await requireSignedIn(request);
    const replaces=request.data?.replaces;
    if(replaces!==undefined&&(typeof replaces!=='string'||!/^[a-f0-9]{64}$/.test(replaces)))throw new HttpsError('invalid-argument','Thiết bị cũ không hợp lệ.');
    let subscription;
    try{subscription=normalizeSubscription(request.data?.subscription);}
    catch(error){throw new HttpsError('invalid-argument',error.message);}
    const id=createHash('sha256').update(subscription.endpoint).digest('hex');
    const ref=db.collection(devices).doc(id);
    const oldRef=replaces&&replaces!==id?db.collection(devices).doc(replaces):null;
    const showPreview=await db.runTransaction(async tx=>{
      const [current,old]=await Promise.all([tx.get(ref),oldRef?tx.get(oldRef):undefined]);
      if(current.data()?.status==='expired')throw expiredError();
      const existing=await tx.get(db.collection(devices).where('ownerUid','==',uid).limit(maxDevices));
      const replaceOwnDevice=old?.data()?.ownerUid===uid;
      if(existing.size>=maxDevices&&current.data()?.ownerUid!==uid&&!replaceOwnDevice)throw new HttpsError('resource-exhausted','Tài khoản đã đạt giới hạn thiết bị nhận thông báo.');
      const previous=current.data();
      const preference=typeof request.data?.showPreview==='boolean'?request.data.showPreview:previous?.ownerUid===uid&&previous.showPreview===true;
      tx.set(ref,{ownerUid:uid,subscription,showPreview:preference,updatedAtMs:Date.now(),lastTestAtMs:previous?.ownerUid===uid?previous.lastTestAtMs||0:0});
      if(replaceOwnDevice)tx.delete(oldRef);
      return preference;
    });
    return {id,showPreview};
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
  const sendPush=(subscription,payload)=>webPush.sendNotification(normalizeSubscription(subscription),JSON.stringify(payload),{
    vapidDetails:{subject:'https://mediafbtq-6e1bb.web.app/',...vapid()},TTL:120,urgency:'high',timeout:8000
  });
  const testDevice=callable({secrets:[MESSENGER_WEB_PUSH_VAPID],timeoutSeconds:20},async request=>{
    const {uid}=await requireSignedIn(request),id=request.data?.id,testId=request.data?.testId;
    if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new HttpsError('invalid-argument','Thiết bị không hợp lệ.');
    if(testId!==undefined&&(typeof testId!=='string'||!/^[a-f0-9]{64}$/.test(testId)))throw new HttpsError('invalid-argument','Mã kiểm tra không hợp lệ.');
    const ref=db.collection(devices).doc(id),now=Date.now();
    const saved=await db.runTransaction(async tx=>{
      const device=(await tx.get(ref)).data();
      if(device?.status==='expired')throw expiredError();
      if(device?.ownerUid!==uid)throw new HttpsError('failed-precondition','Hãy bật lại thông báo trên thiết bị này.');
      if(now-(device.lastTestAtMs||0)<10000)throw new HttpsError('resource-exhausted','Vui lòng chờ 10 giây trước khi thử lại.');
      tx.update(ref,{lastTestAtMs:now});
      return device;
    });
    try{
      await sendPush(saved.subscription,{owner:uid,device:id,id:testId??randomBytes(32).toString('hex'),test:true});
    }catch(error){
      const status=Number(error.statusCode)||0;
      logger.warn('Messenger web push test failed',{status});
      if([404,410].includes(status)){
        await markExpired(ref,saved);
        throw expiredError();
      }
      throw new HttpsError('unavailable','Dịch vụ thông báo chưa nhận được yêu cầu thử.');
    }
    return {accepted:true};
  });
  const deliver=onDocumentWritten({document:'workspaces/fbtq/messages/{messageId}',secrets:[MESSENGER_WEB_PUSH_VAPID],retry:false,timeoutSeconds:30},async event=>{
    const before=event.data?.before.data(),message=event.data?.after.data();
    if(!shouldNotify(before,message))return;
    const uid=message.ownerUid;
    const subscriptions=await db.collection(devices).where('ownerUid','==',uid).limit(maxDevices).get();
    if(subscriptions.empty)return;
    const owner=await db.doc(`users/${uid}`).get();
    if(owner.data()?.approved!==true)return;
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
        const payload={owner:uid,device:doc.id,id:event.params.messageId,...(saved.showPreview===true?{preview:notificationPreview(message)}:{})};
        const result=await sendPush(saved.subscription,payload);
        logger.info?.('Messenger web push accepted',{status:result?.statusCode||0});
      }catch(error){
        if([404,410].includes(Number(error.statusCode))){
          logger.info?.('Messenger web push subscription expired',{status:Number(error.statusCode)});
          return markExpired(doc.ref,saved);
        }
        logger.warn('Messenger web push failed',{status:Number(error.statusCode)||0});
      }
    }));
  });
  return {getMessengerPushConfig:config,registerMessengerPushDevice:register,unregisterMessengerPushDevice:unregister,notifyMessengerIncoming:deliver,testMessengerPushDevice:testDevice};
}
module.exports={normalizeSubscription,shouldNotify,registerMessengerPush};
