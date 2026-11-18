export async function downloadAllHistory({pageId,callFunction,load,save,onProgress,isStopped}){
 let job=load()||{pageId,cursor:'',queue:[],stage:'pages',imported:0,conversations:0};if(job.done)job={pageId,cursor:'',queue:[],stage:'pages',imported:0,conversations:0};
 const seen=new Set();
 while(!isStopped()){
  const marker=JSON.stringify([job.stage,job.cursor,job.queue[0]||'']);if(job.stage==='pages'&&seen.has(marker))throw Error('Meta lặp lại trang lịch sử. Tiến trình đã lưu; thử tiếp tục sau.');
  if(job.stage==='pages'){seen.add(marker);const result=await callFunction('syncFacebookInbox',{pageId,...(job.cursor?{cursor:job.cursor}:{})},{timeout:125000});if(isStopped())return {stopped:true};if(result.errors?.length)throw Error(result.errors.join(' '));job.imported+=Number(result.imported)||0;job.conversations+=Number(result.conversations)||0;job.queue=(result.historyThreads||[]).filter(t=>t.hasMore).map(t=>t.threadId);job.cursor=result.nextCursor||'';job.stage='threads';}
  else if(job.queue.length){const id=job.queue[0],result=await callFunction('syncFacebookInbox',{pageId,threadId:id},{timeout:125000});if(isStopped())return {stopped:true};if(result.errors?.length)throw Error(result.errors.join(' '));job.imported+=Number(result.imported)||0;if(!result.hasMore)job.queue.shift();}
  else if(job.cursor){job.stage='pages';}
  else{job.done=true;save(job);onProgress(job);return job;}
  save(job);onProgress(job);
 }
 return {stopped:true};
}
