const crypto=require('node:crypto');
// A per-user gate prevents parallel paid requests and caps calls on the server.
module.exports.createAIUsageGate=({db,HttpsError,now=Date.now})=>async(uid,kind,limit,work)=>{
 const ref=db.doc(`openaiUsage/${uid}_${kind}`),jobId=crypto.randomUUID(),stamp=now();
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(stamp));
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref),old=snap.exists?snap.data():{},count=old.day===day?Number(old.count)||0:0;
  if(old.lockUntil>stamp)throw new HttpsError('resource-exhausted','Một yêu cầu AI cùng loại đang chạy. Đợi hoàn thành rồi thử lại.');
  if(count>=limit)throw new HttpsError('resource-exhausted',`Đã đạt ${limit} lượt ${kind} trong ngày. Hạn mức được đặt trên máy chủ để kiểm soát chi phí.`);
  tx.set(ref,{day,count:count+1,jobId,lockUntil:stamp+100000});
 });
 try{return await work();}finally{
  await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data().jobId===jobId)tx.update(ref,{lockUntil:0});}).catch(()=>{});
 }
};
