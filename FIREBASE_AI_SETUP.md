# Dùng Gemini trước trên Firebase Spark

**Studio nội dung**, **Kiểm duyệt nội dung** (lọc từ cấm và chính tả) và lựa chọn **Gemini** của **Trợ lý FBTQ** dùng Firebase AI Logic trực tiếp. Không cần triển khai Cloud Functions hoặc cấu hình OpenAI để dùng các tính năng văn bản này.

1. Trong [Firebase Console](https://console.firebase.google.com/project/mediafbtq-6e1bb/overview), chọn project `mediafbtq-6e1bb` → **Firebase AI Logic → Get started** → chọn **Gemini Developer API**. Provider này hỗ trợ Spark với hạn mức miễn phí; hạn mức Gemini vẫn áp dụng. Nếu chọn Agent Platform/Vertex AI, sẽ cần Blaze.
2. Tạo **reCAPTCHA Enterprise Web site key** cho tên miền `bighappy9xx.github.io` và tên miền website thực tế nếu có. Đăng ký Web App trong **App Check** với provider **reCAPTCHA Enterprise**, dùng cùng site key. Bật enforcement cho Firebase AI Logic.
3. Điền site key công khai vào `appCheckSiteKey` trong `firebase-config.js` để cả công ty dùng chung, hoặc lưu tại **Cài đặt → Firebase & dữ liệu → Kết nối Firebase** rồi tải lại trang. Không đưa secret key reCAPTCHA hoặc khóa nhà cung cấp AI vào mã nguồn.
4. Đưa các file `app.js`, `index.html`, `content-review-ai.js`, `firebase-ai-text.js` và `styles.css` mới lên hosting. Nếu sửa cấu hình chung, đưa cả `firebase-config.js` lên.
5. Đăng nhập website. Vào **Kiểm duyệt nội dung**, nhập bài hoặc bấm **Kiểm tra lại**. Gemini tự kiểm tra khi ngừng gõ, tô đỏ đoạn cần sửa, kèm gợi ý. Bấm đoạn đỏ để chọn vị trí sửa hoặc **Áp dụng gợi ý**. Trong **Trợ lý FBTQ**, chọn **Gemini**.

Kiểm tra văn bản dùng `gemini-3.8-flash`. Nếu App Check, quota hoặc mạng gặp lỗi, website hiển thị lỗi và không coi bài là đạt. Từ cấm đã lưu vẫn được dò ngay trên trình duyệt; trước khi gửi/phê duyệt, website đọc lại danh sách từ cấm từ Firestore và kiểm tra bài. Kết quả AI được tái dùng tối đa 10 phút theo tài khoản, nội dung và danh sách từ cấm. Không tự chuyển sang OpenAI khi Gemini lỗi.

Giới hạn 120 lượt/ngày của hàm OpenAI cũ không áp dụng cho đường Firebase AI Logic. Quota của Firebase AI Logic/Gemini và App Check áp dụng; cấu hình hạn mức trong Firebase Console. Các bước chặn trên giao diện không thay thế Firestore Security Rules và người duyệt.

OpenAI vẫn được giữ để cấu hình sau theo [OPENAI_SETUP.md](OPENAI_SETUP.md). Các chức năng tạo ảnh/chép âm thanh bằng OpenAI và chatbot Messenger vẫn cần backend riêng.

Tài liệu chính thức: [Firebase AI Logic và Spark](https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting), [JSON có cấu trúc](https://firebase.google.com/docs/ai-logic/generate-structured-output), [App Check cho web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
