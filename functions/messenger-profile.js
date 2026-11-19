const core=require('./chatbot-core');
const cleanName=name=>typeof name==='string'?name.trim().slice(0,160):'';
function profileFields(data){
 const senderName=cleanName(data?.name)||cleanName([data?.first_name,data?.last_name].filter(s=>typeof s==='string').join(' ')),patch={};
 if(senderName)patch.senderName=senderName;
 try{const url=new URL(data?.profile_pic);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.searchParams.has('access_token'))patch.senderPhotoUrl=url.href.slice(0,3000);}catch{}
 return patch;
}
function conversationIdentity(data,peerId){
 const rows=Array.isArray(data?.data)?data.data:[];
 for(const row of rows){
  const participant=row.participants?.data?.find(p=>String(p.id)===peerId);
  const name=cleanName(participant?.name);
  if(name)return {senderName:name,profileNameSource:'conversation'};
 }
 return {};
}
function resultStatus(thread){return thread?.profileStatus|| (thread?.senderPhotoUrl?'ready':'missing');}
async function enrichProfile({db,page,peerId,graph,token,now=Date.now(),force=false}){
 const ref=db.doc(`workspaces/fbtq/inbox/${core.key(page.pageId,peerId)}`);
 // Reserve the attempt so concurrent webhook/sync/browser requests cannot hammer Meta.
 const canProceed=await db.runTransaction(async tx=>{
  const old=(await tx.get(ref)).data();
  if(!old||old.ownerUid!==page.ownerUid)return {status:'missing'};
  const checked=Number(old.profileCheckedAtMs)||0,retry=Number(old.profileRetryAtMs)||(checked+(old.senderPhotoUrl?86400000:300000));
  if((!force&&now<retry)||(force&&checked&&now-checked<60000)||old.profileLockUntil>now)return {status:resultStatus(old),cached:true};
  tx.update(ref,{profileCheckedAtMs:now,profileLockUntil:now+90000});
  return {lookupName:!old.senderName||old.profileNameSource!=='conversation'||now-(old.profileNameCheckedAtMs||0)>=86400000};
 });
 if(!Object.hasOwn(canProceed,'lookupName'))return canProceed;
 const nameLookup=canProceed.lookupName?Promise.resolve().then(()=>graph(`${page.pageId}/conversations?${new URLSearchParams({platform:'messenger',user_id:peerId,fields:'id,participants',limit:'5'})}`,token))
  .then(data=>conversationIdentity(data,peerId)).catch(()=>({})):Promise.resolve({});
 let fields={},error=null;try{fields=profileFields(await graph(`${peerId}?fields=first_name,last_name,profile_pic`,token));}catch(e){error=e;}
 // Permission for names must not prevent fetching a profile picture that Meta allows.
 if(!fields.senderPhotoUrl&&error?.details?.reason!=='messenger-profile-restricted'){try{Object.assign(fields,profileFields(await graph(`${peerId}?fields=profile_pic`,token)));error=null;}catch(e){error=e;}}
 const identity=await nameLookup;
 const restricted=['permission-denied','failed-precondition'].includes(error?.code),status=fields.senderPhotoUrl?'ready':restricted?'restricted':error?'unavailable':'missing';
 const nameUpdated=await db.runTransaction(async tx=>{
  const current=(await tx.get(ref)).data();
  if(!current||current.ownerUid!==page.ownerUid)return false;
  const patch={...fields,...identity,profileStatus:status,profileCheckedAtMs:now,profileRetryAtMs:now+(status==='ready'?86400000:status==='restricted'?900000:300000),profileLockUntil:0};
  if(identity.senderName)patch.profileNameCheckedAtMs=now;
  else if(current.profileNameSource==='conversation')delete patch.senderName;
  tx.update(ref,patch);
  return !!patch.senderName&&patch.senderName!==current.senderName;
 });
 return {status,cached:false,nameUpdated};
}
function registerProfileRefresh({db,onCall,HttpsError,owner,graph,decryptToken,META_TOKEN_ENCRYPTION_KEY}){
 return onCall({invoker:'public',secrets:[META_TOKEN_ENCRYPTION_KEY],timeoutSeconds:120,memory:'256MiB'},async req=>{
  const {page}=await owner(req,req.data?.pageId),ids=req.data?.threadIds;if(!Array.isArray(ids)||!ids.length||ids.length>10||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)))throw new HttpsError('invalid-argument','Chọn tối đa 10 hội thoại hợp lệ.');
  const threads=[];for(const id of new Set(ids)){const snap=await db.doc(`workspaces/fbtq/inbox/${id}`).get(),t=snap.data();if(!t||t.ownerUid!==page.ownerUid||t.pageId!==page.pageId||id!==core.key(page.pageId,t.senderId))throw new HttpsError('permission-denied','Hội thoại không thuộc Fanpage này.');threads.push(t);}
  const token=decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()),results=[];for(let i=0;i<threads.length;i+=5){results.push(...await Promise.all(threads.slice(i,i+5).map(async t=>({threadId:core.key(page.pageId,t.senderId),...await enrichProfile({db,page,peerId:t.senderId,graph,token,force:true})}))));}
  return {results};
 });
}
module.exports={enrichProfile,profileFields,registerProfileRefresh};
