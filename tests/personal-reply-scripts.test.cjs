const {test}=require('node:test');
const assert=require('node:assert/strict');
const {registerPersonalScripts}=require('../functions/personal-reply-scripts');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}

test('personal replies are read, edited and deleted only under the authenticated owner',async()=>{
  const documents=new Map();
  const db={doc:path=>({path,get:async()=>({data:()=>structuredClone(documents.get(path))})})};
  db.runTransaction=callback=>callback({get:ref=>ref.get(),set:(ref,data)=>documents.set(ref.path,structuredClone(data))});
  const api=registerPersonalScripts({db,onCall:(_,fn)=>fn,HttpsError,requireSignedIn:async ({auth})=>auth});
  const call=(uid,data,approved=true)=>api({auth:{uid,profile:{approved,role:'employee'}},data});
  const entry={title:'Giờ mở cửa',text:'Mở từ 8 giờ.'};
  const {scripts:[saved]}=await call('a',{action:'save',script:entry});
  assert.equal(saved.title,entry.title);
  assert.deepEqual((await call('b',{action:'list',uid:'a'})).scripts,[]);
  await assert.rejects(call('b',{action:'save',id:saved.id,script:entry}),{code:'not-found'});
  await assert.rejects(call('b',{action:'delete',id:saved.id}),{code:'not-found'});
  await assert.rejects(call('a',{action:'list'},false),{code:'permission-denied'});
  await assert.rejects(call('a',{action:'save',script:{...entry,image:'https://example.test/fake.png'}}),{code:'invalid-argument'});
  const edited=await call('a',{action:'save',id:saved.id,script:{...entry,text:'Mở từ 9 giờ.'}});
  assert.equal(edited.scripts[0].text,'Mở từ 9 giờ.');
  assert.deepEqual((await call('a',{action:'delete',id:saved.id})).scripts,[]);
});
