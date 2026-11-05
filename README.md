# Marketing Ai FBTQ

Website quản trị marketing dạng file tĩnh, không cần bước build. Giao diện không chứa số liệu chiến dịch, hội thoại hay nhân sự mẫu. Đăng nhập Firebase để làm việc; các bảng chỉ hiển thị dữ liệu thật đã lưu hoặc trạng thái chưa có dữ liệu.

## Bắt đầu sử dụng

Đưa giao diện lên hosting HTTPS, sau đó đăng nhập hoặc đăng ký bằng Firebase Authentication. Nếu chưa có dữ liệu, nhập báo cáo CSV/JSON ở mục **Hiệu suất marketing**; mục **Tổng quan** sẽ lấy số liệu của kỳ báo cáo đang chọn. Các nội dung, công việc và hóa đơn được lưu theo tài khoản/workspace trong Firestore.

Các tệp giao diện chính: `index.html`, `styles.css`, `app.js`, `firebase-config.js`.

## Triển khai Firebase Hosting

1. Tạo Firebase project và Web App. Bật **Authentication → Email/Password** và **Cloud Firestore**. Trong **Authentication → Settings → Authorized domains**, thêm `bighappy9xx.github.io` (chỉ tên miền, không thêm `/marketing-ai-fbtq`).
2. Tạo Firestore ở chế độ production; Rules cho phép mọi tài khoản đã đăng nhập sử dụng website và giới hạn thao tác theo vai trò.
3. Điền `apiKey`, `authDomain`, `projectId`, `appId` vào `firebase-config.js`. Web API key là thông tin nhận diện dự án, không phải private key; không đặt service account key trong thư mục public.
4. Cài Firebase CLI, đăng nhập, chọn project; cài dependencies cho Cloud Functions:

   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add
   cd functions && npm install && cd ..
   ```

5. Các Cloud Functions trong gói liên kết cả ba nhà cung cấp AI và webhook Meta. Trước khi triển khai Functions, tạo secrets tương ứng trong Firebase Secret Manager:

   ```sh
   firebase functions:secrets:set GEMINI_API_KEY
   firebase functions:secrets:set OPENAI_API_KEY
   firebase functions:secrets:set ANTHROPIC_API_KEY
   firebase functions:secrets:set META_TOKEN_ENCRYPTION_KEY
   firebase functions:secrets:set META_VERIFY_TOKEN
   firebase functions:secrets:set META_APP_SECRET
   ```

   Cần khóa API hợp lệ của Gemini, OpenAI và Anthropic để bật đủ ba mô hình. Tạo khoá mã hoá 32 byte bằng `openssl rand -hex 32`; lấy `META_APP_SECRET` từ Meta App. Các tính năng AI và Messenger cần triển khai Cloud Functions; website trên GitHub Pages vẫn có thể phục vụ giao diện tĩnh qua HTTPS.

6. Đặt biến môi trường `META_GRAPH_VERSION` trong `functions/.env.<PROJECT_ID>` theo phiên bản Graph API đang được Meta App của công ty hỗ trợ. Meta thay đổi vòng đời API; kiểm tra phiên bản trước khi kết nối thật.
7. Triển khai Hosting, Rules và Functions:

   ```sh
   firebase deploy --only hosting,firestore:rules,functions
   ```

Hosting cần HTTPS để Firebase Authentication, clipboard và webhook hoạt động.

## Tài khoản và phân quyền

Mọi tài khoản đã đăng ký và đăng nhập Firebase đều vào được website; nếu chưa có hồ sơ Firestore, website tự tạo hồ sơ với vai trò **Nhân viên**. Rules giới hạn Nhân viên ở dữ liệu của chính họ: chỉ số quảng cáo theo `createdBy`, công việc được giao, báo cáo/bản nháp/đề xuất hóa đơn do họ tạo, và hội thoại thuộc Fanpage của họ. Giám đốc, Quản lý chi nhánh và Trưởng phòng có thể xem dữ liệu toàn công ty. Mẫu nội dung đã duyệt và cấu hình chatbot là tài nguyên dùng chung.

Triển khai Rules mới để áp dụng phân quyền riêng tư theo người dùng và vai trò:

```sh
firebase deploy --project mediafbtq-6e1bb --only firestore:rules
```

Giám đốc đổi vai trò tại **Nhân sự & phân quyền** bằng UID trong Firebase Authentication hoặc email. Website đồng bộ vai trò vào hồ sơ `users/{UID}` và custom claim. Nếu vừa sửa mã nguồn, triển khai hàm phân quyền:

```sh
firebase deploy --project mediafbtq-6e1bb --only functions:setUserRole
```

Các mã vai trò: `director` (Giám đốc), `branch_manager` (Quản lý chi nhánh), `department_manager` (Trưởng phòng), `employee` (Nhân viên). Cloud Functions cần bật thanh toán theo yêu cầu hiện hành của Firebase.

## Kết nối mô hình AI

Mỗi nhà cung cấp cần API key và thanh toán/quyền truy cập riêng của công ty. Khóa được giữ trong Firebase Functions Secrets, không gửi xuống trình duyệt. Chọn Gemini, ChatGPT hoặc Claude trong Studio nội dung. Phần kết nối gọi [Gemini generateContent](https://ai.google.dev/api/generate-content), [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses/create) và [Anthropic Messages API](https://docs.anthropic.com/en/api/messages). Chatbot dùng Gemini hoặc ChatGPT. Nếu muốn dùng model khác, chỉnh giá trị model mặc định trong `functions/index.js`.

## Kết nối Fanpage Messenger

1. Tạo Meta App, thêm Messenger và cấu hình webhook HTTPS tới endpoint `metaWebhook` sau khi deploy.
2. Đặt secrets:

   ```sh
   firebase functions:secrets:set META_TOKEN_ENCRYPTION_KEY
   firebase functions:secrets:set META_VERIFY_TOKEN
   firebase functions:secrets:set META_APP_SECRET
   ```

   Tạo khóa mã hoá 32 byte (64 ký tự hex) và verify token ngẫu nhiên trên máy quản trị. Cất các giá trị này trong kho bí mật; không ghi vào file website.
3. Đăng ký webhook cho sự kiện `messages`, cấu hình App Secret/verify token và hoàn thành yêu cầu xét duyệt quyền `pages_messaging` cùng các quyền Meta bắt buộc khác.
4. Mỗi nhân viên kết nối Page bằng Page ID và Page Access Token của họ trong **Chatbot AI → Kết nối Fanpage**. Token được mã hoá AES-GCM trong Cloud Functions trước khi lưu Firestore. Nhân viên chỉ gửi tin qua Page của chính mình.

Meta có thể yêu cầu xác minh doanh nghiệp, xét duyệt ứng dụng và các điều kiện riêng cho tài khoản. Chưa có quyền Meta, danh sách Fanpage và hội thoại sẽ hiển thị trạng thái chưa có dữ liệu.

## Nhập chỉ số quảng cáo

Trong **Hiệu suất marketing**, chọn **Nhập chỉ số** để tải CSV xuất từ Meta Ads Manager hoặc dán JSON từ Ads Clipper. Bộ nhập nhận các cột Meta Ads tiếng Việt, gồm kỳ báo cáo, tên nhóm, trạng thái phân phối, cài đặt ghi nhận, kết quả, ngân sách, chi tiêu, lượt hiển thị, tiếp cận, tin nhắn và chi phí tương ứng. Bảng có mục **Chi tiết** cho ngày chạy nhóm, giá thầu, lần chỉnh sửa và kết quả ban đầu.

Mỗi nhóm được lưu theo tài khoản, nền tảng, kỳ báo cáo và mã nhóm quảng cáo; nếu CSV không có mã nhóm thì dùng tên nhóm cùng ngày bắt đầu. Khi tên và ngày bắt đầu bị lặp trong cùng tệp, ngân sách/loại ngân sách và giá thầu giúp giữ riêng các biến thể có trong tệp mẫu. Nhập lại cùng kỳ và nhóm sẽ ghi đè chỉ số vào bản ghi đã có. Các dòng trùng hoàn toàn trong cùng tệp được gộp. Bộ chọn kỳ báo cáo chỉ cộng số liệu của một khoảng ngày tại một thời điểm, tránh cộng chồng các bản xuất có khoảng ngày giao nhau.

`extension/` là tiện ích Chrome riêng. Cài bằng `chrome://extensions` → **Developer mode** → **Load unpacked** → chọn thư mục `extension/`. Trên Meta Ads Manager, chọn tab chiến dịch/các cột cần lấy, bấm **Sao chép chỉ số Ads**, rồi nhập JSON trên website.

