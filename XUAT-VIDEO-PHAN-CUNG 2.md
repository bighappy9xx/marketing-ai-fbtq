# Xuất MP4 ưu tiên bộ mã hoá phần cứng

## Cài đặt

Giải nén ZIP và chép nội dung thư mục `FBTQ-Fix` vào thư mục gốc dự án, giữ cả thư mục `vendor`. Cập nhật các file lên GitHub/hosting như bản sửa trước. Sau khi website cập nhật, tải lại bằng Ctrl+Shift+R (Mac: Cmd+Shift+R). Không tải nguyên ZIP lên để thay cho mã nguồn.

## Sử dụng

1. Mở Studio Sáng Tạo → Chỉnh sửa Video trên Chrome/Edge máy tính, qua HTTPS hoặc localhost.
2. Chọn **MP4 · Ưu tiên phần cứng** bên cạnh nút Xuất video.
3. Chọn Xuất video và vị trí lưu MP4. H.264 xuất 30 fps ở đúng kích thước khung hình; âm thanh AAC stereo 48 kHz. Chiều rộng/cao cần là số chẵn.
4. Giữ tab hiển thị, xem phần trăm và tốc độ thực tế trong Thuộc tính. Nút Huỷ xuất dừng công việc; file được ghi thành công sau khi hoàn tất. Nút Xuất Final → Kiểm duyệt sử dụng cùng luồng xuất và giữ video đã xuất để chuyển sang biểu mẫu.

## Thay đổi

- Xuất từng frame theo timestamp qua WebCodecs, ưu tiên `hardwareAcceleration: prefer-hardware`, không phải phát timeline và ghi màn hình theo thời gian thực.
- Đọc file nguồn theo nhu cầu, giải mã tuần tự từng đoạn, trộn âm thanh từng khối một giây, ghi MP4 phân mảnh trực tiếp ra ổ đĩa. Không giữ toàn bộ video xuất trong RAM.
- Giữ vị trí cắt, lớp chồng, chữ, ảnh, hiệu ứng, âm lượng, ẩn/tắt tiếng lớp và fade giống phép dựng của Studio.
- Bỏ giới hạn xuất 10 phút cho chế độ này. Nhận video/âm thanh đến 8 GB/file và tổng tư liệu đến 16 GB; dung lượng lưu dự án vẫn phụ thuộc quota trình duyệt và ổ đĩa.
- Chế độ Xuất tương thích vẫn dùng MediaRecorder theo thời gian thực và giới hạn 10 phút. Không tự chuyển sang chế độ này khi bộ mã hoá mới lỗi.

## Giới hạn thực tế

WebCodecs cung cấp lựa chọn ưu tiên phần cứng, không cung cấp bằng chứng chắc chắn máy đang dùng GPU nào; trình duyệt có thể bỏ qua gợi ý này. Kiểm tra hỗ trợ cấu hình trước khi mã hoá. Không hứa tốc độ cố định: giải mã, độ phân giải, số lớp và hiệu ứng có thể là nút thắt. Đây không phải bản FFmpeg native hay máy chủ GPU.

Cần trình duyệt có WebCodecs H.264/AAC và File System Access để lưu trực tiếp. Khi thiếu hỗ trợ, thông báo lỗi hướng dẫn chọn trình duyệt/cấu hình khác. Bật tăng tốc đồ hoạ trong cài đặt trình duyệt và khởi động lại nếu cần. Video dùng codec nguồn không giải mã được phải chuyển định dạng trước. Âm thanh nguồn trên 2 kênh cần chuyển về stereo. Không tự bỏ âm thanh khi giải mã lỗi.

Với video dài, lưu dự án có thể cần dung lượng IndexedDB lớn; quota có thể thấp hơn giới hạn nhập. Luồng Kiểm duyệt hiện nhận tối đa 250 MB/video; video dài có thể vượt mức này dù đã xuất thành công ra ổ đĩa.

Đã kiểm tra cú pháp và các ca kiểm thử tự động về timestamp, trộn âm thanh, kiểm tra codec, huỷ xuất, đóng file và giải phóng nguồn. Chưa chạy xuất video thật bằng GPU trên máy Windows/Mac trong môi trường này; cần thử một đoạn 30–60 giây trước khi xuất cả dự án dài. Chưa triển khai lên website.

## Thư viện kèm theo

Mediabunny 1.65.2, MIT, nguồn: https://github.com/Vanilagy/mediabunny, bản phát hành https://www.npmjs.com/package/mediabunny/v/1.65.2. Mã đóng gói và LICENSE được lưu trong `vendor/mediabunny`, không cần tải mã thư viện từ CDN khi xuất.
