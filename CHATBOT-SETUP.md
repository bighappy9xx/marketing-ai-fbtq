# Chatbot Facebook — cài đặt và đưa vào sử dụng

## Đã bổ sung
- Luồng Facebook Login qua OAuth, kiểm tra state, tài khoản, thời hạn và chống dùng lại mã; lấy danh sách Trang ở máy chủ, chỉ chuyển tên/ID Trang về trình duyệt. Token Trang mã hoá AES-GCM ở máy chủ.
- Chọn tối đa 10 Fanpage mỗi lượt, đăng ký webhook. Trang mới mặc định tắt tự động.
- Cấu hình riêng từng Trang: tắt, kịch bản theo từ khoá, AI, hoặc kịch bản trước/AI khi không khớp. Hướng dẫn tư vấn riêng theo Trang. Lưu cấu hình phải phê duyệt; đây là việc cho phép bot tự trả lời các tin mới về sau.
- Realtime dùng Firestore listener hiện có; giữ hội thoại đang chọn khi có tin mới, thêm tìm kiếm.
- Chuyển hội thoại cho nhân viên để dừng bot. Nhân viên vẫn có thể trả lời trong cửa sổ hợp lệ.
- Gửi hàng loạt tối đa 20 người/lượt: xem trước, chọn người nhận, phê duyệt, kiểm tra lại từng hội thoại trước khi gửi. Dừng khi lỗi, kết quả theo người nhận, mã yêu cầu chống bấm gửi lặp.
- Chỉ gửi tin thông thường trong 24 giờ tính từ tin đến. Không coi tin do Trang gửi là mở lại cửa sổ. STOP, HỦY, HỦY ĐĂNG KÝ, DỪNG NHẮN TIN làm dừng nhận tin. Không tích hợp gửi quảng cáo ngoài cửa sổ, Marketing Messages API hoặc vượt giới hạn Meta.
- Webhook xác thực chữ ký; trigger máy chủ trả lời khi có tin đến mới, tránh lặp theo message ID. Khi lỗi gửi có thể không xác định Meta đã nhận hay chưa, không tự gửi lại; kiểm tra Messenger trước khi thử lại.

## 1. Firebase và website
Cần project Firebase có billing phù hợp để chạy Cloud Functions và gọi API ngoài. Website phải có HTTPS. Mã này chưa được triển khai và chưa kết nối Fanpage thật.

Cài Node 22 và Firebase CLI trên máy quản trị, sau đó tại thư mục dự án:

```powershell
firebase login
firebase use YOUR_PROJECT_ID
npm --prefix functions install
```

Tạo functions/.env.YOUR_PROJECT_ID từ functions/env.example:

```dotenv
META_GRAPH_VERSION=v26.0
META_APP_ID=ID_UNG_DUNG_META
META_REDIRECT_URI=https://TEN_MIEN_CUA_BAN/index.html
META_WEBHOOK_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/metaWebhook
```

Redirect URI phải trùng tuyệt đối với website và cấu hình Meta, kể cả đường dẫn, dấu gạch cuối. Với GitHub Pages ở thư mục con, giữ đúng thư mục đó. Dùng phiên bản Graph mà Meta App thực sự hỗ trợ. Không đưa App Secret/API key/Page Token vào tệp public hay Git.

Đặt secrets bằng CLI (nhập giá trị khi được hỏi, không dán vào mã nguồn):

