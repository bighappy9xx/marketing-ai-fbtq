# Gemini Developer API trên Firebase Spark

Bản test chọn Gemini Developer API qua Firebase AI Logic (`GoogleAIBackend`), model văn bản nhanh `gemini-3.5-flash-lite`; kiểm duyệt và âm thanh giữ `gemini-3.8-flash`. Không cần triển khai OpenAI Worker hoặc Firebase Cloud Functions cho các công cụ Gemini. Các lựa chọn OpenAI/Claude cũ trong trình duyệt được chuyển về Gemini; model mặc định cũ từ workspace không ghi đè lựa chọn này.

## Thiết lập trong Firebase Console

1. Mở Firebase Console, chọn đúng project website (`mediafbtq-6e1bb` trong cấu hình hiện tại).
2. Vào AI Logic, chọn Bắt đầu và chọn **Gemini Developer API**. Hoàn thành trình hướng dẫn bật API, giữ gói Spark cho tầng miễn phí. Không chọn nhà cung cấp yêu cầu billing.
3. Vào App Check, đăng ký ứng dụng web bằng reCAPTCHA Enterprise. Thêm tên miền hosting vào site key (không có https/đường dẫn), ví dụ `bighappy9xx.github.io` và/hoặc `mediafbtq-6e1bb.web.app`.
4. Trong website: Cài đặt → Firebase & dữ liệu → điền App Check site key công khai → lưu rồi tải lại. Không điền Gemini API key vào mã website hoặc chat. Firebase AI Logic proxy quản lý đường gọi Gemini.
5. Đăng nhập lại → Cài đặt → Mô hình AI → Kiểm tra kết nối Gemini. Chỉ báo thành công khi một yêu cầu Gemini thực sự trả kết quả; việc khởi tạo SDK không chứng minh API đã hoạt động.
6. Nhấn Lưu cấu hình bằng tài khoản quản lý để ghi lựa chọn Gemini vào workspace. Các nhân viên tải lại giao diện mới để nhận bản chuyển đổi.

Nếu giao diện chưa có nút Gemini, cập nhật mã nguồn lên hosting đang dùng. Nếu dùng Firebase Hosting, từ thư mục dự án chạy `firebase deploy --only hosting --project mediafbtq-6e1bb`. Không chạy triển khai Functions cho luồng AI này. Giao diện mới không tự triển khai lên hosting.

## Chức năng

- Studio nội dung, Trợ lý và kiểm duyệt: Gemini trực tiếp qua Firebase AI Logic.
- Video highlights: giữ đường Gemini hiện có.
- Lời thoại Studio: gửi WAV PCM mono 16 kHz tối đa 3 phút đến Gemini; kiểm tra JSON/mốc thời gian và từ chối kết quả sai. Mốc thời gian do model ước lượng, cần nghe lại trước khi xác nhận tách/cắt. Không có timestamp cấp từ, không coi phân tích AI là đo khoảng lặng chính xác.
- Tạo ảnh: tạm khóa trong bản test không billing; dùng kho ảnh sẵn có hoặc tải ảnh lên.
- Giọng đọc: đường Gemini hiện có, hạn mức/model riêng; không bảo đảm mọi model media có tầng miễn phí.
- Fanpage/Messenger, ghi dữ liệu và lưu Final trên Cloud Storage là các tích hợp riêng; đổi AI provider không thay thế backend hoặc yêu cầu gói của các dịch vụ này.

Không bảo đảm quota vô hạn. Nếu 429/quota, kiểm tra hạn mức trong Google AI Studio rồi đợi quota phục hồi. Nếu 403/App Check, kiểm tra site key, domain, app Firebase và token sau khi tải lại. Nếu yêu cầu billing, kiểm tra đúng Gemini Developer API và model có tầng miễn phí; không tự nâng cấp gói.

Mã đã được kiểm thử bằng phản hồi Gemini mô phỏng; chưa xác minh tài khoản Google hoặc gọi Gemini thật thay người dùng.

Tài liệu: [Thiết lập Firebase AI Logic](https://firebase.google.com/docs/ai-logic/get-started?platform=web), [giá và tầng miễn phí](https://firebase.google.com/docs/ai-logic/pricing?api=dev), [phân tích âm thanh](https://firebase.google.com/docs/ai-logic/analyze-audio).

## Thời gian phản hồi

Kiểm tra kết nối dùng Flash-Lite, phản hồi ngắn, tối đa 20 giây; các lượt kiểm tra trùng trong cùng phiên/tài khoản được gộp. Nội dung và Trợ lý dùng Flash-Lite với thinking MINIMAL; chỉ thử Flash với thinking LOW một lần khi nhận lỗi quá tải 500/503, trong cùng giới hạn 60 giây. Không tự gửi lại sau timeout/429/lỗi App Check. Yêu cầu phía trình duyệt được truyền AbortSignal để tránh bỏ chờ rồi tạo thêm lượt song song; hủy trên trình duyệt không bảo đảm tác vụ phía Google chưa dùng quota.

Kiểm duyệt giữ schema/kiểm tra kết quả, model Flash với thinking LOW và 60 giây. Phiên âm có giới hạn chờ 120 giây do gửi âm thanh. Không tăng giới hạn token vô hạn hoặc coi phản hồi trống/chưa hoàn tất là thành công. Kết nối kiểm tra Lite thành công không chứng minh mọi model media đều hoạt động; cần thử công cụ tương ứng.

Nếu vẫn gặp timeout: kiểm tra App Check và site key/domain, kết nối tới dịch vụ Google, sau đó thử lại một lần. Model nhanh không sửa được lỗi cấu hình hoặc bảo đảm thời gian phản hồi của dịch vụ miễn phí. Tài liệu: [thinking levels](https://firebase.google.com/docs/ai-logic/thinking), [hủy từng yêu cầu](https://firebase.google.com/docs/reference/js/ai.singlerequestoptions).
