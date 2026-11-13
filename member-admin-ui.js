import {createMemberAdmin,registrationLink} from './member-admin.js?v=20261113-members';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initMemberAdminUI({state,isDirector,roles,openModal,closeModal,notify,onChange,onOpenDirectory}){
 const service=createMemberAdmin({getState:()=>state,isDirector,onChange}),q=s=>document.querySelector(s);
 const roleOptions=selected=>Object.entries(roles).map(([key,label])=>`<option value="${key}"${selected===key?' selected':''}>${esc(label)}</option>`).join('');
 const fields=member=>`<label>Vai trò<select name="role" required>${roleOptions(member?.role||'employee')}</select></label><label>Phòng ban<input name="department" maxlength="100" value="${esc(member?.department)}" placeholder="Ví dụ: Marketing"></label><label>Chi nhánh / trụ sở<input name="branch" maxlength="100" value="${esc(member?.branch||member?.branchName||member?.branchId)}" placeholder="Ví dụ: Hà Nội, Trụ sở chính"></label>`;
 const allow=()=>{if(isDirector()&&state.firebase)return true;notify('Đăng nhập bằng tài khoản Giám đốc để mời và phân quyền.','error');return false;};
 function editor(uid=''){
  if(!allow())return;
  const member=uid?state.users.find(u=>u.uid===uid):null;if(uid&&!member)return notify('Tải lại danh sách thành viên trước khi sửa.','error');
  const choice=member?`<p><b>${esc(member.name||member.email)}</b><br>${esc(member.email||'')}</p><input type="hidden" name="uidOrEmail" value="${esc(uid)}">`:`<label>Thành viên<select name="uidOrEmail" id="memberRoleChoice" required><option value="">Chọn thành viên…</option>${state.users.map(u=>`<option value="${esc(u.uid)}">${esc(u.name||u.email)} · ${esc(u.email||u.uid)}</option>`).join('')}</select></label>`;
  openModal('Sửa quyền & đơn vị thành viên',`<p>Chọn thành viên và vai trò ngay trên website. Quyền được lưu sau khi bấm xác nhận; thành viên tải lại hoặc đăng nhập lại để cập nhật giao diện.</p><div class="modal-fields">${choice}${fields(member)}</div>`,'Lưu quyền',async f=>{await service.editMember(f.get('uidOrEmail'),{role:f.get('role'),department:f.get('department'),branch:f.get('branch')});closeModal();notify('Đã lưu vai trò, phòng ban và chi nhánh.');});
  q('#memberRoleChoice')?.addEventListener('change',e=>{const m=state.users.find(u=>u.uid===e.target.value),form=q('#activeModalForm');form.elements.role.value=m?.role||'employee';form.elements.department.value=m?.department||'';form.elements.branch.value=m?.branch||m?.branchName||m?.branchId||'';});
 }
 function showLink(invite){
  const link=registrationLink(location.href,invite);
  openModal('Liên kết mời thành viên',`<p>Đã lưu lời mời cho <b>${esc(invite.email)}</b> · ${esc(roles[invite.role])}.</p><label class="member-invite-link">Liên kết đăng ký<input id="memberInvitationLink" type="text" readonly value="${esc(link)}"></label><button type="button" class="btn btn-primary" id="copyMemberInvitation">Sao chép liên kết</button><p id="memberInvitationCopyStatus" role="status"></p><p class="muted">Chia sẻ liên kết này cho thành viên. Website chưa gửi email tự động. Người nhận tự đăng ký mật khẩu; sau đó Giám đốc mở Danh sách lời mời để xác nhận cấp quyền. Link không tự cấp vai trò.</p>`,'');
  q('#copyMemberInvitation').onclick=async()=>{try{await navigator.clipboard.writeText(link);q('#memberInvitationCopyStatus').textContent='Đã sao chép liên kết.';}catch{q('#memberInvitationLink').select();q('#memberInvitationCopyStatus').textContent='Chọn và sao chép liên kết phía trên.';}};
 }
 function invite(){if(!allow())return;openModal('Mời thành viên',`<p>Tạo liên kết đăng ký theo email. Không cần tạo tài khoản trong Firebase Console.</p><div class="modal-fields"><label>Email thành viên<input name="email" type="email" maxlength="254" required autocomplete="off" placeholder="ten@congty.vn"></label>${fields()}</div>`,'Tạo liên kết mời',async f=>{const invite=await service.createInvite(Object.fromEntries(f));showLink(invite);});}
 async function invitations(){
  if(!allow())return;
  try{
   const invites=await service.listInvites();
   openModal('Danh sách lời mời',`<p>Thành viên đăng ký xong sẽ xuất hiện sau khi bấm Tải lại user. Kiểm tra email và vai trò trước khi cấp quyền.</p><div class="member-invitations">${invites.map(i=>{const member=state.users.find(u=>String(u.email||'').trim().toLowerCase()===String(i.email||'').trim().toLowerCase()),pending=i.status==='invited';return `<article><div><b>${esc(i.email)}</b><span>${esc(roles[i.role]||i.role)} · ${esc(i.department||'Chưa chọn phòng ban')} · ${esc(i.branch||'Chưa chọn chi nhánh')}</span><small>${i.status==='applied'?'Đã cấp quyền':i.status==='revoked'?'Đã thu hồi':member?'Đã có tài khoản · chờ Giám đốc cấp quyền':'Chờ đăng ký'}</small></div>${pending?`<div class="member-invite-actions"><button type="button" class="btn btn-secondary" data-member-invite-copy="${esc(i.id)}">Lấy link</button>${member?`<button type="button" class="btn btn-primary" data-member-invite-apply="${esc(i.id)}" data-member-uid="${esc(member.uid)}">Gán ${esc(roles[i.role])}</button>`:''}<button type="button" class="text-button" data-member-invite-revoke="${esc(i.id)}">Thu hồi</button></div>`:''}</article>`;}).join('')||'<p class="muted">Chưa có lời mời. Chọn Mời thành viên để tạo liên kết.</p>'}</div>`,'');
   q('.member-invitations').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.memberInviteCopy||b.dataset.memberInviteApply||b.dataset.memberInviteRevoke,invite=invites.find(i=>i.id===id);if(!invite)return;b.disabled=true;
    try{if(b.dataset.memberInviteCopy){showLink(invite);return;}if(b.dataset.memberInviteApply){await service.applyInvite(invite,b.dataset.memberUid);notify('Đã cấp quyền cho '+invite.email+'.');}else{await service.revokeInvite(invite);notify('Đã thu hồi lời mời.');}await invitations();}catch(error){notify(error.message,'error');b.disabled=false;}
   };
  }catch(error){notify(error.message||'Không tải được lời mời.','error');}
 }
 q('#inviteUser').addEventListener('click',invite);q('#editPermissions').addEventListener('click',()=>editor());
  q('#settingsInviteUser')?.addEventListener('click',invite);q('#settingsEditPermissions')?.addEventListener('click',()=>editor());q('#settingsMemberDirectory')?.addEventListener('click',()=>onOpenDirectory?.());
 q('#manageInvitations').addEventListener('click',invitations);
 q('#peopleTable').addEventListener('click',e=>{const b=e.target.closest('[data-edit-user-role]');if(b)editor(b.dataset.editUserRole);});
 // Registration links only prefill an email. Roles always require a director write.
 const params=new URL(location.href).searchParams,email=params.get('email');
 if(params.has('invite')&&email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254){q('#showRegister').click();q('#registerForm [name=email]').value=email;q('#loginForm [name=email]').value=email;q('#registerNotice').textContent='Bạn được mời đăng ký bằng email này. Sau khi đăng ký, Giám đốc sẽ xác nhận vai trò trên website.';}
 return {editor};
}
