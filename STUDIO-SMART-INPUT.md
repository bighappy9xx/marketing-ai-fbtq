# Studio — kéo thả nhận diện tư liệu và phím tắt

## Lớp linh động

- Kéo file từ Explorer/Finder vào kho tư liệu, khung xem trước hoặc một lớp trên timeline.
- Studio nhận diện video, ảnh PNG/JPG/WebP, âm thanh và preset hiệu ứng FBTQ. Khi hệ điều hành không gửi MIME, hệ thống dùng phần mở rộng rồi để bộ giải mã trình duyệt kiểm tra nội dung; không chạy nội dung file.
- Thả nhầm loại lớp sẽ tự chọn lớp đúng loại; nếu chưa có lớp phù hợp thì tạo mới. Thời điểm thả trên timeline được giữ khi chuyển sang lớp phù hợp.
- Nút **Lớp tự động** tạo hàng trống: lần thả tư liệu đầu tiên sẽ xác định đó là lớp hình, âm thanh, chữ hay hiệu ứng.
- Thả vào vùng **Thả tư liệu ở đây để tạo lớp phù hợp** phía cuối timeline để tạo lớp riêng, thay vì dùng lớp sẵn có. Cũng có thể kéo một đoạn đang có xuống vùng này.
- Kéo file từ máy tính theo nhóm: các file hình/video/âm thanh cùng lớp được xếp nối tiếp tại vị trí thả, không đè toàn bộ vào cùng thời điểm. Các preset hiệu ứng có thể chồng cùng thời điểm.
- Trong thư viện, chọn **Hiệu ứng** rồi kéo một thẻ Tông ấm / Đen trắng / Hoài cổ / Làm mờ / Tăng sáng vào timeline. Có thể nhấn thẻ để thêm tại đầu phát.
- File không hỗ trợ báo lỗi riêng; các file hợp lệ trong cùng lần thả vẫn được giữ. Thả file ngoài khu vực Studio không làm điều hướng mất trang đang chỉnh sửa.
- Khi kéo xa giữa thư viện và các lớp, dùng **Mở rộng không gian** để tránh bị thanh tiêu đề hoặc vùng cuộn che. Có thể kéo tư liệu từ kho hoặc nhập bằng nút tải lên như trước.

Giới hạn dung lượng/codec và cơ chế lưu cục bộ vẫn như bản nhiều lớp: ảnh tối đa 15 MB, 40 megapixel; video/âm thanh tối đa 250 MB/file; tổng tư liệu nạp tối đa 750 MB. Khả năng đọc MOV/HEVC/M4A và các codec khác phụ thuộc trình duyệt. Không nhận project/hiệu ứng riêng của CapCut dưới dạng plugin thực thi.

## File hiệu ứng

Dùng file mẫu `studio-warm.fbtq-effect.json` đi kèm, hoặc tạo file có hậu tố `.fbtq-effect.json` với nội dung:

```json
{
  "type": "fbtq-effect",
  "version": 1,
  "name": "Ánh ấm FBTQ",
  "effect": "warm",
  "duration": 3,
  "strength": 0.65,
  "opacity": 1
}
```

`effect` nhận `warm`, `grayscale`, `sepia`, `blur`, `bright`. Thời lượng 0,1–600 giây; cường độ và độ đậm 0–1. File tối đa 32 KB. Đây là preset thông số của Studio, không phải mã hiệu ứng JavaScript hoặc một file plugin CapCut. Các trường ngoài schema, URL/mã thực thi hoặc thông số sai bị từ chối.

## Phím tắt đang được cài đặt

Đây là cấu hình thao tác quen thuộc kiểu CapCut cho Studio FBTQ, không tuyên bố trùng toàn bộ mọi phiên bản CapCut. Dùng **⌘** thay **Ctrl** trên macOS. Bấm nút **Phím tắt**, **F1** hoặc **?** để xem bảng ngay trên website.

