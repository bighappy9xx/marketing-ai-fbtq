# Ai Media FBTQ — trọn bộ mã nguồn

Đây là mã nguồn đầy đủ, không phải chỉ một bản vá. Giải nén thư mục marketing-ai-fbtq rồi mở thư mục này trong trình soạn thảo.

- Frontend: index.html, app.js, các module Studio, assets, font và âm thanh kèm giấy phép.
- Backend Firebase Functions: functions/package.json và các module; cần cài dependency trước khi triển khai.
- Chrome extension: mã nguồn trong extension. Vào chrome://extensions, bật Developer mode, chọn Load unpacked và chọn thư mục extension.
- Cấu hình Hosting, Firestore Rules và Storage Rules có kèm theo.
- Chạy kiểm tra: node scripts/check-source.cjs; chạy bộ kiểm thử trong tests.
- Xem XUAT-VIDEO-PHAN-CUNG.md cho cách xuất video ra thư mục và chuyển Final sang Kiểm duyệt.
- Xuất MP4 ưu tiên GPU hoặc dùng CPU khi không hỗ trợ; tốc độ phụ thuộc máy và trình duyệt. Chưa kiểm chứng tốc độ GPU thực tế.
- Giới hạn Final 2 GB cần cập nhật cả Firestore Rules và Storage Rules.
- Các khoá bí mật, thông tin đăng nhập, node_modules và dữ liệu người dùng không được đóng gói.
- Bản ZIP không tự triển khai website hoặc Firebase.

Tài liệu cũ đi kèm mô tả các mốc cập nhật trước. Với tính năng xuất video, dùng XUAT-VIDEO-PHAN-CUNG.md làm hướng dẫn hiện tại.
