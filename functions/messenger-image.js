const crypto=require('node:crypto'),core=require('./chatbot-core'),{messageKey}=require('./messenger-history');
function decodeImage(value,mime,max=4*1024*1024){
 if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||!value.length||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Ảnh không hợp lệ hoặc vượt quá 4 MB sau tối ưu.');
 const b=Buffer.from(value,'base64'),jpeg=b[0]===255&&b[1]===216&&b[2]===255,png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
 if(!b.length||b.length>max||!({'image/jpeg':jpeg,'image/png':png,'image/webp':webp})[mime])throw Error('Chỉ nhận ảnh JPG, PNG hoặc WebP hợp lệ.');return b;
}
async function sendPreparedImage({db,page,recipientId,bytes,mimeType,preview='',source='manual',token,graphUrl,HttpsError,FieldValue,fetchImage=fetch}){
 const thread=db.doc(`workspaces/fbtq/inbox/${core.key(page.pageId,recipientId)}`),snap=await thread.get();if(!page.active||!snap.exists||snap.data().ownerUid!==page.ownerUid||!core.eligible({...snap.data(),...(source==='manual'?{humanPaused:false}:{})}))throw new HttpsError('failed-precondition','Hội thoại ngoài 24 giờ, đã dừng nhận tin hoặc chuyển nhân viên.');
   const form=new FormData();form.set('recipient',JSON.stringify({id:recipientId}));form.set('messaging_type','RESPONSE');form.set('message',JSON.stringify({attachment:{type:'image',payload:{}}}));form.set('filedata',new Blob([bytes],{type:mimeType}),'image.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mimeType]);
   const response=await fetchImage(graphUrl(`${page.pageId}/messages`),{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form,signal:AbortSignal.timeout(60000)}),data=await response.json().catch(()=>null);
   if(!response.ok||!data?.message_id)throw new HttpsError('unavailable',`Meta chưa xác nhận gửi ảnh${Number(data?.error?.code)?' (mã '+Number(data.error.code)+')':''}. Kiểm tra quyền, token và hội thoại trước khi thử lại.`);
   const attachment={type:'image',url:'',...(preview?{preview}:{})},message={pageId:page.pageId,pageName:page.pageName,ownerUid:page.ownerUid,senderId:recipientId,conversationId:thread.id,direction:'outgoing',message:'[Hình ảnh]',attachments:[attachment],source,metaMessageId:data.message_id,createdAt:FieldValue.serverTimestamp()};
   // An echo can arrive first. Preserve the full Meta URL in that case.
   const ref=db.doc(`workspaces/fbtq/messages/${messageKey(thread.id,data.message_id)}`);await db.runTransaction(async tx=>{const old=await tx.get(ref);tx.set(ref,{...message,attachments:old.data()?.attachments?.some(a=>a.url)?old.data().attachments:[attachment]},{merge:true});});
   await thread.set({message:'[Hình ảnh]',direction:'outgoing',lastMessageAtMs:Date.now(),receivedAt:FieldValue.serverTimestamp()},{merge:true});return {ok:true,messageId:data.message_id};
}
function registerMessengerImage({db,onCall,HttpsError,owner,decryptToken,graphUrl,META_TOKEN_ENCRYPTION_KEY,FieldValue,fetchImage=fetch}){
 return onCall({invoker:'public',secrets:[META_TOKEN_ENCRYPTION_KEY],timeoutSeconds:90,memory:'512MiB'},async req=>{
  const {page}=await owner(req,req.data?.pageId),{recipientId,requestId,imageBase64,mimeType,previewBase64}=req.data||{};
  if(!/^\d{5,30}$/.test(recipientId||'')||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||''))throw new HttpsError('invalid-argument','Yêu cầu gửi ảnh không hợp lệ.');
  let bytes,preview;try{bytes=decodeImage(imageBase64,mimeType);if(previewBase64){decodeImage(previewBase64,'image/jpeg',40000);preview='data:image/jpeg;base64,'+previewBase64;}}catch(e){throw new HttpsError('invalid-argument',e.message);}
  const thread=db.doc(`workspaces/fbtq/inbox/${core.key(page.pageId,recipientId)}`),check=async()=>{const snap=await thread.get();if(!page.active||!snap.exists||snap.data().ownerUid!==page.ownerUid||!core.eligible({...snap.data(),humanPaused:false}))throw new HttpsError('failed-precondition','Hội thoại ngoài 24 giờ hoặc khách đã dừng nhận tin.');};await check();
  const job=db.doc(`chatbotJobs/${page.ownerUid}_${requestId}`);try{await job.create({status:'sending',kind:'image',createdAt:FieldValue.serverTimestamp()});}catch{throw new HttpsError('already-exists','Yêu cầu gửi ảnh đã được xử lý. Kiểm tra hội thoại trước khi gửi lại.');}
  try{
   const result=await sendPreparedImage({db,page,recipientId,bytes,mimeType,preview,token:decryptToken(page,META_TOKEN_ENCRYPTION_KEY.value()),graphUrl,HttpsError,FieldValue,fetchImage});await job.update({status:'sent'});return result;
  }catch(error){await job.update({status:'failed'});if(error instanceof HttpsError)throw error;throw new HttpsError('unavailable','Chưa xác nhận được ảnh đã gửi. Không tự gửi lại; kiểm tra hội thoại trước khi thử lại.');}
 });
}
module.exports={decodeImage,registerMessengerImage,sendPreparedImage};