Tiện ích đọc bảng đang hiển thị trên trang; đây là snapshot do người dùng kích hoạt, không phải đồng bộ trực tiếp qua Marketing API. Cần đối chiếu chỉ số trước khi dùng báo cáo. Tích hợp Marketing API tự động cần ứng dụng Meta và quyền quảng cáo được Meta cấp.

## Dữ liệu và hóa đơn

- Tổng quan dùng các chỉ số từ mục **Hiệu suất marketing**, theo một kỳ báo cáo được chọn. Khi chưa có báo cáo, giao diện hiển thị dấu gạch và thông báo trống.
- Nhân viên tạo đề xuất hóa đơn với trạng thái **Chờ duyệt**. Giám đốc, quản lý chi nhánh hoặc trưởng phòng có thể duyệt/từ chối; chỉ đề xuất đã duyệt mới được tải thành tệp HTML để in hoặc lưu PDF.
- Các thay đổi Firestore Rules giới hạn quyền tạo hóa đơn và quyền cập nhật trạng thái. Sau khi lấy gói mới, triển khai Rules bằng `firebase deploy --project mediafbtq-6e1bb --only firestore:rules`.
- Danh sách Fanpage được nạp qua callable `listMyPages`; khi cập nhật Cloud Functions, triển khai bằng `firebase deploy --project mediafbtq-6e1bb --only functions`.
- Tệp in hóa đơn là bản nội bộ để kiểm tra/in, không thay thế hóa đơn điện tử theo quy định. Bộ lọc từ cấm cung cấp ngữ cảnh cho mô hình gợi ý; nhân viên vẫn cần kiểm tra trước khi gửi.

## Tệp trong gói

```text
index.html                 Giao diện và cấu trúc website
styles.css                 Giao diện sáng/tối, responsive, chuyển động
app.js                     Điều hướng, thao tác, đăng nhập và gọi dịch vụ
firebase-config.js         Cấu hình Firebase Web App
firebase.json              Cấu hình Firebase Hosting/Functions/Firestore
firestore.rules            Quy tắc phân quyền cơ sở dữ liệu
firestore.indexes.json     Khai báo chỉ mục Firestore
functions/                 API AI, phân quyền, Fanpage webhook
extension/                 Tiện ích sao chép chỉ số Ads Manager
```
