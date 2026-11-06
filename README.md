# Marketing Ai FBTQ

Website quản trị marketing dạng file tĩnh, không cần bước build. Giao diện không chứa số liệu chiến dịch, hội thoại hay nhân sự mẫu. Đăng nhập Firebase để làm việc; các bảng chỉ hiển thị dữ liệu thật đã lưu hoặc trạng thái chưa có dữ liệu.

## Bắt đầu sử dụng

Đưa giao diện lên hosting HTTPS, sau đó đăng nhập hoặc đăng ký bằng Firebase Authentication. Nếu chưa có dữ liệu, nhập báo cáo CSV/JSON ở mục **Hiệu suất marketing**; mục **Tổng quan** sẽ lấy số liệu của kỳ báo cáo đang chọn. Các nội dung, công việc và hóa đơn được lưu theo tài khoản/workspace trong Firestore.

Các tệp giao diện chính: `index.html`, `styles.css`, `app.js`, `firebase-config.js`.

## Triển khai Firebase Hosting

1. Tạo Firebase project và Web App. Bật **Authentication → Email/Password** và **Cloud Firestore**. Trong **Authentication → Settings → Authorized domains**, thêm `bighappy9xx.github.io` (chỉ tên miền, không thêm `/marketing-ai-fbtq`).
2. Tạo Firestore ở chế độ production; Rules cho phép mọi tài khoản đã đăng nhập sử dụng website và giới hạn thao tác theo vai trò.
3. Điền `apiKey`, `authDomain`, `projectId`, `appId` và `appCheckSiteKey` (reCAPTCHA Enterprise site key) vào `firebase-config.js`. Tệp này được tải chung khi website mở nên quản trị viên cấu hình một lần, không cần gửi site key cho từng user. Sau khi sửa, commit và triển khai lại GitHub Pages. Firebase Web API key và reCAPTCHA site key là mã công khai; tuyệt đối không đưa private key hoặc service account key vào thư mục public.
4. Nếu cần triển khai Rules hoặc Cloud Functions, cài Firebase CLI và đăng nhập. Bỏ qua bước cài dependencies bên dưới nếu chỉ dùng Gemini AI Logic:

   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add
   cd functions && npm install && cd ..
   ```

5. Gemini trong **Studio nội dung** và mục **Giọng đọc** dùng Firebase AI Logic trực tiếp, không cần Cloud Function hoặc Gemini API Key riêng. ChatGPT, Claude và các chức năng máy chủ khác vẫn cần Cloud Functions cùng cấu hình tương ứng.

6. Chỉ khi kết nối Fanpage: đặt biến môi trường `META_GRAPH_VERSION` trong `functions/.env.<PROJECT_ID>` theo phiên bản Graph API mà Meta App của công ty hỗ trợ.
7. Nếu dùng Firebase Hosting, triển khai giao diện và Rules. Với GitHub Pages, đẩy file website lên GitHub như thường lệ; triển khai Cloud Functions riêng bằng lệnh trong mục AI bên dưới.

   ```sh
   firebase deploy --only hosting,firestore:rules --project mediafbtq-6e1bb
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

### Logo và ảnh đại diện

`logo.svg`, `logo-light.svg` và `favicon.svg` là bộ nhận diện dùng trên trang đăng nhập, menu và tab trình duyệt. Sau khi đăng nhập, bấm ảnh đại diện ở góc trên bên phải để chọn hoặc gỡ ảnh. Ảnh được cắt vuông, thu nhỏ ở trình duyệt và lưu trong hồ sơ Firebase của chính tài khoản; không cần bật Firebase Storage. Rules chỉ cho chủ tài khoản cập nhật trường ảnh đại diện, giới hạn 180 KB. Sau khi cập nhật Rules, triển khai lại:

```sh
firebase deploy --project mediafbtq-6e1bb --only firestore:rules
```

Mỗi **Báo cáo quảng cáo hàng ngày** gồm doanh thu. Ô doanh thu trong **Tổng quan** và ô thứ năm trong **Hiệu suất marketing** cộng doanh thu theo kỳ Meta Ads đang chọn. Quản lý có thể lọc chiến dịch theo từng user và đối chiếu hai user. Trang **Xếp hạng & so sánh nhân sự** có biểu đồ cột 3D theo tháng/quý/năm. Mỗi nhân viên chỉ đọc báo cáo chi tiết của mình; mọi tài khoản đăng nhập có thể đọc các bản ghi doanh thu tối thiểu để xếp hạng. Triển khai Rules bằng lệnh ở trên; không cần Cloud Function cho xếp hạng.

