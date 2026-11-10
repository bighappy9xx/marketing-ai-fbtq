# Cập nhật báo cáo ngày và Trợ lý FBTQ

- Bỏ nút Nhập chỉ số và Sao chép từ Facebook Ads. Nhập CSV/JSON qua Trợ lý hoặc báo cáo ngày.
- Báo cáo mặc định ngày hiện tại theo giờ Việt Nam. Ngày chưa có báo cáo mở biểu mẫu trống; chọn ngày cũ để xem/chỉnh dữ liệu đã lưu. Không tự xoá số liệu cũ. Khi qua nửa đêm, giữ dữ liệu chưa lưu và có nút Hôm nay để chuyển ngày.
- So sánh hai ngày trong Hiệu suất marketing, áp dụng phạm vi tài khoản/nhân sự hiện có.
- Lịch sử chat riêng từng tài khoản: bộ đệm 200 tin trên thiết bị; đồng bộ assistantChatMessages, tải 100 tin/lần và có nút xem cũ hơn. Nội dung lịch sử không khôi phục nút thực thi cũ.
- Mở rộng cửa sổ Trợ lý bằng nút phóng to. Lệnh Quyền & chức năng hiển thị khả năng theo vai trò.
- Biểu mẫu thay đổi dữ liệu yêu cầu Phê Duyệt hoặc Từ Chối trước khi gửi. Xác nhận gắn tài khoản, nội dung và thời hạn 5 phút. Quy trình quản lý/kế toán/trưởng phòng vẫn giữ nguyên; xác nhận thao tác không cấp thêm quyền.

## Triển khai
Cập nhật các tệp giao diện và module đi kèm. Publish firestore.rules và firestore.indexes.json cho đúng Firebase project. Chờ composite index assistantChatMessages (createdBy tăng, createdAt giảm) sẵn sàng. Chưa publish rules/index thì chat vẫn lưu trên thiết bị, hiển thị trạng thái chưa đồng bộ. Các chức năng backend hiện có vẫn cần triển khai và phân quyền như trước.

## Kiểm tra
17 unit tests và kiểm tra ánh xạ extension đạt. Kiểm thử Chrome với Firebase giả lập xác nhận báo cáo trống ngày mới, giữ ngày cũ, so sánh, từ chối không ghi, thay đổi nội dung huỷ xác nhận, chống sửa payload thao tác, lịch sử chat tách tài khoản và mở rộng cửa sổ. Không thử ghi vào Firebase thật. Bộ workflows-browser cũ dùng mock callable không còn khớp luồng Firestore trực tiếp hiện tại; không dùng để kết luận triển khai production.
