# Tìm khoảnh khắc hấp dẫn trong Studio AI

Tính năng dùng **Gemini qua Firebase AI Logic**, xem hình ảnh và nghe âm thanh video đang chọn để tìm đoạn có hook, ý trọn vẹn và kết thúc gọn. Không cần cấu hình OpenAI hoặc triển khai Cloud Functions cho tính năng này. Bật Gemini Developer API và App Check theo [FIREBASE_AI_SETUP.md](FIREBASE_AI_SETUP.md).

## Cách dùng

1. Mở **Studio Sáng Tạo → Chỉnh sửa video**, nhập video. Studio AI tự chọn video vừa thêm; nếu project có nhiều video, có thể đổi nguồn bằng danh sách Video trong project.
2. Bấm **Studio AI** để mở không gian lớn gồm trình xem toàn bộ video bên trái và thiết lập bên phải. AI tự quyết định số khoảnh khắc phù hợp; chỉ cần chọn thời lượng tối thiểu/tối đa (5–180 giây), nền tảng và khán giả/mục tiêu nếu có.
3. Bấm **Phân tích toàn bộ video**. Video nguồn được phân tích từ đầu đến cuối, kể cả khi timeline đang chọn lớp chữ hoặc một phần video đã trim. Không cần nhận dạng lời thoại bằng OpenAI trước.
4. Xem bảng gồm **STT, Timecode Start, Timecode End, câu nói/hành động và lý do hấp dẫn**. Mỗi đoạn có hook, tiêu đề, mô tả, hashtag và gợi ý chuyển cảnh, vị trí nhạc nền, phụ đề nhấn từ khoá.
5. Bấm timecode hoặc **Đến đoạn này trên timeline** để kiểm tra video tại mốc tương ứng. Có thể sao chép kế hoạch/toàn bộ nội dung từng clip hoặc **Xuất bảng CSV**.
6. Nếu muốn dựng tiếp, bấm **Đặt điểm cắt đoạn → Xác nhận đặt điểm cắt**. Hệ thống tách video ở hai biên của đoạn gợi ý, chọn phần đó và giữ phần trước/sau cùng các lớp khác. Dùng **Hoàn tác** để phục hồi; lưu dự án để giữ các điểm cắt. Khi nguồn hoặc timeline thay đổi, cần tạo lại đề xuất/xác nhận tương ứng.

## Timecode và phạm vi

- Bảng và gợi ý dựng dùng timecode từ đầu **file nguồn**, dạng `HH:MM:SS` hoặc `HH:MM:SS.mmm`. Nút nhảy tự chuyển mốc nguồn sang vị trí timeline, kể cả sau khi đã trim hoặc di chuyển đoạn.
- Video nguồn tối đa **8 GB/file**, tổng tư liệu project tối đa 16 GB theo giới hạn hiện có của Studio. Không còn giới hạn nguồn 12 MB hoặc phạm vi 10 phút trong luồng phân tích này. Khả năng đọc/nén thực tế còn phụ thuộc codec, dung lượng bộ nhớ và trình duyệt; nên dùng Chrome/Edge.
- Video nhỏ gửi trực tiếp. Video lớn/dài được thư viện Mediabunny có sẵn đọc từ Blob, chia thành các cửa sổ chồng lấn và nén từng phần bằng WebCodecs (tối đa 640 px, 12 fps, giữ âm thanh). Mỗi phần gửi Gemini dưới 12 MB; không nạp cả file 8 GB vào ArrayBuffer và không gửi cả file lớn trong một yêu cầu. Nguồn gốc và chất lượng file gốc không đổi.
- Tiến trình hiển thị phần đang nén/phân tích. Có nút **Dừng phân tích**. Giữ tab mở; video dài sẽ cần nhiều thời gian và nhiều lượt AI, có thể chạm quota. Mốc nguồn của từng phần được chuyển về timecode tuyệt đối trước khi gộp; loại bỏ các đề xuất trùng nhau ở vùng chồng lấn.
- Gemini tự tìm các đoạn có nội dung phù hợp, không cố tạo đủ một số clip định trước. Không có bảo đảm clip sẽ viral. Nghe/xem lại trước khi cắt và đăng.
- Chuyển cảnh, nhạc và phụ đề là **gợi ý**, chưa được tự chèn. Đặt điểm cắt chưa tạo các file MP4 riêng; dùng công cụ chỉnh sửa/xuất của Studio để hoàn thiện video.
- Tác vụ chỉ chạy khi bấm phân tích, không gửi video tự động theo mỗi lần chọn đoạn. Quota Firebase AI Logic/Gemini áp dụng. Không tự chuyển sang OpenAI nếu Gemini lỗi.

Triển khai giao diện mới gồm `app.js`, `index.html`, `creative-studio.js`, `studio-ai.js`, `studio-ai.css`, `studio-highlights-core.js`, `studio-highlights-ai.js`, `studio-highlights-ui.js`, `studio-video-preparation.js` và thư mục `vendor/mediabunny/` hiện có. Giữ các tệp phụ thuộc hiện có của dự án. API key OpenAI không được sử dụng trong luồng này.

Tài liệu chính thức: [Firebase AI Logic phân tích video](https://firebase.google.com/docs/ai-logic/analyze-video), [Video metadata và phạm vi nguồn](https://firebase.google.com/docs/reference/js/ai.videometadata).
