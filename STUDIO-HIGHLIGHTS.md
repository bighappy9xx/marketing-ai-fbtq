# Tìm khoảnh khắc hấp dẫn trong Studio AI

Tính năng dùng nhà cung cấp đã chọn trong **Cài đặt → Mô hình AI** để tìm đoạn có hook, ý trọn vẹn và kết thúc gọn. OpenAI phân tích ảnh mẫu cùng lời thoại; Gemini phân tích video nén qua Firebase AI Logic. Xem [cài OpenAI](OPENAI_FIREBASE_SETUP.md) hoặc [cài Gemini](FIREBASE_AI_SETUP.md).

## Cách dùng

1. Mở **Studio Sáng Tạo → Chỉnh sửa video**, nhập video. Studio AI tự chọn video vừa thêm; nếu project có nhiều video, có thể đổi nguồn bằng danh sách Video trong project.
2. Bấm **Studio AI** để mở không gian lớn gồm trình xem toàn bộ video bên trái và thiết lập bên phải. AI tự quyết định số khoảnh khắc phù hợp; chỉ cần chọn thời lượng tối thiểu/tối đa (5–180 giây), nền tảng và khán giả/mục tiêu nếu có.
3. Bấm **Phân tích toàn bộ video**. Phân tích chạy trên toàn bộ phạm vi file nguồn, kể cả khi timeline đang chọn lớp chữ hoặc một phần video đã trim. Với OpenAI, hệ thống tự chuẩn bị ảnh mẫu và lời thoại từng phần; không cần nhận dạng lời thoại thủ công trước.
4. Xem bảng gồm **STT, Timecode Start, Timecode End, câu nói/hành động và lý do hấp dẫn**. Mỗi đoạn có hook, tiêu đề, mô tả, hashtag và gợi ý chuyển cảnh, vị trí nhạc nền, phụ đề nhấn từ khoá.
5. Bấm timecode hoặc **Đến đoạn này trên timeline** để kiểm tra video tại mốc tương ứng. Có thể sao chép kế hoạch/toàn bộ nội dung từng clip hoặc **Xuất bảng CSV**.
6. Để ghép thành một video: đánh dấu các hàng muốn giữ (mặc định chọn tất cả), bấm **Tự cắt & ghép timeline**. Xem tổng thời lượng và bảng đối chiếu mốc nguồn/mốc timeline, rồi bấm **Tạo timeline hoàn chỉnh**. Các đoạn được cắt và nối theo thứ tự nguồn, bắt đầu từ giây 0, loại bỏ khoảng giữa các đoạn. Timeline hiện tại được thay thế trong một bước có Hoàn tác; file gốc và tư liệu vẫn còn trong kho.
7. Tuỳ chọn **Giữ các lớp chữ, hình, hiệu ứng và âm thanh đang có** cắt/dồn lớp phụ theo các cửa sổ thời gian của video trên timeline. Nếu nguồn đã mất một phần cần giữ, hoặc xuất hiện nhiều lần khiến ánh xạ không rõ, bỏ chọn để chỉ dựng video từ file gốc. Đoạn/lớp đang khoá phải được mở khoá trước khi thay timeline.
8. Sau khi ghép, Studio đóng bảng AI và đưa vùng timeline vào tầm nhìn. Có thể phát thử, chỉnh tiếp, **Lưu dự án**, **Xuất video**, hoặc dùng **Hoàn tác/Khôi phục**. Bước ghép dùng kết quả sẵn có, không gọi AI thêm. Nếu chỉnh timeline sau lúc xem trước, cần mở lại bản xem trước để tránh áp dụng kế hoạch cũ.
9. Để chỉ đặt hai điểm cắt cho một đoạn, dùng **Đặt điểm cắt đoạn → Xác nhận đặt điểm cắt**. Cách này giữ phần trước/sau và các lớp khác, thay vì ghép một timeline mới.

## Timecode và phạm vi

- Bảng và gợi ý dựng dùng timecode từ đầu **file nguồn**, dạng `HH:MM:SS` hoặc `HH:MM:SS.mmm`. Nút nhảy tự chuyển mốc nguồn sang vị trí timeline, kể cả sau khi đã trim hoặc di chuyển đoạn.
- Video nguồn tối đa **8 GB/file**, tổng tư liệu project tối đa 16 GB theo giới hạn hiện có của Studio. Không còn giới hạn nguồn 12 MB hoặc phạm vi 10 phút trong luồng phân tích này. Khả năng đọc/nén thực tế còn phụ thuộc codec, dung lượng bộ nhớ và trình duyệt; nên dùng Chrome/Edge.
- Video được thư viện Mediabunny đọc từ Blob, chia thành các cửa sổ chồng lấn và nén từng phần khi cần. Gemini nhận video nén; OpenAI nhận 8 ảnh mẫu nhỏ/phần và bản lời thoại. OpenAI không xem liên tục mọi khung hình. File gốc và chất lượng file gốc không đổi.
- Tiến trình hiển thị phần đang nén/phân tích. Có nút **Dừng phân tích**. Giữ tab mở; video dài sẽ cần nhiều thời gian và nhiều lượt AI, có thể chạm quota. Mốc nguồn của từng phần được chuyển về timecode tuyệt đối trước khi gộp; loại bỏ các đề xuất trùng nhau ở vùng chồng lấn.
- AI tự tìm các đoạn có nội dung phù hợp, không cố tạo đủ một số clip định trước. Không có bảo đảm clip sẽ viral. Nghe/xem lại trước khi cắt và đăng.
- Chuyển cảnh, nhạc và phụ đề là **gợi ý**, chưa được tự chèn. Đặt điểm cắt chưa tạo các file MP4 riêng; dùng công cụ chỉnh sửa/xuất của Studio để hoàn thiện video.
- Tác vụ chỉ chạy khi bấm phân tích, không gửi video tự động theo mỗi lần chọn đoạn. Hạn mức và phí của nhà cung cấp đã chọn áp dụng. Không tự đổi nhà cung cấp khi gặp lỗi. Ghép timeline chạy cục bộ và không gửi thêm yêu cầu phân tích.

Triển khai giao diện mới phải gồm `studio-highlight-assembly.js`, `studio-highlights-ui.js`, `studio-ai.js`, `creative-studio.js`, `app.js`, `studio-ai.css`, `index.html` và giữ các tệp phụ thuộc hiện có. Bước ghép timeline không cần triển khai thêm Cloud Functions. Khi dùng GitHub Pages, cập nhật mã nguồn lên Pages; Firebase Hosting không tự cập nhật Pages.

Tài liệu chính thức: [Firebase AI Logic phân tích video](https://firebase.google.com/docs/ai-logic/analyze-video), [Video metadata và phạm vi nguồn](https://firebase.google.com/docs/reference/js/ai.videometadata).
