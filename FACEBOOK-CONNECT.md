# Cài Messenger Fanpage cho website FBTQ

Website: https://bighappy9xx.github.io/marketing-ai-fbtq/
Firebase backend: `mediafbtq-6e1bb` (Blaze), region `us-central1`.

**Trạng thái:** mã nguồn và trình cài đặt đã chuẩn bị. Chưa có Meta App ID/App Secret nên chưa triển khai hoặc xác minh Fanpage thật. Không cần gửi secret qua cuộc trò chuyện. Các bài kiểm thử dùng API giả lập, không gửi tin thật.

## 1. Bạn tạo Meta App

1. Đăng nhập [Meta for Developers](https://developers.facebook.com/apps/) bằng tài khoản Facebook có quyền quản lý/nhắn tin trên Fanpage. Hoàn tất đăng ký developer nếu Meta yêu cầu.
2. Chọn **Create App**. Chọn use case về **Messenger / Business messaging / Engage with customers on Messenger** phù hợp màn hình Meta hiện tại. Tên mục có thể thay đổi theo loại App và tài khoản. Nếu tạo App kiểu Business qua luồng cũ, thêm Messenger vào App.
3. Đặt tên App, email liên hệ thật và chọn Business Portfolio sở hữu Fanpage nếu phù hợp. Không dùng App ID của một App không có khả năng Messenger.
4. Vào **App settings → Basic** để lấy **App ID** và **App Secret**. App ID có thể gửi để hỗ trợ; App Secret chỉ nhập kín vào Terminal.
5. Cấu hình sản phẩm/use case **Facebook Login** cho đăng nhập web. Nếu Meta cung cấp **Facebook Login for Business**, tạo cấu hình đăng nhập cho các quyền Trang cần dùng và ghi lại **Configuration ID**. Trình cài đặt hỗ trợ cả Configuration ID này và luồng Facebook Login dùng scope.

Quyền tài khoản trên Fanpage và vai trò trong Meta App là hai thứ khác nhau. Khi đang Development, thêm tài khoản thử vào App roles và chấp nhận lời mời. Kiểm tra bằng tài khoản thử hợp lệ trước.

## 2. Nhập các URL công khai trên Meta

| Trường trong Meta | Giá trị |
| --- | --- |
| App Domains | `bighappy9xx.github.io` |
| Terms of Service URL | `https://mediafbtq-6e1bb-meta.web.app/terms.html` |
| Privacy policy URL | `https://mediafbtq-6e1bb-meta.web.app/privacy.html` |
| User data deletion → Data deletion instructions URL | `https://mediafbtq-6e1bb-meta.web.app/data-deletion.html` |
| Website / Site URL | `https://bighappy9xx.github.io/marketing-ai-fbtq/` |
| Valid OAuth Redirect URIs | `https://bighappy9xx.github.io/marketing-ai-fbtq/index.html` |
| Webhook Callback URL | `https://us-central1-mediafbtq-6e1bb.cloudfunctions.net/metaWebhook` |

Redirect URI phải trùng tuyệt đối, kể cả `index.html`, HTTPS và đường dẫn repository. Đây là callback kết nối Fanpage, không phải callback đăng nhập Firebase. Không nhập URL Firebase `__/auth/handler` vào chỗ này.

Trong **App settings → Basic**, dùng email liên hệ `bighappy9xx@gmail.com` và các URL công khai ở bảng trên cho chính sách riêng tư, điều khoản sử dụng và hướng dẫn yêu cầu xóa dữ liệu. Nội dung phải phản ánh thực tế: thu thập tin nhắn, mục đích chăm sóc khách hàng, ai được truy cập, dùng AI nếu bật và cách yêu cầu xóa dữ liệu. Hệ thống hiện chưa có endpoint tự động xử lý Data Deletion Callback; chọn **Data Deletion Instructions URL** nếu dashboard cho phép và cung cấp quy trình/contact thực sự hoạt động. Không khai báo một URL mẫu hoặc URL chưa tồn tại. Việc xét duyệt/publish Meta do bạn hoàn tất trong tài khoản Meta.

## 3. Bạn chạy trình cài đặt một lần

Mở Terminal trên Mac:

```sh
cd /Users/amsbetrd/Documents/GitHub/marketing-ai-fbtq
node scripts/setup-messenger.cjs
```

Hoặc mở file `Cai-dat-Messenger.command` trong thư mục dự án.

Trình cài đặt cần Node.js 22, Firebase CLI đã cài và đăng nhập tài khoản có quyền project. Nếu báo chưa đăng nhập, chạy `firebase login` rồi chạy lại. Nếu thiếu Firebase CLI, dùng `npm install -g firebase-tools` theo cấu hình Node/npm của máy; lỗi EACCES cần sửa npm prefix trước, không tự đổi quyền toàn bộ `/usr/local`.

Các giá trị sẽ được hỏi:

1. **Meta App ID**: mã công khai lấy ở bước 1.
2. **Graph version**: mặc định `v26.0`; chọn phiên bản App đang hỗ trợ nếu khác.
3. **Facebook Login for Business Configuration ID**: nhập nếu App dùng loại đăng nhập này; Enter nếu dùng Facebook Login truyền thống.
4. **App Secret**: dán kín, Enter. Khi chạy lại cùng App có thể Enter để giữ secret cũ. Đổi App ID phải nhập App Secret của App mới.

Trình cài đặt thực hiện:

- Kiểm tra source; xác nhận App ID/App Secret bằng yêu cầu máy chủ tới Meta, không in App Secret hoặc app access token.
- Lưu `META_APP_SECRET` trong Firebase Secret Manager qua stdin, không viết secret vào source hoặc file env.
- Tạo `META_VERIFY_TOKEN` nếu chưa có. **Sao chép Verify Token hiển thị trong Terminal vào Meta Webhooks ở bước 4, không gửi nó vào chat.** Nếu đã có token, giữ nguyên và chỉ xem trong Terminal riêng khi cần.
- Tự sinh khóa mã hóa 32 byte `META_TOKEN_ENCRYPTION_KEY` nếu chưa tồn tại. **Không xoay khóa cũ**, tránh làm các Page Token đã lưu không giải mã được.
- Ghi cấu hình công khai vào `functions/.env.mediafbtq-6e1bb`, giữ nguyên các cấu hình khác. File env đã nằm trong gitignore.
- Triển khai 14 hàm kết nối/nhận/gửi/cấu hình Messenger và chỉ mục hội thoại. Nếu đã có `OPENAI_API_KEY`, triển khai thêm `autoReplyFacebook` dùng OpenAI; không buộc tạo `GEMINI_API_KEY`.
- HTTP của webhook và callable nhận kết nối từ Internet. Webhook kiểm tra HMAC bằng App Secret; các callable bắt buộc Firebase Auth, tài khoản đã duyệt, vai trò hợp lệ và kiểm tra chủ sở hữu Fanpage.

Trình cài đặt không đăng nhập Facebook thay bạn, không tự kết nối Trang, không gửi tin và không bật bot. Chi phí Functions/Secret Manager/Firestore và API OpenAI theo mức sử dụng vẫn áp dụng. Không liên quan tới project Gemini Free dành cho giọng đọc.

## 4. Bạn xác minh webhook trên Meta

Sau khi Terminal báo triển khai thành công:

1. Mở Meta App → Messenger API Settings / Webhooks (hoặc use case Messenger → Customize).
2. Chọn đối tượng **Page**, nhập **Callback URL** ở bảng trên và **Verify Token** do trình cài đặt cung cấp.
3. Bấm **Verify and Save**. Nếu Meta không xác minh được, dừng tại đây để xử lý URL/token/quyền HTTP trước.
4. Đăng ký hai trường **messages**, **messaging_postbacks**. Bản hiện tại đưa sự kiện message vào inbox; postback được đăng ký nhưng chưa chuyển thành yêu cầu AI.

Hai bước phải đủ: ứng dụng đăng ký webhook Page và Fanpage đăng ký ứng dụng. Bước sau được website thực hiện khi bạn phê duyệt kết nối Fanpage, không chỉ bấm Verify & Save là hoàn tất.

## 5. Bạn cấp quyền và kết nối Fanpage trên website

Kiểm tra quyền/permissions trong App:

- `pages_show_list`: liệt kê Trang người đăng nhập được quản lý.
- `pages_messaging`: gửi/nhận và quản lý hội thoại Messenger.
- `pages_manage_metadata`: đăng ký ứng dụng vào webhook của Trang.
- `pages_read_engagement`: quyền Trang được yêu cầu trong luồng đăng nhập hiện có.

Facebook Login for Business Configuration phải bao gồm quyền/tài sản tương ứng nếu dùng nó. Các quyền cần cấp phải xuất hiện đúng trong màn hình xin quyền thực tế; chỉ thêm scope trong code không tự cấp quyền.

Cập nhật giao diện qua GitHub Pages theo quy trình của repository; triển khai Firebase Functions không tự cập nhật GitHub Pages. Source mới dùng `chatbot-ui.js`, `app.js` và `styles.css` phiên bản `20261118-fanpage-picker`.

Sau khi giao diện đã cập nhật:

1. Đăng nhập website bằng tài khoản FBTQ đã duyệt, tài khoản này sẽ là chủ sở hữu kết nối.
2. Mở **Hộp thư & Chatbot AI → + Fanpage → Đăng nhập Facebook & chọn Fanpage**.
3. Đăng nhập tài khoản Facebook có quyền nhắn tin/quản lý Trang, cấp các quyền cần thiết.
4. Chọn Fanpage, bấm **Phê duyệt kết nối**. Backend mã hóa Page Token và đăng ký `subscribed_apps` cho Trang.
5. Giữ chế độ tự động **Tắt** để kiểm tra nhận/gửi thủ công trước.

Không cần gửi Page Access Token vào chat hoặc dán nó vào mã nguồn. Nếu OAuth không liệt kê được Trang, kiểm tra quyền trên Trang và App roles trước khi dùng kết nối Page Token nâng cao.

## 6. Bạn kiểm tra hai chiều và bật bot sau cùng

1. Từ tài khoản thử hợp lệ, chủ động nhắn một câu vào Fanpage.
2. Hội thoại/tin mới phải xuất hiện trên website. Chọn hội thoại, soạn câu trả lời và tự bấm gửi để kiểm tra chiều ngược lại.
3. Sau khi hai chiều hoạt động, mở **Cấu hình AI → chọn Fanpage**. Chọn **Kịch bản**, **AI**, hoặc **Kết hợp**; dùng OpenAI hiện có. Nhập thông tin sản phẩm/giá/giờ làm việc được duyệt rồi **Lưu & áp dụng**.
4. Nhắn một câu thử mới. Xem câu trả lời, kiểm tra chuyển nhân viên và STOP. Chuyển nhân viên sẽ dừng bot; bật lại qua nút tương ứng khi cần.

Gửi tin thông thường trong hệ thống hiện tại chỉ cho hội thoại trong 24 giờ từ tin khách mới nhất, chưa dừng nhận tin. Không nhập ID Facebook bất kỳ để nhắn tự do. Gửi hàng loạt có xem trước và xác nhận, tối đa 20 người/lượt đủ điều kiện; không phải cơ chế gửi không giới hạn.

Để phục vụ người dùng ngoài nhóm thử: hoàn tất App Review, mức truy cập phù hợp (Advanced Access khi yêu cầu), Business Verification nếu Meta yêu cầu và các bước Publish/Live trong dashboard. Không thể bỏ các yêu cầu Meta bằng sửa code.

## Nếu bị lỗi

| Hiện tượng | Kiểm tra |
| --- | --- |
| Nút đăng nhập bị khóa | Chạy trình cài đặt, kiểm tra App ID/redirect/webhook trong `getChatbotSetup` |
| URL blocked / redirect mismatch | Trùng đúng Valid OAuth Redirect URI ở bảng trên |
| Không thấy Fanpage | Đúng tài khoản Facebook, quyền MESSAGING/MODERATE/MANAGE, App roles và quyền đã cấp |
| Webhook không Verify | URL function, Verify Token và HTTP invoker; không đổi App Secret để thử ngẫu nhiên |
| Kết nối xong nhưng không nhận tin | App đã đăng ký messages, Trang đã subscribed_apps, tài khoản gửi thử hợp lệ |
| Nhận tin nhưng bot im | Đã deploy autoReplyFacebook, mode đã lưu, OpenAI có quota, hội thoại chưa STOP/handoff |
| Không gửi trả lời được | pages_messaging, cửa sổ 24 giờ, token còn hiệu lực và quyền Meta/App Review |
| Chỉ tester dùng được | Kiểm tra các yêu cầu App Review/Advanced Access/Publish của App |

Tài liệu Meta: [Messenger Quick Start](https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/), [Webhooks cho Pages](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages), [Facebook Login web](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/), [Page subscribed_apps](https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/).


## Lỗi Eventarc khi triển khai autoReplyFacebook lần đầu

Nếu các hàm kết nối đã báo Successful create operation nhưng `autoReplyFacebook` báo `Permission denied while using the Eventarc Service Agent`, phần kết nối và webhook có thể đã triển khai thành công. Đây là lỗi trigger Google Cloud, không phải App Secret hoặc Page Token.

Kiểm tra tài khoản dịch vụ `service-231204857128@gcp-sa-eventarc.iam.gserviceaccount.com` có role `roles/eventarc.serviceAgent` trong đúng project `mediafbtq-6e1bb`. Khi role đã tồn tại, đợi vài phút để quyền có hiệu lực và triển khai lại đúng một hàm:

```sh
firebase deploy --only functions:autoReplyFacebook --project mediafbtq-6e1bb --non-interactive
```

Không cần nhập lại secret hoặc chạy lại toàn bộ trình cài đặt. Nếu role thực sự thiếu, cần người có quyền IAM khôi phục role này cho đúng Eventarc service agent; không cấp role cho tài khoản người dùng hoặc allUsers, không cấp Owner/Editor để xử lý lỗi này. Sau khi triển khai, cần xác nhận trạng thái function và Eventarc trigger trước khi bật bot. Không tạo tin nhắn giả trong Firestore để kiểm tra vì có thể kích hoạt gửi tin thật.

[Tài liệu Google về lỗi quyền Eventarc](https://docs.cloud.google.com/eventarc/docs/troubleshooting#permission_denied_errors).


## Đã đăng nhập Facebook nhưng không thấy hộp chọn Fanpage

Màn hình mới đưa về Hộp thư và mở bảng chọn Trang sau OAuth. Nếu đã đóng bảng hoặc tải lại trang, bấm **+ Fanpage** hoặc **Chọn Fanpage** trên thông báo để khôi phục phiên đã được cấp quyền. Backend `getFacebookPageSelection` chỉ trả ID/tên Trang của phiên sẵn sàng thuộc đúng tài khoản FBTQ, trong hạn 10 phút; không trả token mã hóa. Có thể chọn tối đa 10 Trang mỗi lần và phải phê duyệt trước khi kết nối.

Nếu phiên đã hết hạn, cần đăng nhập lại Facebook để cấp phiên mới. Đây là việc làm mới phiên, không yêu cầu đổi App Secret hoặc tạo lại Meta App. Hộp chọn có tìm kiếm, hiển thị số Trang và nút phê duyệt luôn nằm trong khung trên điện thoại.
