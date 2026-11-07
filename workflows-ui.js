import { STATUS_LABELS, SESSION_LABELS, monthDays, leaveSummary, dayMark, leaveWorkbook, workflowErrorMessage } from './workflow-reports.js?v=20261106-workflow-load-fix';
import { downloadWorkbook } from './xlsx-export.js';

export function initWorkflows(api) {
  const {state,$,esc,money,avatarMarkup,openModal,closeModal,showToast,roleName}=api;
  const collections={advance:'advanceInvoices',request:'staffRequests'}, records={advance:[],request:[]};
  const stageNames={manager:'Quản lý chi nhánh',accountant:'Kế toán',department:'Trưởng phòng',branch:'Quản lý chi nhánh'};
  let subscriptions=[],generation=0,errors={advance:'',request:''},warnings={advance:'',request:''},loading={advance:false,request:false};
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const branch=p=>p?.branch||p?.branchName||p?.branchId||'';
  const formatDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.split('-').reverse().join('/'):d||'—';
  const time=value=>value?new Date(value?.toDate?value.toDate():value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa ghi nhận';
  const stageKeys=kind=>kind==='advance'?['manager','accountant']:['department','branch'];
  const page=kind=>$('#page-'+(kind==='advance'?'advances':'requests'));
  const query=(kind,name)=>$(`[data-wf-filter="${name}"]`,page(kind));
  function person(row) {
    const profile=state.users.find(p=>p.uid===row.createdBy),name=profile?.name||row.createdByName||row.employee||'Nhân viên';
    return `<div class="wf-person">${avatarMarkup(profile?.photoData||row.photoData||'',name.split(/\s+/).slice(-2).map(n=>n[0]).join(''))}<div><b>${esc(name)}</b><small>${esc(row.branch||'Chưa gán chi nhánh')} · ${esc(row.department||'Chưa gán phòng')}</small></div></div>`;
  }
  function canReview(row,stage) {
    if(row.legacy||row.status!=='pending'||row.createdBy===state.user?.uid)return false;
    const same=!!branch(state.user)&&branch(state.user)===row.branch;
    if(row.kind==='advance')return stage==='manager'?state.role==='branch_manager'&&same:stage==='accountant'&&state.role==='accountant';
    return stage==='department'?state.role==='department_manager'&&same&&!!state.user.department&&state.user.department===row.department:stage==='branch'&&state.role==='branch_manager'&&same;
  }
  function nextStage(row) { const stages=stageKeys(row.kind);return row.approvals?.[stages[0]]?.status==='approved'?stages[1]:stages[0]; }
  const badge=(status,label)=>`<span class="wf-badge wf-${esc(status||'pending')}">${esc(label||STATUS_LABELS[status]||'Chưa xác định')}</span>`;
  function approvals(row) {
    if(row.legacy)return '<span class="wf-badge wf-legacy">Hồ sơ cũ · quy trình trước đây</span>';
    return stageKeys(row.kind).map(stage=>`<div class="wf-stage"><span>${stageNames[stage]}</span>${badge(row.approvals?.[stage]?.status||'pending',row.approvals?.[stage]?.status==='approved'?'Đã duyệt':row.approvals?.[stage]?.status==='rejected'?'Từ chối':'Chờ duyệt')}</div>`).join('');
  }
  function actionButtons(row) {
    const base=`data-wf-kind="${row.kind}" data-wf-id="${esc((row.legacy?'legacy:':'')+row.id)}"`;
    let html=`<button class="text-button" type="button" data-wf-action="history" ${base}>Chi tiết & lịch sử</button>`;
    if(canReview(row,nextStage(row)))html+=`<div class="wf-decision-buttons"><button class="approve-btn" type="button" data-wf-action="approve" ${base}>Phê Duyệt</button><button class="reject-btn" type="button" data-wf-action="reject" ${base}>Từ Chối</button></div>`;
    if(row.kind==='advance'&&row.status==='approved'&&state.role==='accountant'&&row.createdBy!==state.user?.uid)html+=`<button class="btn btn-primary" type="button" data-wf-action="disburse" ${base}>Xác nhận cấp tiền</button>`;
    return html;
  }
  function filters(kind) {
    return `<div class="wf-filters"><label>Kỳ lọc<select data-wf-filter="period"><option value="all">Tất cả thời gian</option><option value="day">Theo ngày</option><option value="month">Theo tháng</option><option value="year">Theo năm</option></select></label><label data-wf-date-label hidden>Ngày / tháng / năm<input data-wf-filter="date" type="date" value="${today()}"></label><label>Chi nhánh<select data-wf-filter="branch"><option value="all">Tất cả trong phạm vi truy cập</option></select></label><label>User<select data-wf-filter="user"><option value="all">Tất cả nhân sự</option></select></label><label>Trạng thái<select data-wf-filter="status"><option value="all">Tất cả</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt đủ 2 cấp</option><option value="rejected">Từ chối</option>${kind==='advance'?'<option value="disbursed">Đã cấp tiền</option>':''}</select></label>${kind==='request'?'<label>Loại đơn<select data-wf-filter="type"><option value="all">Tất cả</option><option value="leave">Xin nghỉ</option><option value="proposal">Đề xuất</option><option value="legacy">Hồ sơ cũ</option></select></label>':''}<button type="button" class="btn btn-secondary" data-wf-action="reset">Xóa lọc</button></div>`;
  }
  function buildPages() {
    page('advance').innerHTML=`<div class="page-heading"><div><div class="eyebrow">NGÂN SÁCH QUẢNG CÁO</div><h1>Hoá Đơn Tạm Ứng</h1><p class="muted">Đề nghị cấp ngân sách, duyệt hai cấp và theo dõi từng lần cấp tiền.</p></div><div class="heading-actions"><button class="btn btn-secondary" data-wf-action="refresh">Tải lại</button><button class="btn btn-primary" data-wf-action="create">＋ Tạo hóa đơn tạm ứng</button></div></div><div class="wf-flow"><span>1. Gửi đề nghị</span><i>→</i><span>2. Quản lý chi nhánh</span><i>→</i><span>3. Kế toán</span><i>→</i><span>4. Ghi nhận cấp tiền</span></div><div class="wf-summary" data-wf-summary></div><section class="panel wf-panel"><div class="panel-heading"><div><h3>Lịch sử hóa đơn tạm ứng</h3><p class="muted">Lọc theo ngày đề nghị, chi nhánh và người nhận tạm ứng.</p></div></div>${filters('advance')}<div class="wf-load-state" data-wf-message role="status"></div><div class="table-scroll"><table class="wf-table"><thead><tr><th>NGƯỜI NHẬN</th><th>HÓA ĐƠN / NỘI DUNG</th><th>NGÀY ĐỀ NGHỊ</th><th>SỐ TIỀN</th><th>HAI CẤP DUYỆT</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody data-wf-table></tbody></table></div></section>`;
    page('request').innerHTML=`<div class="page-heading"><div><div class="eyebrow">ĐƠN TỪ NHÂN SỰ</div><h1>Đơn Từ & Đề Xuất</h1><p class="muted">Gửi đơn xin nghỉ, đề xuất và theo dõi lịch sử phê duyệt.</p></div><div class="heading-actions"><button class="btn btn-secondary" data-wf-action="refresh">Tải lại</button><button class="btn btn-primary" data-wf-action="create">＋ Tạo đơn</button></div></div><div class="wf-flow"><span>1. Gửi đơn</span><i>→</i><span>2. Trưởng phòng</span><i>→</i><span>3. Quản lý chi nhánh</span></div><section class="panel wf-panel"><div class="panel-heading"><div><h3>Lịch sử đơn từ</h3><p class="muted">Đơn xin nghỉ hiển thị rõ ngày và buổi nghỉ. Bộ lọc dùng ngày áp dụng.</p></div></div>${filters('request')}<div class="wf-load-state" data-wf-message role="status"></div><div class="table-scroll"><table class="wf-table"><thead><tr><th>NHÂN VIÊN</th><th>LOẠI / NỘI DUNG</th><th>NGÀY / BUỔI</th><th>HAI CẤP DUYỆT</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody data-wf-table></tbody></table></div></section><section class="panel wf-panel wf-leave-panel"><div class="panel-heading"><div><h3>Thống kê nghỉ theo tháng</h3><p class="muted">Chỉ tính đơn đã được duyệt đủ hai cấp. 1 buổi = 0,5 ngày.</p></div><div class="heading-actions"><label>Tháng<input id="wfLeaveMonth" type="month" value="${today().slice(0,7)}"></label><button class="btn btn-secondary" data-wf-action="export">⇩ Xuất Excel (.xlsx)</button></div></div><p class="wf-stat-scope">Áp dụng bộ lọc Chi nhánh và User phía trên; tháng thống kê được chọn riêng tại đây.</p><div class="wf-legend"><span class="wf-day-morning">S · Nghỉ sáng</span><span class="wf-day-afternoon">C · Nghỉ chiều</span><span class="wf-day-full">S+C · Cả ngày</span><span>Ô trống: không có đơn nghỉ đã duyệt</span></div><div class="table-scroll" id="wfLeaveCalendar"></div><p class="wf-stat-scope" id="wfLeaveTotals"></p></section>`;
    for(const kind of ['advance','request']) {
      page(kind).addEventListener('click',event=>{const button=event.target.closest('[data-wf-action]');if(button)handleAction(kind,button);});
      page(kind).addEventListener('change',event=>{
        if(event.target.dataset.wfFilter==='period') {
          const period=event.target.value,input=query(kind,'date');$('[data-wf-date-label]',page(kind)).hidden=period==='all';input.type=period==='month'?'month':period==='year'?'number':'date';input.value=period==='year'?today().slice(0,4):period==='month'?today().slice(0,7):today();if(period==='year'){input.min='2000';input.max='2200';}
        }
        render(kind);
      });
    }
  }
  function options(select,items,placeholder) {
    const value=select.value;select.innerHTML=`<option value="all">${placeholder}</option>`+items.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');if(items.some(([id])=>id===value))select.value=value;
  }
  function filtered(kind) {
    const val=name=>query(kind,name)?.value||'all';
    const stamp=row=>row.createdAt?.toMillis?row.createdAt.toMillis():Date.parse(row.createdAt||row.submittedAt||'')||0;
    return records[kind].filter(row=>(val('branch')==='all'||row.branch===val('branch'))&&(val('user')==='all'||row.createdBy===val('user'))&&(val('status')==='all'||row.status===val('status'))&&(val('type')==='all'||(row.legacy?'legacy':row.type)===val('type'))&&(val('period')==='all'||String(row.date||'').startsWith(val('date')))).sort((a,b)=>stamp(b)-stamp(a));
  }
  function render(kind) {
    const data=records[kind],roster=kind==='request'?reportPeople():[],branches=[...new Set([...data,...roster].map(row=>row.branch).filter(Boolean))].sort(),people=new Map([...roster.map(row=>[row.uid,row.name]),...data.map(row=>[row.createdBy,row.createdByName||row.employee||row.createdBy])]);
    options(query(kind,'branch'),branches.map(b=>[b,b]),'Tất cả trong phạm vi truy cập');options(query(kind,'user'),[...people].filter(([uid])=>uid),'Tất cả nhân sự');
    const rows=filtered(kind),message=$('[data-wf-message]',page(kind));message.textContent=[errors[kind],warnings[kind],loading[kind]?'Đang tải hồ sơ…':`${rows.length} hồ sơ trong phạm vi truy cập`].filter(Boolean).join(' ');message.classList.toggle('wf-error',!!errors[kind]);
    $('[data-wf-table]',page(kind)).innerHTML=rows.map(row=>`<tr><td>${person(row)}</td><td><b>${esc(row.title||row.type||'Đơn từ')}</b><small class="wf-description">${esc(row.description)}</small><small class="wf-code">${esc(row.id)}</small></td><td>${esc(formatDate(row.date))}${row.type==='leave'?`<small>${esc((row.sessions||[]).map(s=>SESSION_LABELS[s]).join(' + '))}</small>`:''}</td>${kind==='advance'?`<td><b>${money(row.amount)}</b>${row.disbursement?`<small>Cấp ngày ${formatDate(row.disbursement.date)}</small>`:''}</td>`:''}<td>${approvals(row)}</td><td>${badge(row.status,row.legacy?(row.status==='approved'?'Đã duyệt (quy trình cũ)':row.status==='rejected'?'Từ chối (quy trình cũ)':'Hồ sơ cũ · chờ xử lý'):null)}</td><td class="wf-row-actions">${actionButtons(row)}</td></tr>`).join('')||`<tr><td colspan="${kind==='advance'?7:6}" class="wf-empty">${loading[kind]?'Đang tải…':errors[kind]?'Chưa tải được hồ sơ.':'Chưa có hồ sơ khớp bộ lọc.'}</td></tr>`;
    if(kind==='advance') {
      const sum=status=>rows.filter(row=>row.status===status).reduce((n,row)=>n+row.amount,0);
      $('[data-wf-summary]',page(kind)).innerHTML=[['Chờ phê duyệt',sum('pending'),'pending'],['Đã duyệt · chờ cấp',sum('approved'),'approved'],['Đã cấp tiền',sum('disbursed'),'disbursed'],['Từ chối',sum('rejected'),'rejected']].map(([label,value,tone])=>`<article class="wf-summary-${tone}"><span>${label}</span><b>${money(value)}</b></article>`).join('');
    } else renderLeave();
  }
  function reportPeople() {
    const roster=[...state.users];if(state.user&&!roster.some(p=>p.uid===state.user.uid))roster.push(state.user);
    return roster.filter(p=>p.uid===state.user?.uid||state.role==='director'||!!branch(state.user)&&branch(p)===branch(state.user)&&(state.role==='branch_manager'||state.role==='department_manager'&&p.department===state.user.department)).map(p=>({...p,branch:branch(p)}));
  }
  function reportFilter() {return {branch:query('request','branch').value,user:query('request','user').value};}
  function renderLeave() {
    const month=$('#wfLeaveMonth').value,days=monthDays(month),people=leaveSummary(records.request,month,reportFilter(),reportPeople());
    $('#wfLeaveCalendar').innerHTML=`<table class="wf-calendar"><thead><tr><th>NHÂN VIÊN</th>${days.map(day=>`<th>${Number(day.slice(-2))}</th>`).join('')}<th>SÁNG</th><th>CHIỀU</th><th>NGÀY</th><th>CHỜ DUYỆT</th></tr></thead><tbody>${people.map(p=>`<tr><td>${person({createdBy:p.uid,createdByName:p.name,...p})}</td>${days.map(day=>{const mark=dayMark(p.dates[day]);return `<td class="${mark.css?'wf-day-'+mark.css:''}" title="${esc(p.name)} · ${formatDate(day)}">${mark.text||'—'}</td>`;}).join('')}<td>${p.morning}</td><td>${p.afternoon}</td><td><b>${p.totalDays}</b></td><td>${p.pendingCount}</td></tr>`).join('')||`<tr><td colspan="${days.length+5}" class="wf-empty">Chưa có nhân sự hoặc đơn nghỉ trong phạm vi đã chọn.</td></tr>`}</tbody></table>`;
    $('#wfLeaveTotals').textContent=`${people.length} nhân sự · ${people.reduce((n,p)=>n+p.totalDays,0)} ngày nghỉ quy đổi đã duyệt · ${people.reduce((n,p)=>n+p.pendingCount,0)} đơn đang chờ. Hồ sơ cũ không có buổi nghỉ/phê duyệt hai cấp không được tính.`;
  }
  function unitNote() {return `<p class="wf-form-note">Người gửi: <b>${esc(state.user?.name)}</b> · Chi nhánh: <b>${esc(branch(state.user)||'Chưa gán')}</b> · Phòng: <b>${esc(state.user?.department||'Chưa gán')}</b></p>`;}
  function create(kind) {
    if(!state.user||!state.firebase)return showToast('Vui lòng đăng nhập và kết nối Firebase.','error');
    const requestId=crypto.randomUUID();
    const advance=`<label>Số tiền tạm ứng (VND)<input name="amount" type="number" min="1" max="1000000000000" step="1" required></label><label>Ngày đề nghị<input name="date" type="date" value="${today()}" required></label><label>Thông tin nhận tiền<textarea name="paymentInfo" maxlength="500" placeholder="Ngân hàng, số tài khoản, chủ tài khoản hoặc hình thức nhận tiền"></textarea></label>`;
    const request=`<label>Loại đơn<select name="type" id="wfRequestType"><option value="leave">Đơn xin nghỉ</option><option value="proposal">Đơn đề xuất</option></select></label><label>Ngày áp dụng<input name="date" type="date" value="${today()}" required></label><fieldset id="wfLeaveFields"><label>Buổi nghỉ<select name="session"><option value="morning">Nghỉ Sáng · 0,5 ngày</option><option value="afternoon">Nghỉ Chiều · 0,5 ngày</option><option value="full">Cả ngày · 1 ngày</option></select></label></fieldset><fieldset id="wfProposalFields" hidden disabled><label>Tiêu đề đề xuất<input name="title" maxlength="160" minlength="3" required></label></fieldset>`;
    openModal(kind==='advance'?'Tạo hóa đơn tạm ứng':'Tạo đơn từ & đề xuất',unitNote()+`<div class="modal-fields">${kind==='advance'?advance:request}<label>${kind==='advance'?'Mục đích chạy quảng cáo':'Lý do / nội dung đề xuất'}<textarea name="description" minlength="5" maxlength="2000" required></textarea></label></div>`,'Gửi phê duyệt',async form=>{
      const data=Object.fromEntries(form);data.kind=kind;data.clientRequestId=requestId;if(kind==='advance')data.amount=Number(data.amount);else data.sessions=data.type==='leave'?(data.session==='full'?['morning','afternoon']:[data.session]).sort():[];
      await createWorkflowDirect(data);closeModal();showToast('Đã gửi hồ sơ. Lịch sử sẽ cập nhật sau mỗi bước duyệt.');
    });
    $('#wfRequestType')?.addEventListener('change',event=>{const leave=event.target.value==='leave';$('#wfLeaveFields').hidden=!leave;$('#wfLeaveFields').disabled=!leave;$('#wfProposalFields').hidden=leave;$('#wfProposalFields').disabled=leave;});
  }
  function workflowStore() {
    if(!state.firebase?.storeMod||!state.firebase?.db)throw new Error('Firebase Firestore chưa kết nối. Hãy đăng nhập lại rồi thử tiếp.');
    return {db:state.firebase.db,s:state.firebase.storeMod};
  }
  async function runWorkflowTransaction(s,db,work) {
    try{return await s.runTransaction(db,work);}
    catch(error){
      if(error?.code==='permission-denied')throw new Error('Firestore từ chối thao tác. Hãy triển khai Rules mới và kiểm tra tài khoản đã được gán đúng chi nhánh/phòng ban.');
      if(error?.code==='unavailable')throw new Error('Không kết nối được Firestore. Kiểm tra mạng rồi thử lại.');
      throw error;
    }
  }
  function workflowPath(s,kind,id) {return s.doc(state.firebase.db,'workspaces','fbtq',collections[kind],id);}
  function actorFromProfile(uid,profile) {
    if(!profile||profile.approved===false)throw new Error('Tài khoản chưa được duyệt để sử dụng chức năng này.');
    const userBranch=branch(profile),name=profile.name||profile.email||'Nhân viên';
    if(!userBranch)throw new Error('Nhờ Giám đốc gán chi nhánh cho tài khoản trước khi tạo hoặc duyệt hồ sơ.');
    return {uid,name,role:profile.role||'employee',branch:userBranch,department:profile.department||'',photoData:profile.photoData||''};
  }
  function validateLeaveDate(value) {
    return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  }
  function sameRequest(row,data) {
    if(row.kind!==data.kind||row.date!==data.date||row.description!==String(data.description||'').trim())return false;
    if(data.kind==='advance')return Number(row.amount)===Number(data.amount)&&String(row.paymentInfo||'')===String(data.paymentInfo||'');
    return row.type===data.type&&row.title===(data.type==='leave'?'Đơn xin nghỉ':String(data.title||'').trim())&&JSON.stringify(row.sessions||[])===JSON.stringify(data.sessions||[]);
  }
  async function createWorkflowDirect(data) {
    const {db,s}=workflowStore(),uid=state.user.uid,requestId=`${uid}_${data.clientRequestId}`;
    if(!/^[a-zA-Z0-9-]{16,60}$/.test(data.clientRequestId||''))throw new Error('Mã gửi hồ sơ không hợp lệ. Hãy đóng form và tạo lại.');
    if(!validateLeaveDate(data.date))throw new Error('Ngày áp dụng không hợp lệ.');
    if(String(data.description||'').trim().length<5)throw new Error('Nội dung cần ít nhất 5 ký tự.');
    if(data.kind==='request'&&(!['leave','proposal'].includes(data.type)||data.type==='leave'&&(!Array.isArray(data.sessions)||!data.sessions.length||data.sessions.some(value=>!['morning','afternoon'].includes(value)))||data.type==='proposal'&&String(data.title||'').trim().length<3))throw new Error('Kiểm tra loại đơn, buổi nghỉ và nội dung trước khi gửi.');
    if(data.kind==='advance'&&(!Number.isSafeInteger(data.amount)||data.amount<=0||data.amount>1e12))throw new Error('Số tiền tạm ứng phải là số nguyên dương, tối đa 1.000 tỷ đồng.');
    const ref=workflowPath(s,data.kind,requestId),profileRef=s.doc(db,'users',uid);
    if(!collections[data.kind])throw new Error('Loại hồ sơ không hợp lệ.');
    const sessionList=data.kind==='request'&&data.type==='leave'?[...new Set(data.sessions)].sort():[];
    const slotRefs=sessionList.map(session=>s.doc(db,'workspaces','fbtq','leaveSlots',`${uid}_${data.date}_${session}`));
    let duplicate=false;
    await runWorkflowTransaction(s,db,async transaction=>{
      const [profileSnap,existingSnap,...slotSnaps]=await Promise.all([transaction.get(profileRef),transaction.get(ref),...slotRefs.map(slot=>transaction.get(slot))]);
      const profile=profileSnap.exists()?profileSnap.data():null,user=actorFromProfile(uid,profile);
      if(data.kind==='request'&&!user.department)throw new Error('Nhờ Giám đốc gán phòng ban cho tài khoản trước khi tạo đơn từ.');
      if(existingSnap.exists()){
        if(!sameRequest(existingSnap.data(),data))throw new Error('Mã gửi này đã gắn với nội dung hồ sơ khác. Đóng form và tạo hồ sơ mới.');
        duplicate=true;return;
      }
      if(slotSnaps.some(snap=>snap.exists()))throw new Error('Buổi nghỉ này đã có đơn chờ duyệt hoặc đã được duyệt.');
      const now=new Date().toISOString(),stageFirst=data.kind==='advance'?'manager':'department',stageSecond=data.kind==='advance'?'accountant':'branch';
      const record={schemaVersion:1,kind:data.kind,createdBy:uid,createdByName:user.name,photoData:user.photoData,branch:user.branch,department:user.department,description:String(data.description).trim(),status:'pending',createdAt:s.serverTimestamp(),createdDate:today(),updatedAt:s.serverTimestamp(),approvals:{[stageFirst]:{status:'pending'},[stageSecond]:{status:'pending'}},history:[{action:'submitted',actorUid:uid,actorName:user.name,actorRole:user.role,at:now,note:''}]};
      if(data.kind==='advance')Object.assign(record,{amount:data.amount,date:data.date,title:'Tạm ứng chạy quảng cáo',paymentInfo:String(data.paymentInfo||'').trim(),disbursement:null});
      else Object.assign(record,{type:data.type,title:data.type==='leave'?'Đơn xin nghỉ':String(data.title||'').trim(),date:data.date,sessions:sessionList});
      transaction.set(ref,record);
      slotRefs.forEach((slot,index)=>transaction.set(slot,{requestId,createdBy:uid,date:data.date,session:sessionList[index],branch:user.branch,department:user.department}));
    });
    return {ok:true,id:requestId,duplicate};
  }
  function history(row) {
    const events=row.history||[{action:'submitted',at:row.submittedAt,actorName:row.createdByName||row.employee,note:row.description},...(row.reviewedAt?[{action:row.status==='approved'?'approve':'reject',at:row.reviewedAt,actorName:row.reviewedBy||'Người duyệt',note:'Hồ sơ theo quy trình cũ'}]:[])];
    const labels={submitted:'Tạo và gửi hồ sơ',approve:'Phê duyệt',reject:'Từ chối',disbursed:'Ghi nhận cấp tiền'};
    openModal(row.kind==='advance'?'Chi tiết hóa đơn tạm ứng':'Chi tiết đơn từ',`<div class="wf-detail">${person(row)}<p>${badge(row.status,row.legacy?(row.status==='approved'?'Đã duyệt (quy trình cũ)':row.status==='rejected'?'Từ chối (quy trình cũ)':'Hồ sơ cũ · chờ xử lý'):null)}</p><dl><dt>Mã hồ sơ</dt><dd>${esc(row.id)}</dd><dt>Ngày áp dụng</dt><dd>${formatDate(row.date)}</dd>${row.kind==='advance'?`<dt>Số tiền</dt><dd>${money(row.amount)}</dd><dt>Thông tin nhận tiền</dt><dd>${esc(row.paymentInfo||'Chưa cung cấp')}</dd>`:`<dt>Loại đơn / buổi</dt><dd>${esc(row.title||row.type)} ${(row.sessions||[]).map(s=>SESSION_LABELS[s]).join(' + ')}</dd>`}<dt>Nội dung</dt><dd>${esc(row.description)}</dd>${row.disbursement?`<dt>Cấp tiền</dt><dd>${money(row.disbursement.amount)} · ${formatDate(row.disbursement.date)} · ${esc(row.disbursement.reference)}</dd>`:''}</dl><div class="wf-approval-detail">${approvals(row)}</div><h4>Lịch sử xử lý</h4><ol class="wf-timeline">${events.map(e=>`<li><b>${labels[e.action]||esc(e.action)}${e.stage?' · '+stageNames[e.stage]:''}</b><span>${esc(e.actorName||'Chưa ghi nhận')} ${e.actorRole?'· '+esc(roleName(e.actorRole)):''}</span><time>${esc(time(e.at))}</time>${e.note?`<p>${esc(e.note)}</p>`:''}</li>`).join('')}</ol></div>`,'',null);
  }
  function decide(row,decision) {
    const stage=nextStage(row);if(!canReview(row,stage))return showToast('Bạn không có quyền duyệt bước này.','error');
    openModal(decision==='approve'?'Phê duyệt hồ sơ':'Từ chối hồ sơ',`${person(row)}<p>${esc(row.title)}${row.kind==='advance'?' · '+money(row.amount):''}</p><p>Bước duyệt: <b>${stageNames[stage]}</b></p><div class="modal-fields"><label>${decision==='reject'?'Lý do từ chối (bắt buộc)':'Ghi chú phê duyệt'}<textarea name="note" maxlength="2000" ${decision==='reject'?'required minlength="3"':''}></textarea></label></div>`,decision==='approve'?'Phê Duyệt':'Từ Chối',async form=>{await reviewWorkflowDirect(row,stage,decision,String(form.get('note')||'').trim());closeModal();showToast(decision==='approve'?'Đã ghi nhận phê duyệt.':'Đã ghi nhận từ chối.');});
  }
  function nextStageForRecord(record) {const stages=stageKeys(record.kind);return record.approvals?.[stages[0]]?.status==='approved'?stages[1]:stages[0];}
  async function reviewWorkflowDirect(row,stage,decision,note) {
    const {db,s}=workflowStore(),uid=state.user.uid,ref=workflowPath(s,row.kind,row.id),profileRef=s.doc(db,'users',uid);
    if(!['approve','reject'].includes(decision)||decision==='reject'&&note.length<3)throw new Error('Vui lòng kiểm tra quyết định và lý do từ chối.');
    await runWorkflowTransaction(s,db,async transaction=>{
      const [profileSnap,recordSnap]=await Promise.all([transaction.get(profileRef),transaction.get(ref)]);
      if(!recordSnap.exists())throw new Error('Không tìm thấy hồ sơ. Tải lại danh sách rồi thử lại.');
      const user=actorFromProfile(uid,profileSnap.exists()?profileSnap.data():null),record={...recordSnap.data(),id:recordSnap.id};
      if(record.status!=='pending')throw new Error('Hồ sơ đã được xử lý. Tải lại danh sách.');
      if(nextStageForRecord(record)!==stage||!canReview(record,stage))throw new Error('Bạn không có quyền duyệt bước này hoặc chưa đến lượt duyệt.');
      const second=stageKeys(record.kind)[1];
      if(Object.values(record.approvals||{}).some(item=>item.actorUid===uid))throw new Error('Hai cấp phê duyệt phải do hai người khác nhau thực hiện.');
      const now=new Date().toISOString(),status=decision==='reject'?'rejected':stage===second?'approved':'pending';
      const approval={status:decision==='approve'?'approved':'rejected',actorUid:uid,actorName:user.name,actorRole:user.role,at:now,note};
      const approvals={...record.approvals,[stage]:approval},history=[...(record.history||[]),{...approval,action:decision,stage}];
      const slotRefs=record.kind==='request'&&record.type==='leave'&&decision==='reject'?(record.sessions||[]).map(session=>s.doc(db,'workspaces','fbtq','leaveSlots',`${record.createdBy}_${record.date}_${session}`)):[];
      const slots=await Promise.all(slotRefs.map(slot=>transaction.get(slot)));
      transaction.update(ref,{approvals,status,updatedAt:s.serverTimestamp(),history});
      slots.forEach((snap,index)=>{if(snap.exists())transaction.delete(slotRefs[index]);});
    });
  }
  function disburse(row) {
    openModal('Xác nhận đã cấp tiền',`${person(row)}<p>Số tiền: <b>${money(row.amount)}</b></p><p>Ghi nhận sau khi đã chuyển tiền hoặc chi tiền mặt cho người nhận.</p><div class="modal-fields"><label>Ngày cấp tiền<input name="date" type="date" value="${today()}" max="${today()}" required></label><label>Mã giao dịch / phiếu chi<input name="reference" minlength="3" maxlength="200" required></label></div>`,'Xác nhận đã cấp tiền',async form=>{await disburseAdvanceDirect(row,String(form.get('date')||''),String(form.get('reference')||'').trim());closeModal();showToast('Đã lưu lịch sử cấp tiền.');});
  }
  async function disburseAdvanceDirect(row,date,reference) {
    const {db,s}=workflowStore(),uid=state.user.uid,ref=workflowPath(s,'advance',row.id),profileRef=s.doc(db,'users',uid);
    if(!validateLeaveDate(date)||date>today()||reference.length<3)throw new Error('Nhập ngày cấp tiền không ở tương lai và mã giao dịch/phiếu chi hợp lệ.');
    await runWorkflowTransaction(s,db,async transaction=>{
      const [profileSnap,recordSnap]=await Promise.all([transaction.get(profileRef),transaction.get(ref)]);
      if(!recordSnap.exists())throw new Error('Không tìm thấy hóa đơn tạm ứng. Tải lại danh sách.');
      const user=actorFromProfile(uid,profileSnap.exists()?profileSnap.data():null),record=recordSnap.data();
      if(user.role!=='accountant'||uid===record.createdBy)throw new Error('Chỉ kế toán được ghi nhận cấp tiền cho người khác.');
      if(record.status!=='approved'||record.disbursement||record.approvals?.manager?.status!=='approved'||record.approvals?.accountant?.status!=='approved')throw new Error('Hóa đơn phải được duyệt đủ hai cấp và chưa cấp tiền.');
      const now=new Date().toISOString(),disbursement={amount:record.amount,reference,date,actorUid:uid,actorName:user.name,at:now},history=[...(record.history||[]),{action:'disbursed',actorUid:uid,actorName:user.name,actorRole:user.role,at:now,note:reference}];
      transaction.update(ref,{status:'disbursed',disbursement,updatedAt:s.serverTimestamp(),history});
    });
  }
  function handleAction(kind,button) {
    const action=button.dataset.wfAction,row=records[kind].find(row=>(row.legacy?'legacy:':'')+row.id===button.dataset.wfId);
    if(action==='create')return create(kind);
    if(action==='refresh')return start();
    if(action==='reset'){for(const input of page(kind).querySelectorAll('[data-wf-filter]'))if(input.tagName==='SELECT')input.value='all';$('[data-wf-date-label]',page(kind)).hidden=true;return render(kind);}
    if(action==='export'){
      if(loading.request||errors.request)return showToast('Hãy chờ tải đầy đủ đơn từ trước khi xuất bảng.','error');
      const month=$('#wfLeaveMonth').value;if(!monthDays(month).length)return showToast('Chọn tháng cần xuất.','error');
      try{downloadWorkbook(leaveWorkbook(records.request,month,reportFilter(),reportPeople()),`Thong-ke-nghi-${month}.xlsx`);showToast('Đã xuất lịch nghỉ, chi tiết đơn và chú giải màu.');}catch(error){showToast(error.message,'error');}return;
    }
    if(!row)return;
    if(action==='history')history(row);else if(action==='disburse')disburse(row);else if(['approve','reject'].includes(action))decide(row,action);
  }
  function stop() {generation++;subscriptions.forEach(fn=>fn());subscriptions=[];records.advance=[];records.request=[];errors={advance:'',request:''};warnings={advance:'',request:''};loading={advance:false,request:false};}
  function start() {
    stop();for(const kind of ['advance','request'])render(kind);if(!state.user||!state.firebase)return;
    const epoch=generation,{db,storeMod:s}=state.firebase,uid=state.user.uid,projectId=state.firebase.app?.options?.projectId||window.FBTQ_FIREBASE_CONFIG?.projectId||'';
    for(const kind of ['advance','request']) {
      loading[kind]=true;const ref=s.collection(db,'workspaces','fbtq',collections[kind]),queries=[];
      if(state.role==='director'||kind==='advance'&&state.role==='accountant')queries.push(ref);
      else {
        queries.push(s.query(ref,s.where('createdBy','==',uid)));
        if(branch(state.user)&&state.role==='branch_manager')queries.push(s.query(ref,s.where('branch','==',branch(state.user))));
        if(kind==='request'&&state.role==='department_manager'&&branch(state.user)&&state.user.department)queries.push(s.query(ref,s.where('branch','==',branch(state.user)),s.where('department','==',state.user.department)));
      }
      const primaryCount=queries.length;
      if(kind==='request'){const legacy=s.collection(db,'workspaces','fbtq','requests');queries.push(state.role==='director'?legacy:s.query(legacy,s.where('createdBy','==',uid)));}
      const buckets=queries.map(()=>[]),ready=new Set(),sourceErrors=new Map();
      const update=()=>{
        loading[kind]=ready.size<queries.length;
        errors[kind]=[...sourceErrors].filter(([index])=>index<primaryCount).map(([,message])=>message).join(' ');
        warnings[kind]=[...sourceErrors].filter(([index])=>index>=primaryCount).map(([,message])=>'Lịch sử cũ chưa tải được: '+message).join(' ');
        records[kind]=[...new Map(buckets.flat().map(row=>[(row.legacy?'legacy:':'')+row.id,row])).values()];render(kind);
      };
      queries.forEach((q,index)=>{
        const failed=error=>{
          if(epoch!==generation||state.user?.uid!==uid)return;
          ready.add(index);buckets[index]=[];sourceErrors.set(index,workflowErrorMessage(error,index<primaryCount?collections[kind]:'requests (hồ sơ cũ)',projectId));
          console.error('Workflow subscription failed',{collection:index<primaryCount?collections[kind]:'requests',projectId,code:error?.code});update();
        };
        try{subscriptions.push(s.onSnapshot(q,snap=>{
          if(epoch!==generation||state.user?.uid!==uid)return;
          buckets[index]=snap.docs.map(doc=>{const row={...doc.data(),id:doc.id,kind};return index>=primaryCount?{...row,legacy:true,title:row.type,createdByName:row.createdByName||row.employee}:row;});
          ready.add(index);sourceErrors.delete(index);update();
        },failed));}catch(error){failed(error);}
      });
      render(kind);
    }
  }
  buildPages();render('advance');render('request');
  return {start,stop,render};
}
