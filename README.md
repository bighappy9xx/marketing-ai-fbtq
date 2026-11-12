# Marketing Ai FBTQ

Website quản trị marketing dạng file tĩnh, không cần bước build. Giao diện không chứa số liệu chiến dịch, hội thoại hay nhân sự mẫu. Đăng nhập Firebase để làm việc; các bảng chỉ hiển thị dữ liệu thật đã lưu hoặc trạng thái chưa có dữ liệu.

## Bắt đầu sử dụng

Đưa giao diện lên hosting HTTPS, sau đó đăng nhập hoặc đăng ký bằng Firebase Authentication. Nếu chưa có dữ liệu, nhập báo cáo CSV/JSON ở mục **Hiệu suất marketing**; mục **Tổng quan** sẽ lấy số liệu của kỳ báo cáo đang chọn. Các nội dung, công việc và hóa đơn được lưu theo tài khoản/workspace trong Firestore.

Các tệp giao diện chính: `index.html`, `styles.css`, `app.js`, `firebase-config.js`.

### Báo cáo quảng cáo hàng ngày

1. Vào **Hiệu suất marketing** và nhập tệp CSV/JSON như bình thường.
2. Bấm **Báo cáo hàng ngày**. Bảng sẽ lấy các dòng của chính tài khoản đang đăng nhập trong kỳ đang chọn, tự điền tài khoản quảng cáo, chiến dịch, trạng thái, ngân sách, chi tiêu và các chỉ số tin nhắn có trong tệp.
3. Kiểm tra ngày báo cáo, bổ sung SĐT/doanh thu và các thông tin còn thiếu, rồi bấm **Lưu báo cáo**. Tổng chi tiêu, số Mess, doanh thu, ngưỡng còn và KPI tháng được tính ngay trên bảng.

Nếu cùng ngày và chiến dịch đã có báo cáo, thao tác lưu sẽ cập nhật bản ghi doanh thu hiện tại thay vì cộng lặp vào bảng xếp hạng. Những cột không có trong tệp được để trống để nhân viên xác nhận thủ công.


## Triển khai Firebase Hosting

