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

## AI lọc từ cấm và kiểm tra chính tả

Mục **Kiểm duyệt nội dung** tự kiểm tra sau khi ngừng gõ khoảng 1,5 giây. Trong bản đang chờ duyệt / cần sửa, bấm vào ô nội dung hoặc **Kiểm tra lại** để AI đọc bài. Các đoạn có vấn đề hiển thị màu đỏ trong bản đánh dấu; bấm đoạn đỏ để chọn đúng vị trí trong ô nhập, hoặc bấm **Áp dụng gợi ý** để sửa từng lỗi. Sau mỗi lần sửa, kết quả cũ được xoá và bài được kiểm tra lại.

- Từ cấm công ty được đối chiếu ngay trên máy và máy chủ, kể cả chữ hoa hoặc biến thể không dấu. AI bổ sung nhận diện câu cam kết thiếu căn cứ, ngôn từ xúc phạm và lỗi chính tả theo ngữ cảnh. Phát hiện của AI áp dụng cho bài đang kiểm tra; danh sách cấm chung vẫn do quản lý chỉnh sửa.
- Giao diện chặn gửi mới, gửi lại và phê duyệt khi còn đoạn bị cấm. Lỗi chính tả hiện đỏ kèm gợi ý, người dùng quyết định sửa. Quản lý vẫn có thể trả bài để yêu cầu sửa.
- Nếu AI chưa kiểm tra được hoặc chưa cấu hình, giao diện không cho gửi / phê duyệt bài. Kết quả AI cần được người duyệt xem lại. Đây là bước kiểm tra trên giao diện, không thay thế phân quyền và quy trình xét duyệt Firestore.
- Mỗi tài khoản tối đa 120 yêu cầu AI/ngày theo giờ Việt Nam, chỉ một yêu cầu chạy cùng lúc; kết quả giống nhau được tái dùng trong 10 phút. Không tự thử lại yêu cầu lỗi. Các lượt gọi OpenAI có tính phí theo mức dùng.

Sau khi cấu hình Blaze và `OPENAI_API_KEY`, triển khai thêm:

```sh
firebase deploy --project mediafbtq-6e1bb --only functions:reviewContentAI
```

Đưa `app.js`, `index.html`, `styles.css` và `content-review-ai.js` mới lên hosting. Hàm dùng `OPENAI_MODEL` hoặc biến ghi đè `CONTENT_REVIEW_OPENAI_MODEL`; model cần hỗ trợ [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
