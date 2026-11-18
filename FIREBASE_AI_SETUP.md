# Gemini Free TTS với project riêng

Cấu hình giọng đọc mới dùng key của project Google **gen-lang-client-0906214986** qua backend **synthesizeFreeSpeech** trên Firebase **mediafbtq-6e1bb**. Không đổi project đăng nhập/dữ liệu hoặc cấu hình OpenAI. Phần giọng đọc không còn gọi Firebase AI Logic của project Blaze.

## Kích hoạt: chỉ nhập key trong Terminal

1. Đảm bảo project `gen-lang-client-0906214986` trong Google AI Studio hiển thị **Free Tier**, không liên kết Billing. Key phải được tạo trong đúng project này. Trình cài đặt không thể suy ra project/tầng thanh toán từ chuỗi key; bước xác nhận trên AI Studio là cần thiết.
2. Mở Terminal tại thư mục repository và chạy:

```sh
cd /Users/amsbetrd/Documents/GitHub/marketing-ai-fbtq
node scripts/setup-gemini-free.cjs
```

Hoặc mở `Cai-dat-Gemini-Free.command`. Trình cài đặt yêu cầu Node.js 22 và Firebase CLI đã đăng nhập, thử một câu rất ngắn bằng Gemini Flash-Lite TTS, rồi lưu key qua stdin vào secret **GEMINI_FREE_API_KEY**. Nội dung key không hiển thị, không ghi vào source hoặc biến môi trường. Không nhập key vào chat.

3. Đợi triển khai riêng **functions:synthesizeFreeSpeech**. Chỉ triển khai backend trên project Blaze `mediafbtq-6e1bb`, không liên kết Billing cho project Gemini Free. Hàm nhận HTTP công khai để CORS hoạt động; handler bắt buộc đăng nhập Firebase, profile đã duyệt và vai trò hợp lệ. Hạn mức 20 lượt/ngày/tài khoản và khóa tránh gọi song song, lưu trong Firestore `openaiUsage` với loại `gemini_free_speech` (tái sử dụng bộ hạn mức hiện có).
4. Cập nhật các tệp giao diện mới lên GitHub Pages; triển khai Functions không tự cập nhật Pages. Khi website đã nhận bản mới, tải lại và vào **Studio Nội Dung → Giọng đọc AI**. Chọn model, giọng và nhập tối đa 1.800 ký tự; nghe/tải WAV.

## Chi phí và hạn mức

- Chỉ lượt gọi Gemini của project Free Tier được hưởng quota miễn phí theo điều kiện Google; không phải miễn phí không giới hạn. Hết quota thì chờ phục hồi. Không tự tạo project mới, tự gửi lại hoặc chuyển sang project trả phí.
- Backend Firebase vẫn trên Blaze: Functions, Secret Manager và Firestore có thể phát sinh phí sau mức không tính phí tương ứng. Cấu hình này không hạ Firebase xuống Spark.
- Các model cho phép: `gemini-3.8-flash-lite-tts` mặc định và `gemini-3.8-flash-tts`. Backend cố định danh sách model, bảo vệ key và trả tệp WAV hoàn chỉnh. Không nhận tùy ý URL, key hay tên model từ website.
- Key ở Free Tier có các điều khoản xử lý dữ liệu khác tầng trả phí; xem điều khoản Google trước khi gửi nội dung nhạy cảm.

## Nếu gặp lỗi

- **Chưa kích hoạt backend**: chạy trình cài đặt, lưu secret và triển khai `synthesizeFreeSpeech`.
- **Key yêu cầu thanh toán**: kiểm tra key thuộc đúng project `gen-lang-client-0906214986` ở Free Tier; không nạp tiền hoặc đổi key OpenAI để sửa lỗi này.
- **429/quota**: kiểm tra quota và đợi phục hồi. Không tự chuyển sang trả phí.
- **401/403/model không khả dụng**: kiểm tra key, xác minh project nếu Google yêu cầu và quyền dùng TTS Free Tier.
- **CORS/HTTP 403 trước khi gọi hàm**: kiểm tra HTTP invoker của riêng `synthesizeFreeSpeech`. `invoker:'public'` nằm trong định nghĩa; auth vẫn bắt buộc bên trong. Không sửa IAM của các hàm khác.

## Các chức năng Gemini khác

Tạo nội dung/Trợ lý/phân tích video khi chọn Gemini vẫn dùng Firebase AI Logic của project Blaze, cần App Check và chịu mức phí của project đó. Việc chuyển giọng đọc sang Gemini Free không tự chuyển những chức năng này sang Free Tier.

Tài liệu: [API key và project](https://ai.google.dev/gemini-api/docs/api-key), [Giá Gemini TTS](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash-lite-tts), [Gemini TTS](https://ai.google.dev/gemini-api/docs/speech-generation).
