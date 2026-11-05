# FBTQ Ads Clipper

Tiện ích Chrome Manifest V3 đọc các hàng chiến dịch đang hiện trong Meta Ads Manager, rồi sao chép JSON hoặc tải tệp JSON để nhập vào trang **Hiệu suất marketing**.

## Cài đặt

1. Mở `chrome://extensions` trong Chrome.
2. Bật **Developer mode**.
3. Chọn **Load unpacked** và chọn nguyên thư mục `extension/`.
4. Mở Meta Ads Manager, vào tab Campaigns/Chiến dịch và bật các cột cần lấy.
5. Chọn **▣ Sao chép chỉ số Ads** ở góc dưới bên phải.
6. Sao chép JSON hoặc tải tệp, rồi nhập trong website tại **Hiệu suất marketing → Nhập chỉ số**.

Tiện ích chỉ đọc văn bản bảng hiện đang được Meta hiển thị trong tab; không gọi API, không lưu mật khẩu/token và không tải dữ liệu ra ngoài. Nếu Meta thay đổi cấu trúc trang, một số cột có thể không được nhận diện chính xác. Hãy kiểm tra số liệu trước khi dùng cho báo cáo.
