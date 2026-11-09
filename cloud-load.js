// A failed optional collection must not prevent other collections from loading.
export async function loadIndependentCollections({reads,state,uid,onError=()=>{}}){
  const results=await Promise.allSettled(reads.map(read=>Promise.resolve().then(read.load)));
  if(state.user?.uid!==uid)return {stale:true,errors:[]};
  const errors=[];
  results.forEach((result,index)=>{
    const read=reads[index];
    if(result.status==='fulfilled'){
      state[read.key]=result.value.docs.map(doc=>({...doc.data(),[read.idField||'id']:doc.id}));
      if(read.key==='users'){state.usersLoadError='';state.usersLoaded=true;}
    }else{
      const error={key:read.key,code:result.reason?.code||'unavailable',message:result.reason?.message||'Không tải được dữ liệu.'};
      errors.push(error);if(read.key==='users')state.usersLoadError=error.code;onError(error);
    }
  });
  return {stale:false,errors};
}
