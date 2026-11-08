# Marketing Ai FBTQ Meta Helper

Extension Chrome Manifest V3 để chuyển chỉ số quảng cáo và PDF biên lai Meta vào website Marketing Ai FBTQ. Logo của extension dùng biểu tượng Favicon của website.

## Cài đặt / cập nhật extension

1. Tải thư mục dự án về máy và giải nén.
2. Mở `chrome://extensions` trong Chrome, bật **Developer mode**.
3. Nếu đã cài bản cũ: bấm **Reload** trên extension. Nếu chưa cài: chọn **Load unpacked** và chọn nguyên thư mục `extension/`.
4. Tải lại các tab Ads Manager, billing của Meta và website `https://bighappy9xx.github.io/marketing-ai-fbtq/`.

## Chuyển chỉ số vào Báo cáo hàng ngày

1. Mở Meta Ads Manager, chọn cấp **Chiến dịch** (không chọn đồng thời Nhóm quảng cáo hoặc Quảng cáo), đúng tài khoản và kỳ báo cáo. Bật các cột **Chiến dịch**, **Phân phối**, **Ngân sách**, **Số tiền đã chi tiêu**, **Kết quả**, **Lượt hiển thị** và **Người tiếp cận**.
2. Tích ô vuông đầu các chiến dịch cần báo cáo.
3. Mở **Meta Helper** → **Quét mục đã chọn**. Đối chiếu phần xem trước: tên chiến dịch, phân phối, ngân sách, chi tiêu, hiển thị, tiếp cận và số Mess. Chỉ gửi khi các giá trị khớp với bảng Meta.
4. Bấm **Gửi mục đã chọn vào Báo cáo**. Extension chuyển dữ liệu qua hàng đợi của Chrome; website cần mở và đăng nhập để nhận, lưu Firebase rồi mở bảng **Báo cáo hàng ngày**. SĐT và doanh thu để trống nếu Meta không cung cấp trong các cột đã chọn.

Ánh xạ được chuẩn hoá theo tệp CSV Meta: **Tên chiến dịch/Chiến dịch → Bài chạy**, **Lượt phân phối chiến dịch/Phân phối → Trạng thái**, **Kết quả → Số Mess**. Ngân sách, tiền đã chi, kết quả, lượt hiển thị, người tiếp cận và các chỉ số tin nhắn đọc theo tiêu đề cột, không theo vị trí cố định. Nếu ngân sách là dạng chữ (ví dụ dùng ngân sách chiến dịch), website giữ nội dung đó thay vì biến thành số 0. Số có dấu chấm phân cách hàng nghìn như `1.251` được hiểu là một nghìn hai trăm năm mươi mốt.

Kỳ ngày đang chọn trên Meta được lưu cùng dữ liệu và **ngày báo cáo mặc định là ngày kết thúc kỳ đó**. Nếu dữ liệu chỉ dùng cho báo cáo một ngày, hãy chọn khoảng ngày một ngày trên Meta trước khi quét.

Meta Ads Manager chỉ tải một số hàng trong bảng cùng lúc. Nếu cần thêm hàng, cuộn bảng Meta để tải tiếp, tích chọn các dòng cần lấy rồi quét lại. Tiện ích chỉ gửi dòng đã tích chọn. Nếu chưa nhận được dòng nào, hãy kiểm tra dấu tích ở ô đầu hàng và chờ bảng tải xong. Khi cài bản mới, mở `chrome://extensions`, bấm **Reload** trên extension rồi tải lại cả Meta Ads Manager và website FBTQ.

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

## Cập nhật 2.6.5

Ánh xạ các cột Meta sang chi tiết báo cáo:

| Meta Ads Manager | Báo cáo hàng ngày |
| --- | --- |
| Chiến dịch | Bài chạy |
| Phân phối | Trạng thái |
| Kết quả | Số Mess |
| Chi phí mỗi kết quả | Giá mess TB |
| Ngân sách | Ngân sách |
| Số tiền đã chi tiêu | Chi tiêu thực tế/ngày |

Giá mess TB lấy trực tiếp từ Chi phí mỗi kết quả, kể cả khi kết quả Meta là tương tác hoặc ThruPlay. Số liệu thuộc khoảng ngày đang chọn trên Meta; chọn một ngày nếu dùng cho báo cáo ngày. Cần cập nhật cả app.js của website và tải lại extension phiên bản 2.6.5.

## Cập nhật 2.6.6

- Đọc ô theo phạm vi cột, bỏ cách đoán ô gần nhất và vị trí thay thế khi không khớp cột.
- Đường đọc giao diện không có ARIA lấy dòng chữ trên cùng trong đúng phạm vi cột, không lấy chú thích kết quả ở dòng dưới.
- Không nhập dòng nhận nhầm nội dung cài đặt ghi nhận thành chiến dịch/trạng thái.
- Khi mở báo cáo từ extension, sáu trường ánh xạ ưu tiên dữ liệu vừa quét thay cho báo cáo đã lưu; các trường bổ sung vẫn giữ dữ liệu đã nhập.
- Cập nhật cả website app.js và extension, sau đó tải lại hai tab. Kiểm tra: node tests/extension-mapping.cjs.

## Cập nhật 2.7.0 – Toàn bộ cột theo mẫu

Extension hiển thị bảng xem trước cuộn ngang cho mọi dòng được tích chọn. Lấy Tắt/Bật (nếu Meta cung cấp trạng thái switch), Chiến dịch, Phân phối, Kết quả và loại kết quả, Chi phí trên mỗi kết quả, Ngân sách và loại ngân sách, Số tiền đã chi tiêu, Lượt hiển thị, Người tiếp cận, Người liên hệ nhắn tin mới, Chi phí trên mỗi người liên hệ nhắn tin mới, Lượt bắt đầu cuộc trò chuyện và chi phí tương ứng. Giữ dấu — ở dữ liệu gốc và lưu null cho số thiếu; bỏ dòng tổng. Bộ đọc bảng có ARIA giữ thêm mọi cột khác trong rawColumns.

Website lưu chỉ số vào campaigns, hiển thị dữ liệu gốc trong Chi tiết và mục Toàn bộ cột Meta ở form báo cáo. Khi lưu báo cáo, metaSnapshot giữ dữ liệu Meta tương ứng để đối chiếu. Sáu trường báo cáo vẫn theo ánh xạ đã yêu cầu.

Cài cập nhật: thay app.js và styles.css của website, cập nhật thư mục extension, Reload extension ở chrome://extensions, tải lại Meta và website. Tích các dòng cần gửi, Quét mục đã chọn, đối chiếu toàn bộ bảng rồi bấm Gửi. Chỉ lấy cột/hàng Meta đã tải vào trang; không suy ra dữ liệu ngoài khoảng ngày đang chọn.

## Phiên bản 2.8.0 – Nhập dữ liệu tại Trợ lý FBTQ

Hai chức năng nhập chiến dịch và hóa đơn nay có nút trực tiếp trong menu/cửa sổ Trợ lý FBTQ của website. Website nhận CSV/JSON số liệu và PDF hóa đơn, tự điền biểu mẫu để xem lại trước khi lưu. Meta Helper vẫn có thể quét dòng đã chọn hoặc gửi PDF từ Meta; nơi tiếp nhận cả hai loại dữ liệu được chuyển sang Trợ lý FBTQ. Cập nhật cả website và extension, Reload extension ở chrome://extensions và tải lại các tab. Nút Mở Trợ lý FBTQ trong popup đi thẳng tới #assistant sau khi đăng nhập.
