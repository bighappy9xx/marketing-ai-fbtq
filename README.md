# Marketing Ai FBTQ

Website quản trị marketing dạng file tĩnh, không cần bước build. Có thể đưa các file lên hosting HTTPS; thư mục `functions/` và Firebase Rules dùng khi muốn bật xác thực, đồng bộ dữ liệu, AI và Messenger thật.

## Mở bản demo

Mở `index.html` trên hosting hoặc chạy bằng máy chủ tĩnh cục bộ. Chọn **Trải nghiệm bản demo** ở trang đăng nhập. Dữ liệu mẫu, công việc và bản nháp demo được lưu riêng trong trình duyệt.

Các tệp giao diện chính: `index.html`, `styles.css`, `app.js`, `firebase-config.js`.

## Triển khai Firebase Hosting

1. Tạo Firebase project và Web App. Bật **Authentication → Email/Password** và **Cloud Firestore**.
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

   Cần khóa API hợp lệ của Gemini, OpenAI và Anthropic để bật đủ ba mô hình. Tạo khoá mã hoá 32 byte bằng `openssl rand -hex 32`; lấy `META_APP_SECRET` từ Meta App. Nếu chưa sẵn sàng tích hợp backend, chỉ triển khai bốn tệp giao diện lên hosting thường và dùng bản demo.

6. Đặt biến môi trường `META_GRAPH_VERSION` trong `functions/.env.<PROJECT_ID>` theo phiên bản Graph API đang được Meta App của công ty hỗ trợ. Meta thay đổi vòng đời API; kiểm tra phiên bản trước khi kết nối thật.
7. Triển khai Hosting, Rules và Functions:

   ```sh
   firebase deploy --only hosting,firestore:rules,functions
   ```

Hosting cần HTTPS để Firebase Authentication, clipboard và webhook hoạt động.

## Tài khoản và phân quyền

Mọi tài khoản đã đăng ký và đăng nhập Firebase đều vào được website; không cần chạy script duyệt tài khoản. Nếu người dùng chưa có hồ sơ Firestore, website tự tạo hồ sơ với vai trò **Nhân viên**. Vai trò đã lưu của người dùng hiện có được giữ nguyên. Quyền Giám đốc và quản lý vẫn do vai trò quyết định.

Triển khai Rules mới để bỏ chặn trạng thái `approved`:

```sh
firebase deploy --project mediafbtq-6e1bb --only firestore:rules,hosting
```

Để đổi vai trò trong website, triển khai Cloud Function:

   ```sh
   firebase deploy --only functions:setUserRole
   ```

Giám đốc đổi vai trò tại **Nhân sự & phân quyền**. Cloud Functions cần bật thanh toán theo yêu cầu hiện hành của Firebase.

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

Meta có thể yêu cầu xác minh doanh nghiệp, xét duyệt ứng dụng và các điều kiện riêng cho tài khoản. Chưa có quyền Meta thì giao diện vẫn chạy ở chế độ demo.

## Nhập chỉ số quảng cáo

`extension/` là tiện ích Chrome riêng. Cài bằng `chrome://extensions` → **Developer mode** → **Load unpacked** → chọn thư mục `extension/`. Trên Meta Ads Manager, chọn tab chiến dịch/các cột cần lấy, bấm **Sao chép chỉ số Ads**, rồi nhập JSON trên website.

Tiện ích đọc bảng đang hiển thị trên trang; đây là snapshot do người dùng kích hoạt, không phải đồng bộ trực tiếp qua Marketing API. Cần đối chiếu chỉ số trước khi dùng báo cáo. Tích hợp Marketing API tự động cần ứng dụng Meta và quyền quảng cáo được Meta cấp.

## Nội dung và dữ liệu demo

- Dashboard ban đầu, đồ thị và vài hội thoại là dữ liệu minh hoạ. Không dùng số liệu mẫu làm báo cáo kinh doanh.
- Chế độ demo lưu dữ liệu ở localStorage của trình duyệt. Khi Firebase được kết nối và đăng nhập, website đọc các collection Firestore và ghi báo cáo, công việc, nội dung, chiến dịch và hộp thư vào workspace `fbtq`.
- Mẫu hoá đơn được tải thành HTML để mở/in thành PDF; cần bổ sung thông tin pháp lý, mã số thuế, quy định hoá đơn và mẫu thương hiệu trước khi dùng phát hành chính thức.
- Bộ lọc từ cấm hiện cung cấp ngữ cảnh cho mô hình gợi ý, không thay thế kiểm duyệt nội dung của nhân viên.

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
