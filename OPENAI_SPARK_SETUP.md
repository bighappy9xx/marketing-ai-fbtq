# OpenAI API với Firebase Spark

Website dùng Firebase Spark cho tài khoản và Firestore, **Cloudflare Worker** để gọi OpenAI, **D1** để giữ bộ đếm hạn mức và khóa yêu cầu đang chạy. Không triển khai Firebase Cloud Functions và không cần Firebase service account cho đường kết nối này.

Chức năng hỗ trợ: ChatGPT trong Studio nội dung, Trợ lý FBTQ chọn OpenAI, kiểm tra kết nối, nhận dạng lời thoại và tạo ảnh Studio. Phân tích video/kiểm duyệt Gemini tiếp tục dùng Firebase AI Logic. OpenAI API cần số dư/quyền truy cập riêng; không nhập tài khoản hoặc mật khẩu ChatGPT Plus vào website.

## 1. Tạo backend

Cài Node.js 22 trở lên cùng npm, có tài khoản Cloudflare và OpenAI API key. Từ thư mục dự án:

```sh
cd openai-worker
npx wrangler login
npx wrangler d1 create fbtq-openai-usage
```

Sửa `openai-worker/wrangler.jsonc`:

- `database_id`: ID database D1 nhận được từ lệnh vừa chạy.
- `FIREBASE_PROJECT_ID`: `mediafbtq-6e1bb` hoặc đúng Firebase project website đang dùng.
- `FIREBASE_WEB_API_KEY`: Firebase **Web API key công khai** trong `firebase-config.js`, không phải OpenAI key hay service account key.
- `ALLOWED_ORIGINS`: origin HTTPS chính xác của website, ví dụ `https://bighappy9xx.github.io`. Nếu nhiều website, phân cách bằng dấu phẩy. Không thêm đường dẫn `/marketing-ai-fbtq`, dấu `/` cuối origin hoặc wildcard. Không tự cho phép mọi domain.
- `OPENAI_MODEL`: model văn bản mà OpenAI project có quyền truy cập. Mặc định giữ model của hệ thống; sửa nếu project không có quyền. Có thể thêm `ASSISTANT_OPENAI_MODEL` để ghi đè cho Trợ lý và `STUDIO_AI_IMAGE_MODEL` cho ảnh.

Giữ `nodejs_compat` và compatibility date trong mẫu để các module dùng chung với backend Firebase hoạt động. Dùng Wrangler hiện hành hỗ trợ compatibility date này. Chạy:

```sh
npx wrangler d1 migrations apply fbtq-openai-usage --remote
npx wrangler deploy
npx wrangler secret put OPENAI_API_KEY
```

Dán OpenAI API key vào lời nhắc kín của lệnh cuối. Không ghi vào `wrangler.jsonc`, file website, Firestore, localStorage hoặc chat. Khi đổi/thu hồi key, chạy lại lệnh `secret put`. Các file local secret `.dev.vars`/`.env` trong thư mục Worker đã được gitignore.

Không tải riêng `worker.js` lên dashboard như một file đơn: Wrangler cần bundle các module dùng chung trong `functions/` qua đường import tương đối. Không cần cài `firebase-admin` hoặc `firebase-functions` để bundle Worker.

## 2. Kết nối website

1. Đưa các file giao diện mới `app.js`, `index.html`, `styles.css`, `openai-setup-ui.js`, `openai-backend-client.js` lên hosting, cùng các phụ thuộc hiện có.
2. Đăng nhập website bằng tài khoản quản lý → **Cài đặt → Mô hình AI → Thêm OpenAI API**.
3. Dán URL Worker đã triển khai, ví dụ `https://fbtq-openai-api.<tai-khoan>.workers.dev`, không thêm tên chức năng vào cuối URL.
4. Bấm **Lưu URL backend**, sau đó **Kiểm tra kết nối**. URL được lưu tại `workspaces/fbtq/settings/bot.openaiBackendUrl`, chỉ quản lý được sửa theo Firestore Rules hiện có. Các nhân viên tải lại/đăng nhập lại để nhận URL mới. Chỉ dùng URL backend bạn quản lý vì website gửi Firebase ID token tới endpoint này.
5. Khi kiểm tra thành công, chọn **ChatGPT** trong Studio nội dung hoặc **OpenAI** trong Trợ lý. Các công cụ phiên âm/tạo ảnh Studio cũng dùng Worker khi URL đã được cấu hình.

Có thể cấu hình URL công khai dùng chung bằng `window.FBTQ_OPENAI_BACKEND_URL` trong cấu hình hosting thay cho bước lưu Firestore; không đưa API key vào cấu hình đó. Nếu không có URL backend, đường Firebase Functions cũ vẫn được giữ để tương thích, nhưng cần Blaze để triển khai các hàm đó. Không tự chuyển backend khi một yêu cầu bị lỗi.

## Hạn mức và xác thực

- Backend xác minh ID token với Google, kiểm tra đúng Firebase project/thời hạn/phiên bị thu hồi, sau đó đọc hồ sơ Firestore bằng token của chính người dùng. User bị khóa/chưa được cấp quyền bị từ chối. Không tin vai trò do trình duyệt gửi lên.
- Chỉ quản lý được kiểm tra kết nối. Các tài khoản đã được cấp quyền có thể gọi công cụ nội dung/Studio. Danh sách chức năng cố định, không có proxy URL hoặc model tùy ý do client điều khiển.
- D1 dùng compare-and-swap để khóa một yêu cầu có tính phí đang chạy cho mỗi user. Tối đa 120 yêu cầu/user/ngày UTC, tính cả lượt kiểm tra và lượt đã bắt đầu nhưng lỗi. Studio giới hạn thêm 8 ảnh và 40 lần phiên âm/user/ngày UTC. Nếu D1 chưa cấu hình hoặc lỗi, yêu cầu có tính phí bị chặn.
- Không ghi log ID token, API key hoặc nội dung phản hồi lỗi gốc của OpenAI. Responses đặt `store:false`. Không tự gửi lại yêu cầu có tính phí sau lỗi.
- Workers Free và D1 có hạn mức riêng. Đặc biệt tác vụ ảnh hoặc WAV lớn có thể chạm giới hạn CPU của Workers Free. Quota ứng dụng không bảo đảm tổng chi phí hoặc đảm bảo chạy trong hạn mức miễn phí của Cloudflare. Phí OpenAI tính riêng theo mức dùng.

Nếu lỗi xác minh Firebase: kiểm tra `FIREBASE_PROJECT_ID`, Firebase Web API key, project đang đăng nhập, Firestore Rules và Firebase API restrictions. Key chỉ cho HTTP referrer trình duyệt có thể không gọi được từ Worker; dùng Firebase Web API key phù hợp phía server, giới hạn đúng Identity Toolkit API. Không tháo giới hạn của OpenAI key để sửa lỗi Firebase.

Nếu OpenAI trả 401/403: kiểm tra secret và quyền model. Lỗi 429: kiểm tra số dư/quota OpenAI hoặc hạn mức D1. `configured:true` của Studio chỉ báo secret đã có; dùng **Kiểm tra kết nối** để xác nhận một yêu cầu thực sự thành công.

Đã kiểm thử logic với Google/OpenAI giả lập và D1 qua SQLite thật. Chưa triển khai lên Cloudflare hoặc gọi OpenAI thật nếu chưa cung cấp secret và tài khoản triển khai.

Tài liệu: [OpenAI API authentication](https://developers.openai.com/api/reference/overview), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Firebase Auth REST](https://docs.cloud.google.com/identity-platform/docs/use-rest-api).
