const core=require('./chatbot-core');
function profileFields(data){
 const senderName=[data?.first_name,data?.last_name].filter(s=>typeof s==='string').join(' ').trim().slice(0,160),patch={};
 if(senderName)patch.senderName=senderName;
 try{const url=new URL(data?.profile_pic);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.searchParams.has('access_token'))patch.senderPhotoUrl=url.href.slice(0,3000);}catch{}
 return patch;
}
async function enrichProfile({db,page,peerId,graph,token,now=Date.now()}){
 const ref=db.doc(`workspaces/fbtq/inbox/${core.key(page.pageId,peerId)}`),snap=await ref.get(),old=snap.data();
 if(!old||old.ownerUid!==page.ownerUid||now-(old.profileCheckedAtMs||0)<86400000)return;
 // A profile permission failure must never fail or delay storing a message.
 let fields={};try{fields=profileFields(await graph(`${peerId}?fields=first_name,last_name,profile_pic`,token));}catch{}
 // Do not recreate a thread removed while Meta was responding.
 await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.exists&&current.data().ownerUid===page.ownerUid)tx.update(ref,{...fields,profileCheckedAtMs:now});});
}
module.exports={enrichProfile,profileFields};
