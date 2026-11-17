# Lọc từ khoá và AI biên tập bài viết

Trong **Kiểm Duyệt Nội Dung**, bộ lọc công ty dùng quy tắc chính xác, độc lập với nhận xét của AI:

- Phân biệt đầy đủ dấu tiếng Việt: `chưa`, `chữa`, `chua` là ba từ khác nhau; `ban`, `bán`, `bạn` cũng khác nhau.
- Không phân biệt hoa/thường. `CHỮA` vẫn khớp từ khoá `chữa`.
- Khớp trọn từ/cụm từ, không khớp một phần của từ dài hơn. Khoảng trắng, xuống dòng giữa các từ trong một cụm được xử lý tương đương.
- Các dạng Unicode dựng sẵn/tổ hợp được nhận diện tương đương; vị trí đánh đỏ vẫn trỏ chính xác vào chữ gốc để chọn sửa.
- Các ký tự định dạng ẩn không làm mất dấu cảnh báo trong từ. Dấu tiếng Việt vẫn được giữ nguyên khi so khớp.
- Muốn chặn biến thể không dấu, quản lý cần thêm đúng biến thể đó thành một dòng riêng. Không tự coi mọi từ gần giống là từ cấm.

Mỗi lỗi thể hiện nguyên văn đoạn khớp và lý do. **Từ khoá công ty** là kết quả so khớp xác định; **Rủi ro nội dung (AI)** là nhận xét theo ngữ cảnh, cần người duyệt xem lại. Bộ lọc không coi lỗi gọi AI là bài đạt.

## Biên tập bài viết

1. Nhập bài vào ô nội dung (hỗ trợ cả ô gửi bài, ô quản lý chỉnh bài và ô người gửi sửa lại).
2. Nhập yêu cầu bổ sung nếu có, rồi bấm **AI phân tích & chỉnh bài**.
3. So sánh **Bản hiện tại** với **Bản đề xuất** và đọc các ghi chú thay đổi. Có thể gõ sửa tiếp vào bản đề xuất.
4. Bấm **Hoàn tất chỉnh sửa** để thay nội dung trong ô đang sửa. Bài sẽ được kiểm tra lại. Thao tác này không tự gửi bài, phê duyệt hay lưu quyết định của quản lý.
5. Bấm **Hoàn tác chỉnh sửa** để khôi phục nguyên văn trước lần áp dụng. Nếu đã chỉnh tay tiếp, bản khôi phục được mở để xem trước, tránh ghi đè các thay đổi mới mà chưa xem.
6. **Giữ bản hiện tại** bỏ bản đề xuất. Nếu đổi nội dung/tài khoản/chính sách khi AI đang chạy, kết quả cũ không được tự áp dụng.

AI được hướng dẫn giữ các thông tin đã cung cấp, sửa chính tả, làm rõ câu và cải thiện bố cục. Người dùng cần kiểm tra lại tên, số liệu và các khẳng định trước khi gửi duyệt. Mỗi tài khoản có tối đa 20 lượt đề xuất/ngày; bài/yêu cầu/chính sách giống nhau được cache 10 phút. Khôi phục và gõ sửa bản đề xuất không gọi chức năng biên tập thêm.

## Cập nhật website

Phần máy chủ dùng **hàm `reviewContentAI` hiện có**, cùng secret và quyền gọi HTTP hiện có. Không thêm endpoint hoặc mở rộng IAM:

```bash
firebase deploy --only functions:reviewContentAI --project mediafbtq-6e1bb
```

Giao diện cần các tệp `keyword-matcher.js`, `content-review-rewrite.js`, `content-review-ai.js`, `firebase-ai-text.js`, `app.js`, `styles.css`, `index.html`. Triển khai mã nguồn mới lên đúng hosting đang dùng. GitHub Pages cần nhận commit/push mới; Firebase Hosting không tự cập nhật Pages.

`functions/keyword-matcher.js` và `keyword-matcher.js` phải giống nhau; kiểm tra nguồn sẽ chặn triển khai nếu hai bản khác nhau, để tránh giao diện và máy chủ lọc không nhất quán. Cache kiểm duyệt trên máy chủ đã đổi phiên bản để không dùng lại kết quả từ thuật toán bỏ dấu cũ.
