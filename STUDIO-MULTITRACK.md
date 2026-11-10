# Studio Sáng Tạo — dựng video nhiều lớp

## Bố cục

- Bên trái: tải và chọn tư liệu video, ảnh, âm thanh. Chọn lớp đích trước khi thêm tư liệu, hoặc kéo trực tiếp từ kho vào một lớp phù hợp trên timeline.
- Chính giữa: khung xem trước; có tỉ lệ 16:9, 9:16, 1:1, 4:5. Chọn đối tượng và kéo để thay vị trí.
- Bên phải: tên, thời điểm bắt đầu, thời lượng, điểm vào file gốc, vị trí/kích thước, độ đậm, chữ, hiệu ứng và âm lượng của đoạn đang chọn.
- Phía dưới: một thước thời gian chung cho tất cả các lớp, thanh đầu phát, zoom và các nút tách/hoàn tác.
- Mở rộng không gian để dùng khung gần toàn màn hình. Nút Thu gọn đưa bố cục về trang bình thường; trợ lý nổi được tạm ẩn khi mở rộng để tránh che timeline.

## Làm việc với các lớp

1. Thêm video vào lớp Video chính. Các video mới trên lớp này được đặt nối tiếp khi bấm chọn tư liệu.
2. Chọn lớp Ảnh / video chồng, đặt đầu phát rồi thêm một ảnh/video khác. Đoạn mới bắt đầu ở đầu phát. Chỉnh X/Y/Rộng/Cao theo px (bản cập nhật Timeline Px) để làm logo hoặc hình/video trong hình.
3. Chọn Thêm chữ. Nhập nội dung, cỡ chữ, màu, màu nền và bật/tắt nền chữ. Thời điểm bắt đầu cùng thời lượng quyết định khi nào chữ xuất hiện.
4. Chọn Hiệu ứng để tạo một đoạn hiệu ứng: tông ấm, đen trắng, hoài cổ, làm mờ hoặc tăng sáng. Đổi cường độ và thời gian áp dụng.
5. Thêm âm thanh riêng vào lớp Âm thanh. Các clip âm thanh/video cùng hoạt động sẽ được trộn; dùng âm lượng riêng hoặc nút tắt tiếng của lớp để điều chỉnh.
6. Có thể thêm lớp hình, lớp chữ, lớp âm thanh. Nút mũi tên ở tên lớp đổi thứ tự chồng: lớp nằm trên timeline phía trên sẽ vẽ lên các lớp phía dưới. Hiệu ứng tác động đến các hình đã vẽ ở phía dưới nó; muốn chữ không chịu hiệu ứng, đưa lớp chữ lên trên lớp hiệu ứng.
7. Nút mắt ẩn nội dung của lớp; nút nhạc tắt tiếng của lớp. Có thể có nhiều đoạn ở cùng thời điểm. Với các đoạn chồng ngay trong một lớp, đoạn được thêm sau sẽ được vẽ sau.

## Cắt, di chuyển và tách

- Kéo phần giữa đoạn để đổi thời điểm. Kéo lên/xuống một lớp cùng loại để đổi lớp; chữ, âm thanh và hiệu ứng phải nằm trên lớp phù hợp.
- Kéo mép trái hoặc phải để cắt. Cắt video/âm thanh không vượt file nguồn; thời lượng tối thiểu 0,1 giây.
- Nhập thông số chính xác ở bảng Thuộc tính nếu cần. Điểm vào file gốc tính theo giây trong file, còn Bắt đầu tính theo giây trên timeline.
- Chọn đoạn rồi đặt đầu phát bên trong đoạn và chọn Tách đoạn. Hai đoạn mới vẫn dùng chung tư liệu gốc, không sửa file gốc.
- Kéo đầu phát hoặc bấm lên phần trống của timeline để xem vị trí tương ứng. Có thể dùng phím trái/phải khi đoạn đang được focus để dịch đoạn 0,1 giây.
- Hiện dần/Mờ dần áp dụng cho độ đậm và âm lượng của đoạn. Thời gian fade được giới hạn nội bộ ở một nửa thời lượng đoạn.
- Có hoàn tác/làm lại tối đa 40 trạng thái trong phiên hiện tại.

## Lưu và xuất

