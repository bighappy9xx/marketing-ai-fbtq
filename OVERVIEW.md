# Tổng quan vận hành

Trang Tổng quan được sắp xếp theo thứ tự:

1. Bộ lọc kỳ báo cáo, chi nhánh, nhân sự và năm thẻ chỉ số marketing.
2. Ba ô truy cập nhanh: nội dung chờ kiểm duyệt, đơn nghỉ chờ duyệt, tạm ứng chờ duyệt.
3. Xếp hạng doanh thu (tối đa 5 người) và Bảng vàng vinh danh (tối đa 3 người).
4. Đơn xin nghỉ và hóa đơn tạm ứng: mỗi bảng hiển thị tối đa 5 hồ sơ, ưu tiên hồ sơ đang chờ duyệt. Có tên, ảnh đại diện, ngày, buổi nghỉ hoặc số tiền và trạng thái.
5. Biểu đồ hiệu suất và chiến dịch gần đây, rồi lịch sử kiểm duyệt và công việc ưu tiên.

Mỗi bảng có nút mở mục đầy đủ; không phê duyệt hoặc cấp tiền trực tiếp từ thẻ Tổng quan.

## Dữ liệu và bộ lọc

- Xếp hạng cộng doanh thu từ báo cáo đã tải trong kỳ đã chọn. Các bảng công khai (doanh thu và điểm đã công bố) vẫn được nhân viên xem theo quyền hiện có. Quản lý áp dụng phạm vi chi nhánh; giám đốc lọc toàn công ty/chi nhánh/user.
- Bảng vàng chỉ đọc `workAwardScores` đã công bố, theo tháng kết thúc kỳ báo cáo; không dùng điểm xem trước của trang công việc. Nếu chưa có bảng điểm thì hiện trạng thái trống; lỗi kết nối/quyền được thông báo riêng.
- Nội dung, đơn nghỉ và tạm ứng cá nhân tuân theo quyền và dữ liệu đã tải. Kế toán có phạm vi tạm ứng toàn công ty theo quyền nghiệp vụ.
- Số hồ sơ đang chờ duyệt tính mọi thời gian để tránh bỏ sót. Danh sách hồ sơ ưu tiên đưa các mục đang chờ lên trước, kể cả ngoài kỳ; phần lịch sử còn lại theo ngày trong kỳ.
- Lịch sử kiểm duyệt lấy các lượt phê duyệt/trả bài/từ chối đã ghi nhận, không dùng thời điểm gửi bài để giả làm thời điểm duyệt.
- Trên điện thoại, các nhóm bảng chuyển thành một cột; bảng chiến dịch được thu gọn thành chiến dịch/nhân sự, chi tiêu và trạng thái.

## Cập nhật

Cập nhật các file giao diện trong gói ZIP, giữ các module và tài nguyên hiện có. File mới `overview-hub.js` phải nằm cùng thư mục `app.js`. Sau đó tải lại trang. Tính năng dùng các quyền đọc hiện có, không thêm collection hay thao tác ghi trên máy chủ.

## Kiểm tra

```sh
node --test tests/overview-hub.test.cjs
node tests/overview-hub-browser.cjs
```

Kiểm tra trình duyệt dùng Playwright và Chrome với dữ liệu mô phỏng; không truy cập Firebase thật.
