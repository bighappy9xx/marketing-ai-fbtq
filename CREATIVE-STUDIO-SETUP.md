# Studio Sáng Tạo · Cài đặt cho Ai Media FBTQ

## Chức năng có trong bản cập nhật

- Menu chính Studio Sáng Tạo, hai tab Chỉnh Sửa Hình ảnh và Chỉnh sửa Video.
- Canva Connect OAuth theo từng user, PKCE và state dùng một lần; mã truy cập được mã hóa tại máy chủ, không đưa vào trình duyệt. Đồng bộ danh sách thiết kế, tải thêm trang, mở trình biên tập Canva và xuất PNG vào kho Studio. Nút Ngắt kết nối xoá mã đã lưu ở FBTQ; người dùng có thể thu hồi quyền ứng dụng tại Canva.
- Công cụ chỉnh ảnh trên website: upload PNG/JPG/WebP, xoay, cắt giữa ảnh theo tỉ lệ, sáng/tương phản, xuất PNG tối đa 2.400 px. Không thay thế toàn bộ công cụ thiết kế Canva.
- Kho ảnh phân tách theo UID, lưu bằng IndexedDB trên trình duyệt hiện tại; không đồng bộ giữa các máy và mất khi xoá dữ liệu trang. Tải bản ảnh quan trọng về máy để lưu giữ. Đây chưa phải kho lưu trữ đám mây.
- Chọn ảnh đã lưu để đưa vào danh sách tư liệu video, tải các ảnh đã chọn, mở CapCut Online và Upload tại đó. Trình duyệt có thể hỏi cho phép tải nhiều file.
- Lưu tên và URL dự án CapCut để mở lại; không coi liên kết đã lưu là kết nối OAuth. Chưa có đồng bộ tài khoản/danh sách dự án tự động hoặc tự chuyển file sang CapCut. Chưa xác minh được API công khai để làm việc đó. Trình biên tập CapCut được mở ở tab riêng, không nhúng vào iframe.

## 1. Cập nhật mã nguồn

Giải nén ZIP vào đúng thư mục dự án hiện tại (có index.html, firebase.json và functions/). Các file frontend đi kèm giữ cả những cập nhật trước đó. Không có functions/index.js trong ZIP để tránh ghi đè máy chủ hiện tại.

Trong Terminal, cd vào thư mục dự án và chạy:

```bash
node install-creative-studio.cjs
```

Script kiểm tra các helper cần thiết trong functions/index.js, sao lưu file đó rồi thêm một dòng đăng ký creativeCanva. Chạy lần hai sẽ không thêm trùng. Không sửa các chức năng cũ.

## 2. Tạo ứng dụng Canva

Tài liệu chính thức: https://www.canva.dev/docs/apps/rest-apis/authentication/

1. Đăng nhập Canva Developer Portal: https://www.canva.com/developers/
2. Tạo ứng dụng hỗ trợ REST/Connect API, loại hoạt động thay mặt người dùng (public hoặc private, không dùng service app).
3. Trong phần Outside Canva / Configuration, lấy Client ID và tạo Client Secret.
4. Thêm Redirect URL đúng bằng địa chỉ website của bạn, ví dụ:
   `https://mediafbtq-6e1bb.web.app/canva-callback.html`
   Nếu dùng tên miền riêng, thay bằng tên miền đó. Người dùng phải bắt đầu kết nối trên cùng origin đã cấu hình để quay về đúng phiên đăng nhập.
5. Bật các scope: `design:meta:read` và `design:content:read`.
6. Trong giai đoạn thử nghiệm, cấp quyền cho tài khoản thử nghiệm theo cài đặt ứng dụng. Việc dùng cho những tài khoản khác phụ thuộc loại ứng dụng và yêu cầu xét duyệt của Canva.

## 3. Cấu hình Firebase Functions

Trong `functions/.env.mediafbtq-6e1bb`, thêm (giữ nguyên các biến cũ):

```dotenv
CANVA_CLIENT_ID=Client_ID_cua_ban
CANVA_REDIRECT_URI=https://mediafbtq-6e1bb.web.app/canva-callback.html
```

Không thêm Client Secret vào frontend hoặc GitHub. Lưu secret bằng Firebase CLI:

```bash
firebase functions:secrets:set CANVA_CLIENT_SECRET --project mediafbtq-6e1bb
firebase functions:secrets:set STUDIO_TOKEN_KEY --project mediafbtq-6e1bb
```

Lệnh đầu: nhập Client Secret của Canva. Lệnh thứ hai: nhập chuỗi ngẫu nhiên mạnh dành riêng cho việc mã hóa token. Trên macOS, tạo chuỗi bằng `openssl rand -hex 32` rồi nhập vào lời nhắc secret. Giữ khóa ổn định: thay khóa sẽ khiến các kết nối cũ phải kết nối lại.

Functions/Secret Manager cần dự án có tài khoản thanh toán đang hoạt động; bản cập nhật không khắc phục trạng thái Billing của Google Cloud. Có thể sử dụng công cụ chỉnh ảnh và liên kết CapCut mà không triển khai backend Canva.

## 4. Triển khai

```bash
firebase deploy --only functions:creativeCanva,hosting --project mediafbtq-6e1bb
```

Chức năng dùng các collection máy chủ `creativeCanvaAccounts`, `creativeCanvaOAuth`. Firestore Rules hiện tại của dự án chặn mặc định những collection này; giữ quy tắc đó. Không mở quyền đọc token cho client. Có thể cấu hình TTL cho expiresAt của phiên OAuth nếu chuyển trường này sang Firestore Timestamp; hiện bản này dùng số milliseconds và từ chối phiên hết hạn khi xác thực, không có TTL tự động.

## 5. Kiểm tra sau triển khai

1. Đăng nhập FBTQ, mở Studio Sáng Tạo → Kết nối Canva.
2. Cấp quyền. Canva chuyển về canva-callback.html rồi Studio tự hoàn tất xác thực và tải danh sách dự án.
3. Chọn Chỉnh trên Canva; chỉnh và lưu tại Canva, quay lại FBTQ rồi Đồng bộ dự án. Chọn Lưu PNG để lưu ảnh xuất vào Studio.
4. Nếu chính sách tải file của trình duyệt/Canva chặn tải PNG qua fetch: tải PNG trong Canva, chọn Tải ảnh lên trong Studio rồi Lưu ảnh vào Studio.
5. Chọn → Video ở một ảnh đã lưu, chọn các ảnh khác nếu cần, Tải các ảnh đã chọn và Mở CapCut Online. Trong CapCut, đăng nhập đúng tài khoản, chọn dự án rồi Upload các ảnh vừa tải. Dựng và Export video trong CapCut.
6. Dán liên kết dự án vào form lưu liên kết để lần sau mở nhanh.
7. Kiểm tra user khác không thấy kho ảnh của user trước; tải lại trang vẫn thấy ảnh trên cùng trình duyệt.

## Phạm vi kiểm chứng của gói

Đã kiểm tra cú pháp và kiểm thử tự động logic URL, mã hóa, PKCE, kiểm soát user/phiên xác thực, cùng các kiểm thử hồi quy hiện có. Chưa đăng nhập Canva/CapCut thật, chưa kiểm tra giao diện bằng trình duyệt và chưa triển khai lên Firebase trong phiên làm việc này. Cần Client ID/Secret và quyền triển khai của chủ dự án để hoàn tất bước kết nối thật.
