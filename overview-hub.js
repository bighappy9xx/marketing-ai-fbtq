const branchKey=value=>String(value||'').trim().toLocaleLowerCase('vi-VN')||'__unassigned__';
const dateKey=value=>{
  if(value?.toDate)value=value.toDate();else if(value?.seconds)value=new Date(value.seconds*1000);
  if(value instanceof Date)return Number.isFinite(value.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(value):'';
  return String(value||'').slice(0,10);
};
const time=value=>value?.toMillis?.()||value?.seconds*1000||Date.parse(value||'')||0;
export function overviewHubModel({user,role,users=[],revenue=[],awards=[],reviews=[],workflow={},range={},selectedBranch='all',selectedUser='all'}){
  const director=role==='director',manager=['director','branch_manager','department_manager'].includes(role),profiles=new Map(users.map(p=>[p.uid,p]));if(user)profiles.set(user.uid,user);
  const profile=row=>profiles.get(row.createdBy||row.uid)||row;
  const withinRange=value=>{const date=dateKey(value);return !!date&&(!range.start||date>=range.start)&&(!range.end||date<=range.end);};
  const allowed=(row,publicBoard=false,finance=false)=>{
    const uid=row.createdBy||row.uid,p=profile(row),unit=branchKey(row.branch||p.branch||p.branchName||p.branchId);
    if(!user)return false;
    if(selectedUser!=='all'&&uid!==selectedUser)return false;
    if(role==='accountant'&&finance)return true;
    if(director)return selectedBranch==='all'||unit===selectedBranch;
    if(manager)return branchKey(user.branch)==='__unassigned__'?uid===user.uid:unit===branchKey(user.branch);
    return publicBoard||uid===user.uid;
  };
  const avatar=row=>{const p=profile(row);return {...row,name:row.name||row.createdByName||p.name||p.email||'Thành viên',photoData:p.photoData||row.photoData||row.createdByPhoto||''};};
  const rankMap=new Map();
  revenue.filter(r=>allowed(r,true)&&withinRange(r.reportDate||r.submittedAt)).forEach(r=>{if(!r.createdBy)return;const amount=Number(r.revenue);if(!Number.isFinite(amount)||amount<0)return;const row=rankMap.get(r.createdBy)||avatar({uid:r.createdBy,createdByName:r.createdByName,revenue:0});row.revenue+=amount;rankMap.set(r.createdBy,row);});
  const ranking=[...rankMap.values()].sort((a,b)=>b.revenue-a.revenue||a.name.localeCompare(b.name,'vi')||a.uid.localeCompare(b.uid)).map((r,i)=>({...r,rank:i+1}));
  const eligibleReviews=reviews.filter(r=>allowed(r)),eligibleRequests=(workflow.requests||[]).filter(r=>!r.legacy&&r.type==='leave'&&allowed(r)),eligibleAdvances=(workflow.advances||[]).filter(r=>!r.legacy&&allowed(r,false,true));
  const sortRecords=rows=>[...rows].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||time(b.createdAt||b.date)-time(a.createdAt||a.date));
  const events=[];
  for(const row of eligibleReviews){
    const history=(row.editHistory||[]).filter(e=>['approved','revision_requested','rejected'].includes(e.action));
    if(history.length)history.forEach((event,index)=>{if(withinRange(event.at))events.push({...event,id:row.id+'-'+index,title:row.title||'Bài viết',author:row.createdByName||profile(row).name||'Nhân viên',name:event.actorName||'Người kiểm duyệt',photoData:event.actorPhoto||profiles.get(event.actorUid)?.photoData||'',at:event.at});});
    else if(row.reviewedAt&&['approved','rejected','revision_requested'].includes(row.status)&&withinRange(row.reviewedAt))events.push({id:row.id,title:row.title||'Bài viết',author:row.createdByName||'Nhân viên',action:row.status,name:row.reviewedByName||'Người kiểm duyệt',photoData:row.reviewedByPhoto||'',at:row.reviewedAt,note:row.reviewNote||''});
  }
  return {ranking,awards:awards.filter(r=>allowed(r,true)).map(avatar).sort((a,b)=>(Number(a.rank)||999)-(Number(b.rank)||999)),leaves:sortRecords(eligibleRequests.filter(r=>r.status==='pending'||withinRange(r.date))),advances:sortRecords(eligibleAdvances.filter(r=>r.status==='pending'||withinRange(r.date))),events:events.sort((a,b)=>time(b.at)-time(a.at)),pending:{reviews:eligibleReviews.filter(r=>r.status==='pending').length,leaves:eligibleRequests.filter(r=>r.status==='pending').length,advances:eligibleAdvances.filter(r=>r.status==='pending').length},approvedFunds:eligibleAdvances.filter(r=>r.status==='approved').reduce((n,r)=>n+(Number(r.amount)||0),0),publicBoards:!manager};
}

