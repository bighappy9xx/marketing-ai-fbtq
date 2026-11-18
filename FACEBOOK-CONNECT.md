# Cài Messenger Fanpage cho website FBTQ

Website: https://bighappy9xx.github.io/marketing-ai-fbtq/
Firebase backend: `mediafbtq-6e1bb` (Blaze), region `us-central1`.

**Trạng thái:** đã cấu hình Meta App `1679762183550015` và triển khai backend Messenger. Việc kết nối Trang không tự xác nhận quyền đọc hội thoại hoặc nhận tin của khách ngoài nhóm thử. Dùng chức năng kiểm tra kết nối và tài khoản thử hợp lệ để xác minh; không gửi secret qua cuộc trò chuyện. Các bài kiểm thử tự động dùng API giả lập, không gửi tin thật.

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
- Triển khai nhóm hàm kết nối/nhận/gửi/đồng bộ/kiểm tra/cấu hình Messenger và chỉ mục hội thoại. Nếu đã có `OPENAI_API_KEY`, triển khai thêm `autoReplyFacebook` dùng OpenAI; không buộc tạo `GEMINI_API_KEY`.
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

Cập nhật giao diện qua GitHub Pages theo quy trình của repository; triển khai Firebase Functions không tự cập nhật GitHub Pages. Source mới dùng `chatbot-ui.js`, `app.js` và `styles.css` phiên bản `20261118-page-groups`.

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


## Fanpage đã kết nối nhưng chưa có tin nhắn

1. Mở **Hộp thư & Chatbot AI → Đồng bộ tin nhắn**, chọn đúng Fanpage và bấm **Kiểm tra kết nối**. Bảng này kiểm tra token, đăng ký ứng dụng trên Trang, webhook Page/messages và quyền đọc hội thoại; không gửi tin.
2. Bấm **Tải lịch sử gần đây**. Mỗi lượt đọc tối đa 5 hội thoại, tối đa 25 tin gần nhất mỗi hội thoại. Dùng **Tải thêm hội thoại** để lấy lượt kế tiếp; chọn hội thoại rồi **Tải tin nhắn cũ hơn** nếu còn dữ liệu. Meta chỉ trả dữ liệu trong phạm vi App/token được phép, nên kết quả 0 không khẳng định Trang không có tin trên Facebook.
3. Tin lịch sử giữ thời gian gốc, không tự gửi trả lời, không kích hoạt bot và không đặt lại cửa sổ gửi 24 giờ. Tin trùng được bỏ qua; đồng bộ không ghi đè tin mới hơn hoặc trạng thái chuyển nhân viên.
4. Với tin mới, ứng dụng phải có webhook Page/messages và Trang phải đăng ký đúng ứng dụng. Màn hình kiểm tra kết nối hiển thị lần nhận webhook gần nhất nếu có.
5. Khi App chưa xuất bản, kiểm tra bằng tài khoản có vai trò **Admin/Developer/Tester của chính Meta App**; tài khoản Tester cần chấp nhận lời mời trước. Quyền quản trị Fanpage không thay cho vai trò trong App. Để thử: Meta App → **Role in the application / App roles → Role / Roles** → thêm tài khoản thử, chấp nhận lời mời rồi dùng tài khoản đó chủ động nhắn Fanpage.
6. Để phục vụ khách thông thường, hoàn tất Publish/Live, App Review/Advanced Access cho các quyền Messenger và Business Verification nếu Meta yêu cầu. Không có bản sửa website nào thay thế được phê duyệt của Meta.

Triển khai đồng thời `autoReplyFacebook` có chặn `historical/meta_history` trước khi mở chức năng nhập lịch sử; triển khai webhook và các hàm gửi cùng phiên bản để tránh lặp tin echo. Không tạo tin thử trực tiếp trong Firestore.


## Messenger cập nhật tức thời và gửi trực tiếp

### Tin nhắn và giao diện

- Khi Meta gửi webhook, Firestore cập nhật danh sách hội thoại và nội dung đang xem mà không cần tải lại trang. Tin gửi trên website hiển thị ngay trạng thái đang gửi, sau đó đã gửi hoặc lỗi. Không hiển thị “đã đọc/đã nhận” khi chưa có bằng chứng từ Meta.
- Bấm **Gửi** hoặc Enter để gửi trực tiếp tin đang soạn; trả lời từ gợi ý AI cũng gửi trực tiếp khi bấm **Gửi trả lời**. Không còn hộp xác nhận riêng cho một tin. Gửi hàng loạt và thay đổi cấu hình bot vẫn giữ bước xác nhận hiện có.
- Khi có tin đến, giữ nguyên bản nháp, hội thoại đang chọn và vị trí đọc; tải tin cũ hơn giữ vị trí theo nội dung. Không tự gửi lại tin khi lỗi mạng; bản nháp được giữ để kiểm tra trước khi thử lại.
- Tên và ảnh khách được lấy qua Messenger User Profile API bằng Page Token trên máy chủ, lưu đệm 24 giờ khi có ảnh; hồ sơ thiếu ảnh hoặc lỗi được thử lại sau 5 phút, lỗi quyền sau 15 phút. Nếu Meta không cấp quyền trả ảnh hoặc ảnh hết hạn, dùng chữ viết tắt. Không gắn token vào URL ảnh phía trình duyệt.

### Tự bổ sung tin bị bỏ lỡ

