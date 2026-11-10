# Bản sửa lỗi xuất video tại 0.00s — 10/11/2026

- Bộ kiểm thử tự động: 62 đạt, 0 lỗi.
- Thêm 3 ca hồi quy: track hình bắt đầu muộn, audio có timestamp âm và clip đã cắt điểm vào.
- Chrome / MP4 thật / bộ mã hoá phần mềm: tái hiện lỗi khi audio bắt đầu tại 0, video bắt đầu tại 0,066667s. Bản sửa xuất và giải mã lại có đúng hình ở đầu ra 0 cùng track âm thanh.
- Kiểm tra cú pháp, dấu xung đột và tham chiếu module.
- ZIP kiểm tra CRC, giải nén thực và so sánh byte từng tệp.
- Chưa thử trực tiếp file nguồn của người dùng; chưa đo GPU thật, chưa triển khai hosting hoặc Firebase Rules.

Cập nhật toàn bộ mã nguồn từ thư mục marketing-ai-fbtq trong ZIP lên dự án, không tải nguyên ZIP lên để thay frontend. Sau khi hosting cập nhật, tải lại bằng Ctrl+Shift+R hoặc Cmd+Shift+R. Bộ xuất mới dùng mã phiên bản 20261110-first-frame-fix để tránh dùng lại module cũ.

Xem START-HERE.md và XUAT-VIDEO-PHAN-CUNG.md để cài đặt và sử dụng.
