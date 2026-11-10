# Cài đặt Chatbot Facebook FBTQ

Website đã có phần Hộp thư, kết nối Fanpage, bật/tắt Gemini tự trả lời, lọc từ khoá cấm, quản lý kịch bản và gửi tin theo lô. Meta App, Page token, Gemini key và webhook chỉ hoạt động sau khi cài Functions bên dưới.

## 1. Chuẩn bị Firebase Functions

Cloud Functions cần dự án Firebase dùng gói Blaze. Nếu dự án đang ở Spark, Meta không thể gọi webhook trên website tĩnh; phải bật Blaze hoặc chuyển webhook sang một máy chủ HTTPS khác.

Mở Terminal trong thư mục dự án rồi đăng nhập và chọn đúng Firebase project:

```bash
firebase login
firebase use mediafbtq-6e1bb
```

Tạo một khoá mã hoá 32 byte trên máy Mac:

```bash
openssl rand -hex 32
```

Lưu kết quả ở nơi riêng tư. Đặt các secret sau; Firebase CLI sẽ hỏi giá trị từng secret. Không đặt giá trị secret trong `app.js`, `firebase-config.js`, GitHub hay tin nhắn công khai.

```bash
firebase functions:secrets:set META_TOKEN_ENCRYPTION_KEY
firebase functions:secrets:set META_VERIFY_TOKEN
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set GEMINI_API_KEY
```

- `META_TOKEN_ENCRYPTION_KEY`: chuỗi hex 64 ký tự vừa tạo.
- `META_VERIFY_TOKEN`: chuỗi tự chọn đủ khó đoán; nhập lại chính xác chuỗi này trong phần Webhooks của Meta.
- `META_APP_SECRET`: App Secret trong Meta for Developers.
- `GEMINI_API_KEY`: API key dùng bởi Cloud Function để tự trả lời. Key này nằm ở Secret Manager, không phải key đặt trong giao diện website.

Triển khai các hàm cần cho chatbot:

```bash
firebase deploy --project mediafbtq-6e1bb --only functions:listMyPages,functions:connectFacebookPage,functions:setFacebookPageActive,functions:sendPageReply,functions:sendPageBroadcast,functions:replyToMessengerMessage,functions:metaWebhook
```

Lệnh này chỉ triển khai các hàm chatbot. Nếu bạn triển khai toàn bộ `functions` thay vì nhóm trên, các chức năng OpenAI/Claude hiện có trong dự án cũng sẽ yêu cầu secrets `OPENAI_API_KEY` và `ANTHROPIC_API_KEY`.

Webhook URL mặc định:

```text
https://us-central1-mediafbtq-6e1bb.cloudfunctions.net/metaWebhook
```

## 2. Cấu hình Meta App

1. Trong Meta for Developers, tạo ứng dụng Business và thêm sản phẩm Messenger.
2. Cấu hình Webhooks cho đối tượng **Page**, callback URL ở trên và Verify Token đã lưu thành `META_VERIFY_TOKEN`.
3. Đăng ký trường `messages` (và `messaging_postbacks` nếu dùng nút tương tác).
4. Cấp các quyền cần thiết, tối thiểu `pages_messaging` và `pages_manage_metadata` cho thao tác nhận tin/đăng ký webhook. Xét duyệt ứng dụng và quyền theo quy trình Meta trước khi dùng với khách hàng ngoài vai trò thử nghiệm.
5. Tạo Page Access Token cho Fanpage với các quyền đã cấp. Trong website, mở **Chatbot AI → Kết nối Fanpage** và nhập tên trang, Page ID, Page Access Token. Server kiểm tra token, mã hoá trước khi lưu và thử tự đăng ký Fanpage vào webhook.

Nếu giao diện báo token đã lưu nhưng webhook chưa sẵn sàng, kiểm tra `pages_manage_metadata`, trạng thái xét duyệt quyền và phần Webhooks trong Meta. Sau khi đổi quyền/token, kết nối lại Fanpage.

## 3. Bật AI và bộ lọc

1. Đăng nhập tài khoản Quản lý, Trưởng phòng hoặc Giám đốc.
2. Mở **Cài đặt hệ thống → Chatbot & Fanpage**.
3. Thêm các từ hoặc cụm từ cấm và lưu. Máy chủ kiểm tra cả tin AI, trả lời thủ công và tin gửi theo lô trước khi gọi Meta.
4. Thêm kịch bản trả lời đã duyệt.
5. Kết nối Fanpage, gửi thử một tin nhắn từ tài khoản thử nghiệm, sau đó bật **Trả lời tự động bằng Gemini**.
6. Kiểm tra Hộp thư: trạng thái hội thoại ghi rõ AI đã trả lời, bị chặn bởi từ cấm, hoặc gặp lỗi cấu hình.

Khi AI không tạo được câu trả lời, hệ thống không gửi nội dung dự phòng bừa; trạng thái lỗi xuất hiện trong hội thoại để nhân viên trả lời thủ công.

## 4. Gửi tin hàng loạt

Chỉ quản lý, Trưởng phòng và Giám đốc mới thấy nút **Gửi tin hàng loạt**. Danh sách lấy từ hội thoại của Fanpage; máy chủ kiểm tra từng người nhận, từ cấm và khung 24 giờ, tối đa 50 người mỗi lượt. Người nhận không hoạt động trong khung này sẽ bị từ chối gửi. Hãy chỉ gửi nội dung phù hợp với sự đồng ý và chính sách Meta.

## 5. Đẩy website lên GitHub

Commit các tệp website đã sửa (`app.js`, `index.html`, `styles.css`, `functions/index.js`, `CHATBOT_SETUP.md`) rồi đẩy lên nhánh GitHub Pages. Functions được triển khai riêng bằng lệnh Firebase ở bước 1; chỉ tải website lên GitHub thì webhook và trả lời tự động chưa chạy.

