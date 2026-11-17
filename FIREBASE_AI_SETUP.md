# Gemini chạy song song với OpenAI

Giữ **Cài đặt → Mô hình AI → Nhà cung cấp mặc định: OpenAI** để dùng các chức năng OpenAI hiện tại. **Studio Nội Dung → Giọng đọc AI** luôn gọi Gemini qua Firebase AI Logic riêng, không phụ thuộc lựa chọn mặc định.

## Kích hoạt trên project mediafbtq-6e1bb

1. Mở [Firebase AI Logic](https://console.firebase.google.com/project/mediafbtq-6e1bb/ailogic), bấm bắt đầu nếu chưa cấu hình, chọn **Gemini Developer API**, hoàn thành các bước bật API. Project hiện đã lên Blaze; không cần hạ gói hoặc thay đổi OpenAI.
2. Vào **App Check → Apps**, chọn Web App của website và đăng ký **reCAPTCHA Enterprise**. Tạo site key cho tên miền `bighappy9xx.github.io` (không thêm https hoặc đường dẫn), cùng các tên miền thực tế khác nếu dùng. Không tắt App Check để bỏ qua lỗi.
3. Trong website → **Cài đặt → Firebase & dữ liệu**, nhập **App Check site key** công khai rồi lưu và tải lại. Để cả công ty dùng chung, đặt site key đó trong `appCheckSiteKey` của `firebase-config.js` và cập nhật GitHub Pages. Không nhập reCAPTCHA secret key, service account key hoặc Gemini API key vào file công khai.
4. Trong **Mô hình AI**, giữ **OpenAI**, mở **Gemini chạy song song · giọng đọc → Kiểm tra kết nối Gemini**. Đây là kiểm tra văn bản, không xác nhận model TTS đã được cấp quyền.
5. Bấm **Mở Giọng đọc Gemini**, nhập câu ngắn, chọn **Gemini Flash-Lite TTS · nhanh, tiết kiệm** hoặc **Gemini Flash TTS · chất lượng cao**, chọn giọng, bấm **Tạo giọng đọc**. Nghe và tải WAV. Mỗi lần tối đa 1.800 ký tự. Phát âm vùng miền là yêu cầu hướng dẫn model; cần nghe lại trước khi dùng.

Giọng đọc dùng `gemini-3.8-flash-lite-tts` mặc định, tùy chọn `gemini-3.8-flash-tts`. Nội dung và hướng dẫn giọng được gửi riêng. WAV trả về đã có header, không bọc thêm header PCM. Yêu cầu có thời gian chờ 90 giây, không tự gửi lại hoặc tự chuyển sang OpenAI; nút tạo khóa trong lúc chờ. Kiểm thử tự động dùng âm thanh giả lập; cần thử câu thật trên tài khoản đã đăng nhập và App Check hợp lệ để xác nhận project.

## Chi phí và xử lý lỗi

- Blaze không đồng nghĩa Gemini miễn phí. Quota và phí theo model/project Google, tách riêng với API OpenAI. Kiểm tra ngân sách/quota trong Google Cloud và Google AI Studio.
- **App Check**: kiểm tra đúng Web App, site key và domain, lưu rồi tải lại. Site key là mã công khai, không phải API key.
- **429/quota**: kiểm tra quota/billing của Gemini; không bấm tạo liên tục.
- **Model không khả dụng/403**: kiểm tra Gemini Developer API và quyền truy cập model TTS của project.
- **Chờ quá lâu**: thử đoạn ngắn hơn, kiểm tra mạng. Không tự coi yêu cầu đã hủy là không phát sinh phí.

Đường giọng đọc trên website dùng Firebase AI Logic, không gọi hàm Cloud Functions `synthesizeSpeech` cũ; không cần thêm secret `GEMINI_API_KEY` cho đường này. Các chức năng Gemini văn bản/video vẫn có thể chọn riêng trong website. OpenAI giữ nguyên API key, Functions và IAM.

Tài liệu: [Firebase AI Logic TTS](https://firebase.google.com/docs/ai-logic/generate-speech), [Gemini TTS và lựa chọn model](https://ai.google.dev/gemini-api/docs/speech-generation), [App Check reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
