# Meta Helper 2.9.0 — Điền trực tiếp

## Sử dụng
- Chiến dịch: tích dòng ở Meta → Quét → Điền Báo cáo hàng ngày. Website chuyển sang Hiệu suất marketing, mở biểu mẫu và điền đúng nhóm vừa chọn. Không mở trang Trợ lý, không tạo tin nhắn chat.
- Hóa đơn: gửi PDF Meta hoặc chọn PDF đã tải. Website chuyển sang Báo cáo hóa đơn, mở biểu mẫu PDF và tự đọc để điền thông tin. Kiểm tra trước khi Lưu và gửi duyệt.
- Nếu website chưa đăng nhập, đăng nhập để nhận dữ liệu đang chờ trong hàng đợi tiện ích.
- Chỉ số và hóa đơn vẫn cần kiểm tra/phê duyệt khi lưu; không tự xác nhận hóa đơn.

## Cập nhật hai phần
1. Giải nén gói Website-Direct-Import-2.9.0, sao chép các tệp giao diện vào dự án website, commit/push và chờ GitHub Pages xuất bản xong. Gói không đổi Firebase Rules hay Cloud Functions, không cần triển khai backend cho thay đổi điều hướng này.
2. Giải nén extension-only FBTQ-Meta-Helper-Chrome-2.9.0.zip, tắt bản cũ, Load unpacked đúng thư mục có manifest.json. Nếu thay tệp tại thư mục đã nạp thì bấm Reload. Chỉ bật một phiên bản.
3. Tải lại cả website và Meta bằng Command + Shift + R. Kiểm tra Meta Helper hiện 2.9.0.
4. Thử gửi một chiến dịch và một PDF. Không dùng thư mục website làm thư mục cài tiện ích.

## Kiểm tra
Đã kiểm thử ánh xạ cột giữ nguyên, đường nhận dữ liệu chỉ mở analytics/automation và chuyển tệp PDF đúng input, đường mở tab mới của extension và tái sử dụng tab hiện có. Chưa triển khai website hoặc cài lên Chrome của người dùng trong phiên này.