| Phím | Thao tác |
|---|---|
| Space | Phát / dừng |
| Ctrl/⌘ + B | Tách đoạn đang chọn tại đầu phát |
| Ctrl/⌘ + Shift + B | Tách tất cả đoạn giao với đầu phát, cách mép ít nhất 0,1 giây |
| Ctrl/⌘ + C / X / V | Sao chép / cắt / dán đoạn trong Studio |
| Ctrl/⌘ + D | Nhân đôi nối tiếp đoạn đã chọn |
| Delete / Backspace | Xoá đoạn, giữ khoảng trống |
| Shift + Delete | Xoá và khép khoảng trống trong cùng lớp; không dịch các lớp khác |
| Ctrl/⌘ + Z | Hoàn tác |
| Ctrl/⌘ + Shift + Z; Ctrl + Y trên Windows | Làm lại |
| Ctrl/⌘ + S | Lưu dự án |
| Ctrl/⌘ + I | Chọn file để nhập |
| Ctrl/⌘ + E | Xuất video hoặc PNG tuỳ tab |
| ← / → | Đầu phát lùi / tiến 1 khung, theo bước 1/30 giây |
| Shift + ← / → | Đầu phát lùi / tiến 1 giây |
| Home / End | Đầu / cuối timeline |
| + / − | Phóng to / thu nhỏ timeline |
| A | Công cụ chọn / kéo |
| B | Công cụ tách bằng chuột; bấm lên đoạn tại vị trí muốn tách |
| Q / W | Cắt bỏ phần trái / phải của đoạn tại đầu phát, giữ nguyên vị trí các đoạn khác |
| Escape | Bỏ chọn, về công cụ chọn và thoát không gian mở rộng; nếu đang mở bảng phím tắt thì đóng bảng trước |

Phím tắt chỉ hoạt động khi đã đăng nhập và trang Studio đang được mở. Không bắt phím khi đang nhập trong input/textarea, chọn thông số, soạn nội dung rich text hoặc khi hộp thoại khác đang mở. Vì vậy khi cần dùng phím tắt sau khi gõ chữ, bấm vào timeline/đồng hồ xem trước để rời ô nhập.

Clipboard đoạn chỉ dùng trong phiên Studio và cùng loại tab; không đọc/ghi clipboard hệ điều hành. Đổi tài khoản xoá clipboard này. Dán ở đầu phát vào lớp phù hợp; ảnh từ tab ảnh vẫn có thể xuất PNG vào kho rồi kéo sang video. Bước khung 30 fps là bước điều khiển timeline của Studio, không có nghĩa mọi video nguồn hoặc bản xuất luôn cố định đúng 30 fps.

## Cập nhật website

Các file đã được chỉnh trực tiếp trong dự án trên máy Windows. Gói `FBTQ-Studio-Smart-Input-Update.zip` chứa frontend Studio nhiều lớp cùng bản cập nhật nhận diện/phím tắt. Nếu chép sang máy khác, sao lưu và đối chiếu `app.js`/`index.html` trước nếu máy đó có các thay đổi riêng.

Không cần Firebase Rules, Functions hoặc secret mới. Để triển khai frontend sau khi kiểm tra mã:

```powershell
firebase deploy --only hosting --project mediafbtq-6e1bb
```

Tải mới trang bằng Ctrl+Shift+R trên Windows hoặc Cmd+Shift+R trên macOS. Các dự án vẫn lưu trong IndexedDB, riêng theo tài khoản và trình duyệt, chưa đồng bộ hai máy.

## Kiểm chứng

- Bốn bài kiểm thử mới cho nhận diện MIME/phần mở rộng, xác thực preset, chọn/tạo lớp, phím Windows/macOS và xoá khép khoảng trống.
- Bộ 31 kiểm thử tự động của checkout này đạt trong lần chạy cuối. Một lần chạy trước gặp lỗi thứ tự timestamp ở kiểm thử chat có sẵn, không liên quan các file Studio; chạy lại đã đạt và không thay đổi mã chat.
- Chrome: thả hỗn hợp ảnh có MIME trống, WAV, preset và file không hỗ trợ; xác nhận file hợp lệ vào đúng lớp và không mất khi có file lỗi; lớp tự động nhận âm thanh; kéo preset từ thư viện; copy/paste, nhân đôi, tách, hoàn tác/làm lại, xoá, đầu phát, công cụ A/B, lưu qua bàn phím; không can thiệp soạn chữ/hộp thoại/menu khác.
- Kiểm thử hồi quy nhiều lớp tiếp tục đạt: kéo lớp, cắt bằng mép, lưu/mở lại, mobile, cách ly tài khoản, giải mã lại video xuất với đúng ảnh chèn và âm thanh. Luồng tải file của trình duyệt tự động vẫn bị môi trường kiểm thử huỷ như bản trước; đã kiểm tra Blob mã hoá thực thay thế, không tuyên bố download của môi trường đó thành công.
- Chưa triển khai lên website production trong phiên làm việc này.
