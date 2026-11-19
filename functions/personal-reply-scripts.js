const {randomUUID}=require('node:crypto');
const {decodeImage}=require('./messenger-image');
const {requireAIAccount}=require('./ai-policy');

const scriptsRef=(db,uid)=>db.doc('privateReplyScripts/'+uid);
function cleanImage(value,max){
  if(value===undefined||value==='')return '';
  if(typeof value!=='string'||!value.startsWith('data:image/jpeg;base64,'))throw Error('Ảnh kịch bản phải có định dạng JPEG.');
  decodeImage(value.slice(23),'image/jpeg',max);
  return value;
}
function validateScript(input){
  const title=typeof input?.title==='string'?input.title.trim():'';
  const text=typeof input?.text==='string'?input.text.trim():'';
  if(!title||title.length>120||!text||text.length>2000)throw Error('Nhập tên tối đa 120 ký tự và nội dung từ 1 đến 2.000 ký tự.');
  const image=cleanImage(input.image,150000);
  const imagePreview=image?cleanImage(input.imagePreview,40000):'';
  return {title,text,image,imagePreview};
}

async function readPersonalScripts(db,uid){
  return (await scriptsRef(db,uid).get()).data()?.scripts||[];
}

function registerPersonalScripts({db,onCall,HttpsError,requireSignedIn}){
  return onCall({invoker:'public'},async request=>{
    const auth=await requireSignedIn(request);
    requireAIAccount(auth,HttpsError);
    const {action,id,script}=request.data||{};
    if(action==='list')return {scripts:await readPersonalScripts(db,auth.uid)};
    if(!['save','delete'].includes(action)||((id!==undefined||action==='delete')&&!/^[a-f0-9-]{36}$/.test(id||''))){
      throw new HttpsError('invalid-argument','Thao tác kịch bản không hợp lệ.');
    }
    let entry;
    if(action==='save'){
      try{entry=validateScript(script);}catch(error){throw new HttpsError('invalid-argument',error.message);}
    }
    const ref=scriptsRef(db,auth.uid);
    const scripts=await db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);
      const rows=snapshot.data()?.scripts||[];
      const index=id===undefined?-1:rows.findIndex(row=>row.id===id);
      if(id!==undefined&&index<0)throw new HttpsError('not-found','Kịch bản không tồn tại trong tài khoản này.');
      if(action==='delete')rows.splice(index,1);
      else if(index>=0)rows[index]={id,...entry};
      else rows.push({id:randomUUID(),...entry});
      if(rows.length>30||Buffer.byteLength(JSON.stringify(rows))>650000){
        throw new HttpsError('resource-exhausted','Mỗi tài khoản có tối đa 30 kịch bản. Hãy giảm tổng dung lượng ảnh nếu danh sách quá lớn.');
      }
      transaction.set(ref,{scripts:rows});
      return rows;
    });
    return {scripts};
  });
}

module.exports={readPersonalScripts,registerPersonalScripts};
