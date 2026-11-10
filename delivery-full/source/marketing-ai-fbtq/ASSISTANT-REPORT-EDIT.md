# Trợ lý FBTQ và chỉnh sửa lịch sử báo cáo

## Trợ lý
- Nút Toàn bộ tác quyền trong khung Trợ lý mở các thao tác theo vai trò. Các lệnh nghiệp vụ có hỗ trợ như Làm đơn nghỉ / Giúp tôi làm đơn xin nghỉ không cần gọi mô hình AI.
- Ví dụ: Làm đơn nghỉ ngày 10/11/2026 buổi chiều lý do: việc gia đình. Trợ lý mở đúng biểu mẫu và điền ngày/buổi/lý do được nhận diện. Người dùng kiểm tra và bổ sung các mục bắt buộc rồi phê duyệt gửi.
- Tạo đề xuất, tạm ứng, báo cáo ngày; nhập hóa đơn; mở cấu hình Fanpage/bot; xuất thống kê nghỉ và VAT; mở hồ sơ, công việc, bảng xếp hạng. Quản lý có giao việc, xét duyệt và công bố bảng vàng; kế toán có cấp tiền theo quy trình; giám đốc có lời mời và phân quyền.
- Phê duyệt/từ chối hồ sơ, cập nhật công việc và sửa hạn tiếp tục dùng quy trình xác nhận hiện có. Các biểu mẫu thay đổi dữ liệu vẫn hiện Phê Duyệt/Từ Chối trước khi gửi. Không cấp quyền mới, không dùng văn bản mô hình để tự thực thi thao tác.
- Trò chuyện AI vẫn cần endpoint và khóa mô hình đã cấu hình. Lỗi internal [0] được thay bằng thông báo dễ hiểu; bản sửa lệnh nghiệp vụ không khắc phục thay cho cấu hình/quota AI ở máy chủ.

## Chỉnh sửa báo cáo
- Hiệu suất marketing → Lịch sử báo cáo → Chỉnh sửa ở cột đầu tiên. Cột được ghim để không phải cuộn sang cuối bảng.
- Người tạo báo cáo được sửa bản ghi của mình theo Rules hiện có. Với báo cáo của người khác, hiện Chỉ người tạo. Bản này không mở rộng quyền sửa chéo cho quản lý/giám đốc.
- Sửa ngày, tài khoản, tên chiến dịch, trạng thái, ngân sách, chi tiêu, Mess, SĐT, doanh thu, KPI, đơn giá, ngưỡng, vấn đề, hướng xử lý và ghi chú. Bắt buộc ghi lý do sửa.
- Lưu bằng một transaction cập nhật bản ghi và revenueEntries cùng ID, không tạo thêm dòng. Đổi ngày/tháng cập nhật kỳ doanh thu tương ứng. Giữ metaSnapshot dữ liệu nguồn để đối chiếu; không viết lại số liệu chiến dịch gốc lấy từ Meta.
- Kiểm tra dữ liệu thay đổi trên thiết bị khác trước khi lưu. Nếu có xung đột, dừng và yêu cầu mở lại để tránh ghi đè.
- Lưu tối đa 30 sự kiện chỉnh sửa trong bản ghi, biểu mẫu hiển thị 5 sự kiện gần nhất. Đây là lịch sử ứng dụng, chưa phải nhật ký kiểm toán bất biến do máy chủ cưỡng chế.

## Cài đặt
Cập nhật các tệp giao diện trong gói vào repository website, commit/push và chờ GitHub Pages xuất bản. Phải có report-editor.js và assistant-actions.js cùng app.js/index.html mới. Tải lại bằng Command + Shift + R. Không cần thay extension 2.9.0, không cần đổi Firestore Rules hay triển khai Cloud Functions mới cho hai tính năng này. Quyền thực tế vẫn được Firestore kiểm tra khi lưu.

## Kiểm tra
27 unit tests đạt; gồm nhận Làm đơn nghỉ không gọi AI, điền đúng buổi/ngày/lý do, phạm vi danh sách thao tác, hiển thị nút theo người tạo, cập nhật cùng ID + doanh thu, từ chối sửa chéo, xung đột thiết bị, số âm/số không nguyên và ngày không hợp lệ. Bộ kiểm tra ánh xạ extension vẫn đạt. Chưa chạy trên Firebase production hoặc Chrome thật trong phiên này.
