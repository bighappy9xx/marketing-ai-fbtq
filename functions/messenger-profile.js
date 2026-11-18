const core=require('./chatbot-core');
function profileFields(data){
 const senderName=[data?.first_name,data?.last_name].filter(s=>typeof s==='string').join(' ').trim().slice(0,160),patch={};
 if(senderName)patch.senderName=senderName;
 try{const url=new URL(data?.profile_pic);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.searchParams.has('access_token'))patch.senderPhotoUrl=url.href.slice(0,3000);}catch{}
 return patch;
}
function resultStatus(thread){return thread?.profileStatus|| (thread?.senderPhotoUrl?'ready':'missing');}
async function enrichProfile({db,page,peerId,graph,token,now=Date.now(),force=false}){
 const ref=db.doc(`workspaces/fbtq/inbox/${core.key(page.pageId,peerId)}`);let skip=null;
 // Reserve the attempt so concurrent webhook/sync/browser requests cannot hammer Meta.
 await db.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.data();if(!old||old.ownerUid!==page.ownerUid){skip={status:'missing'};return;}const checked=Number(old.profileCheckedAtMs)||0,retry=Number(old.profileRetryAtMs)||(checked+(old.senderPhotoUrl?86400000:300000));if((!force&&now<retry)||(force&&checked&&now-checked<60000)||old.profileLockUntil>now){skip={status:resultStatus(old),cached:true};return;}tx.update(ref,{profileCheckedAtMs:now,profileLockUntil:now+90000});});
 if(skip)return skip;
 let fields={},error=null;try{fields=profileFields(await graph(`${peerId}?fields=first_name,last_name,profile_pic`,token));}catch(e){error=e;}
 // Permission for names must not prevent fetching a profile picture that Meta allows.
 if(!fields.senderPhotoUrl){try{Object.assign(fields,profileFields(await graph(`${peerId}?fields=profile_pic`,token)));error=null;}catch(e){error=e;}}
 const restricted=['permission-denied','failed-precondition'].includes(error?.code),status=fields.senderPhotoUrl?'ready':restricted?'restricted':error?'unavailable':'missing';
 await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.exists&&current.data().ownerUid===page.ownerUid)tx.update(ref,{...fields,profileStatus:status,profileCheckedAtMs:now,profileRetryAtMs:now+(status==='ready'?86400000:status==='restricted'?900000:300000),profileLockUntil:0});});
 return {status,cached:false};
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
