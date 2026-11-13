const {test}=require('node:test'),assert=require('node:assert/strict');
async function fixture(){
 const {createMemberAdmin}=await import('../member-admin.js'),records=new Map(),changes=[];let admin=true;
 const state={user:{uid:'director'},users:[{uid:'director',email:'director@test.vn',role:'director'},{uid:'staff',email:'staff@test.vn',role:'employee',approved:false}]};
 for(const user of state.users)records.set('users/'+user.uid,{...user});
 const s={doc:(_, ...parts)=>parts.join('/'),collection:(_, ...parts)=>parts.join('/'),serverTimestamp:()=>({seconds:1}),
  setDoc:async(ref,data)=>records.set(ref,{...data}),getDocs:async ref=>({docs:[...records].filter(([key])=>key.startsWith(ref+'/')).map(([key,value])=>({id:key.split('/').at(-1),data:()=>({...value})}))}),
  runTransaction:async(_,work)=>{const writes=[];await work({get:async ref=>({exists:()=>records.has(ref),data:()=>({...records.get(ref)})}),update:(ref,data)=>writes.push([ref,data])});for(const [ref,data] of writes)records.set(ref,{...records.get(ref),...data});}
 };state.firebase={db:{},storeMod:s};return{state,records,changes,admin:value=>admin=value,service:createMemberAdmin({getState:()=>state,isDirector:()=>admin,onChange:()=>changes.push(1)})};
}
test('invites normalize email, persist intended units and build an unprivileged registration link',async()=>{
 const f=await fixture(),invite=await f.service.createInvite({email:' Staff@Test.VN ',role:'department_manager',department:'Marketing',branch:'Hà Nội'});
 assert.equal(invite.email,'staff@test.vn');assert.equal(invite.status,'invited');assert.equal((await f.service.listInvites()).length,1);
 const {registrationLink}=await import('../member-admin.js'),url=new URL(registrationLink('https://website.test/app/?old=value#people',invite));assert.equal(url.pathname,'/app/');assert.equal(url.searchParams.get('email'),'staff@test.vn');assert.equal(url.searchParams.get('role'),null);assert.equal(url.hash,'');assert.equal(f.records.get('users/staff').role,'employee');
});
test('only directors can mutate membership; invalid roles and self-demotion are rejected',async()=>{
 const f=await fixture();f.admin(false);await assert.rejects(f.service.createInvite({email:'x@y.vn',role:'director'}),/Giám đốc/);await assert.rejects(f.service.editMember('staff',{role:'director'}),/Giám đốc/);
 f.admin(true);await assert.rejects(f.service.createInvite({email:'invalid',role:'employee'}),/email/);await assert.rejects(f.service.editMember('staff',{role:'invented'}),/Vai trò/);await assert.rejects(f.service.editMember('director',{role:'employee'}),/tự hạ quyền/);assert.equal(f.records.get('users/staff').role,'employee');
});
test('direct role edits preserve activation and update local rows after a committed write',async()=>{
 const f=await fixture();await f.service.editMember('staff',{role:'accountant',branch:'Huế',department:'Kế toán'});assert.equal(f.records.get('users/staff').role,'accountant');assert.equal(f.records.get('users/staff').approved,false);assert.equal(f.state.users[1].branch,'Huế');assert.equal(f.changes.length,1);
});
test('granting an invitation is atomic, matches the registered email, detects edits and cannot be replayed',async()=>{
 const f=await fixture(),invite=await f.service.createInvite({email:'staff@test.vn',role:'department_manager',branch:'Hà Nội'});
 await assert.rejects(f.service.applyInvite(invite,'director'),/tự hạ quyền/);
 const path='workspaces/fbtq/invitations/'+invite.id;f.records.get(path).role='director';await assert.rejects(f.service.applyInvite(invite,'staff'),/thay đổi/);assert.equal(f.records.get('users/staff').role,'employee');
 f.records.get(path).role=invite.role;await f.service.applyInvite(invite,'staff');assert.equal(f.records.get('users/staff').role,'department_manager');assert.equal(f.records.get('users/staff').approved,true);assert.equal(f.records.get(path).status,'applied');await assert.rejects(f.service.applyInvite(invite,'staff'),/thay đổi/);
});
test('revoked invites cannot grant permissions and account changes discard pending mutations',async()=>{
 const f=await fixture(),invite=await f.service.createInvite({email:'staff@test.vn',role:'accountant'});await f.service.revokeInvite(invite);await assert.rejects(f.service.applyInvite(invite,'staff'),/thu hồi/);
 f.state.firebase.storeMod.runTransaction=async(_,work)=>{f.state.user={uid:'other'};await work({get:async ref=>({exists:()=>true,data:()=>f.records.get(ref)}),update:()=>assert.fail('must not write')});};await assert.rejects(f.service.editMember('staff',{role:'director'}),/thay đổi/);
});