```powershell
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set META_VERIFY_TOKEN
firebase functions:secrets:set META_TOKEN_ENCRYPTION_KEY
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

META_TOKEN_ENCRYPTION_KEY là khoá ngẫu nhiên mạnh; giữ nguyên khi đã mã hoá token, thay khoá phải kết nối lại Trang. META_VERIFY_TOKEN là chuỗi bí mật tự đặt, dùng xác minh webhook. Các function AI hiện ràng buộc cả Gemini và OpenAI secrets nên cần cấu hình chúng trước triển khai các function đó. Các chức năng cũ có secrets khác vẫn cần cấu hình theo README.

Triển khai chatbot, các endpoint nền liên quan và rules/index:

```powershell
firebase deploy --only functions:getChatbotSetup,functions:beginFacebookLogin,functions:finishFacebookLogin,functions:addFacebookPages,functions:getPageChatbot,functions:savePageChatbot,functions:sendChatbotMessage,functions:previewChatbotBroadcast,functions:sendChatbotBroadcast,functions:setChatbotHandoff,functions:autoReplyFacebook,functions:metaWebhook,functions:connectFacebookPage,functions:listMyPages,functions:sendPageReply,firestore:rules,firestore:indexes
```

Chờ index messages (conversationId tăng, createdAt giảm) sẵn sàng. Cập nhật toàn bộ tệp giao diện đi kèm. Nếu dùng Firebase Hosting chạy firebase deploy --only hosting; nếu GitHub Pages, xuất bản mã nguồn qua quy trình repository hiện có.

## 2. Meta App
1. Mở https://developers.facebook.com/apps/ và tạo/chọn ứng dụng phù hợp với Messenger và Facebook Login. Cấu hình website HTTPS, App Domains, email liên hệ, chính sách riêng tư, yêu cầu xoá dữ liệu.
2. Trong Facebook Login, khai báo Valid OAuth Redirect URIs đúng META_REDIRECT_URI. Chỉ quản trị được thay cấu hình App ID/Secret phía máy chủ.
3. Thêm Messenger/Webhooks, đặt Callback URL bằng META_WEBHOOK_URL và Verify Token bằng secret tương ứng. Đăng ký messages, messaging_postbacks. Triển khai metaWebhook trước khi xác minh URL.
4. Cấp quyền pages_show_list, pages_messaging, pages_manage_metadata, pages_read_engagement theo luồng App Review/quyền truy cập Meta yêu cầu. Hoàn tất xác minh doanh nghiệp khi được yêu cầu. Trong Development mode, thử bằng tài khoản có vai trò và tài sản được phép trong App. Chuyển Live và đạt quyền cần thiết trước khi phục vụ khách thật.
5. Mở Chatbot trên website → Kết nối Facebook → đăng nhập → cấp quyền → chọn Trang → Phê Duyệt. Tài khoản Facebook cần có quyền nhắn tin trên Trang. Hệ thống tự đăng ký ứng dụng vào Trang.
6. Chọn AI & Kịch bản, chọn Trang, nhập thông tin sản phẩm/giá/giờ làm việc đã duyệt. Có thể thêm một kịch bản mỗi lần mở cấu hình; lưu rồi mở lại để thêm tiếp. Phê duyệt chế độ trước khi bật tự động.
7. Từ tài khoản thử nghiệm gửi tin đến Fanpage. Kiểm tra hộp thư web, phản hồi kịch bản, AI, chuyển nhân viên, STOP và lượt gửi hàng loạt thử với nhóm nhỏ đủ điều kiện.

## 3. Trạng thái và giới hạn
- Kết nối hoặc webhook lỗi: xem thông báo trong giao diện, kiểm tra function logs trên Firebase và cấu hình App. Kết nối lại khi token hết hiệu lực hoặc quyền bị thu hồi.
- AI chậm phụ thuộc API, mạng và cold start; không cam kết thời gian phản hồi cố định. Realtime là hiển thị tin khi webhook và listener nhận dữ liệu.
- Hội thoại cũ chưa có lastIncomingAtMs phải có tin đến mới qua webhook mới đủ điều kiện gửi; không tự suy đoán cửa sổ từ tin ra.
- Không thể bảo đảm Facebook không hạn chế/khoá tài khoản. Meta quyết định theo quyền, chất lượng và chính sách. Đây không phải cơ chế gửi không giới hạn. Chưa có cơ chế mở lại đăng ký tự động sau STOP; khách cần được xử lý quyền nhận tin theo luồng đồng ý phù hợp trước khi bật lại.
- Phiên OAuth tạm hết hạn sau 10 phút; dữ liệu phiên hết hạn không còn được chấp nhận. Quản trị có thể cấu hình TTL để dọn metaOAuthSessions và chatbotJobs sau thời gian lưu kiểm toán phù hợp (không xoá jobs quá sớm vì chống gửi lặp).

Tài liệu đối chiếu: https://developers.facebook.com/docs/messenger-platform/send-messages/ ; https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/ ; bộ API do Meta phát hành https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api

## Kiểm thử
19 unit tests đạt, gồm kiểm tra cửa sổ gửi, dừng nhận tin, ưu tiên từ khoá, quyền sở hữu, chống gửi lặp, phiên OAuth hết hạn và trigger tự động theo kịch bản. Chrome với mock API đạt: onboarding, chọn Trang, cấu hình, từ chối/phê duyệt, gửi hàng loạt, tìm kiếm, giữ hội thoại và bố cục mobile. Các tests không gọi Meta/AI hay ghi Firebase thật; chưa xác minh OAuth, xét duyệt App và gửi tin production.

## Cập nhật bố cục và Trợ lý AI
Chatbot có thanh chức năng trên, danh sách hội thoại bên trái, khung nhắn ở giữa và thông tin khách bên phải. Màn hình nhỏ thu gọn cột thông tin; điện thoại xếp danh sách và hội thoại theo chiều dọc. Nút trả lời nhanh điền nội dung, không tự gửi.

Trợ lý FBTQ có lựa chọn Gemini / OpenAI / Claude. Câu hỏi tự nhiên được gửi tới mô hình; tối đa 8 lượt gần nhất và ngữ cảnh tổng hợp trong phạm vi tài khoản được dùng để trả lời. Lệnh nghiệp vụ vẫn đi qua luồng xác nhận hiện có. Mô hình chỉ trả lời văn bản, không thực thi thay đổi dữ liệu.

Triển khai riêng endpoint cho mô hình thực tế bạn dùng (mỗi endpoint chỉ ràng buộc secret của chính nó):

```powershell
firebase deploy --only functions:askAssistantGemini
# Hoặc: functions:askAssistantOpenai / functions:askAssistantClaude
```

Đặt GEMINI_API_KEY, OPENAI_API_KEY hoặc ANTHROPIC_API_KEY tương ứng bằng Secret Manager. Có thể chỉ định model ID do nhà cung cấp hỗ trợ trong functions/.env.YOUR_PROJECT_ID bằng ASSISTANT_GEMINI_MODEL, ASSISTANT_OPENAI_MODEL, ASSISTANT_CLAUDE_MODEL. Chọn đúng mô hình đã triển khai trên giao diện. Nếu thiếu endpoint/key, Trợ lý thông báo lỗi, không tạo câu trả lời giả. Chưa có kiểm thử gọi mô hình thật trong môi trường này.
