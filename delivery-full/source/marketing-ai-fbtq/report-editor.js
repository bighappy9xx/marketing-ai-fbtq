export const reportEditFields=[
 ['Ngày báo cáo','reportDate','date'],['Bài chạy','campaign','text'],['Tài khoản quảng cáo','adAccount','text'],['Trạng thái','status','text'],
 ['Ngân sách/ngày','budget','number'],['Chi tiêu thực tế/ngày','spend','number'],['Số Mess','messages','integer'],['SĐT/Camp','phoneLeads','integer'],['Doanh thu SĐT/Camp','phoneRevenue','number'],['KPI/ngày','dailyKpi','number'],['Giá mess TB','avgMessageCost','number'],['Giá số TB','avgPhoneCost','number'],['Tỷ lệ xin số mới (%)','newPhoneRate','number'],['Ngưỡng','threshold','number'],['Ngưỡng đã chi','thresholdSpent','number'],['Vấn đề / nguyên nhân','issue','textarea'],['Hướng giải quyết','resolution','textarea'],['Ghi chú','note','textarea']
];
export function reportEditVersion(row){return JSON.stringify(reportEditFields.map(([,key])=>[key,row[key]??null]));}
export function validateReportEdit(values){
 const next={};for(const [label,key,type] of reportEditFields){const raw=String(values[key]??'').trim();
  if(type==='number'||type==='integer'){const n=raw===''?0:Number(raw);if(!Number.isFinite(n)||n<0||type==='integer'&&!Number.isInteger(n))throw new Error(label+' phải là số '+(type==='integer'?'nguyên ':'')+'không âm.');next[key]=n;}
  else {if(raw.length>6000)throw new Error(label+' quá dài.');next[key]=raw;}
 }
 if(!next.campaign)throw new Error('Bài chạy không được để trống.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(next.reportDate)||Number.isNaN(Date.parse(next.reportDate))||new Date(next.reportDate+'T00:00:00Z').toISOString().slice(0,10)!==next.reportDate)throw new Error('Ngày báo cáo không hợp lệ.');
 next.monthKey=next.reportDate.slice(0,7);next.actualSpend=next.spend;next.revenue=next.phoneRevenue;next.results=next.phoneLeads;return next;
}
export async function saveReportEdit({state,id,version,values,reason}){
 if(!reason?.trim())throw new Error('Nhập lý do chỉnh sửa để lưu lịch sử.');if(reason.length>1000)throw new Error('Lý do chỉnh sửa quá dài.');
 const next=validateReportEdit(values),uid=state.user?.uid,{db,storeMod:s}=state.firebase||{};
 if(!uid||!s?.runTransaction)throw new Error('Cần đăng nhập và kết nối Firestore để chỉnh sửa.');
 const reportRef=s.doc(db,'workspaces','fbtq','dailyReports',id),revenueRef=s.doc(db,'workspaces','fbtq','revenueEntries',id);let saved;
 await s.runTransaction(db,async tx=>{
  const snap=await tx.get(reportRef);if(!snap.exists())throw new Error('Báo cáo không còn tồn tại.');const old=snap.data();
  if(state.user?.uid!==uid||old.createdBy!==uid)throw new Error('Chỉ người tạo báo cáo được chỉnh sửa theo quyền hiện tại.');
  if(reportEditVersion(old)!==version)throw new Error('Báo cáo đã thay đổi trên thiết bị khác. Đóng biểu mẫu, tải lại và kiểm tra trước khi sửa.');
  const at=new Date().toISOString(),changes=Object.fromEntries(reportEditFields.filter(([,key])=>String(old[key]??'')!==String(next[key]??'')).map(([,key])=>[key,{before:old[key]??null,after:next[key]}]));
  if(!Object.keys(changes).length)throw new Error('Chưa có nội dung thay đổi.');
  const name=state.user.name||state.user.email||'',department=state.user.department||'';
  saved={...old,...next,createdByName:name,employee:name,department,editHistory:[...(Array.isArray(old.editHistory)?old.editHistory:[]).slice(-29),{actorUid:uid,actorName:name,at,reason:reason.trim(),changes}],lastEditedAt:at,updatedAt:s.serverTimestamp(),updatedBy:uid};
  tx.set(reportRef,saved);
  tx.set(revenueRef,{reportDate:next.reportDate,monthKey:next.monthKey,revenue:next.revenue,dailyReportId:id,createdBy:uid,createdByName:name,department,submittedAt:old.submittedAt||at,updatedAt:s.serverTimestamp(),updatedBy:uid});
 });
 return {...saved,id};
}
export function initReportEditor({state,openModal,closeModal,esc,showToast,onSaved}){
 return function openReportEditor(id){
  const row=state.dailyReports.find(r=>r.id===id);if(!row)return showToast('Không tìm thấy báo cáo. Hãy tải lại danh sách.','error');
  if(row.createdBy!==state.user?.uid)return showToast('Chỉ người tạo báo cáo được chỉnh sửa theo quyền hiện tại.','error');
  const version=reportEditVersion(row),initial={...row,spend:row.actualSpend??row.spend,phoneRevenue:row.phoneRevenue??row.revenue,phoneLeads:row.phoneLeads??row.results};
  const fields=reportEditFields.map(([label,key,type])=>`<label>${esc(label)}${type==='textarea'?`<textarea name="${key}">${esc(initial[key]??'')}</textarea>`:`<input name="${key}" type="${type==='integer'?'number':type}" value="${esc(initial[key]??'')}" ${['number','integer'].includes(type)?'min="0" step="'+(type==='integer'?'1':'any')+'"':''} ${['campaign','reportDate'].includes(key)?'required':''}>`}</label>`).join('');
  const history=(row.editHistory||[]).slice(-5).reverse().map(e=>`<p>${esc(e.at)} · ${esc(e.actorName)} · ${esc(e.reason)}</p>`).join('');
  openModal('Chỉnh sửa báo cáo — '+row.campaign,`<p>Đang sửa đúng bản ghi ngày ${esc(row.reportDate)}. Khi lưu, doanh thu và bảng tổng hợp sẽ cập nhật cùng báo cáo.</p><div class="report-edit-fields">${fields}<label>Lý do chỉnh sửa<textarea name="editReason" required maxlength="1000" placeholder="Ví dụ: sửa tên chiến dịch bị nhập nhầm"></textarea></label></div>${history?'<details><summary>Lịch sử chỉnh sửa gần đây</summary>'+history+'</details>':''}`,'Lưu chỉnh sửa',async form=>{
   const saved=await saveReportEdit({state,id,version,values:Object.fromEntries(form),reason:String(form.get('editReason')||'')});
   if(state.user?.uid!==saved.createdBy)return;
   state.dailyReports=state.dailyReports.map(r=>r.id===id?saved:r);state.revenueEntries=(state.revenueEntries||[]).filter(r=>r.id!==id).concat([{id,reportDate:saved.reportDate,monthKey:saved.monthKey,revenue:saved.revenue,createdBy:saved.createdBy}]);
   closeModal();onSaved?.();showToast('Đã cập nhật báo cáo và doanh thu, không tạo thêm dòng.');
  });
 };
}