export function initOverviewHub({state,$,esc,money,avatarMarkup,navigate,getWorkflow}){
  let context={},awardMonth='',awardRows=[],awardStatus='idle',awardStop=null,epoch=0;
  const number=n=>Number(n||0).toLocaleString('vi-VN',{maximumFractionDigits:1});
  const person=row=>`<span class="ov-person">${avatarMarkup(row.photoData||'',String(row.name||'NV').split(/\s+/).slice(-2).map(n=>n[0]).join(''),'avatar avatar-blue')}<span><b>${esc(row.name)}</b>${row.detail?`<small>${esc(row.detail)}</small>`:''}</span></span>`;
  const empty=message=>`<div class="ov-empty">${esc(message)}</div>`;
  const date=value=>{const d=dateKey(value);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.split('-').reverse().join('/'):d||'—';};
  const statusLabels={pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối',disbursed:'Đã cấp tiền',revision_requested:'Cần chỉnh sửa'};
  const badge=s=>`<span class="ov-status ov-status-${esc(s)}">${esc(statusLabels[s]||s||'Chưa rõ')}</span>`;
  function watchAwards(month){
    if(awardMonth===month)return;awardMonth=month;awardRows=[];awardStatus='loading';awardStop?.();awardStop=null;const run=++epoch;
    const {db,storeMod:s}=state.firebase||{};
    if(!s?.onSnapshot||!month){awardStatus='offline';return;}
    try{awardStop=s.onSnapshot(s.query(s.collection(db,'workspaces','fbtq','workAwardScores'),s.where('monthKey','==',month)),snapshot=>{if(run!==epoch)return;awardRows=snapshot.docs.map(doc=>({uid:doc.id.slice(month.length+1),...doc.data()}));awardStatus='ready';render();},error=>{if(run!==epoch)return;awardStatus='error';console.error('Overview published awards',error.code);render();});}catch(error){awardStatus='error';console.error('Overview awards',error);}
  }
  function render(next){
    if(next)context=next;if(!$('#overviewRankingList'))return;
    if(state.user)watchAwards(String(context.range?.end||new Date().toISOString()).slice(0,7));
    const workflow=getWorkflow?.()||{},model=overviewHubModel({user:state.user,role:state.role,users:state.users,revenue:state.revenueEntries.length?state.revenueEntries:state.dailyReports,awards:awardRows,reviews:state.reviews,workflow,...context});
    const pending=model.pending;
    $('#overviewPendingReviews').textContent=number(pending.reviews);$('#overviewPendingLeaves').textContent=workflow.loading?.request||workflow.errors?.request?'—':number(pending.leaves);$('#overviewPendingAdvances').textContent=workflow.loading?.advance||workflow.errors?.advance?'—':number(pending.advances);
    $('#overviewRankingCaption').textContent=(model.publicBoards?'Xếp hạng doanh thu công ty':'Xếp hạng doanh thu trong phạm vi đã chọn')+' · '+(context.periodLabel||'Kỳ hiện tại');
    $('#overviewRankingList').innerHTML=model.ranking.length?model.ranking.slice(0,5).map(r=>`<div class="ov-rank-row"><span class="ov-rank ov-rank-${r.rank}">${r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:'#'+r.rank}</span>${person(r)}<strong>${money(r.revenue)}</strong></div>`).join(''):empty('Chưa có báo cáo doanh thu trong kỳ này.');
    $('#overviewAwardsCaption').textContent='Điểm đã công bố · '+(awardMonth?awardMonth.slice(5)+'/'+awardMonth.slice(0,4):'Tháng hiện tại');
    $('#overviewAwardPodium').innerHTML=awardStatus==='ready'?(model.awards.length?model.awards.slice(0,3).map(r=>`<article class="ov-award ov-award-${Number(r.rank)||4}"><span class="ov-award-medal">${['🥇','🥈','🥉'][Number(r.rank)-1]||'#'+r.rank}</span>${avatarMarkup(r.photoData||'',String(r.name||'NV').slice(0,2),'avatar avatar-blue')}<b>${esc(r.name)}</b><strong>${number(r.score)}<small> / 10 điểm</small></strong></article>`).join(''):empty('Chưa có bảng điểm đã công bố cho tháng này.')):empty(awardStatus==='error'?'Không tải được điểm đã công bố. Kiểm tra kết nối hoặc quyền Firestore.':awardStatus==='loading'?'Đang tải điểm đã công bố…':'Đăng nhập để xem bảng vàng đã công bố.');
    const workflowMessage=kind=>workflow.errors?.[kind]|| (workflow.loading?.[kind]?'Đang tải hồ sơ…':'');
    $('#overviewLeaveList').innerHTML=workflowMessage('request')?empty(workflowMessage('request')):model.leaves.length?model.leaves.slice(0,5).map(r=>`<div class="ov-record-row">${person({name:r.createdByName,photoData:r.photoData||state.users.find(p=>p.uid===r.createdBy)?.photoData,detail:date(r.date)+' · '+(r.sessions?.length===2?'Cả ngày':r.sessions?.includes('morning')?'Nghỉ sáng':r.sessions?.includes('afternoon')?'Nghỉ chiều':'Xem chi tiết')})}${badge(r.status)}</div>`).join(''):empty('Chưa có đơn xin nghỉ trong kỳ hoặc đang chờ duyệt.');
    $('#overviewAdvanceList').innerHTML=workflowMessage('advance')?empty(workflowMessage('advance')):model.advances.length?model.advances.slice(0,5).map(r=>`<div class="ov-record-row">${person({name:r.createdByName,photoData:r.photoData||state.users.find(p=>p.uid===r.createdBy)?.photoData,detail:date(r.date)+' · '+money(r.amount)})}${badge(r.status)}</div>`).join(''):empty('Chưa có hóa đơn tạm ứng trong kỳ hoặc đang chờ duyệt.');
    $('#overviewApprovedFunds').textContent=workflowMessage('advance')?'Đang chờ tải đủ dữ liệu':'Đã duyệt, chờ cấp: '+money(model.approvedFunds);
    $('#overviewReviewHistory').innerHTML=model.events.length?model.events.slice(0,6).map(e=>`<div class="ov-audit-row"><span class="ov-audit-mark ${e.action==='approved'?'is-approved':''}">${e.action==='approved'?'✓':'↺'}</span><div><b>${esc(e.title)}</b><small>${esc(e.author)} · ${esc(e.name)} · ${date(e.at)}</small>${e.note?`<p>${esc(e.note)}</p>`:''}</div>${badge(e.action)}</div>`).join(''):empty('Chưa có lượt kiểm duyệt đã xử lý trong kỳ đã chọn.');
  }
  $('#page-overview').addEventListener('click',event=>{const button=event.target.closest('[data-overview-go]');if(button)navigate(button.dataset.overviewGo);});
  function stop(){epoch++;awardStop?.();awardStop=null;awardMonth='';awardRows=[];awardStatus='idle';context={};}
  return {render,stop};
}
