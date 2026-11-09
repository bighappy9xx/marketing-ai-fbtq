# Studio Sáng Tạo · Layer ảnh và cắt ghép video trực tiếp

Bản cập nhật ngày 09/11/2026 dành cho dự án Ai Media FBTQ. Tính năng chỉnh sửa chạy trong trình duyệt sau khi đăng nhập FBTQ, không cần Canva, CapCut hoặc API AI. Các phần kết nối Canva/CapCut trước đó vẫn được giữ làm lựa chọn bổ sung.

## Cài đặt vào website hiện tại

1. Giải nén FBTQ-Studio-Layers-Video-Update.zip vào thư mục dự án hiện tại có index.html, app.js và firebase.json. Cho phép cập nhật các file frontend cùng tên. Gói có đủ các module frontend mà app.js đang dùng; không có file secrets hoặc functions/index.js.
2. Nếu website đang mở ở các tab khác, đóng các tab đó trước khi mở lại Studio để trình duyệt nâng cấp kho dự án từ v1 lên v2. Các ảnh và liên kết CapCut đã lưu vẫn được giữ.
3. Với Firebase Hosting của dự án này, chạy trong thư mục dự án:

```bash
firebase deploy --only hosting --project mediafbtq-6e1bb
```

4. Tải mới trang bằng Ctrl+Shift+R trên Windows hoặc Cmd+Shift+R trên macOS.

Không cần triển khai Functions, Firestore Rules mới hoặc cấu hình Billing để dùng phần chỉnh sửa tại trình duyệt. Kết nối Canva thật vẫn cần cấu hình backend Canva đã mô tả trong gói trước.

## Chỉnh sửa nhiều layer ảnh

- Vào Studio Sáng Tạo → Chỉnh Sửa Hình ảnh.
- Tải ảnh lên nhiều lần: mỗi ảnh thành một layer riêng. Thêm Chữ hoặc Khối màu để tạo đối tượng mới.
- Chọn đối tượng trên canvas hoặc trong danh sách Layers. Layer trên cùng của danh sách nằm phía trước.
- Kéo trên canvas để di chuyển. Với layer chưa xoay, kéo góc phải dưới để thay kích thước. Có thể nhập chính xác X/Y, Rộng/Cao, Xoay và độ đậm trong bảng thuộc tính.
- Chỉnh chữ, cỡ chữ và màu; chỉnh sáng/tương phản riêng cho layer ảnh. Bấm icon mắt để ẩn/hiện, icon khoá để khoá vị trí và thuộc tính. Dùng ↑ Lên, ↓ Xuống để đổi lớp, Nhân đôi hoặc Xoá.
- Hoàn tác/Làm lại hỗ trợ tối đa 40 trạng thái thiết kế trong phiên hiện tại.
- Khung thiết kế cho nhập kích thước 64–2.400 px mỗi chiều và màu nền.
- Lưu dự án layer: giữ các layer và ảnh gốc để mở lại từ danh sách dự án đã lưu.
- Lưu PNG vào kho: xuất ảnh phẳng vào kho Studio. Nút PNG tải file về máy.

Ảnh PNG/JPG/WebP từ Canva là một layer ảnh phẳng khi đưa vào Studio; không tự khôi phục chữ, hiệu ứng hoặc layer gốc của Canva/PSD. Các layer tạo và lưu trong Studio mới có thể chỉnh riêng ở đây. Đây là trình chỉnh sửa ảnh, chữ và khối màu cơ bản, chưa có mặt nạ, path vector, PSD hoặc toàn bộ bộ công cụ Canva/Photoshop.

## Cắt ghép video ngay trên website

