# Chỉnh sửa hình ảnh trong Studio FBTQ

## Cách sử dụng

- Chọn tab Chỉnh sửa hình ảnh. Thanh danh mục gồm Mẫu, Thành phần, Văn bản, Tải lên, Dự án, Nền và Lớp.
- Chọn một đối tượng để dùng thanh công cụ phía trên. Chữ hỗ trợ phông, cỡ, màu, in đậm, nghiêng, gạch chân/ngang, căn trái/giữa/phải và độ đậm. Ảnh hỗ trợ thay thế, lật, vừa khung, lấp đầy, độ sáng, tương phản, đen trắng và làm mờ.
- Kéo đối tượng để di chuyển; kéo các tay nắm để đổi kích thước. Nút xoay trên thanh công cụ xoay 90 độ; Vị trí mở thuộc tính X/Y/kích thước/góc xoay chính xác.
- Nhấp đúp lớp chữ để mở ô nhập nội dung. Chữ tự xuống dòng theo chiều rộng lớp.
- Các nút nổi hỗ trợ khoá/mở khoá, nhân đôi và xoá. Lớp khoá không bị di chuyển, thay đổi thuộc tính hoặc xoá nhầm. Mở khoá trước khi chỉnh tiếp.
- Mục Lớp cho phép chọn lớp, ẩn/hiện, đưa lên/xuống và căn giữa. Nền được thêm dưới cùng và khoá sẵn.
- Dùng nút cạnh vùng thiết kế để hiện/ẩn bảng tư liệu. Thanh dưới cùng có thu phóng và vừa không gian.
- Lưu dự án để giữ từng lớp. Lưu PNG vào kho để xuất ảnh và dùng ảnh đó trong tab chỉnh sửa video.

## Cài đặt

Chép các file từ ZIP vào đúng vị trí trong mã nguồn hiện tại. Giữ thư mục functions nếu sử dụng các cập nhật quyền duyệt đi kèm. Ba file mới cần có trên hosting: studio-image-editor.js, studio-image-render.js và studio-image-editor.css. index.html, app.js, creative-studio.js và studio-editor-chrome.js đã cập nhật liên kết tương ứng.

Giao diện này chạy trên trình duyệt, không cần thêm dịch vụ máy chủ cho thao tác chỉnh ảnh. Thiết kế hiện có một trang, lưu riêng từng tài khoản trên trình duyệt; các mẫu là bố cục nội bộ. Phông sử dụng các font hệ thống được liệt kê trong trình chỉnh sửa. Đây không phải trình Canva nhúng, không đồng bộ các dự án Canva và không bao gồm xoá nền hay tạo hình AI.

Luồng gửi video Final dùng Firebase Storage và Rules riêng như hướng dẫn STUDIO-ADAPTIVE-FINAL.md. Việc triển khai hosting và Firebase chưa được thực hiện trong bản cập nhật này.

## Kiểm tra

Đã chạy kiểm tra trình duyệt cho thanh công cụ chữ, hình dạng, khoá/xoá lớp, nền, lưu thuộc tính dự án, thu phóng, thu gọn bảng tư liệu, màu pixel PNG đã xuất, bộ lọc ảnh, bố cục di động và chuyển lại tab video. Kiểm tra video nhiều lớp cũng xác nhận dữ liệu video được mã hoá có hình ảnh, chữ, hiệu ứng và âm thanh. Trong môi trường kiểm tra, tải tệp qua hệ điều hành bị chặn; nội dung PNG được đọc từ kho trình duyệt và video được xác minh từ Blob đã mã hoá.
