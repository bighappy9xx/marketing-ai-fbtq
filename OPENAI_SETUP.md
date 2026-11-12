# Kết nối ChatGPT vào Marketing AI FBTQ

Studio nội dung và Trợ lý FBTQ gọi OpenAI Responses API qua Firebase Cloud Functions. API key chỉ lưu ở máy chủ.

1. Bật gói **Blaze** cho Firebase project `mediafbtq-6e1bb`. Tạo API key trong OpenAI project có API billing và quyền dùng model.
2. Cài Node.js 22 và Firebase CLI. Tại thư mục dự án, chạy:

   ```sh
   firebase login
   npm --prefix functions install
   firebase functions:secrets:set OPENAI_API_KEY --project mediafbtq-6e1bb
   ```

   Dán key vào lời nhắc Firebase CLI. Không dán key vào chat, website hoặc file public.
3. Tạo `functions/.env.mediafbtq-6e1bb`, thêm `OPENAI_MODEL=gpt-6-luna` hoặc model mà OpenAI project của bạn được cấp quyền. Biến này dùng cho bộ tạo văn bản ChatGPT trên máy chủ. Có thể đặt `ASSISTANT_OPENAI_MODEL` để ghi đè riêng cho trợ lý.
4. Triển khai cả ba hàm:

   ```sh
   firebase deploy --project mediafbtq-6e1bb --only functions:generateContentOpenAI,functions:askAssistantOpenai,functions:checkOpenAIConnection
   ```

5. Đưa `app.js` và `index.html` mới lên hosting website. Đăng nhập tài khoản quản lý, mở **Cài đặt → Mô hình AI → Kiểm tra kết nối ChatGPT**. Mỗi lần bấm gửi một yêu cầu API nhỏ có tính phí. Chỉ khi OpenAI trả về văn bản thành công mới hiển thị **Đã kết nối ChatGPT**.
6. Trong **Studio nội dung**, chọn **ChatGPT** rồi tạo bài. Trong **Trợ lý FBTQ**, chọn **OpenAI** để trò chuyện. Có thể chọn ChatGPT làm mô hình nội dung mặc định và bấm **Lưu cấu hình**.

Nếu key sai hoặc đã thu hồi, cập nhật secret và triển khai lại các hàm dùng key. Lỗi 429 cần kiểm tra số dư, API billing hoặc giới hạn yêu cầu; lỗi model cần kiểm tra `OPENAI_MODEL` và quyền truy cập. Cấu hình Gemini/App Check không thay thế secret OpenAI.

Tài liệu: [OpenAI API quickstart](https://developers.openai.com/api/docs/quickstart).
