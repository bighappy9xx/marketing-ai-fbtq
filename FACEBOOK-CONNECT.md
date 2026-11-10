# Kết nối Facebook — dành cho hệ thống FBTQ hiện tại

## Dùng hằng ngày
Chatbot → + Fanpage → Đăng nhập Facebook & chọn Fanpage → cấp quyền → chọn Trang → Phê Duyệt kết nối. Không nhập token thủ công. Sau đó vào AI & Kịch bản → chọn Trang → chọn chế độ → nhập thông tin tư vấn → phê duyệt lưu. Trang mới luôn tắt tự động cho đến khi bạn duyệt cấu hình.

## Quản trị cấu hình một lần
Firebase project đọc từ firebase-config.js: mediafbtq-6e1bb.
Repository: https://github.com/bighappy9xx/marketing-ai-fbtq . Nếu xuất bản bằng GitHub Pages mặc định của repository này, website dự kiến là https://bighappy9xx.github.io/marketing-ai-fbtq/ . Nếu đang dùng tên miền khác, thay URL trong toàn bộ các bước dưới đây bằng tên miền thật.

1. Mở https://developers.facebook.com/apps/ , tạo hoặc chọn App có khả năng Messenger cho Fanpage và Facebook Login. Tên màn hình có thể khác tuỳ App/use case. Khai báo chính sách riêng tư, xoá dữ liệu và email liên hệ. Lấy App ID từ App settings → Basic. App Secret chỉ lưu máy chủ, không gửi qua chat và không đưa lên GitHub.
2. Với URL GitHub Pages dự kiến trên, khai báo App Domains: bighappy9xx.github.io ; Site URL: https://bighappy9xx.github.io/marketing-ai-fbtq/ ; Valid OAuth Redirect URIs: https://bighappy9xx.github.io/marketing-ai-fbtq/index.html . Đường dẫn redirect phải trùng chính xác với META_REDIRECT_URI. Đây là callback kết nối Fanpage, không phải callback đăng nhập Firebase.
3. Cài Node.js 22 và Firebase CLI, mở PowerShell ở thư mục dự án:

```powershell
npm install -g firebase-tools
firebase login
npm --prefix functions install
```

Trong Firebase Console, bảo đảm project có billing phù hợp để triển khai Cloud Functions và API ngoài. Tạo functions/.env.mediafbtq-6e1bb từ mẫu env.example, không ghi secret vào file:

```dotenv
META_GRAPH_VERSION=v26.0
META_APP_ID=THAY_BANG_APP_ID_THAT
META_REDIRECT_URI=https://bighappy9xx.github.io/marketing-ai-fbtq/index.html
META_WEBHOOK_URL=https://us-central1-mediafbtq-6e1bb.cloudfunctions.net/metaWebhook
```

Chọn Graph version thực tế App hỗ trợ, sửa META_GRAPH_VERSION nếu khác. URL webhook trên tương ứng region us-central1 mặc định của mã; sau deploy đối chiếu Function URL trong Firebase Console.

4. Tạo ba secrets, lệnh sẽ hỏi giá trị để bạn nhập trong terminal:

```powershell
firebase functions:secrets:set META_APP_SECRET --project mediafbtq-6e1bb
firebase functions:secrets:set META_VERIFY_TOKEN --project mediafbtq-6e1bb
firebase functions:secrets:set META_TOKEN_ENCRYPTION_KEY --project mediafbtq-6e1bb
```

META_APP_SECRET: lấy từ đúng Meta App. META_VERIFY_TOKEN: tự đặt chuỗi ngẫu nhiên bí mật, dùng lại y hệt ở Meta Webhooks. META_TOKEN_ENCRYPTION_KEY: chuỗi ngẫu nhiên mạnh, khuyến nghị 32 byte dạng hex (64 ký tự); giữ nguyên sau khi đã kết nối Trang. Có thể tạo trên máy bằng Node crypto.randomBytes(32).toString('hex'). Không chia sẻ ba giá trị này.

5. Triển khai phần kết nối, inbox và gửi tin thủ công:

```powershell
firebase deploy --project mediafbtq-6e1bb --only functions:getChatbotSetup,functions:beginFacebookLogin,functions:finishFacebookLogin,functions:addFacebookPages,functions:getPageChatbot,functions:savePageChatbot,functions:listMyPages,functions:sendChatbotMessage,functions:setChatbotHandoff,functions:previewChatbotBroadcast,functions:sendChatbotBroadcast,functions:metaWebhook,firestore:rules,firestore:indexes
```

