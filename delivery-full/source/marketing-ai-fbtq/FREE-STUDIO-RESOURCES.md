# Kho tư liệu miễn phí cho Studio

## Video

Trong Kho tư liệu, bấm **Âm thanh & hiệu ứng miễn phí**:

- **Nhạc nền**: Calm Pad và Soft Arpeggio, hai bản nhạc tổng hợp không lời, mỗi bản 16 giây, do FBTQ tạo. Không phải bản thu nhạc cụ truyền thống hay bản nhạc thương mại có sẵn.
- **Âm thanh FX**: 12 hiệu ứng Interface Sounds của Kenney (click, xác nhận, glass, pluck, mở/đóng, phóng to/thu nhỏ, switch và glitch) cùng Soft Whoosh/Gentle Chime tổng hợp FBTQ. Tổng kho gồm 16 mục âm thanh.
- Nghe thử trước khi bấm Thêm vào timeline. Nhạc nền được thêm với âm lượng 25%, hiệu ứng 70%; có thể sửa âm lượng, thời điểm và cắt như âm thanh tải lên. Kho này không cần AI key hoặc dịch vụ trả phí.
- **Hiệu ứng**: 10 preset xử lý khung hình trong ứng dụng: tông ấm/lạnh, đen trắng, hoài cổ, làm mờ, tương phản, viền tối, hạt phim, chớp sáng và tăng sáng. Chọn preset để tạo lớp hiệu ứng, chỉnh cường độ và thời lượng trong Thuộc tính. Đây là preset nội bộ, không phải template CapCut/Premiere nhập từ ngoài.
- **Nguồn tải**: liên kết Kenney, Mixkit và Freesound. Tải file tại nguồn rồi dùng Tải tư liệu lên. Các file Mixkit không được sao chép vào bản phân phối ứng dụng vì giấy phép cấm phân phối lại file gốc trong kho/tool/template. Freesound có nhiều loại giấy phép: nội dung thương mại cần lựa chọn phù hợp; CC BY cần ghi công, CC BY-NC không phù hợp cho quảng cáo thương mại.

## Chỉnh ảnh

- **Thành phần → Đông y / Botanical**: lá, hoa sen, bát thảo mộc, âm dương, tre và nhành thảo mộc. Là lớp hình khối riêng, có thể đổi màu, kéo, xoay và đổi kích thước.
- **Văn bản**: thêm 6 họ font mở: Be Vietnam Pro, Noto Serif, Lora, Montserrat, Baloo 2 và Dancing Script. Cùng 6 font hệ thống sẵn có, thanh chọn có 12 họ font. Đã kiểm tra các glyph tiếng Việt trong file font đóng gói.
- Các font mới được tải từ file cùng website, không cần kết nối Google Fonts lúc chỉnh hoặc xuất. Studio đợi font tải xong trước khi vẽ/xuất, báo lỗi nếu thiếu file thay vì âm thầm xuất bằng font thay thế. In nghiêng có thể được trình duyệt mô phỏng từ các file upright đã đóng gói.
- **Mẫu → Social Đông y**: 8 mẫu gốc FBTQ — thương hiệu, kiến thức thảo mộc, sản phẩm, story, lịch tư vấn, trích dẫn, workshop và banner. Khổ gồm 1080×1080, 1080×1350, 1080×1920 và 1200×628 px.
- Mẫu giữ chữ, nền và trang trí thành từng lớp. Các mục trong ngoặc vuông là chỗ điền thông tin thật. Mẫu không kèm ảnh sản phẩm hoặc tuyên bố điều trị. Nếu thiết kế đang có lớp, Studio hỏi xác nhận trước khi thay bố cục bằng mẫu Đông y; Hoàn tác khôi phục cả lớp và kích thước khung trước đó.

## Nguồn và giấy phép

| Tư liệu | Nguồn | Giấy phép đi kèm |
|---|---|---|
| 12 âm thanh Interface Sounds | [Kenney](https://kenney.nl/assets/interface-sounds), tải từ [bản do Kenney đăng tại OpenGameArt](https://opengameart.org/content/interface-sounds) | CC0; audio/kenney/Kenney-LICENSE.txt |
| 4 âm thanh tổng hợp, 8 bố cục và 6 thành phần | Tạo riêng cho FBTQ Studio | CC0; assets/studio-free/FBTQ-COLLECTION-LICENSE.txt |
| 6 họ font, 7 file TTF chưa sửa đổi | [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl) | OFL riêng của từng họ; fonts/<family>/OFL.txt |
| Liên kết tải Mixkit | [Mixkit License](https://mixkit.co/license/) | Xem giấy phép từng loại tại nguồn; không đóng gói file Mixkit |
| Liên kết Freesound | [Freesound FAQ](https://freesound.org/help/faq/) | Xem giấy phép từng file tại nguồn |

Manifest âm thanh ghi tên tác giả, nguồn, giấy phép và SHA-256 của từng file: `assets/studio-free/audio/catalog.json`. Manifest font ghi URL nguồn và SHA-256: `assets/studio-free/fonts/manifest.json`. Không sửa hoặc bỏ các file giấy phép khi phân phối website.

## Triển khai

Chép toàn bộ file trong ZIP vào dự án hiện tại, giữ nguyên cây thư mục. **Phải triển khai cả assets/studio-free**, gồm audio, fonts và giấy phép, cùng các module JavaScript và CSS mới. Không chỉ chép app.js/index.html.

Với Firebase Hosting:

```sh
firebase deploy --only hosting --project mediafbtq-6e1bb
```

Với GitHub Pages, đưa đầy đủ file mới và thư mục assets/studio-free lên nhánh website. Bản cập nhật nguồn miễn phí này không cần thay Firestore Rules, Storage Rules, thêm API key hoặc trả phí kho tư liệu. Các tính năng AI/Final của các bản cập nhật trước vẫn dùng cấu hình máy chủ riêng như các hướng dẫn đi kèm.

Đã kiểm tra trong Chrome: thêm và đọc OGG Kenney/WAV tổng hợp, preset mới, các mẫu chỉnh theo lớp, tải thật cả sáu họ font từ file local, khôi phục kích thước khi Hoàn tác/Làm lại, thành phần có thể đổi màu, xuất PNG đúng kích thước và bố cục màn hình nhỏ. Chưa triển khai lên website trong phiên làm việc này.
