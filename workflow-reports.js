// Pure report builders shared by the screen and the spreadsheet export.
export const STATUS_LABELS = { pending: 'Chờ duyệt', approved: 'Đã duyệt đủ 2 cấp', rejected: 'Từ chối', disbursed: 'Đã cấp tiền' };
export const SESSION_LABELS = { morning: 'Nghỉ Sáng', afternoon: 'Nghỉ Chiều' };
export function monthDays(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, m] = month.split('-').map(Number), count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
export function leaveSummary(records, month, filter = {}, users = []) {
  const days = monthDays(month), people = new Map();
  const allowed = row => (!filter.branch || filter.branch === 'all' || row.branch === filter.branch) && (!filter.user || filter.user === 'all' || (row.createdBy || row.uid) === filter.user);
  const add = row => {
    const uid = row.createdBy || row.uid;
    if (!uid || !allowed(row)) return null;
    if (!people.has(uid)) people.set(uid, { uid, name: row.createdByName || row.name || uid, branch: row.branch || '', department: row.department || '', photoData: row.photoData || '', dates: {}, morning: 0, afternoon: 0, pending: new Set() });
    return people.get(uid);
  };
  users.forEach(add);
  records.filter(row => !row.legacy && row.type === 'leave' && days.includes(row.date) && ['approved','pending'].includes(row.status)).forEach(row => {
    const person = add(row); if (!person) return;
    if (row.status === 'pending') { person.pending.add(row.id); return; }
    if (!person.dates[row.date]) person.dates[row.date] = new Set();
    (row.sessions || []).filter(s => SESSION_LABELS[s]).forEach(s => person.dates[row.date].add(s));
  });
  return [...people.values()].map(person => {
    for (const sessions of Object.values(person.dates)) { if (sessions.has('morning')) person.morning++; if (sessions.has('afternoon')) person.afternoon++; }
    return { ...person, totalDays: (person.morning + person.afternoon) / 2, pendingCount: person.pending.size };
  }).sort((a,b) => a.name.localeCompare(b.name,'vi'));
}
export function dayMark(sessions) {
  return sessions?.size === 2 ? { text:'S+C', style:4, css:'full' } : sessions?.has('morning') ? { text:'S', style:2, css:'morning' } : sessions?.has('afternoon') ? { text:'C', style:3, css:'afternoon' } : { text:'', style:0, css:'' };
}
export function leaveWorkbook(records, month, filter, users = []) {
  const days = monthDays(month), summary = leaveSummary(records, month, filter, users);
  const selected = records.filter(row => !row.legacy && row.type === 'leave' && days.includes(row.date) && (!filter.branch || filter.branch==='all' || row.branch===filter.branch) && (!filter.user || filter.user==='all' || row.createdBy===filter.user));
  return [
    { name:'Lịch nghỉ tháng', freeze:3, widths:[27,22,22,...days.map(()=>5),12,12,14,14], rows:[
      ['Nhân viên','Chi nhánh','Phòng ban',...days.map(d=>Number(d.slice(-2))),'Buổi sáng','Buổi chiều','Quy đổi ngày','Đơn chờ duyệt'].map(value=>({value,style:1})),
      ...summary.map(p=>[p.name,p.branch,p.department,...days.map(date=>{const mark=dayMark(p.dates[date]);return {value:mark.text,style:mark.style};}),p.morning,p.afternoon,p.totalDays,p.pendingCount])
    ] },
    { name:'Chi tiết đơn nghỉ', freeze:2, widths:[30,27,22,22,15,18,26,48,25,25], rows:[
      ['Mã đơn','Nhân viên','Chi nhánh','Phòng ban','Ngày nghỉ','Buổi nghỉ','Trạng thái','Lý do','Trưởng phòng','Quản lý chi nhánh'].map(value=>({value,style:1})),
      ...selected.map(r=>[r.id,r.createdByName,r.branch,r.department,r.date,r.sessions.map(s=>SESSION_LABELS[s]).join(', '),{value:STATUS_LABELS[r.status],style:r.status==='pending'?5:r.status==='rejected'?6:7},r.description,r.approvals?.department?.actorName||'',r.approvals?.branch?.actorName||''])
    ] },
    { name:'Chú giải', widths:[26,75], rows:[[{value:'Tháng báo cáo',style:1},{value:month,style:1}],['Chi nhánh',filter.branch==='all'?'Tất cả trong phạm vi truy cập':filter.branch],['User',filter.user==='all'?'Tất cả trong phạm vi truy cập':filter.user],[{value:'S',style:2},'Nghỉ sáng đã duyệt: 0,5 ngày'],[{value:'C',style:3},'Nghỉ chiều đã duyệt: 0,5 ngày'],[{value:'S+C',style:4},'Nghỉ cả ngày đã duyệt: 1 ngày'],[{value:'Chờ duyệt',style:5},'Không cộng vào tổng ngày nghỉ'],[{value:'Từ chối',style:6},'Không cộng vào tổng ngày nghỉ'],['Ô trống','Không có buổi nghỉ đã duyệt; không phải xác nhận có mặt'],['Hồ sơ cũ','Không tính hồ sơ cũ thiếu buổi nghỉ hoặc phê duyệt hai cấp'],['Cách tính','Một user / ngày / buổi chỉ được tính một lần.']] }
  ];
}
