const flags=['unread','needsReply','orderCreated','starred'];
function metadataPatch(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Object.keys(value).length||Object.keys(value).some(k=>![...flags,'phone','rating'].includes(k)))throw Error('Thông tin lọc không hợp lệ.');
 const patch={};for(const [key,v]of Object.entries(value)){if(flags.includes(key)){if(typeof v!=='boolean')throw Error('Trạng thái cần là bật hoặc tắt.');patch[key]=v;}else if(key==='rating'){if(!Number.isInteger(v)||v<0||v>5)throw Error('Đánh giá cần từ 0 đến 5 sao.');patch.rating=v;}else{if(typeof v!=='string'||v.length>30||v&&(!/^\+?[\d\s().-]{8,30}$/.test(v)||v.replace(/\D/g,'').length<8||v.replace(/\D/g,'').length>15))throw Error('Số điện thoại không hợp lệ.');patch.phone=v.trim();}}
 return patch;
}
function registerThreadMetadata({db,onCall,HttpsError,owner}){return onCall({},async req=>{const {page}=await owner(req,req.data?.pageId),id=req.data?.threadId;if(!/^[a-f0-9]{64}$/.test(id||''))throw new HttpsError('invalid-argument','Hội thoại không hợp lệ.');let patch;try{patch=metadataPatch(req.data?.patch);}catch(e){throw new HttpsError('invalid-argument',e.message);}const ref=db.doc(`workspaces/fbtq/inbox/${id}`);await db.runTransaction(async tx=>{const snap=await tx.get(ref),t=snap.data();if(!snap.exists||t.ownerUid!==page.ownerUid||t.pageId!==page.pageId)throw new HttpsError('permission-denied','Không có quyền sửa hội thoại.');tx.update(ref,patch);});return {ok:true,patch};});}
module.exports={metadataPatch,registerThreadMetadata};
