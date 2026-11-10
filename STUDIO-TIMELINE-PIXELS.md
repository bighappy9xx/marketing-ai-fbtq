# Timeline kéo ngang và thuộc tính px

## Timeline mới

- Thước thời gian và đầu phát nằm trên các lớp; đầu phát di chuyển bằng transform để tránh cập nhật bố cục liên tục.
- Video/ảnh hiển thị dải thumbnail trên đoạn. Studio lấy thêm tối đa 10 khung xem trước của mỗi video ở nền; nếu codec không seek tốt, giữ thumbnail đầu thay vì chặn việc dựng.
- Kéo vùng trống của lớp sang trái/phải để trượt ngang; bấm đơn vào vùng trống vẫn đặt đầu phát.
- Chọn **Trượt** hoặc nhấn **H** để kéo timeline bằng chuột, kể cả trên vùng có đoạn. Nhấn **A** để quay về công cụ chọn; **B** vẫn là công cụ tách.
- Giữ **Shift** và cuộn chuột để trượt ngang. Cuộn ngang trên trackpad được hỗ trợ; cuộn dọc thông thường vẫn để xem các lớp.
- Có thể kéo bằng nút giữa chuột.
- Thanh trượt ngang riêng cùng hai nút trái/phải nằm dưới timeline. Tên lớp ở bên trái và thước ở phía trên giữ vị trí khi cuộn.
- Kéo trên thước hoặc núm đầu phát để tua. Đường đầu phát bên dưới không chặn việc kéo/cắt đoạn nằm sau nó.
- Khi zoom, giữ nguyên thời gian ở giữa vùng đang xem thay vì nhảy về đầu timeline. Khi phát, vùng nhìn tự đi theo đầu phát khi cần.
- Cuộn bằng bánh xe/nút có easing 180 ms; thay đổi vị trí/kích thước đoạn có chuyển động 160 ms. Kéo trực tiếp bám theo chuột, không thêm độ trễ vào dữ liệu cắt. Nếu hệ điều hành yêu cầu giảm chuyển động, bỏ các animation phụ.

Trượt không thay đổi thời điểm hay độ dài các đoạn. Dữ liệu hình/âm thanh và phương thức xuất video giữ nguyên.

## Đơn vị px

Bốn trường **X, Y, Rộng, Cao** giờ hiển thị và nhận pixel theo kích thước khung hiện tại, thay cho phần trăm. Cỡ chữ cũng hiển thị theo pixel thực của khung.

Ví dụ khung 1280 × 720:

- Đối tượng phủ toàn khung: X = 0, Y = 0, Rộng = 1280, Cao = 720.
- Đối tượng ở giữa, chiếm nửa chiều rộng và chiều cao: X = 320, Y = 180, Rộng = 640, Cao = 360.

Mục Khung hình có các kích thước 1280×720, 720×1280, 1080×1080, 864×1080, 1920×1080 và 1080×1920 px, hoặc chọn kích thước tuỳ chỉnh. Có thể nhập trực tiếp Rộng/Cao của khung, mỗi chiều 64–3840 px. Thay đổi kích thước khung giữ bố cục tương đối và cập nhật lại các giá trị px.

Để giữ tương thích với các dự án đã lưu, dữ liệu hình học bên trong vẫn lưu chuẩn hoá theo khung. Khi mở dự án cũ, hiển thị đúng vị trí cũ bằng px mà không coi nhầm 50% thành 50 px. Khung tuỳ chỉnh được lưu kèm dự án, không chỉ thay nhãn giao diện.

Khung lớn làm tăng tải bộ nhớ/mã hoá và có thể làm xuất chậm trên máy yếu. Giới hạn 10 phút và việc giữ tab hiển thị trong lúc xuất vẫn áp dụng. Chất lượng/codec thực tế phụ thuộc trình duyệt; đây chưa phải bộ xuất offline chính xác từng frame.

## Cập nhật website

Mã nguồn đã được sửa trực tiếp trên máy Windows. Gói `FBTQ-Studio-Timeline-Px-Update.zip` kèm đủ frontend Studio nhiều lớp, kéo thả/phím tắt và helper timeline mới. Nếu chuyển sang máy có thay đổi riêng, đối chiếu `app.js`/`index.html` trước khi ghi đè.

```powershell
firebase deploy --only hosting --project mediafbtq-6e1bb
```

Không cần Rules, Functions hoặc secret mới. Tải lại trang bằng Ctrl+Shift+R trên Windows hoặc Cmd+Shift+R trên macOS. Dự án vẫn lưu riêng trong trình duyệt, chưa đồng bộ giữa hai máy.

## Kiểm tra

- 33 kiểm thử tự động đạt, bao gồm chuyển đổi px/chuẩn hoá và giữ mốc thời gian giữa viewport khi zoom.
- Chrome: thanh trượt/nút trượt, kéo bằng tay và vùng trống, Shift+wheel, tua theo thước có bù scroll, zoom không đổi mốc giữa, giảm chuyển động; xác nhận pan không sửa dữ liệu clip.
- Kiểm tra giá trị px trên khung ngang/dọc và khung 800×450 tuỳ chỉnh; lưu được kích thước khung cùng dự án.
- Kiểm thử nhiều lớp/kéo thả/phím tắt trước đó vẫn đạt; video mã hoá được giải mã lại với đúng pixel của ảnh chèn và âm thanh. Môi trường download tự động vẫn huỷ thao tác tải như bản trước, nên kiểm thử xác nhận Blob mã hoá thực thay thế.
- Chưa triển khai website production trong phiên này.
