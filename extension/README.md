# Marketing Ai FBTQ Meta Helper

Extension Chrome Manifest V3 để chuyển chỉ số quảng cáo và PDF biên lai Meta vào website Marketing Ai FBTQ. Logo của extension dùng biểu tượng Favicon của website.

## Cài đặt / cập nhật extension

1. Tải thư mục dự án về máy và giải nén.
2. Mở `chrome://extensions` trong Chrome, bật **Developer mode**.
3. Nếu đã cài bản cũ: bấm **Reload** trên extension. Nếu chưa cài: chọn **Load unpacked** và chọn nguyên thư mục `extension/`.
4. Tải lại các tab Ads Manager, billing của Meta và website `https://bighappy9xx.github.io/marketing-ai-fbtq/`.

## Chuyển chỉ số vào Báo cáo hàng ngày

1. Mở Meta Ads Manager, chọn tab **Campaigns/Chiến dịch** hoặc **Ad sets/Nhóm quảng cáo**, chọn đúng tài khoản và kỳ báo cáo. Bảng cần có cột tên chiến dịch/nhóm quảng cáo; bật thêm các cột chỉ số muốn đưa vào báo cáo.
2. Tích ô vuông ở đầu các dòng chiến dịch/nhóm quảng cáo cần báo cáo trên Meta.
3. Bấm nút nổi **Meta Helper**, chọn **Quét mục đã chọn** để kiểm tra số dòng, rồi bấm **Gửi mục đã chọn vào Báo cáo**.
4. Extension mở website; nếu chưa đăng nhập, hãy đăng nhập. Sau khi Firebase tải dữ liệu, chỉ số được nhập và cửa sổ **Báo cáo hàng ngày** hiện ra. Kiểm tra ngày, số Mess, SĐT và doanh thu trước khi lưu.

Meta Ads Manager chỉ tải một số hàng trong bảng cùng lúc. Nếu cần thêm hàng, cuộn bảng Meta để tải tiếp, tích chọn các dòng cần lấy rồi quét lại. Tiện ích chỉ gửi các dòng đã tích chọn. Nếu chưa nhận được dòng nào, hãy kiểm tra dấu tích ở ô vuông đầu hàng; chỉ chọn cấp Chiến dịch hoặc Nhóm quảng cáo, không chọn tab Quảng cáo nếu bạn muốn lấy nhóm/campaign. Chỉ số được gắn với ngày hiện tại để mở đúng báo cáo ngày; hãy kiểm tra ngày và dữ liệu trước khi lưu.

## Chuyển PDF hóa đơn Meta

1. Mở Billing/Payment activity trong Meta. Trang Payment Settings bạn cung cấp có thể chỉ hiển thị cài đặt thanh toán, chưa có liên kết biên lai. Nếu vậy, mở **Payment activity/Giao dịch**, chọn giao dịch và mở hoặc tải biên lai PDF.
2. Bấm **Meta Helper → Quét lại liên kết biên lai**. Nếu extension thấy liên kết PDF trực tiếp, bấm đúng liên kết. Hoặc dùng **Chọn PDF đã tải xuống**.
3. Website mở **Tự động hoá → Upload Hóa Đơn Meta**, đính kèm PDF và tự điền các trường đọc được. Kiểm tra thông tin rồi bấm **Lưu và gửi duyệt**. Extension không tự gửi/duyệt hóa đơn.

PDF tối đa 5 MB, theo giới hạn form hiện có. PDF scan dạng ảnh có thể không có lớp chữ để đọc; khi đó hãy kiểm tra và điền lại các trường thủ công.

## Quyền riêng tư và giới hạn

- Extension chỉ đọc hàng Meta đang hiển thị/tải trong trang và liên kết biên lai do bạn yêu cầu quét.
- Dữ liệu chỉ được gửi tới website FBTQ sau khi bạn bấm gửi. Nếu website chưa đăng nhập, dữ liệu chờ cục bộ trong Chrome extension cho tới khi trang sẵn sàng.
- Extension không đọc mật khẩu, không gọi Meta Marketing API và không gửi dữ liệu tới dịch vụ bên ngoài website FBTQ.
- Meta thường thay đổi cấu trúc giao diện; một số tên cột hoặc liên kết tải PDF có thể cần thao tác thủ công. Luôn đối chiếu số liệu trước khi lưu.
