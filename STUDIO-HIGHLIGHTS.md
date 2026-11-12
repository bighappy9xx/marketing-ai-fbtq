# Tìm khoảnh khắc hấp dẫn trong Studio AI

Tính năng dùng **Gemini qua Firebase AI Logic**, xem hình ảnh và nghe âm thanh video đang chọn để tìm đoạn có hook, ý trọn vẹn và kết thúc gọn. Không cần cấu hình OpenAI hoặc triển khai Cloud Functions cho tính năng này. Bật Gemini Developer API và App Check theo [FIREBASE_AI_SETUP.md](FIREBASE_AI_SETUP.md).

## Cách dùng

1. Mở **Studio Sáng Tạo → Chỉnh sửa video**, nhập video rồi chọn đoạn trên timeline.
2. Bấm **Studio AI → Tìm khoảnh khắc hấp dẫn**. Chọn số clip muốn tìm (1–10), thời lượng tối thiểu/tối đa (5–180 giây), nền tảng và khán giả/mục tiêu nếu có.
3. Bấm **Phân tích khoảnh khắc hấp dẫn**. Video nguồn được gửi đến Gemini, kèm phạm vi đoạn đang chọn. Không cần nhận dạng lời thoại bằng OpenAI trước.
4. Xem bảng gồm **STT, Timecode Start, Timecode End, câu nói/hành động và lý do hấp dẫn**. Mỗi đoạn có hook, tiêu đề, mô tả, hashtag và gợi ý chuyển cảnh, vị trí nhạc nền, phụ đề nhấn từ khoá.
5. Bấm timecode hoặc **Đến đoạn này trên timeline** để kiểm tra video tại mốc tương ứng. Có thể sao chép kế hoạch/toàn bộ nội dung từng clip hoặc **Xuất bảng CSV**.
6. Nếu muốn dựng tiếp, bấm **Đặt điểm cắt đoạn → Xác nhận đặt điểm cắt**. Hệ thống tách video ở hai biên của đoạn gợi ý, chọn phần đó và giữ phần trước/sau cùng các lớp khác. Dùng **Hoàn tác** để phục hồi; lưu dự án để giữ các điểm cắt. Khi nguồn hoặc timeline thay đổi, cần tạo lại đề xuất/xác nhận tương ứng.

## Timecode và phạm vi

- Bảng và gợi ý dựng dùng timecode từ đầu **file nguồn**, dạng `HH:MM:SS` hoặc `HH:MM:SS.mmm`. Nút nhảy tự chuyển mốc nguồn sang vị trí timeline, kể cả sau khi đã trim hoặc di chuyển đoạn.
- Chỉ phân tích đoạn video đang chọn, tối đa 10 phút. File nguồn tối đa **12 MB** vì video được mã hoá base64 trong yêu cầu inline. Với file lớn, nén hoặc xuất riêng đoạn cần phân tích, rồi nhập lại Studio. Việc trim trên timeline không giảm kích thước file nguồn được gửi.
- Gemini có thể trả ít hơn số clip yêu cầu nếu video không đủ đoạn phù hợp; kết quả sẽ ghi lý do. Không có bảo đảm clip sẽ viral. Nghe/xem lại trước khi cắt và đăng.
- Chuyển cảnh, nhạc và phụ đề là **gợi ý**, chưa được tự chèn. Đặt điểm cắt chưa tạo các file MP4 riêng; dùng công cụ chỉnh sửa/xuất của Studio để hoàn thiện video.
- Tác vụ chỉ chạy khi bấm phân tích, không gửi video tự động theo mỗi lần chọn đoạn. Quota Firebase AI Logic/Gemini áp dụng. Không tự chuyển sang OpenAI nếu Gemini lỗi.

Triển khai giao diện mới gồm `app.js`, `index.html`, `creative-studio.js`, `studio-ai.js`, `studio-ai.css`, `studio-highlights-core.js`, `studio-highlights-ai.js`, `studio-highlights-ui.js`. Giữ các tệp phụ thuộc hiện có của dự án. API key OpenAI không được sử dụng trong luồng này.

Tài liệu chính thức: [Firebase AI Logic phân tích video](https://firebase.google.com/docs/ai-logic/analyze-video), [Video metadata và phạm vi nguồn](https://firebase.google.com/docs/reference/js/ai.videometadata).