### Upload Hóa Đơn Meta Ads

Trong **Tự động hóa → Upload Hóa Đơn**, chọn PDF hóa đơn Meta/Facebook. Website đọc lớp văn bản của PDF ngay trên trình duyệt rồi điền tên trên hóa đơn, tài khoản quảng cáo, mã hóa đơn, mã số thuế nhà cung cấp, mã giao dịch, ngày lập, kỳ kế toán/kỳ thuế và các số tiền trước VAT, VAT, tổng thanh toán. Kiểm tra lại các trường được điền, sửa nếu cần, rồi bấm **Lưu và gửi duyệt**. PDF có thể tối đa 5 MB; PDF dạng ảnh quét không có lớp văn bản sẽ cần nhập số liệu bằng tay.

Hóa đơn được lưu ở trạng thái **Chờ duyệt**. Nhân viên xem hồ sơ do mình gửi; trưởng phòng, quản lý chi nhánh và giám đốc xem toàn bộ, mở PDF gốc, rồi duyệt hoặc từ chối. Bảng **Báo cáo VAT Meta Ads** lọc theo tháng/quý/năm hoặc ngày, phòng ban, tổng hợp tiền trước VAT/VAT/tổng thanh toán và xuất CSV để kế toán xử lý. Sau khi cập nhật website, triển khai Firestore Rules mới để khóa quyền đọc file PDF theo chủ sở hữu và vai trò quản lý:

```sh
firebase deploy --project mediafbtq-6e1bb --only firestore:rules
```

Tệp PDF gốc được chia thành các phần nhỏ và lưu cùng hồ sơ trong Firestore để không phụ thuộc Firebase Storage. Nếu tải PDF lớn, Firestore sẽ sử dụng dung lượng và lượt đọc/ghi tương ứng.

## Firebase AI Logic cho Gemini

