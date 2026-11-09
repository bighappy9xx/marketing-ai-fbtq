export function initAssistantAgent({state,callFunction,workflows,navigate,openModal,closeModal,openReportEditor,esc,onResult,reviewContent,reviewInvoice,setTaskStatus,openTaskDeadlineEditor,createReportDraft}){
 let owner='',turns=[],activeToken='',actorAtPreparation='',planning=false,generation=0;
 const $=selector=>document.querySelector(selector);
 const managers=['director','branch_manager','department_manager'];
 const requireManager=()=>{if(!managers.includes(state.role))throw new Error('Tài khoản không có quyền quản lý thao tác này.');};
 const field=(form,name,value)=>{const input=form.elements.namedItem(name);if(!input)throw new Error('Biểu mẫu thiếu trường '+name);input.value=String(value??'');input.dispatchEvent(new Event('change',{bubbles:true}));};
 const item=(rows,id)=>{const row=rows.find(r=>r.id===id);if(!row)throw new Error('Không xác định được bản ghi trong phạm vi tài khoản. Hãy tải lại hoặc nêu rõ mã.');return row;};
 const preview=details=>'<label>Thao tác sẽ thực hiện<textarea name="assistantActionDetails" readonly>'+esc(details)+'</textarea></label>';
 const compact=(rows,fields)=>rows.slice(0,40).map(row=>Object.fromEntries(fields.map(k=>[k,row[k]??null])));
 function context(){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),tomorrowDate=new Date(today+'T00:00:00Z');tomorrowDate.setUTCDate(tomorrowDate.getUTCDate()+1);
  const data=workflows()?.assistantData?.()||{};
  return {today,tomorrow:tomorrowDate.toISOString().slice(0,10),actor:{uid:state.user.uid,name:state.user.name,branch:state.user.branch,department:state.user.department,role:state.role},
   users:compact(state.users||[],['uid','name','email','role','department','branch']),tasks:compact(state.tasks||[],['id','title','assigneeUid','assignee','due','status']),
   campaigns:compact((state.metrics||[]).filter(r=>r.createdBy===state.user.uid),['id','name','account','reportAt','reportStart','reportEnd','budget','spend','results','costPerResult']),
   reports:compact((state.dailyReports||[]).filter(r=>r.createdBy===state.user.uid&&!r.isOtherRevenue),['id','campaign','reportDate','adAccount','spend','messages','phoneRevenue']),
   requests:compact(data.requests||[],['id','title','createdByName','date','status','canReview','nextStageName']),advances:compact(data.advances||[],['id','title','createdByName','date','amount','status','canReview']),
   invoices:compact(state.invoices||[],['id','invoiceNumber','supplier','createdByName','total','status']),reviews:compact(state.reviews||[],['id','title','createdByName','status']),
   activeConversation:state.activeThread?{pageId:state.activeThread.pageId,recipientId:state.activeThread.senderId,name:state.activeThread.senderName}:null};
 }
 function submitPrepared(){
  const form=$('#activeModalForm');if(!form)throw new Error('Không mở được biểu mẫu để chuẩn bị thao tác.');
  const invalid=[...form.querySelectorAll('input,select,textarea')].filter(input=>!input.disabled&&!input.checkValidity());
  if(invalid.length){const labels=invalid.map(input=>input.name||'thông tin bắt buộc');closeModal();return {kind:'clarify',message:'Bạn bổ sung hoặc xác định rõ '+[...new Set(labels)].join(', ')+' ngay trong chat để tôi tự hoàn tất nhé.'};}
  activeToken=crypto.randomUUID();actorAtPreparation=state.user.uid;form.dataset.assistantAgentToken=activeToken;
  form.requestSubmit(form.querySelector('button[type="submit"]'));
  return {kind:'prepared',message:'Tôi đã tự điền đủ dữ liệu và chuẩn bị thao tác. Bạn kiểm tra nội dung ở bảng xác nhận rồi chọn Phê Duyệt hoặc Từ Chối; chưa có dữ liệu nghiệp vụ nào được ghi trước khi phê duyệt.'};
 }
 async function prepare(plan){
  const a=plan.args;if(plan.action==='navigate'){if(a.page==='people'&&state.role!=='director')throw new Error('Chỉ giám đốc được mở mục nhân sự.');navigate(a.page);return {kind:'answer',message:'Đã mở mục được yêu cầu.'};}
  if(['leave_request','proposal','advance'].includes(plan.action)){
   const advance=plan.action==='advance';navigate(advance?'advances':'requests');const button=$('#page-'+(advance?'advances':'requests')+' [data-wf-action="create"]');if(!button)throw new Error('Danh sách nghiệp vụ chưa tải xong.');button.click();const form=$('#activeModalForm');if(!form)throw new Error('Không mở được biểu mẫu nghiệp vụ.');
   field(form,'date',a.date);
   if(advance){field(form,'accountingMode','advance_pending');field(form,'direction','expense');field(form,'costGroup',a.costGroup);field(form,'subgroup',a.costGroup==='Facebook Ads'?'FB Ads':a.costGroup==='GG Ads'?'GG Ads':a.costGroup==='TikTok Ads'?'TikTok / Zalo Ads':'');field(form,'costType','business');field(form,'amount',a.amount);field(form,'vatAmount',0);field(form,'accountingPeriod',a.date.slice(0,7));field(form,'description',a.description);}
   else {field(form,'type',plan.action==='proposal'?'proposal':'leave');field(form,'description',a.reason||a.description);if(plan.action==='proposal')field(form,'title',a.title);else field(form,'session',a.session);}
  }else if(plan.action==='report_create'){
   navigate('analytics');createReportDraft(a);
  }else if(plan.action==='report_edit'){
   const row=item(state.dailyReports,a.id);if(row.createdBy!==state.user.uid)throw new Error('Chỉ người tạo được sửa báo cáo.');navigate('analytics');openReportEditor(a.id);const form=$('#activeModalForm');for(const [name,value] of Object.entries(a.changes))field(form,name,value);field(form,'editReason',a.reason);
  }else if(plan.action==='task_create'){
   requireManager();const member=(state.members||[]).find(m=>m.uid===a.assigneeUid);if(!member)throw new Error('Không tìm thấy người nhận công việc trong danh sách được giao.');navigate('tasks');$('#newTaskBtn').click();const form=$('#activeModalForm');for(const [name,value] of Object.entries({title:a.title,description:a.description,assignee:a.assigneeUid,due:a.due.slice(0,16),priority:a.priority,tag:'Công việc'})){if(form.elements.namedItem(name)){if(name==='tag')continue;field(form,name,value);}}
  }else if(plan.action==='task_status'){
   const row=item(state.tasks,a.id);if(!managers.includes(state.role)&&row.assigneeUid!==state.user.uid)throw new Error('Bạn chỉ được cập nhật công việc được giao.');
   openModal('AI chuẩn bị cập nhật công việc',preview('Công việc: '+row.title+'\nMã: '+a.id+'\nTrạng thái mới: '+a.status),'Chuẩn bị thực hiện',async()=>{await setTaskStatus(a.id,a.status);closeModal();});
  }else if(plan.action==='task_deadline'){
   requireManager();openTaskDeadlineEditor(item(state.tasks,a.id));field($('#activeModalForm'),'due',a.due.slice(0,16));
  }else if(plan.action==='invite_user'){
   if(state.role!=='director')throw new Error('Chỉ giám đốc được mời thành viên.');navigate('people');$('#inviteUser').click();const form=$('#activeModalForm');field(form,'email',a.email);field(form,'role',a.role);field(form,'department',a.department);
  }else if(plan.action==='advance_fund'){
   if(state.role!=='accountant'||a.alreadyPaid!==true)throw new Error('Cần tài khoản kế toán và xác nhận đã chi/chuyển tiền thực tế.');
   const row=item(workflows().assistantData().advances,a.id);workflows().openAssistantFunding(a.id);const form=$('#activeModalForm');form.querySelector('.modal-body')?.insertAdjacentHTML('afterbegin',preview('Hồ sơ: '+row.title+'\nNgười nhận: '+row.createdByName+'\nSố tiền đã cấp: '+row.amount+'\nMã hồ sơ: '+a.id));field(form,'date',a.date);field(form,'reference',a.reference);
  }else if(plan.action==='user_role'){
   if(state.role!=='director')throw new Error('Chỉ giám đốc được phân quyền.');
   openModal('AI chuẩn bị thay đổi vai trò',preview('Tài khoản: '+a.identifier+'\nVai trò mới: '+a.role),'Chuẩn bị thực hiện',async()=>{await callFunction('setUserRole',{uidOrEmail:a.identifier,role:a.role});closeModal();});
  }else if(plan.action==='send_message'){
   const t=state.activeThread;if(!t||t.pageId!==a.pageId||t.senderId!==a.recipientId)throw new Error('Người nhận không khớp hội thoại đang chọn. Hãy chọn đúng hội thoại rồi yêu cầu lại.');
   const requestId=crypto.randomUUID();openModal('AI chuẩn bị gửi tin nhắn',preview('Fanpage: '+(t.pageName||a.pageId)+' ('+a.pageId+')\nNgười nhận: '+(t.senderName||a.recipientId)+' ('+a.recipientId+')')+`<label>Nội dung<textarea name="message" readonly>${esc(a.message)}</textarea></label>`,'Chuẩn bị gửi',async()=>{await callFunction('sendChatbotMessage',{...a,requestId});closeModal();});
  }else if(plan.action==='workflow_review'){
   const data=workflows().assistantData(),row=item(a.kind==='advance'?data.advances:data.requests,a.id);if(!row.canReview)throw new Error('Bạn không có quyền xử lý bước duyệt hiện tại.');
   openModal('AI chuẩn bị xét duyệt hồ sơ',preview('Hồ sơ: '+row.title+'\nNgười gửi: '+row.createdByName+'\nNgày: '+row.date+'\nMã: '+a.id+'\nQuyết định: '+(a.decision==='approve'?'Phê duyệt':'Từ chối')+'\nLý do: '+(a.note||'—')),'Chuẩn bị thực hiện',async()=>{await workflows().assistantReview(a.kind,a.id,a.decision,a.note||'');closeModal();});
  }else if(plan.action==='content_review'||plan.action==='invoice_review'){
   requireManager();const row=item(plan.action==='content_review'?state.reviews:state.invoices,a.id);if(row.status!=='pending')throw new Error('Hồ sơ không còn ở trạng thái chờ duyệt.');
   openModal('AI chuẩn bị xét duyệt',preview('Hồ sơ: '+(row.title||row.invoiceNumber||row.supplier||a.id)+'\nMã: '+a.id+'\nNgười gửi: '+(row.createdByName||'—')+'\nQuyết định: '+(a.decision==='approve'?'Phê duyệt':'Từ chối')+'\nLý do: '+(a.note||'—')),'Chuẩn bị thực hiện',async()=>{if(plan.action==='content_review')await reviewContent(a.id,a.decision,a.note||'');else {const ok=await reviewInvoice(a.id,a.decision==='approve'?'approved':'rejected',a.note||'');if(!ok)throw new Error('Hóa đơn chưa được cập nhật.');}closeModal();});
  }else throw new Error('Thao tác AI chưa được hỗ trợ.');
  return submitPrepared();
 }
 window.addEventListener('fbtq:assistant-action-result',event=>{
  const detail=event.detail;if(!activeToken||detail?.token!==activeToken||state.user?.uid!==actorAtPreparation)return;
  activeToken='';const message=detail.ok?'Đã thực hiện thao tác sau khi bạn phê duyệt.':('Thao tác chưa hoàn tất: '+detail.error);turns.push({role:'assistant',text:message});onResult?.(message);
 });
 return {async run(question){
  if(!state.user||!state.firebase)throw new Error('Đăng nhập Firebase để dùng AI thao tác.');
  if(document.querySelector('#assistantActionApproval'))return {kind:'answer',message:'Bạn chọn Phê Duyệt hoặc Từ Chối thao tác đang chờ trước nhé.'};
  if(planning)return {kind:'answer',message:'AI đang chuẩn bị yêu cầu trước. Bạn chờ phản hồi rồi gửi tiếp nhé.'};
  const uid=state.user.uid;if(owner!==uid){owner=uid;turns=[];activeToken='';}const epoch=++generation;planning=true;
  try{
  turns.push({role:'user',text:question});turns=turns.slice(-12);
  const provider=localStorage.getItem('fbtq_assistant_provider')||'gemini',endpoint={gemini:'planAssistantGemini',openai:'planAssistantOpenai',claude:'planAssistantClaude'}[provider]||'planAssistantGemini';
  let plan;try{plan=await callFunction(endpoint,{question,context:context(),history:turns.slice(0,-1)});}catch(error){if(/not-found|unimplemented/.test(error.code||''))throw new Error('Chưa triển khai bộ điều khiển AI '+endpoint+'. Cần triển khai endpoint này trước khi Trợ lý tự thao tác.');throw error;}
  if(state.user?.uid!==uid||epoch!==generation)throw new Error('Phiên tài khoản đã thay đổi.');
  const result=plan.kind==='action'?await prepare(plan):plan;
  if(!result?.message)throw new Error('AI chưa trả về kế hoạch rõ ràng.');turns.push({role:'assistant',text:result.message+(plan.kind==='action'?'\nBản nháp đã chuẩn bị: '+JSON.stringify({action:plan.action,args:plan.args}):'')});return result;
  }finally{if(epoch===generation)planning=false;}
 },reset(){generation++;planning=false;owner='';turns=[];activeToken='';}};
}
