const specs={
 leave_request:{date:'date',session:['morning','afternoon','full'],reason:'text'},
 proposal:{date:'date',title:'text',description:'text'},
 advance:{date:'date',amount:'positiveInteger',description:'text',costGroup:['Doanh thu bán hàng','Facebook Ads','GG Ads','TikTok Ads','Nhập hàng','Lương','Vận chuyển','Phí sàn','Thuê mặt bằng','Chi phí khác']},
 invite_user:{email:'text',role:['director','branch_manager','department_manager','accountant','employee'],department:['Marketing','Kinh doanh','Vận hành']},
 advance_fund:{id:'text',date:'date',reference:'text',alreadyPaid:'true'},
 task_status:{id:'text',status:['todo','doing','done']},
 task_deadline:{id:'text',due:'datetime'},
 task_create:{title:'text',description:'text',assigneeUid:'text',due:'datetime',priority:['Cao','Bình thường','Thấp']},
 report_create:{date:'date',campaign:'text',account:'text',spend:'number',messages:'nonnegativeInteger',status:'optionalText',budget:'optionalNumber',costPerResult:'optionalNumber',phoneLeads:'optionalNumber',phoneRevenue:'optionalNumber'},
 report_edit:{id:'text',changes:'changes',reason:'text'},
 workflow_review:{kind:['request','advance'],id:'text',decision:['approve','reject'],note:'optionalText'},
 content_review:{id:'text',decision:['approve','reject'],note:'optionalText'},
 invoice_review:{id:'text',decision:['approve','reject'],note:'optionalText'},
 send_message:{pageId:'text',recipientId:'text',message:'text'},
 user_role:{identifier:'text',role:['director','branch_manager','department_manager','accountant','employee']},
 navigate:{page:['overview','analytics','requests','advances','automation','tasks','work-awards','content','content-review','inbox','people','settings','leaderboard']}
};
const reportFields=['reportDate','campaign','adAccount','status','budget','spend','messages','phoneLeads','phoneRevenue','dailyKpi','avgMessageCost','avgPhoneCost','newPhoneRate','threshold','thresholdSpent','issue','resolution','note'];
function parseAgentPlan(raw){
 let plan;try{plan=typeof raw==='string'?JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')):raw;}catch{throw new Error('AI chưa trả về kế hoạch hợp lệ. Chưa có dữ liệu nào được thay đổi.');}
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||!['answer','clarify','action'].includes(plan.kind))throw new Error('AI chưa trả về kế hoạch hợp lệ. Hãy diễn đạt lại yêu cầu.');
 if(typeof plan.message!=='string'||!plan.message.trim()||plan.message.length>6000)throw new Error('Thiếu mô tả thao tác AI.');
 if(plan.kind!=='action')return {kind:plan.kind,message:plan.message};
 const spec=specs[plan.action];if(!spec)throw new Error('Thao tác AI chưa được hệ thống hỗ trợ.');
 const args=plan.args;if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!Object.hasOwn(spec,k)))throw new Error('Thông tin thao tác không hợp lệ.');
 const labels={date:'ngày áp dụng',session:'buổi nghỉ (sáng, chiều hoặc cả ngày)',reason:'lý do',title:'tiêu đề',description:'nội dung',amount:'số tiền',costGroup:'nhóm khoản chi',campaign:'tên chiến dịch',account:'tài khoản quảng cáo',spend:'chi tiêu',messages:'số Mess',assigneeUid:'người nhận công việc',due:'hạn hoàn thành',priority:'mức ưu tiên',id:'bản ghi cần xử lý',changes:'nội dung muốn sửa',identifier:'tài khoản cần phân quyền',role:'vai trò mới',pageId:'Fanpage',recipientId:'người nhận',message:'nội dung tin nhắn'};
 const missing=Object.entries(spec).filter(([field,type])=>!['optionalText','optionalNumber'].includes(type)&&(args[field]===undefined||args[field]===null||typeof args[field]==='string'&&!args[field].trim())).map(([field])=>labels[field]||field);
 if(missing.length)return {kind:'clarify',message:'Tôi còn thiếu '+missing.join(', ')+'. Bạn bổ sung ngay trong chat để tôi tự hoàn tất nhé.'};
 for(const [field,type] of Object.entries(spec)){
  const value=args[field];if(['optionalText','optionalNumber'].includes(type)&&(value===undefined||value===null||value===''))continue;
  if(value===undefined||value===null||value==='')return {kind:'clarify',message:'Bạn bổ sung thông tin '+field+' để tôi hoàn tất yêu cầu nhé.'};
  if(Array.isArray(type)){if(!type.includes(value))throw new Error('Giá trị '+field+' không hợp lệ.');}
  else if(['number','nonnegativeInteger','optionalNumber'].includes(type)){if(typeof value!=='number'||!Number.isFinite(value)||value<0||type==='nonnegativeInteger'&&!Number.isSafeInteger(value))throw new Error('Chỉ số '+field+' không hợp lệ.');}
  else if(type==='true'){if(value!==true)throw new Error('Cần xác nhận đã chi/chuyển tiền thực tế.');}
  else if(type==='positiveInteger'){if(!Number.isSafeInteger(value)||value<=0||value>1e12)throw new Error('Số tiền không hợp lệ.');}
  else if(type==='changes'){if(!value||typeof value!=='object'||Array.isArray(value)||!Object.keys(value).length||Object.keys(value).some(k=>!reportFields.includes(k)||!['string','number'].includes(typeof value[k])||typeof value[k]==='number'&&(!Number.isFinite(value[k])||value[k]<0)))throw new Error('Các trường chỉnh sửa báo cáo không hợp lệ.');}
  else if(typeof value!=='string'||value.length>6000)throw new Error('Thông tin '+field+' không hợp lệ.');
  if(type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw new Error('Ngày không hợp lệ.');
  if(type==='datetime'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)||!Number.isFinite(Date.parse(value))))throw new Error('Hạn công việc không hợp lệ.');
 }
 if(['workflow_review','content_review','invoice_review'].includes(plan.action)&&args.decision==='reject'&&(!args.note||args.note.trim().length<3))return {kind:'clarify',message:'Bạn cho biết lý do từ chối để lưu vào lịch sử nhé.'};
 return {kind:'action',action:plan.action,args:{...args},message:plan.message};
}
module.exports={specs,parseAgentPlan};
