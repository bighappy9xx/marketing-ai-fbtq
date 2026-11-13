export const MEMBER_ROLES=['employee','accountant','department_manager','branch_manager','director'];
export function memberFields(data){
 const email=String(data.email||'').trim().toLowerCase(),role=data.role,department=String(data.department||'').trim(),branch=String(data.branch||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Nhập email hợp lệ.');
 if(!MEMBER_ROLES.includes(role))throw Error('Vai trò không hợp lệ.');
 if(department.length>100||branch.length>100)throw Error('Phòng ban và chi nhánh tối đa 100 ký tự.');
 return {email,role,department,branch};
}
export function registrationLink(href,invite){
 const url=new URL(href);url.search='';url.hash='';url.searchParams.set('invite',invite.id);url.searchParams.set('email',invite.email);return url.href;
}
export function createMemberAdmin({getState,isDirector,onChange=()=>{}}){
 function session(){const state=getState();if(!isDirector()||!state.user?.uid||!state.firebase)throw Error('Đăng nhập bằng tài khoản Giám đốc để quản lý thành viên.');return {actor:state.user.uid,...state.firebase};}
 function guard(actor){if(getState().user?.uid!==actor||!isDirector())throw Error('Tài khoản hoặc quyền đã thay đổi. Hãy tải lại.');}
 async function createInvite(data){const fields=memberFields(data),{actor,db,storeMod:s}=session(),id=crypto.randomUUID(),invite={...fields,id,status:'invited',createdBy:actor,createdAt:s.serverTimestamp()};
  await s.setDoc(s.doc(db,'workspaces','fbtq','invitations',id),invite);guard(actor);return invite;
 }
 async function listInvites(){const {actor,db,storeMod:s}=session(),snap=await s.getDocs(s.collection(db,'workspaces','fbtq','invitations'));guard(actor);return snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));}
 async function editMember(uid,data){
  const state=getState(),member=state.users.find(u=>u.uid===uid);if(!member)throw Error('Chọn thành viên trong danh sách đã tải.');
  const fields=memberFields({...data,email:member.email}),{actor,db,storeMod:s}=session();
  if(uid===actor&&fields.role!=='director')throw Error('Không thể tự hạ quyền Giám đốc của phiên đang đăng nhập.');
  const ref=s.doc(db,'users',uid);
  await s.runTransaction(db,async tx=>{const snap=await tx.get(ref);guard(actor);if(!snap.exists())throw Error('Tài khoản không còn tồn tại. Tải lại danh sách.');if(String(snap.data().email||'').toLowerCase()!==fields.email)throw Error('Email tài khoản đã thay đổi. Tải lại danh sách.');tx.update(ref,{role:fields.role,department:fields.department,branch:fields.branch,updatedAt:s.serverTimestamp(),updatedBy:actor});});
  guard(actor);state.users=state.users.map(u=>u.uid===uid?{...u,role:fields.role,department:fields.department,branch:fields.branch}:u);
  if(state.user.uid===uid)Object.assign(state.user,{department:fields.department,branch:fields.branch});onChange();
 }
 async function revokeInvite(invite){const {actor,db,storeMod:s}=session();await s.runTransaction(db,async tx=>{const ref=s.doc(db,'workspaces','fbtq','invitations',invite.id),snap=await tx.get(ref);guard(actor);if(!snap.exists()||snap.data().status!=='invited')throw Error('Lời mời không còn chờ xử lý. Tải lại danh sách.');tx.update(ref,{status:'revoked',updatedBy:actor,updatedAt:s.serverTimestamp()});});guard(actor);}
 async function applyInvite(invite,uid){
  const fields=memberFields(invite),{actor,db,storeMod:s}=session();if(uid===actor&&fields.role!=='director')throw Error('Không thể dùng lời mời để tự hạ quyền Giám đốc.');
  await s.runTransaction(db,async tx=>{
   const invitation=s.doc(db,'workspaces','fbtq','invitations',invite.id),user=s.doc(db,'users',uid),a=await tx.get(invitation),b=await tx.get(user);guard(actor);
   if(!a.exists()||a.data().status!=='invited'||JSON.stringify(memberFields(a.data()))!==JSON.stringify(fields))throw Error('Lời mời đã thay đổi hoặc bị thu hồi. Tải lại danh sách trước khi cấp quyền.');
   if(!b.exists()||String(b.data().email||'').trim().toLowerCase()!==fields.email)throw Error('Tài khoản đăng ký không khớp email lời mời.');
   tx.update(user,{role:fields.role,department:fields.department,branch:fields.branch,approved:true,updatedBy:actor,updatedAt:s.serverTimestamp()});
   tx.update(invitation,{status:'applied',memberUid:uid,updatedBy:actor,updatedAt:s.serverTimestamp()});
  });guard(actor);const state=getState();state.users=state.users.map(u=>u.uid===uid?{...u,...fields,approved:true}:u);onChange();
 }
 return {createInvite,listInvites,editMember,revokeInvite,applyInvite};
}