- Vào tab Chỉnh sửa Video, chọn Thêm video / ảnh để nhập tư liệu. Video tối đa 250 MB/file; ảnh tối đa 15 MB/file, dưới 40 megapixel. Codec phải được trình duyệt đọc được; MP4 H.264 thường là đầu vào thuận tiện. Khi định dạng không đọc được, hệ thống báo lỗi và bạn có thể đổi định dạng nguồn.
- Mỗi video hoặc ảnh là một đoạn trên timeline nối tiếp. Chọn đoạn, nhập Điểm vào/Điểm ra theo giây rồi Áp dụng cắt. Khoảng cắt tối thiểu 0,1 giây.
- Kéo đầu phát đến vị trí cần tách rồi chọn Tách tại đầu phát. Hai đoạn dùng chung tư liệu gốc và giữ điểm cắt riêng.
- Kéo thả đoạn để đổi vị trí, hoặc dùng Đưa trước/Đưa sau; Xoá đoạn để bỏ khỏi timeline. Thao tác không sửa file video gốc.
- Ảnh tĩnh có thời lượng từ 0,1 đến 600 giây. Chọn ảnh trong kho Studio rồi Thêm ảnh đã chọn vào timeline; nút → Video ở mỗi ảnh cũng thêm ảnh trực tiếp vào timeline.
- Chọn tỉ lệ 16:9 (1280×720), 9:16 (720×1280) hoặc 1:1 (1080×1080). Chọn Vừa khung hoặc Lấp đầy. Điều chỉnh âm lượng riêng từng clip, về 0 để tắt tiếng.
- Phát thử hoặc kéo đầu phát để kiểm tra. Lưu dự án giữ toàn bộ tư liệu, thứ tự, điểm cắt, thời lượng ảnh, âm lượng và khung hình để mở lại.
- Xuất video: tải MP4 nếu trình duyệt hỗ trợ cấu hình mã hóa phù hợp, hoặc WebM. Phần mở rộng theo đúng MIME đầu ra; không đổi tên WebM thành MP4. Chỉ nên dùng Chrome/Edge mới trên máy tính.

Video được kết xuất bằng canvas và MediaRecorder theo thời gian thực, không phải xuất offline/frame-accurate như phần mềm dựng chuyên dụng. Giới hạn mỗi bản xuất 10 phút; thời gian chờ thường gần thời lượng video và có thể dài hơn khi đọc file/chuẩn bị mã hoá. Không tắt hoặc chuyển tab, không rời Studio khi xuất; hệ thống sẽ huỷ để tránh video thiếu khung hình. Có nút Huỷ xuất. Độ chính xác thời gian/độ mượt phụ thuộc phần cứng và tải trình duyệt. Chưa có video nhiều track chồng hình, hiệu ứng chuyển cảnh, nhạc rời hoặc phụ đề tự động.

## Lưu trữ

Dự án và Blob tư liệu nằm trong IndexedDB của website, phân tách theo UID FBTQ. Không tự gửi dữ liệu lên máy chủ Canva/CapCut. Không tự đồng bộ giữa hai máy tính; xoá dữ liệu trình duyệt sẽ mất kho này. Chọn Lưu dự án trước khi tải lại trang, đổi dự án hoặc đăng xuất. Nên tải bản PNG/video thành phẩm để lưu giữ riêng. Chưa có tự động lưu hoặc xuất/nhập dự án layer sang máy khác.

## Đã kiểm tra

- 39 bài kiểm thử tự động đạt, bao gồm hit-test layer xoay, thứ tự lớp, ẩn/khoá, trim/split, biên timeline, bảo toàn thời lượng và các chức năng cũ.
- Thử giao diện bằng Chrome trong môi trường kiểm thử: tạo/sửa chữ và khối màu; đổi lớp; lưu dự án ảnh, tải lại trang, mở lại giữ layer; xuất PNG vào kho; thêm PNG vào timeline; nhập clip video thật, cắt 0,2–0,9 giây, tách tại 0,3 giây trên timeline; lưu/mở lại dự án video có đủ tư liệu.
- Xuất file MP4 và WebM thật bằng trình duyệt. Phân tích file WebM xác nhận VP8 1280×720 + âm thanh Opus; tín hiệu âm thanh có trong đoạn video và im lặng ở đoạn ảnh.
- Đây là bản mã nguồn đã kiểm tra, chưa triển khai lên website production và chưa kiểm tra toàn bộ codec/trình duyệt/thiết bị thực tế.
