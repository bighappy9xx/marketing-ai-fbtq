# Sửa nhập chỉ số chiến dịch — Meta Helper 2.8.1

## Ánh xạ
| Cột Facebook Ads | Trường báo cáo |
|---|---|
| Chiến dịch | Bài chạy |
| Phân phối | Trạng thái |
| Kết quả | Số Mess |
| Chi phí trên mỗi kết quả | Giá mess TB |
| Ngân sách | Ngân sách/ngày |
| Số tiền đã chi tiêu | Chi tiêu thực tế/ngày |

Các cột hiển thị, tiếp cận, liên hệ mới và cuộc trò chuyện giữ riêng trong dữ liệu nguồn, không dùng lấp cột Kết quả bị thiếu. SĐT và doanh thu không có dữ liệu nguồn để trống. Chỉ số Kết quả giữ đúng loại kết quả Meta đang hiển thị (tương tác, ThruPlay hoặc tin nhắn), không tự chuyển thành một chỉ số khác.

## Cập nhật trên macOS / Chrome
1. Giải nén gói này. Sao chép các tệp giao diện ở gốc vào dự án website và xuất bản qua quy trình GitHub Pages hiện tại. Gói không chứa thông tin đăng nhập hay thay đổi Firestore Rules.
2. Mở chrome://extensions, bật Developer mode. Với tiện ích cũ, nếu đã thay tệp trong đúng thư mục đã nạp thì bấm Reload. Nếu chọn thư mục extension mới trong gói, tắt bản cũ rồi Load unpacked thư mục extension mới. Chỉ bật một bản Meta Helper, kiểm tra version 2.8.1.
3. Tải lại cả Facebook Ads Manager và website (Command + Shift + R).
4. Chọn cấp Chiến dịch, tài khoản, ngày/kỳ báo cáo. Bật các cột trong bảng ánh xạ trên; tích dòng muốn nhập.
5. Quét mục đã chọn, kiểm tra bảng sáu trường sắp nhập. Gửi vào Trợ lý FBTQ. Biểu mẫu chỉ chứa những chiến dịch trong lần gửi này. Kiểm tra rồi phê duyệt lưu.
6. Cột không nhận diện sẽ không được đoán từ cột bên cạnh. Giữ tiêu đề đầy đủ trên Meta hoặc dùng CSV xuất trực tiếp nếu bố cục Meta khác với các mẫu đã kiểm tra.

Ví dụ từ ảnh: Bonbon → Đang tắt → Ngân sách 30000 → Chi tiêu 46062 → Số Mess 409 → Giá mess TB 113.

## Kiểm tra
Kiểm thử ánh xạ với ba dòng từ ảnh, thiếu/trùng/đổi tiêu đề, mô tả có chữ số, nhãn VND, ARIA lệch vị trí, giữ số 0, danh sách đã chọn và luồng chuyển chỉ nhóm mới. 21 unit tests của dự án đạt. Chưa kiểm tra trên phiên Facebook đăng nhập thật; Chromium trong môi trường hiện tại không tải được nên không khẳng định đã chạy kiểm thử trình duyệt ở phiên này.

Bản sửa không tự chỉnh lại báo cáo lịch sử đã lưu sai; mở đúng ngày và nhập lại sau khi đối chiếu để tránh thay đổi dữ liệu cũ ngoài ý muốn.
