const {test}=require('node:test'),assert=require('node:assert/strict');
const {metadataPatch,registerThreadMetadata}=require('../functions/messenger-thread-metadata');
test('metadata updates accept only real filter fields and owner-scoped threads',async()=>{
 const id='a'.repeat(64),thread={ownerUid:'owner',pageId:'123456'},ref={};let saved;
 const db={doc:()=>ref,runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>thread}),update:(_,patch)=>{saved=patch;Object.assign(thread,patch);}})},HttpsError=class extends Error{constructor(code,message){super(message);this.code=code;}};
 const call=registerThreadMetadata({db,onCall:(_,fn)=>fn,HttpsError,owner:async req=>{if(req.auth.uid!=='owner')throw new HttpsError('permission-denied','owner');return {page:{ownerUid:'owner',pageId:'123456'}};}});
 const request=patch=>({auth:{uid:'owner'},data:{pageId:'123456',threadId:id,patch}});
 await call(request({unread:true,needsReply:false,orderCreated:true,starred:true,phone:'0901 234 567',rating:5}));assert.equal(saved.rating,5);assert.equal(saved.needsReply,false);
 for(const patch of [{ownerUid:'evil'},{phone:'..........'},{rating:6},{unread:'yes'},{aiProcessing:true},{}])assert.throws(()=>metadataPatch(patch));
 await assert.rejects(call({...request({rating:4}),auth:{uid:'other'}}),e=>e.code==='permission-denied');thread.ownerUid='other';await assert.rejects(call(request({rating:4})),e=>e.code==='permission-denied');assert.equal(saved.rating,5);
});