Hộp thư đang mở và tab đang hiển thị tự kiểm tra hội thoại gần đây, tối đa một lượt mỗi 5 giây, luân phiên giữa các Trang thuộc tài khoản. Máy chủ giới hạn tự đồng bộ một lượt mỗi 5 giây cho mỗi Trang kể cả khi mở nhiều tab; khi lỗi sẽ giãn thử lại tối đa 40 giây. Mỗi lượt giữ giới hạn 5 hội thoại × 25 tin; lịch sử xa hơn vẫn tải theo yêu cầu. Khi chuyển mục khác hoặc ẩn tab, không chạy lượt kiểm tra mới. Webhook tiếp tục nhận tin khi không mở website.

Tin lấy qua cơ chế bổ sung vẫn là lịch sử: không tự kích hoạt bot hoặc đặt lại cửa sổ 24 giờ. Để AI tự trả lời mọi tin mới, cần webhook hoạt động và bật AI/kịch bản trong cấu hình Trang. Không tự bật bot cho tất cả Fanpage.

Những cải tiến này không thay thế quyền `pages_messaging`, App Review/Advanced Access và Publish/Live của Meta đối với khách thông thường.


## Đồng bộ nhanh và ảnh Messenger

- Webhook + Firestore listener hiển thị tin ngay sau khi máy chủ nhận sự kiện. Không thể đảm bảo độ trễ bằng 0 từ phía Meta; cần xác nhận POST webhook hợp lệ và quyền App đối với khách thật.
- Kiểm tra bổ sung mỗi 5 giây, luân phiên Fanpage khi tab hộp thư đang hiển thị; máy chủ cũng giới hạn theo Trang. Lượt đồng bộ bỏ qua việc tải lại nội dung hội thoại có `updated_time` không đổi. Đây là dự phòng cho webhook, không phải cam kết nhận mọi hội thoại trong 5 giây.
- Nút **Đính kèm ảnh** cho phép chọn một JPG/PNG/WebP, tối đa 20 MB; trình duyệt tối ưu JPEG cạnh dài tối đa 2.200 px, tối đa 4 MB để gửi. Có ảnh xem trước và nút bỏ ảnh. Ảnh và nội dung chữ là hai tin Messenger riêng; chỉ gửi chữ sau khi Meta xác nhận ảnh. Khi lỗi giữ ảnh và chữ để kiểm tra trước khi thử lại.
- `sendMessengerImage` bắt buộc chủ sở hữu Trang, đăng nhập đã duyệt, cửa sổ 24 giờ, chưa STOP và chống trùng request ID. Máy chủ kiểm tra định dạng byte/giới hạn, gửi multipart trực tiếp đến Meta; không công khai ảnh trong Storage. Chỉ ảnh xem trước nhỏ được lưu cùng tin trong Firestore theo quyền hội thoại; ảnh đầy đủ ở Meta.
- Tin nhận có ảnh hiển thị thumbnail trong bong bóng chat và mở ảnh đầy đủ qua URL Meta khi có. URL có thể hết hạn theo Meta; ảnh gửi có thumbnail dự phòng. Lỗi mạng không kích hoạt gửi lại tự động.


## Gộp nhiều Fanpage và làm mới ảnh đại diện

Mở **Hộp thư → Gộp Fanpage** dưới ô tìm kiếm. Tick nhiều Trang để xem chung, dùng **Chọn tất cả** để gồm cả Trang kết nối sau này hoặc **Bỏ chọn** để không hiển thị Trang nào. Lựa chọn được lưu riêng theo tài khoản FBTQ trong trình duyệt. Tìm kiếm, bộ lọc và thứ tự hội thoại áp dụng trên nhóm Trang đã chọn; nút Xóa lọc đặt lại cả nhóm Trang về tất cả. Đồng bộ bổ sung chỉ chạy cho các Trang đã chọn; webhook vẫn nhận tin của các Trang đang kết nối.

Đây là gộp cách hiển thị hộp thư: mỗi hội thoại vẫn giữ Page ID và PSID gốc, tin trả lời được gửi từ đúng Trang. Không hợp nhất Fanpage trên Facebook, không gộp hai khách có tên giống nhau, không thay đổi quyền quản lý Trang.

Nút **Cập nhật ảnh đại diện** trong bảng Gộp Fanpage làm mới tối đa 10 hồ sơ trong nhóm đã chọn, ưu tiên hồ sơ chưa có ảnh. `refreshMessengerProfiles` kiểm tra đăng nhập/chủ sở hữu và từng hội thoại; giới hạn một lượt thử mỗi 60 giây cho mỗi hồ sơ, có khóa chống yêu cầu đồng thời. Không trả Page Token ra trình duyệt.

Hệ thống thử lấy riêng `profile_pic` nếu yêu cầu hồ sơ đầy đủ không trả ảnh. Thành công lưu cache 24 giờ; lỗi quyền lưu 15 phút, thiếu ảnh/lỗi tạm thời lưu 5 phút thay vì bỏ qua 24 giờ. Ảnh hết hạn khi hiển thị sẽ kích hoạt yêu cầu làm mới có giới hạn. Kết quả hiển thị số hồ sơ có ảnh, hồ sơ Meta giới hạn hoặc chưa trả ảnh; không khẳng định ảnh được lấy thành công nếu Meta từ chối quyền. Không dùng ID hoặc URL suy đoán để lấy ảnh ngoài phạm vi API cho phép.
