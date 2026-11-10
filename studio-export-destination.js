// Keep the save picker on the original click; review exports never ask for a folder.
export function prepareExportDestination({kind='download',name,pickFile,getDirectory,id}){
 if(kind==='download'){
  if(!pickFile)throw Error('Dùng Chrome/Edge máy tính để chọn thư mục lưu video.');
  return pickFile({suggestedName:name,types:[{description:'Video MP4',accept:{'video/mp4':['.mp4']}}]}).then(handle=>({kind,handle,cleanup:async()=>{}}));
 }
 if(kind!=='review')throw Error('Đích xuất không hợp lệ.');
 if(!getDirectory)throw Error('Trình duyệt chưa hỗ trợ bộ nhớ tạm cho bản Final. Dùng Chrome/Edge máy tính.');
 return(async()=>{
  const root=await getDirectory(),directory=await root.getDirectoryHandle('fbtq-final-exports',{create:true});
  const filename=id+'.mp4',handle=await directory.getFileHandle(filename,{create:true});let removed=false;
  return{kind,handle,cleanup:async()=>{if(removed)return;await directory.removeEntry(filename);removed=true;}};
 })();
}
