# Xuất video và chuyển Final sang Kiểm duyệt

## Hai nút riêng biệt

- **Xuất video**: hỏi vị trí lưu, dựng MP4 và ghi thẳng vào thư mục người dùng chọn. Không chuyển trang Kiểm duyệt.
- **Xuất Final → Kiểm duyệt**: dựng vào vùng tạm riêng của website, không hỏi thư mục tải. Sau khi hoàn tất, mở mục Kiểm duyệt và đính kèm video cùng tiêu đề/nội dung vào biểu mẫu. Nếu bản đã xuất trên máy vẫn khớp timeline thì dùng lại, không dựng thêm. Bấm **Gửi quản lý** trong mục Kiểm duyệt để tải video lên và tạo yêu cầu duyệt.

Final tạm được giữ tới khi gửi thành công hoặc bỏ video; sau đó giải phóng vùng tạm. Đóng trang trước khi gửi sẽ mất biểu mẫu đang chờ; file tạm có thể còn chiếm quota trình duyệt.

## CPU / GPU

Mặc định **MP4 · Tự động GPU / CPU**: kiểm tra H.264 ưu tiên phần cứng trước; nếu không hỗ trợ cấu hình, kiểm tra bộ mã hoá phần mềm. Có tuỳ chọn Ưu tiên GPU / Ưu tiên CPU. Không âm thầm đổi chế độ khi đang xuất dở. Tốc độ và phần trăm hiển thị trong Thuộc tính.

Xuất qua WebCodecs theo timestamp, không phải phát lại timeline để ghi hình. Đọc Blob nguồn từng phần, giải mã theo đoạn, trộn âm thanh từng khối một giây và ghi MP4 phân mảnh ra ổ đĩa. H.264 30 fps theo kích thước khung hình (rộng/cao chẵn); AAC stereo 48 kHz. Giữ phép dựng lớp, chữ, ảnh, hiệu ứng và âm thanh của Studio.

WebCodecs `prefer-hardware` / `prefer-software` là gợi ý; trình duyệt có thể bỏ qua. Không xác nhận GPU nào đang chạy, không cam kết sử dụng hết lõi CPU hay tốc độ tối đa cho mọi máy. Đây là bản xuất bằng trình duyệt, không phải FFmpeg native. Chưa đo xuất thật bằng GPU trong môi trường thực hiện bản sửa.

Cần Chrome/Edge máy tính, HTTPS hoặc localhost, WebCodecs H.264/AAC. Lưu về máy cần File System Access, chuyển Final cần OPFS. Bật tăng tốc đồ hoạ và khởi động lại trình duyệt nếu cấu hình phần cứng chưa được hỗ trợ. Giữ tab hiển thị khi xuất.

## Video dài

Bỏ giới hạn xuất 10 phút cho các chế độ MP4 mới. Nhận nguồn tối đa 8 GB/file, tổng 16 GB; lưu dự án còn phụ thuộc quota. Final tối đa **2 GB**, được kiểm tra đồng bộ ở frontend, Firestore Rules và Storage Rules. Phải cập nhật Rules để giới hạn mới hoạt động. Nút Xuất video ra thư mục không bị giới hạn Final này.

Xem bản đã gửi qua URL do Firebase Storage SDK cấp cho phiên có quyền, để trình phát tải theo nhu cầu thay vì nạp cả file dài vào RAM. Quyền sở hữu/duyệt, đường dẫn và quy tắc không ghi đè vẫn được giữ.

Chế độ Xuất tương thích vẫn dùng MediaRecorder, tối đa 10 phút và có thể dùng nhiều RAM hơn. Nguồn âm thanh trên 2 kênh cần chuyển về stereo; không bỏ qua lỗi âm thanh khi xuất.

## Cập nhật website

1. Giải nén và chép nội dung thư mục `FBTQ-Fix` vào gốc dự án, giữ `vendor/mediabunny`.
2. Chạy `node scripts/check-source.cjs` và `node --test tests/*.test.cjs`.
3. Cập nhật mã nguồn GitHub/Hosting theo quy trình dự án. Không tải nguyên ZIP lên để thay mã nguồn.
4. Với Firebase project `mediafbtq-6e1bb`, cập nhật Rules bằng `firebase deploy --only firestore:rules,storage --project mediafbtq-6e1bb` sau khi kiểm tra cấu hình đăng nhập/dự án.
5. Tải lại website bằng Ctrl+Shift+R (Mac: Cmd+Shift+R), thử đoạn 30–60 giây có chữ và nhạc trước khi xuất dài.

Đã kiểm thử tự động luồng đích lưu, chuyển biểu mẫu Kiểm duyệt, trì hoãn tải lên tới lúc gửi, bộ mã hoá tự động, timestamp, trộn âm thanh, huỷ xuất và giới hạn 2 GB. Chưa chạy thử GPU thật, chưa chạy Rules emulator, chưa triển khai lên website.

Mediabunny 1.65.2, MIT: https://github.com/Vanilagy/mediabunny. Mã và LICENSE đi kèm trong `vendor/mediabunny`, không tải thư viện qua CDN khi xuất.
