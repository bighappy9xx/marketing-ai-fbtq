'use strict';

// All workflow writes run on the server. Profiles, decisions and history are never trusted from the client.
const COLLECTIONS = { advance: 'advanceInvoices', request: 'staffRequests' };
class WorkflowError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new WorkflowError(code, message); };
const text = (value, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const branchOf = p => text(p.branch || p.branchName || p.branchId, 120);
const todayVN = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
function actor(uid, profile) {
  if (!uid || !profile || profile.approved === false) fail('permission-denied', 'Tài khoản chưa được phép sử dụng chức năng này.');
  return { uid, name: text(profile.name || profile.email, 160), role: profile.role || 'employee', branch: branchOf(profile), department: text(profile.department, 120), photoData: text(profile.photoData, 180000) };
}
function stagesFor(kind) { return kind === 'advance' ? ['manager', 'accountant'] : ['department', 'branch']; }
function canReview(record, user, stage) {
  if (record.createdBy === user.uid) return false;
  const sameBranch = !!user.branch && user.branch === record.branch;
  if (record.kind === 'advance') return stage === 'manager' ? user.role === 'branch_manager' && sameBranch : stage === 'accountant' && user.role === 'accountant';
  return stage === 'department' ? user.role === 'department_manager' && sameBranch && !!user.department && user.department === record.department : stage === 'branch' && user.role === 'branch_manager' && sameBranch;
}
function createRecord(kind, input, user, now) {
  if (!COLLECTIONS[kind]) fail('invalid-argument', 'Loại hồ sơ không hợp lệ.');
  if (!user.branch || (kind === 'request' && !user.department)) fail('failed-precondition', 'Nhờ Giám đốc gán chi nhánh và phòng ban cho tài khoản trước khi tạo hồ sơ.');
  const description = text(input.description);
  if (description.length < 5) fail('invalid-argument', 'Nội dung cần ít nhất 5 ký tự.');
  const [first, second] = stagesFor(kind);
  const record = {
    schemaVersion: 1, kind, createdBy: user.uid, createdByName: user.name, photoData: user.photoData,
    branch: user.branch, department: user.department, description,
    status: 'pending', createdAt: now.toISOString(), createdDate: todayVN(now), updatedAt: now.toISOString(),
    approvals: { [first]: { status: 'pending' }, [second]: { status: 'pending' } },
    history: [{ action: 'submitted', actorUid: user.uid, actorName: user.name, actorRole: user.role, at: now.toISOString(), note: '' }]
  };
  if (kind === 'advance') {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 1e12) fail('invalid-argument', 'Số tiền tạm ứng phải là số nguyên dương, tối đa 1.000 tỷ đồng.');
    if (!validDate(input.date)) fail('invalid-argument', 'Ngày đề nghị không hợp lệ.');
    Object.assign(record, { amount: input.amount, date: input.date, title: 'Tạm ứng chạy quảng cáo', paymentInfo: text(input.paymentInfo, 500), disbursement: null });
  } else {
    if (!['leave', 'proposal'].includes(input.type)) fail('invalid-argument', 'Chọn đơn xin nghỉ hoặc đơn đề xuất.');
    if (!validDate(input.date)) fail('invalid-argument', 'Ngày áp dụng không hợp lệ.');
    const sessions = input.type === 'leave' ? [...new Set(Array.isArray(input.sessions) ? input.sessions : [])].sort() : [];
    if (input.type === 'leave' && (!sessions.length || sessions.some(s => !['morning', 'afternoon'].includes(s)))) fail('invalid-argument', 'Chọn buổi nghỉ sáng, chiều hoặc cả ngày.');
    const title = input.type === 'leave' ? 'Đơn xin nghỉ' : text(input.title, 160);
    if (title.length < 3) fail('invalid-argument', 'Nhập tiêu đề đề xuất.');
    Object.assign(record, { type: input.type, title, date: input.date, sessions });
  }
  return record;
}
function reviewRecord(record, input, user, now) {
  if (record.status !== 'pending') fail('failed-precondition', 'Hồ sơ đã được xử lý. Hãy tải lại danh sách.');
  const [first, second] = stagesFor(record.kind);
  const stage = record.approvals[first].status === 'pending' ? first : second;
  if (input.stage !== stage || !canReview(record, user, stage)) fail('permission-denied', 'Bạn không có quyền duyệt ở bước này hoặc chưa đến lượt duyệt.');
  if (Object.values(record.approvals).some(a => a.actorUid === user.uid)) fail('permission-denied', 'Hai cấp phê duyệt phải do hai người khác nhau thực hiện.');
  if (!['approve', 'reject'].includes(input.decision)) fail('invalid-argument', 'Quyết định không hợp lệ.');
  const note = text(input.note);
  if (input.decision === 'reject' && note.length < 3) fail('invalid-argument', 'Vui lòng ghi lý do từ chối.');
  const status = input.decision === 'approve' ? 'approved' : 'rejected';
  const approval = { status, actorUid: user.uid, actorName: user.name, actorRole: user.role, at: now.toISOString(), note };
  return { ...record, approvals: { ...record.approvals, [stage]: approval }, status: status === 'rejected' ? 'rejected' : stage === second ? 'approved' : 'pending', updatedAt: now.toISOString(), history: [...record.history, { ...approval, action: input.decision, stage }] };
}
function disburseRecord(record, input, user, now) {
  if (record.kind !== 'advance' || user.role !== 'accountant' || user.uid === record.createdBy) fail('permission-denied', 'Chỉ kế toán được ghi nhận cấp tiền cho người khác.');
  if (record.status !== 'approved' || record.disbursement || Object.values(record.approvals).some(a => a.status !== 'approved')) fail('failed-precondition', 'Hóa đơn phải được duyệt đủ hai cấp và chưa cấp tiền.');
  const reference = text(input.reference, 200);
  if (reference.length < 3 || !validDate(input.date) || input.date > todayVN(now)) fail('invalid-argument', 'Nhập mã giao dịch/phiếu chi và ngày cấp tiền hợp lệ, không ở tương lai.');
  const disbursement = { amount: record.amount, reference, date: input.date, actorUid: user.uid, actorName: user.name, at: now.toISOString() };
  return { ...record, status: 'disbursed', disbursement, updatedAt: now.toISOString(), history: [...record.history, { action: 'disbursed', actorUid: user.uid, actorName: user.name, actorRole: user.role, at: now.toISOString(), note: reference }] };
}
function slotIds(record) { return record.kind === 'request' && record.type === 'leave' ? record.sessions.map(s => `${record.createdBy}_${record.date}_${s}`) : []; }
module.exports = { COLLECTIONS, WorkflowError, actor, createRecord, reviewRecord, disburseRecord, slotIds, validDate, canReview, stagesFor };