Gemini tạo nội dung trong **Studio nội dung** và chuyển văn bản thành giọng đọc qua Firebase AI Logic, dùng Gemini Developer API. Không nhập Gemini API Key vào mã nguồn, cài đặt website hay GitHub: từ giữa năm 2026, Firebase AI Logic xác thực bằng service identity do Google quản lý. Key Google AI Studio mà bạn gửi trong cuộc trò chuyện không cần cho cấu hình này. Vì key đã được chia sẻ trong chat, hãy thu hồi key đó tại [Google AI Studio API keys](https://aistudio.google.com/apikey) và không dùng lại.

### Bật Gemini cho Firebase

1. Mở [Firebase Console](https://console.firebase.google.com/) và chọn project `mediafbtq-6e1bb`.
2. Vào **Build → Firebase AI Logic → Get started**. Chọn **Gemini Developer API** (không chọn Agent Platform/Vertex AI nếu muốn bắt đầu bằng gói miễn phí), rồi hoàn tất bật dịch vụ.
3. Mở Google Cloud Console → **Fraud Defense / reCAPTCHA Enterprise**, tạo key dạng **Web**, thêm tên miền `bighappy9xx.github.io` (không thêm đường dẫn `/marketing-ai-fbtq`), để chế độ score-based/không checkbox, rồi sao chép **site key**. Trong Firebase Console → **Security → App Check → Apps**, đăng ký Web App bằng provider **reCAPTCHA Enterprise** và nhập cùng site key. Chỉ site key được đưa vào website; giữ secret key phía Google.
4. Đẩy các tệp website đã cập nhật (`app.js`, `index.html`, `README.md`) lên GitHub Pages.
5. Đăng nhập website bằng tài khoản quản lý, vào **Cài đặt → Firebase & dữ liệu**, dán **reCAPTCHA Enterprise site key** vào ô cùng tên, bấm **Kết nối Firebase**, rồi tải lại trang. Nếu cấu hình Firebase đã lưu sẵn, điền site key và bấm lưu; website sẽ báo cần tải lại để áp dụng.
6. Trong **Security → App Check → APIs**, kiểm tra Firebase AI Logic đang ở trạng thái Enforced. Vào **Studio nội dung**, chọn Gemini, nhập prompt rồi bấm **Tạo nội dung**. Mục **Giọng đọc** cũng dùng Firebase AI Logic và tạo file WAV.

Firebase AI Logic với Gemini Developer API có thể bắt đầu trên gói Spark không tính phí; giới hạn miễn phí và hạn mức sử dụng của Gemini vẫn áp dụng. Nếu project chuyển sang Blaze, các yêu cầu Gemini Developer API sẽ theo chính sách trả theo mức dùng. TTS của Firebase AI Logic hiện ở giai đoạn Preview; reCAPTCHA Enterprise có hạn mức miễn phí và có thể tính phí khi vượt hạn mức. Xem [Firebase AI Logic bắt đầu](https://firebase.google.com/docs/ai-logic/get-started?platform=web), [App Check cho web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [hỏi đáp và giá Firebase AI Logic](https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting), và [Gemini TTS](https://firebase.google.com/docs/ai-logic/generate-speech).

### ChatGPT, Claude và Chatbot

ChatGPT/Claude trong Studio và các chức năng Chatbot chạy qua Cloud Functions; chúng vẫn cần provider API key dạng Functions Secret và project phải đủ điều kiện triển khai Cloud Functions (thường cần Blaze có billing đang hoạt động). Chỉ lưu khóa của nhà cung cấp cần dùng:

```sh
firebase functions:secrets:set OPENAI_API_KEY --project mediafbtq-6e1bb
firebase functions:secrets:set ANTHROPIC_API_KEY --project mediafbtq-6e1bb
```

Sau đó triển khai hàm tương ứng:

```sh
firebase deploy --project mediafbtq-6e1bb --only functions:generateContentOpenAI
firebase deploy --project mediafbtq-6e1bb --only functions:generateContentClaude
```

Chatbot Messenger đang dùng hàm máy chủ riêng. Nếu chọn Gemini trong chatbot, phần đó vẫn cần `GEMINI_API_KEY` secret vì yêu cầu tin nhắn đi qua Cloud Functions; Gemini Studio nội dung và giọng đọc không dùng secret đó. Không đưa bất kỳ provider key nào vào file website/GitHub.

## Chuyển văn bản thành giọng đọc

Trong **Studio nội dung → Giọng đọc**, nhập văn bản hoặc chuyển bản nháp đang mở sang giọng đọc, nghe thử và tải WAV. Website dùng Firebase AI Logic, model `gemini-3.1-flash-tts-preview`, với năm giọng dựng sẵn: **Thảo Nhi — Aoede**, **Giang Chu — Kore**, **Trần Hà Linh — Zephyr**, **Mai Công Chúa — Callirrhoe** và **Vũ Khánh Phương — Sulafat**. Gemini trả về âm thanh PCM; website chuyển thành WAV trên trình duyệt. Mỗi lần tạo giới hạn 1.800 ký tự. Hoàn tất các bước cấu hình Firebase AI Logic và App Check ở trên; không cần lưu Secret Gemini cho tính năng này.

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

Trong trang **Hiệu suất marketing**, Giám đốc xem thêm cột **Người phụ trách** ở danh sách đầy đủ và chiến dịch gần đây. Tên và email được đối chiếu từ UID tài khoản đã nhập báo cáo; biểu đồ cũng hiện người phụ trách trong chú giải khi rê chuột vào cột.

Trang **Xếp hạng & so sánh nhân sự** cho mọi tài khoản chọn tháng, quý hoặc năm để so sánh tổng doanh thu từ báo cáo quảng cáo hằng ngày. Có thể chuyển giữa cột 3D, cột 2D, biểu đồ tròn và thống kê; biểu đồ cột hiển thị tối đa 10 nhân sự dẫn đầu. Báo cáo cùng ngày và chiến dịch được cập nhật vào bản ghi cũ để tránh cộng trùng; bảng hiển thị số ngày có báo cáo.

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
functions/                 API AI, giọng đọc, phân quyền, Fanpage webhook
extension/                 Tiện ích sao chép chỉ số Ads Manager
```
