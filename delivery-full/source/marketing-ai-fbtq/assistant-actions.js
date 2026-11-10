export const normalizeActionText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
export function assistantOperationalIntent(command){
 const q=normalizeActionText(command).replace(/^(?:(?:toi muon|toi can|toi|minh muon|minh can|hay|vui long|giup toi|cho toi|ban hay)\s+)*/,'');
 if(/^(?:chuc nang|tat ca chuc nang|cac thao tac|toan bo tac quyen|toan bo quyen|quyen cua toi|tro ly lam duoc gi)/.test(q))return {type:'catalog'};
 if(/^(?:sua|sua lai|chinh sua|cap nhat).*(?:bao cao|lich su)/.test(q))return {type:'editReport'};
 if(/^(?:lam|tao|lap|gui|viet).*(?:don (?:xin )?nghi|nghi phep|don tu|don de xuat|de xuat nhan su)/.test(q))return {type:'request',proposal:q.includes('de xuat')};
 if(/^(?:lam|tao|lap|gui).*(?:tam ung|ung tien)/.test(q))return {type:'advance'};
 if(/^(?:lam|tao|lap|nhap).*(?:bao cao hang ngay|bao cao quang cao)/.test(q))return {type:'report'};
 if(/^(?:cau hinh|bat|tat|thiet lap).*(?:bot|chatbot|ai tu dong)/.test(q))return {type:'chatbot'};
 if(/^xuat.*(?:vat|hoa don)/.test(q))return {type:'exportInvoices'};
 if(/^xuat.*(?:nghi|cham cong)/.test(q))return {type:'exportLeave'};
 return null;
}
export function assistantActionCatalog(role){
 const manager=['director','branch_manager','department_manager'].includes(role);
 return [
  {label:'Làm đơn nghỉ',command:'Làm đơn nghỉ'}, {label:'Tạo đề xuất',command:'Tạo đơn đề xuất'},
  {label:'Tạo tạm ứng',command:'Tạo tạm ứng'}, {label:'Báo cáo hàng ngày',command:'Tạo báo cáo hàng ngày'},
  {label:'Sửa báo cáo đã nhập',command:'Chỉnh sửa báo cáo'}, {label:'Nhập hóa đơn',command:'Nhập hóa đơn'},
  {label:'Kết nối Fanpage',command:'Kết nối Fanpage'}, {label:'Cấu hình bot',command:'Cấu hình chatbot'},
  {label:'Xuất bảng nghỉ',command:'Xuất thống kê nghỉ'}, {label:'Xuất hóa đơn VAT',command:'Xuất hóa đơn VAT'},
  {label:'Hồ sơ cá nhân',command:'Mở hồ sơ cá nhân'}, {label:'Nội dung chờ duyệt',command:'Mở kiểm duyệt nội dung'},
  {label:'Công việc',command:'Mở công việc'}, {label:'Xếp hạng',command:'Mở bảng xếp hạng'},
  {label:'Lịch sử đơn từ',command:'Mở đơn từ'}, {label:'Lịch sử hóa đơn',page:'automation'},
  ...(manager?[{label:'Giao việc',command:'Giao việc: '},{label:'Xét duyệt hồ sơ',command:'Kiểm tra hồ sơ chờ duyệt'},{label:'Công bố bảng vàng',command:'Công bố bảng vàng'},{label:'Kịch bản phản hồi',command:'Quản lý kịch bản'}]:[]),
  ...(role==='accountant'?[{label:'Cấp tiền tạm ứng',command:'Cấp tiền tạm ứng'}]:[]),
  ...(role==='director'?[{label:'Mời thành viên',command:'Mời thành viên'},{label:'Phân quyền',command:'Phân quyền'}]:[])
 ];
}
export function assistantRequestPrefill(command){
 const q=normalizeActionText(command),date=String(command).match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/),out={};
 if(date){const iso=`${date[3]}-${date[2].padStart(2,'0')}-${date[1].padStart(2,'0')}`;if(!Number.isNaN(Date.parse(iso))&&new Date(iso+'T00:00:00Z').toISOString().slice(0,10)===iso)out.date=iso;}
 if(/ca ngay|sang va chieu/.test(q))out.sessions=['morning','afternoon'];else if(/buoi sang|nghi sang/.test(q))out.sessions=['morning'];else if(/buoi chieu|nghi chieu/.test(q))out.sessions=['afternoon'];
 const reason=String(command).match(/(?:lý do|lí do|ly do|vì|vi)\s*[:：]?\s+(.+)$/i);if(reason)out.description=reason[1].trim();return out;
}
export function assistantErrorMessage(error){
 const code=String(error?.code||'');if(/not-found|unimplemented/.test(code))return 'Chức năng AI trên máy chủ chưa được triển khai. Bạn vẫn có thể dùng các lệnh nghiệp vụ hoặc chọn “Toàn bộ tác quyền”.';
 if(/internal|unavailable|deadline-exceeded/.test(code)||/^internal(?:\s*\[\d+\])?$/i.test(String(error?.message||'')))return 'Mô hình AI hiện chưa phản hồi. Hãy thử lại hoặc kiểm tra cấu hình mô hình. Các lệnh nghiệp vụ như “Làm đơn nghỉ” được xử lý trực tiếp, không cần gọi AI.';
 return error?.message||'Không thực hiện được. Hãy thử lại hoặc kiểm tra kết nối.';
}