1. Tạo Firebase project và Web App. Bật **Authentication → Email/Password** và **Cloud Firestore**. Trong **Authentication → Settings → Authorized domains**, thêm `bighappy9xx.github.io` (chỉ tên miền, không thêm `/marketing-ai-fbtq`).
2. Tạo Firestore ở chế độ production; Rules cho phép mọi tài khoản đã đăng nhập sử dụng website và giới hạn thao tác theo vai trò.
3. Điền `apiKey`, `authDomain`, `projectId`, `appId` và `appCheckSiteKey` (reCAPTCHA Enterprise site key) vào `firebase-config.js`. Tệp này được tải chung khi website mở nên quản trị viên cấu hình một lần, không cần gửi site key cho từng user. Sau khi sửa, commit và triển khai lại GitHub Pages. Firebase Web API key và reCAPTCHA site key là mã công khai; tuyệt đối không đưa private key hoặc service account key vào thư mục public.
4. Để triển khai Rules trên Spark, cài Firebase CLI và đăng nhập. Không cần cài dependencies trong `functions/` cho quy trình đơn từ/tạm ứng. Chỉ cài dependencies nếu dự án dùng Blaze và cần triển khai backend:

   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add
   cd functions && npm install && cd ..
   ```

5. Gemini trong **Studio nội dung**, **Kiểm duyệt nội dung**, **Trợ lý FBTQ** và mục **Giọng đọc** dùng Firebase AI Logic trực tiếp. Quy trình **Đơn Từ & Đề Xuất** và **Hoá Đơn Tạm Ứng** dùng Firestore Security Rules trực tiếp, không cần Cloud Functions. ChatGPT, Claude, chatbot Messenger, Meta webhook và các phần máy chủ khác vẫn cần Cloud Functions, vì vậy không hoạt động trên Spark.

6. Chỉ khi kết nối Fanpage: đặt biến môi trường `META_GRAPH_VERSION` trong `functions/.env.<PROJECT_ID>` theo phiên bản Graph API mà Meta App của công ty hỗ trợ.
7. Nếu dùng Firebase Hosting, triển khai giao diện và Rules. Với GitHub Pages, đẩy file website lên GitHub như thường lệ; triển khai Cloud Functions riêng bằng lệnh trong mục AI bên dưới.

   ```sh
   firebase deploy --only hosting,firestore:rules --project mediafbtq-6e1bb
   ```

Hosting cần HTTPS để Firebase Authentication, clipboard và webhook hoạt động.

## Extension Meta Helper

Thư mục `extension/` chứa extension Chrome có logo Favicon. Sau khi cài lại/reload extension và tải lại các tab, mở Ads Manager rồi bấm **Gửi vào Báo cáo hàng ngày** để tự nhập chỉ số. Trên Billing/Payment activity, quét liên kết PDF hoặc chọn biên lai đã tải; extension mở form Upload Hóa Đơn Meta và website tự đọc PDF. Cần đăng nhập website trước khi dữ liệu được nhập; hãy kiểm tra báo cáo/hóa đơn rồi tự bấm lưu. Hướng dẫn cài chi tiết nằm trong `extension/README.md`.

## Tài khoản và phân quyền

Mọi tài khoản đã đăng ký và đăng nhập Firebase đều vào được website; nếu chưa có hồ sơ Firestore, website tự tạo hồ sơ với vai trò **Nhân viên**. Rules giới hạn Nhân viên ở dữ liệu của chính họ: chỉ số quảng cáo theo `createdBy`, công việc được giao, báo cáo/bản nháp/đề xuất hóa đơn do họ tạo, và hội thoại thuộc Fanpage của họ. Giám đốc, Quản lý chi nhánh và Trưởng phòng có thể xem dữ liệu toàn công ty. Mẫu nội dung đã duyệt và cấu hình chatbot là tài nguyên dùng chung.

Triển khai Rules mới để áp dụng phân quyền riêng tư theo người dùng và vai trò, đồng thời bật ghi/duyệt hồ sơ trực tiếp trên Spark:

```sh
firebase deploy --project mediafbtq-6e1bb --only "firestore:rules,firestore:indexes"
```

Các đơn xin nghỉ/đề xuất được duyệt theo thứ tự **Trưởng phòng → Quản lý chi nhánh**; tạm ứng theo **Quản lý chi nhánh → Kế toán**. Firestore Rules kiểm tra mỗi bước và bắt buộc hai người duyệt khác nhau. Đơn nghỉ và khóa buổi nghỉ được ghi trong cùng giao dịch, tránh đăng ký trùng ngày/buổi. Hai quy trình này dùng Firestore trực tiếp; không cần bật billing hay triển khai Cloud Functions.

Giám đốc đổi vai trò tại **Nhân sự & phân quyền** bằng UID trong Firebase Authentication hoặc email. Website ghi vai trò vào hồ sơ `users/{UID}`; Firestore Rules chỉ cho Giám đốc thực hiện việc này. Người được phân quyền cần đăng xuất rồi đăng nhập lại để tải quyền mới. Không cần custom claim hoặc Cloud Function cho phân quyền trên website.

Các mã vai trò: `director` (Giám đốc), `branch_manager` (Quản lý chi nhánh), `department_manager` (Trưởng phòng), `employee` (Nhân viên). Cloud Functions cần bật thanh toán theo yêu cầu hiện hành của Firebase.

### Logo và ảnh đại diện

`logo.svg`, `logo-light.svg` và `favicon.svg` là bộ nhận diện dùng trên trang đăng nhập, menu và tab trình duyệt. Sau khi đăng nhập, bấm ảnh đại diện ở góc trên bên phải để chọn hoặc gỡ ảnh. Ảnh được cắt vuông, thu nhỏ ở trình duyệt và lưu trong hồ sơ Firebase của chính tài khoản; không cần bật Firebase Storage. Rules chỉ cho chủ tài khoản cập nhật trường ảnh đại diện, giới hạn 180 KB. Sau khi cập nhật Rules, triển khai lại:

```sh
firebase deploy --project mediafbtq-6e1bb --only firestore:rules
```

Mỗi **Báo cáo quảng cáo hàng ngày** gồm doanh thu. Ô doanh thu trong **Tổng quan** và ô thứ năm trong **Hiệu suất marketing** cộng doanh thu theo kỳ Meta Ads đang chọn. Quản lý có thể lọc chiến dịch theo từng user và đối chiếu hai user. Trang **Xếp hạng & so sánh nhân sự** có biểu đồ cột 3D theo tháng/quý/năm. Mỗi nhân viên chỉ đọc báo cáo chi tiết của mình; mọi tài khoản đăng nhập có thể đọc các bản ghi doanh thu tối thiểu để xếp hạng. Triển khai Rules bằng lệnh ở trên; không cần Cloud Function cho xếp hạng.

### Upload Hóa Đơn Meta Ads

Trong **Tự động hóa → Upload Hóa Đơn**, chọn PDF hóa đơn Meta/Facebook. Website đọc lớp văn bản của PDF ngay trên trình duyệt rồi điền mã số thuế nhà cung cấp, mã giao dịch, ngày lập, kỳ kế toán/kỳ thuế, VAT rate, VAT amount, tiền trước VAT và tổng thanh toán. Nếu hóa đơn không có thông tin VAT, website điền VAT bằng 0 và dùng tổng tiền hóa đơn làm tiền trước VAT. Hệ thống không hiển thị trường tài khoản quảng cáo, tên trên hóa đơn hoặc mã hóa đơn Meta trong form. Sau khi đọc, form báo rõ trường nào chưa nhận diện để người tải bổ sung. Kiểm tra lại các trường được điền, sửa nếu cần, rồi bấm **Lưu và gửi duyệt**. PDF có thể tối đa 5 MB; PDF dạng ảnh quét không có lớp văn bản sẽ cần nhập số liệu bằng tay.

Hóa đơn được lưu ở trạng thái **Chờ duyệt**. Nhân viên xem hồ sơ do mình gửi; trưởng phòng, quản lý chi nhánh và giám đốc xem toàn bộ, mở PDF gốc, rồi duyệt hoặc từ chối. Bảng **Báo cáo VAT Meta Ads** lọc theo tháng/quý/năm hoặc ngày và theo nhân sự; quản lý xem toàn bộ hoặc chọn một user, nhân viên chỉ xem hóa đơn của mình. Bảng tổng hợp tiền trước VAT/VAT/tổng thanh toán và xuất CSV để kế toán xử lý. Sau khi cập nhật website, triển khai Firestore Rules mới để khóa quyền đọc file PDF theo chủ sở hữu và vai trò quản lý:

```sh
firebase deploy --project mediafbtq-6e1bb --only firestore:rules
```

Tệp PDF gốc được chia thành các phần nhỏ và lưu cùng hồ sơ trong Firestore để không phụ thuộc Firebase Storage. Nếu tải PDF lớn, Firestore sẽ sử dụng dung lượng và lượt đọc/ghi tương ứng.

## Firebase AI Logic cho Gemini

Gemini tạo nội dung, kiểm tra từ cấm/chính tả trong **Kiểm duyệt nội dung**, trò chuyện trong **Trợ lý FBTQ** và chuyển văn bản thành giọng đọc qua Firebase AI Logic, dùng Gemini Developer API. Không nhập Gemini API Key vào mã nguồn, cài đặt website hay GitHub: từ giữa năm 2026, Firebase AI Logic xác thực bằng service identity do Google quản lý. Key Google AI Studio mà bạn gửi trong cuộc trò chuyện không cần cho cấu hình này. Vì key đã được chia sẻ trong chat, hãy thu hồi key đó tại [Google AI Studio API keys](https://aistudio.google.com/apikey) và không dùng lại.

### Bật Gemini cho Firebase

1. Mở [Firebase Console](https://console.firebase.google.com/) và chọn project `mediafbtq-6e1bb`.
2. Vào **Build → Firebase AI Logic → Get started**. Chọn **Gemini Developer API** (không chọn Agent Platform/Vertex AI nếu muốn bắt đầu bằng gói miễn phí), rồi hoàn tất bật dịch vụ.
3. Mở Google Cloud Console → **Fraud Defense / reCAPTCHA Enterprise**, tạo key dạng **Web**, thêm tên miền `bighappy9xx.github.io` (không thêm đường dẫn `/marketing-ai-fbtq`), để chế độ score-based/không checkbox, rồi sao chép **site key**. Trong Firebase Console → **Security → App Check → Apps**, đăng ký Web App bằng provider **reCAPTCHA Enterprise** và nhập cùng site key. Chỉ site key được đưa vào website; giữ secret key phía Google.
4. Đẩy các tệp website đã cập nhật (`app.js`, `index.html`, `README.md`) lên GitHub Pages.
5. Đăng nhập website bằng tài khoản quản lý, vào **Cài đặt → Firebase & dữ liệu**, dán **reCAPTCHA Enterprise site key** vào ô cùng tên, bấm **Kết nối Firebase**, rồi tải lại trang. Nếu cấu hình Firebase đã lưu sẵn, điền site key và bấm lưu; website sẽ báo cần tải lại để áp dụng.
6. Trong **Security → App Check → APIs**, kiểm tra Firebase AI Logic đang ở trạng thái Enforced. Vào **Studio nội dung**, chọn Gemini, nhập prompt rồi bấm **Tạo nội dung**. Mục **Giọng đọc** cũng dùng Firebase AI Logic và tạo file WAV.

Firebase AI Logic với Gemini Developer API có thể bắt đầu trên gói Spark không tính phí; giới hạn miễn phí và hạn mức sử dụng của Gemini vẫn áp dụng. Nếu project chuyển sang Blaze, các yêu cầu Gemini Developer API sẽ theo chính sách trả theo mức dùng. TTS của Firebase AI Logic hiện ở giai đoạn Preview; reCAPTCHA Enterprise có hạn mức miễn phí và có thể tính phí khi vượt hạn mức. Xem [Firebase AI Logic bắt đầu](https://firebase.google.com/docs/ai-logic/get-started?platform=web), [App Check cho web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [hỏi đáp và giá Firebase AI Logic](https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting), và [Gemini TTS](https://firebase.google.com/docs/ai-logic/generate-speech).

### ChatGPT, Claude và Chatbot

Hướng dẫn kết nối ChatGPT cho cả Studio nội dung và Trợ lý FBTQ, gồm nút kiểm tra API thực tế: [OPENAI_SETUP.md](OPENAI_SETUP.md).

Mục **Kiểm duyệt nội dung** có AI tự dò từ cấm và chính tả, đánh dấu đỏ và gợi ý sửa trực tiếp. Hiện dùng **Gemini qua Firebase AI Logic** trên Spark, không cần OpenAI hoặc Cloud Functions; xem [FIREBASE_AI_SETUP.md](FIREBASE_AI_SETUP.md). Giao diện chặn gửi/phê duyệt khi còn từ cấm hoặc AI chưa kiểm tra được; lỗi chính tả được cảnh báo để người dùng sửa.

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

Chatbot Messenger dùng hàm máy chủ riêng để giữ Page token và Gemini key ở phía server. Tự trả lời dùng `GEMINI_API_KEY`; Gemini Studio nội dung và giọng đọc dùng Firebase AI Logic và không dùng secret đó. Không đưa bất kỳ provider key nào vào file website/GitHub.

## AI tìm khoảnh khắc hấp dẫn trong video

Trong **Studio Sáng Tạo → Studio AI**, chọn số clip và thời lượng để Gemini đọc video đang chọn, tạo bảng Start/End, hook, lý do chọn, tiêu đề, mô tả, hashtag và gợi ý chuyển cảnh/nhạc/phụ đề. Có thể nhảy timecode, xuất CSV và xác nhận đặt điểm cắt có Hoàn tác. Tính năng dùng Firebase AI Logic, không cần OpenAI; video nguồn tối đa 12 MB, phạm vi chọn tối đa 10 phút. Hướng dẫn: [STUDIO-HIGHLIGHTS.md](STUDIO-HIGHLIGHTS.md).

## Chuyển văn bản thành giọng đọc

Trong **Studio nội dung → Giọng đọc**, nhập văn bản hoặc chuyển bản nháp đang mở sang giọng đọc, nghe thử và tải WAV. Website dùng Firebase AI Logic, model `gemini-3.1-flash-tts-preview`, với năm giọng dựng sẵn: **Thảo Nhi — Aoede**, **Giang Chu — Kore**, **Trần Hà Linh — Zephyr**, **Mai Công Chúa — Callirrhoe** và **Vũ Khánh Phương — Sulafat**. Gemini trả về âm thanh PCM; website chuyển thành WAV trên trình duyệt. Mỗi lần tạo giới hạn 1.800 ký tự. Hoàn tất các bước cấu hình Firebase AI Logic và App Check ở trên; không cần lưu Secret Gemini cho tính năng này.

## Kết nối Fanpage Messenger

1. Đọc [CHATBOT_SETUP.md](CHATBOT_SETUP.md) để cài secrets, triển khai các hàm chatbot và lấy callback URL. Tạo Meta App, thêm Messenger, cấu hình Webhooks cho Page và đăng ký trường `messages`.
2. Đặt secrets:

   ```sh
   firebase functions:secrets:set META_TOKEN_ENCRYPTION_KEY
   firebase functions:secrets:set META_VERIFY_TOKEN
   firebase functions:secrets:set META_APP_SECRET
   firebase functions:secrets:set GEMINI_API_KEY
   ```

   Tạo khóa mã hoá 32 byte (64 ký tự hex) và verify token ngẫu nhiên trên máy quản trị. Cất các giá trị này trong kho bí mật; không ghi vào file website.
3. Đăng ký webhook cho sự kiện `messages`, cấu hình App Secret/verify token và hoàn thành yêu cầu xét duyệt quyền `pages_messaging` cùng `pages_manage_metadata`.
4. Kết nối Page bằng Page ID và Page Access Token trong **Chatbot AI → Kết nối Fanpage**. Token được mã hoá AES-GCM trong Cloud Functions trước khi lưu Firestore.
5. Bật **Trả lời tự động bằng Gemini** trong Cài đặt → Chatbot & Fanpage. Tin nhắn AI, trả lời nhân viên và tin theo lô đều bị chặn nếu trùng với từ khoá cấm đã lưu. Quản lý gửi tối đa 50 người/lượt; máy chủ kiểm tra từng người còn trong cửa sổ tin nhắn 24 giờ.

Meta có thể yêu cầu xác minh doanh nghiệp, xét duyệt ứng dụng và các điều kiện riêng cho tài khoản. Functions cần dự án Firebase Blaze có billing hoạt động; nếu đang ở Spark thì webhook và trả lời tự động chưa thể chạy trên Firebase. Chưa có quyền Meta, danh sách Fanpage và hội thoại sẽ hiển thị trạng thái chưa có dữ liệu.

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
- Danh sách Fanpage được nạp qua callable `listMyPages`; hướng dẫn triển khai riêng chatbot nằm trong [CHATBOT_SETUP.md](CHATBOT_SETUP.md).
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
