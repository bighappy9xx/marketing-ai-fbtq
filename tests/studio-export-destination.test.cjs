const {test}=require('node:test'),assert=require('node:assert/strict');
test('download opens picker immediately and does not use review temporary storage',async()=>{
 const {prepareExportDestination}=await import('../studio-export-destination.js');let clicked=false;
 const handle={};const pending=prepareExportDestination({kind:'download',name:'video.mp4',pickFile:options=>{clicked=true;assert.equal(options.suggestedName,'video.mp4');return Promise.resolve(handle);},getDirectory:()=>{throw Error('wrong route');}});
 assert.equal(clicked,true);const result=await pending;assert.equal(result.handle,handle);assert.equal(result.kind,'download');
});
test('Final uses private temporary storage without folder picker and releases it only on explicit cleanup',async()=>{
 const {prepareExportDestination}=await import('../studio-export-destination.js');let removed=0;
 const handle={},directory={getFileHandle:async(name,options)=>{assert.equal(name,'unique.mp4');assert.equal(options.create,true);return handle;},removeEntry:async name=>{assert.equal(name,'unique.mp4');removed++;}};
 const result=await prepareExportDestination({kind:'review',id:'unique',pickFile:()=>{throw Error('Final must not prompt download');},getDirectory:async()=>({getDirectoryHandle:async(name)=>{assert.equal(name,'fbtq-final-exports');return directory;}})});
 assert.equal(result.handle,handle);assert.equal(removed,0);await result.cleanup();await result.cleanup();assert.equal(removed,1);
});
test('unsupported destinations and denied picker do not silently download elsewhere',async()=>{
 const {prepareExportDestination}=await import('../studio-export-destination.js');
 assert.throws(()=>prepareExportDestination({kind:'unknown'}),/không hợp lệ/);
 assert.throws(()=>prepareExportDestination({kind:'review'}),/bộ nhớ tạm/);
 assert.throws(()=>prepareExportDestination({kind:'download'}),/Chrome/);
 await assert.rejects(prepareExportDestination({kind:'download',pickFile:async()=>{throw new DOMException('cancel','AbortError');}}),{name:'AbortError'});
});
test('2 GB Final limit matches metadata, Firestore and Storage rules while retaining ownership restrictions',async()=>{
 const {finalAttachment}=await import('../studio-final-review.js');const fs=require('node:fs'),path=require('node:path');
 const id='12345678-1234-4234-8234-123456789012',a={provider:'firebase-storage',ownerUid:'user',exportId:id,mime:'video/mp4',size:2*1024**3,path:`studioFinals/user/${id}/final.mp4`};
 assert.equal(finalAttachment(a,'user'),true);assert.equal(finalAttachment({...a,size:a.size+1},'user'),false);assert.equal(finalAttachment(a,'other'),false);
 for(const name of ['firestore.rules','storage.rules'])assert.match(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),/size <= 2147483648/);
});
test('Final handoff navigates to review, fills the form and defers upload until submit',async()=>{
 const {createFinalReviewBridge}=await import('../studio-final-review.js');const oldDocument=global.document;
 const nodes=new Map();class Element{constructor(){this.value='';this.firstChild={textContent:'Video'};this.small={textContent:'Help'};}querySelector(){return this.small;}closest(){return label;}append(){}remove(){}}
 const label=new Element();global.document={querySelector:s=>{if(s==='#studioFinalAttachment')return null;if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);},createElement:()=>new Element()};
 let released=0,uploads=0;const navigated=[];
 try{
  const bridge=createFinalReviewBridge({state:{user:{uid:'u'}},navigate:p=>navigated.push(p),toast:()=>{},onPreviewChanged:()=>{},loadStorage:async()=>{uploads++;throw Error('unexpected upload');}});
  const artifact={id:'12345678-1234-4234-8234-123456789012',ownerUid:'u',blob:new Blob(['video'],{type:'video/mp4'}),name:'Final.mp4',title:'Title',caption:'Caption',release:async()=>released++};
  await bridge.stage(artifact);assert.deepEqual(navigated,['content-review']);assert.equal(nodes.get('#contentReviewTitle').value,'Title');assert.equal(nodes.get('#contentReviewText').value,'Caption');assert.equal(nodes.get('#contentReviewVideoUrl').required,false);assert.equal(uploads,0);assert.equal(bridge.getPending(),artifact);assert.equal(released,0);
  bridge.clear();await Promise.resolve();assert.equal(released,1);assert.equal(bridge.hasPending(),false);
 }finally{global.document=oldDocument;}
});