Cập nhật mã website theo quy trình xuất bản GitHub Pages hiện có. Không dùng firebase deploy hosting nếu website của bạn vẫn phục vụ qua GitHub Pages. Bản cập nhật giao diện phải đi cùng cloud-load.js và các module hiện có để không mất phần tải user.

6. Sau khi metaWebhook triển khai thành công, trong Meta App mở Messenger API Settings/Webhooks. Chọn đối tượng Page nếu được hỏi. Nhập Callback URL bằng URL function thực tế, Verify Token bằng META_VERIFY_TOKEN đã đặt. Bấm Verify & Save. Đăng ký messages và messaging_postbacks. Bản mã hiện tại xử lý tin nhắn đến dạng message; chưa biến nội dung postback thành câu hỏi AI.
7. Kiểm tra các quyền mà luồng đăng nhập hiện tại yêu cầu: pages_show_list, pages_messaging, pages_manage_metadata, pages_read_engagement. Tài khoản đăng nhập cần quyền nhắn tin/quản lý phù hợp trên Trang. Thử trước với tài khoản/tài sản có vai trò hợp lệ trong App. Để phục vụ khách thật ngoài nhóm thử nghiệm, hoàn tất App Review, mức truy cập quyền, xác minh doanh nghiệp nếu Meta yêu cầu và trạng thái phát hành phù hợp. Không thể bỏ bước Meta yêu cầu bằng cách sửa website.
8. Trên website, đăng nhập tài khoản FBTQ muốn sở hữu kết nối → Chatbot → + Fanpage → Đăng nhập Facebook → cấp quyền → chọn Trang → Phê Duyệt. Máy chủ lấy Page Token, mã hoá và tự đăng ký ứng dụng vào Trang. Không cần dán token.
9. Gửi một tin từ tài khoản thử nghiệm hợp lệ đến Fanpage. Tin xuất hiện trên web là phần nhận webhook/realtime đã hoạt động. Gửi trả lời từ web để kiểm tra chiều ngược lại.

## Bật AI hoặc kịch bản
Kết nối Facebook không tự cung cấp mô hình AI. Phần tự động cần function autoReplyFacebook chạy trên máy chủ. Backend hiện ràng buộc cả hai secrets Gemini/OpenAI cho function này; cần cấu hình cả hai trước khi triển khai nó:

```powershell
firebase functions:secrets:set GEMINI_API_KEY --project mediafbtq-6e1bb
firebase functions:secrets:set OPENAI_API_KEY --project mediafbtq-6e1bb
firebase deploy --project mediafbtq-6e1bb --only functions:autoReplyFacebook
```

Trên web: AI & Kịch bản → chọn Fanpage → chế độ Kịch bản, AI, hoặc Kết hợp → nhập thông tin và từ khoá → Lưu & Phê Duyệt. Gửi tin mới từ tài khoản thử nghiệm để kiểm tra. Mô hình phải tồn tại và API key có quyền/quota phù hợp. Trợ lý FBTQ nội bộ dùng endpoints askAssistant riêng như hướng dẫn CHATBOT-SETUP.md.

## Khi không kết nối được
- Nút đăng nhập bị khoá: kiểm tra getChatbotSetup đã deploy, META_APP_ID và META_REDIRECT_URI đã điền, deploy lại sau khi sửa env.
- Redirect URI mismatch / URL blocked: URI của Meta và functions env phải giống tuyệt đối, gồm HTTPS và /marketing-ai-fbtq/index.html.
- Không có Trang để chọn: kiểm tra quyền nhắn tin trên Fanpage, đúng tài khoản Facebook, quyền đã cấp và vai trò thử nghiệm của App.
- Không xác minh được webhook: deploy metaWebhook trước, đối chiếu URL thật và Verify Token, kiểm tra logs/quyền truy cập HTTP.
- Đã kết nối nhưng không có tin: kiểm tra subscribed Apps của Trang, trường messages, quyền App và dùng người gửi thử nghiệm hợp lệ.
- Nhận được tin nhưng bot im: Trang mới mặc định tắt; kiểm tra chế độ đã duyệt, autoReplyFacebook đã deploy, khoá AI và logs. Khách STOP/huỷ đăng ký hoặc hội thoại đã chuyển nhân viên cũng sẽ dừng bot.
- Gửi tin lỗi cửa sổ: bắt đầu bằng một tin đến mới từ khách. Luồng tin thông thường trong bản hiện tại giới hạn 24 giờ kể từ tin đến, không gửi tự do tới mọi người.

Chưa triển khai hay xác minh kết nối Facebook thật trong phiên làm việc này. App ID thực tế và tên miền đang dùng cần được đối chiếu trước khi điền cấu hình. Không cần gửi App Secret, Page Token hay API key để nhận hướng dẫn.