- Lưu dự án giữ toàn bộ lớp, thời điểm, chữ, hiệu ứng, âm lượng, tỉ lệ và Blob tư liệu trong IndexedDB, riêng theo UID người dùng.
- Dữ liệu chỉ nằm trong trình duyệt hiện tại, chưa đồng bộ giữa hai máy. Không tự động lưu. Xoá dữ liệu trang sẽ mất dự án, vì vậy nên lưu riêng các thành phẩm quan trọng.
- Dự án video nối tiếp của phiên bản cũ được chuyển thành các đoạn trên lớp Video chính khi mở lại. Kho ảnh cũ được giữ khi nâng cấp IndexedDB.
- Chọn Xuất video; sau khi dựng xong, chọn Tải video đã xuất. Định dạng MP4 hoặc WebM tuỳ cấu hình MediaRecorder được trình duyệt hỗ trợ. Không đổi đuôi file để giả lập định dạng.
- Xuất theo thời gian thực, tối đa 10 phút mỗi dự án. Giữ Studio và tab đang hiển thị; rời trang hoặc ẩn tab sẽ huỷ xuất để tránh bỏ khung hình. Có thể Huỷ xuất và thử lại.
- Video đầu ra 1280×720 (16:9), 720×1280 (9:16), 1080×1080 (1:1), 864×1080 (4:5). Không phải bộ dựng offline/frame-accurate chuyên dụng; độ mượt và sai số thời gian phụ thuộc phần cứng, codec và tải trình duyệt.
- Video/âm thanh tối đa 250 MB/file; ảnh PNG/JPG/WebP tối đa 15 MB và 40 megapixel; tổng tư liệu được nạp trong một phiên tối đa 750 MB. Không phải mọi codec MOV/HEVC đều được mọi trình duyệt hỗ trợ.
- Tab ảnh giữ khả năng dựng layer ảnh/chữ/khối màu, thay vị trí/kích thước, lưu dự án và xuất PNG vào kho để thêm lên timeline video. PNG/JPG từ Canva là ảnh phẳng, không khôi phục được layer gốc của Canva/PSD.

## Cài đặt / triển khai

Các thay đổi đã được thêm trực tiếp vào bản mã nguồn Windows hiện tại. Chỉ cần cập nhật frontend; không có secret, Firebase Rules hoặc Functions mới cho trình dựng cục bộ này.

Gói ZIP gồm `app.js`, `index.html`, `creative-studio.js`, `creative-studio.css`, `studio-timeline-core.js`, `studio-webm.js` và tài liệu này. Nếu dùng ZIP trên máy khác, sao lưu dự án của máy đó trước; `app.js` và `index.html` dựa trên bản mã nguồn đang có ở máy Windows, không tự hợp nhất các thay đổi riêng của nhánh/máy khác.

Trong thư mục dự án Firebase:

```powershell
firebase deploy --only hosting --project mediafbtq-6e1bb
```

Sau đó tải mới trang bằng Ctrl+Shift+R (Windows) hoặc Cmd+Shift+R (macOS). Đóng các tab FBTQ cũ nếu nâng cấp kho Studio bị chặn.

## Kiểm chứng

- 27 bài kiểm thử tự động trên checkout hiện tại đạt, bao gồm chồng lớp, thứ tự vẽ, mốc thời gian, ẩn/tắt tiếng, di chuyển đúng loại lớp, tách/cắt, fade, hit-test và đọc timestamp WebM.
- Kiểm thử Chrome trên ứng dụng thật với tài khoản/nguồn video và âm thanh giả lập trong môi trường kiểm thử: video + ảnh + chữ + hiệu ứng chồng nhau; kiểm tra pixel để xác nhận hiệu ứng và lớp ảnh; kéo giữa lớp; kéo mép cắt; tách chữ; lưu rồi tải lại giữ toàn bộ dự án; bố cục máy tính/điện thoại; cách ly dữ liệu khi đổi tài khoản.
- Video mã hoá thực được giải mã lại: 1280×720, có đúng màu ảnh chèn và tín hiệu âm thanh. Môi trường Chrome tự động huỷ bước lưu qua download, nên kiểm thử lưu trực tiếp Blob đã mã hoá bằng test runner và xác nhận nội dung file, không tuyên bố luồng tải file của môi trường đó đã thành công. Nút Tải video đã xuất vẫn hiển thị để người dùng tải chủ động.
- Chưa triển khai bản cập nhật lên website production trong phiên làm việc này.
