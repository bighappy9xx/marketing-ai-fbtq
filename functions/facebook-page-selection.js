function publicSelection(data,id,uid,now=Date.now()){
 if(!data||data.ownerUid!==uid||data.status!=='ready'||!Number.isFinite(data.expiresAtMs)||data.expiresAtMs<=now)return null;
 return {sessionId:id,expiresAtMs:data.expiresAtMs,pages:(data.candidates||[]).filter(p=>/^\d{5,30}$/.test(p.pageId)).map(p=>({pageId:p.pageId,pageName:String(p.pageName||p.pageId).slice(0,160),pagePhotoUrl:require('./messenger-profile').profileFields({profile_pic:p.pagePhotoUrl}).senderPhotoUrl||''}))};
}
async function findPageSelection(db,uid,sessionId,now=Date.now()){
 if(sessionId){const snap=await db.doc('metaOAuthSessions/'+sessionId).get();const result=publicSelection(snap.data(),sessionId,uid,now);if(result)return result;}
 const snapshot=await db.collection('metaOAuthSessions').where('ownerUid','==',uid).limit(100).get();
 return snapshot.docs.map(doc=>publicSelection(doc.data(),doc.id,uid,now)).filter(Boolean).sort((a,b)=>b.expiresAtMs-a.expiresAtMs)[0]||{sessionId:null,pages:[]};
}
module.exports={publicSelection,findPageSelection};
