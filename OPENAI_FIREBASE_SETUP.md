# Cài OpenAI API cho FBTQ trên Firebase Blaze

Cấu hình ngày 17/11/2026 cho project `mediafbtq-6e1bb`. Trình duyệt gọi Firebase callable Functions bằng phiên đăng nhập Firebase. Functions gọi OpenAI; API key nằm trong Google Secret Manager. Không cần Worker hoặc nhập URL backend riêng nữa.

## Cài tự động trên Mac — chỉ nhập key

Mở file **Cai-dat-OpenAI.command** trong thư mục dự án bằng Terminal. Hoặc chạy:

```bash
cd /Users/amsbetrd/Documents/GitHub/marketing-ai-fbtq
node scripts/setup-openai.cjs
```

Trình cài đặt kiểm tra mã nguồn, cài thư viện, kiểm tra đăng nhập Google, rồi hỏi API key ở lời nhắc **ẩn ký tự**. Dán key mới và Enter. Nó thử một phản hồi OpenAI tối đa 64 token, lưu key vào đúng secret `OPENAI_API_KEY`, triển khai 9 hàm và cập nhật Firebase Hosting. Key không được đưa vào tên secret, đối số câu lệnh hoặc file tạm. Bước lưu secret tắt file debug của CLI để tránh ghi payload secret vào nhật ký ở phiên bản CLI cũ.

Nếu cần đăng nhập Google hoặc Firebase hỏi cấu hình dịch vụ/giữ ảnh build, hoàn tất lời nhắc trong Terminal. Chỉ sử dụng key mới nếu key trước đã xuất hiện trong ảnh hoặc cuộc trò chuyện. Ctrl+C ở phần nhập key sẽ huỷ cài đặt. Khi thất bại, trình cài đặt dừng, không tự gửi lặp yêu cầu OpenAI; có thể mở lại sau khi sửa lỗi.

Khi báo **ĐÃ TRIỂN KHAI**, mở `https://mediafbtq-6e1bb.web.app`, đăng nhập rồi vào **Cài đặt → Mô hình AI → Kiểm tra OpenAI** để thử luồng Firebase thật. Cài đặt thành công chưa chứng minh mọi endpoint Images/Audio đã được cấp quyền. Website đang dùng GitHub Pages vẫn phải cập nhật mã lên Pages; Firebase Hosting không tự sửa Pages. Các bước thủ công và giải thích chi tiết ở dưới.

## 1. Mô hình và chi phí

Đây là cấu hình tiết kiệm ban đầu, cần thử với nội dung thực tế để đánh giá chất lượng. Không có mô hình luôn tốt nhất hoặc dùng ít token nhất cho mọi yêu cầu.

| Chức năng | Mô hình mặc định | Cách tiết kiệm / giới hạn |
| --- | --- | --- |
| Studio nội dung | `gpt-6-luna` | Không suy luận; tối đa 900 token đầu ra, 1.500 khi chọn Chi tiết; 40 lượt/ngày/người |
| Trợ lý FBTQ | `gpt-6-luna` | Không suy luận; chỉ 4 lượt lịch sử gần nhất, tối đa 1.000 token đầu ra; 80 lượt/ngày/người |
| Gợi ý trả lời hộp thư | `gpt-6-luna` | Tối đa 300 token đầu ra, không suy luận; 100 lượt/ngày/người; vẫn xác nhận trước khi gửi |
| Từ cấm & chính tả | `gpt-6-luna` | Suy luận thấp, JSON theo schema, tối đa 5.000 token bao gồm suy luận; cache cùng bài và chính sách trong 10 phút; 120 lượt/ngày/người |
| AI biên tập bài viết | `gpt-6-luna` | Qua `reviewContentAI` với action improve; không suy luận, tối đa 6.000 token đầu ra; 20 lượt/ngày/người, cache 10 phút. Có xem trước, Hoàn tất chỉnh sửa và Hoàn tác |
| Tìm khoảnh khắc video | `gpt-6-luna` + Whisper | Chia phần tối đa 3 phút, 8 ảnh mẫu nhỏ/phần + lời thoại. Tối đa 6.000 token đầu ra/phần bao gồm suy luận thấp; 40 phần/ngày/người |
| Lời thoại / mốc cắt video | `whisper-1` | Gửi âm thanh mono 16 kHz của đoạn, tối đa 3 phút/lượt, 40 lượt/ngày/người |
| Tạo ảnh Studio | `gpt-image-2.6-flare` | 1 ảnh/lượt, quality low, complexity low, tối đa 8 ảnh/ngày/người |
| Kiểm tra kết nối | `gpt-6-luna` | Một yêu cầu nhỏ, tối đa 64 token đầu ra; 20 lần/ngày/quản lý |
| Giọng đọc AI | Gemini TTS hiện có | Giữ giọng đọc và cấu hình Firebase AI Logic hiện tại; không dùng API key OpenAI |

Hạn mức là theo tài khoản, theo loại tác vụ, không phải trần tiền chung của toàn công ty. Các phần video chồng lấn để tránh bỏ lỡ hook ở ranh giới, nên phút âm thanh xử lý có thể nhiều hơn độ dài file. Video OpenAI dùng ảnh mẫu, không xem liên tục mọi khung hình. Nghe/xem lại đề xuất trước khi cắt.

Theo [giá GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), đầu vào văn bản là **0,10 USD/1 triệu token**, đầu ra **0,50 USD/1 triệu token**. Ví dụ 2.000 token vào + 900 token ra khoảng **0,00065 USD/lượt**, 1.000 lượt tương tự khoảng **0,65 USD**, chưa gồm Firebase, ảnh, âm thanh hoặc suy luận phát sinh. Đây là ví dụ tính toán, không phải báo giá cố định. Token là đơn vị xử lý, không tương đương số từ tiếng Việt.

Whisper được giữ vì chức năng cắt cần mốc từng từ/đoạn mà tích hợp hiện tại dùng. OpenAI đã thông báo `whisper-1` ngừng ngày **26/02/2027**; cần chuyển quy trình timestamp trước mốc đó. `gpt-transcribe` hiện rẻ hơn (0,0045 USD/phút so với Whisper 0,006 USD/phút) nhưng không thể thay tên model trong luồng Whisper verbose timestamps rồi coi mốc cắt vẫn tương đương. Xem [hướng dẫn timestamps](https://developers.openai.com/api/docs/guides/speech-to-text#timestamps) và [deprecations](https://developers.openai.com/api/docs/deprecations).

## 2. Tạo API key OpenAI

1. Mở [OpenAI API Platform](https://platform.openai.com/), chọn đúng organization và project. Có thể tạo project riêng cho website FBTQ để theo dõi mức dùng.
2. Mở [API billing](https://platform.openai.com/settings/organization/billing/overview), kiểm tra số dư và phương thức thanh toán. Blaze chỉ thanh toán Firebase; ChatGPT Plus và API billing là các hệ thống riêng. Nếu tài khoản có API credits khuyến mại, kiểm tra điều kiện và số dư thực tế trong API Platform.
3. Mở [API keys](https://platform.openai.com/api-keys), bấm tạo secret key. Đặt tên dễ nhận diện, ví dụ `FBTQ Firebase`.
4. Nếu giới hạn quyền key, cấp quyền gọi Responses, Audio Transcriptions và Images Generations cho chức năng sử dụng. Kiểm tra project được phép truy cập các model. Chức năng ảnh có thể cần xác minh organization.
5. Giữ key để nhập vào lời nhắc kín ở bước 4. Không gửi key vào chat, không dán vào website, `firebase-config.js`, Git hoặc file `.env` công khai.

## 3. Chuẩn bị Terminal trên Mac

Mở Terminal và chạy từng lệnh:

```bash
cd /Users/amsbetrd/Documents/GitHub/marketing-ai-fbtq
node --version
npm --version
firebase --version
```

Node cần là 22.x. Nếu `firebase` đã hiển thị phiên bản, không cần cài lại. Nếu chưa có Firebase CLI:

```bash
npm config set prefix "$HOME/.local"
npm install -g firebase-tools
```

Nếu Terminal chưa nhận `firebase`, thêm `$HOME/.local/bin` vào PATH bằng cách mở `~/.zshrc`, thêm dòng dưới rồi mở lại Terminal:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Không chạy `firebase init` để tránh ghi đè cấu hình dự án. Đăng nhập đúng tài khoản Google đang có quyền project:

```bash
firebase login
firebase projects:list
npm --prefix functions ci
```

Trong danh sách phải có project `mediafbtq-6e1bb`. Nếu không có, đăng nhập lại đúng tài khoản hoặc cấp quyền project cho tài khoản đó.

## 4. Lưu API key vào Firebase Secret Manager

```bash
firebase functions:secrets:set OPENAI_API_KEY --project mediafbtq-6e1bb
```

Khi Terminal hỏi giá trị secret, dán API key OpenAI và Enter. Lời nhắc nhập secret được ẩn. Không viết API key ngay sau lệnh. Nếu CLI đề nghị bật API cần thiết cho Secret Manager, cho phép với đúng project.

Nếu thay key sau này, chạy lại lệnh này và triển khai lại toàn bộ nhóm Functions OpenAI ở bước 5 để dùng phiên bản secret mới. Xem [hướng dẫn Firebase Secret Manager](https://firebase.google.com/docs/functions/config-env#secret_parameters).

## 5. Triển khai nhóm OpenAI

Chạy từ thư mục gốc dự án:

```bash
node scripts/check-source.cjs
firebase deploy --project mediafbtq-6e1bb --only functions:checkOpenAIConnection,functions:generateContentOpenAI,functions:askAssistantOpenai,functions:reviewContentAI,functions:suggestReplyOpenAI,functions:getStudioAISetup,functions:generateStudioImage,functions:transcribeStudioAudio,functions:analyzeStudioHighlightsOpenAI
```

Lệnh chỉ triển khai nhóm OpenAI, không yêu cầu tạo các secret Gemini/Claude/Meta. Không dùng `firebase deploy --only functions` cho lần cài OpenAI nếu các dịch vụ khác chưa được cấu hình.

Functions chạy Node.js 22 ở `us-central1`, khớp region client hiện có. Chờ CLI báo hoàn tất từng hàm. Nếu CLI hỏi thời gian giữ ảnh build trong Artifact Registry, có thể chọn số ngày ngắn phù hợp để giảm chi phí lưu build. Blaze phải liên kết tài khoản thanh toán đang hoạt động; bật Blaze chưa khắc phục được tài khoản billing bị đình chỉ hoặc thẻ Google bị từ chối.

Các mô hình đã có mặc định trong mã nguồn, không cần tạo `.env`. Nếu muốn đổi model sau khi đã thử chất lượng, thêm những biến KHÔNG CHỨA KEY sau vào `functions/.env.mediafbtq-6e1bb` rồi triển khai lại các hàm liên quan:

```dotenv
OPENAI_MODEL=gpt-6-luna
CONTENT_OPENAI_MODEL=gpt-6-luna
ASSISTANT_OPENAI_MODEL=gpt-6-luna
REPLY_OPENAI_MODEL=gpt-6-luna
CONTENT_REVIEW_OPENAI_MODEL=gpt-6-luna
CONTENT_REWRITE_OPENAI_MODEL=gpt-6-luna
STUDIO_HIGHLIGHTS_OPENAI_MODEL=gpt-6-luna
STUDIO_AI_IMAGE_MODEL=gpt-image-2.6-flare
```

Không đặt `OPENAI_API_KEY` trong `.env`: key phải nằm trong Secret Manager. Kiểm tra file `.env` cũ có model override trước khi triển khai nếu đã cấu hình từ lần trước.

## 6. Cập nhật giao diện và kiểm tra

Nếu dùng Firebase Hosting:

```bash
firebase deploy --only hosting --project mediafbtq-6e1bb
```

Nếu website thực tế đang dùng GitHub Pages, cần cập nhật mã nguồn lên Pages theo quy trình của kho thay vì chỉ triển khai Firebase Hosting. Hai nền tảng hosting không tự đồng bộ nhau.

Sau đó:

1. Mở đúng website, tải lại trang bằng Cmd + Shift + R, đăng nhập tài khoản quản lý/Giám đốc đã duyệt.
2. Vào **Cài đặt → Mô hình AI**. Bấm **Kiểm tra OpenAI**. Chờ thông báo `Đã kết nối OpenAI · gpt-6-luna`.
3. Chọn **OpenAI · GPT-6 Luna tiết kiệm**, nhập phong cách thương hiệu và **Lưu cấu hình**. Trợ lý có lựa chọn nhà cung cấp riêng; chọn OpenAI trong hộp Trợ lý nếu đã từng chọn Gemini riêng trước đó.
4. Studio nội dung: chọn OpenAI và yêu cầu ngắn để thử. Chỉ gửi một lần, đợi phản hồi.
5. Kiểm duyệt: nhập bài thử, đợi AI kiểm tra; thử một từ trong danh sách cấm công ty. Phần đỏ phải chọn được để sửa; lỗi API không được coi là bài đạt.
6. Studio AI video: nhập video thử ngắn 30–60 giây, chọn phân tích. Xem bảng mốc cắt, tiêu đề, hashtag và nghe/xem lại trước khi áp dụng. File dài cần nén từng phần trên máy, không tức thời.
7. Studio ảnh: nhập một prompt ngắn và bấm tạo ảnh. Lần kiểm tra văn bản thành công chưa chứng minh quyền Images/Audio đã được cấp; cần thử riêng các chức năng này.

OpenAI text/kiểm duyệt/Studio không dùng Gemini App Check. Riêng các chức năng Gemini và giọng đọc vẫn cần Firebase AI Logic, Gemini Developer API và App Check như hướng dẫn `GEMINI_SPARK_SETUP.md`.

Hộp thư gợi ý câu trả lời dùng `suggestReplyOpenAI` khi hội thoại chọn OpenAI, hoặc khi chưa có model và mặc định công ty là OpenAI. Ưu tiên model đã lưu trên Fanpage/hội thoại được giữ nguyên. Gửi tin thật và bot tự động còn cần kết nối Meta, webhook và các secret Meta tương ứng; cài API OpenAI không tự kết nối Fanpage. Nhóm triển khai trên không tự bật bot gửi tin.

## 7. Xử lý lỗi thường gặp

| Thông báo | Cách xử lý |
| --- | --- |
| `EACCES /usr/local/lib/node_modules` | Cài CLI vào `$HOME/.local` và thêm PATH như bước 3; không cần sudo |
| Không tìm thấy `checkOpenAIConnection` / CORS / 404 callable | Kiểm tra đã triển khai đúng project, đúng region `us-central1`, frontend dùng đúng Firebase project và phiên bản mã mới |
| Key không hợp lệ / 401 | Lưu lại secret đúng project, triển khai lại các hàm; không chia sẻ key trong ảnh lỗi |
| 403 / model không được phép | Kiểm tra quyền key, quyền model/project và xác minh organization cho ảnh |
| 429 / hết hạn mức | Kiểm tra số dư API và rate limit OpenAI; xem có chạm quota theo ngày của website không. Blaze không nạp tiền vào OpenAI |
| `billing account disabled` / Google billing | Mở Google Cloud Billing, sửa tài khoản thanh toán của project; đây là phí/hạ tầng Firebase, khác OpenAI billing |
| Hết thời gian chờ | Không bấm gửi liên tục. Giảm prompt hoặc chia đoạn video; xem log hàm. Yêu cầu đã gửi có thể đã được tính phí |
| Không có quyền quản lý | Dùng tài khoản quản lý/Giám đốc đã duyệt; không hạ quyền bảo vệ endpoint |
| AI trả JSON/mốc cắt chưa hợp lệ | Chưa áp dụng kết quả; thử nội dung ngắn hơn và kiểm tra log/model. Không bỏ bước kiểm tra dữ liệu |

Xem log một chức năng, ví dụ:

```bash
firebase functions:log --only generateContentOpenAI --project mediafbtq-6e1bb
```

Không công khai log chứa nội dung khách hàng. Theo dõi API usage và Firebase billing sau vài lượt thử để điều chỉnh hạn mức. Hạn mức Firebase/OpenAI trên console có thể là cảnh báo hoặc giới hạn theo từng loại; không mặc định mọi thông báo ngân sách là cơ chế dừng chi tiêu cứng.

Nguồn: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Images Flare](https://developers.openai.com/api/docs/models/gpt-image-2.6-flare), [Whisper timestamps](https://developers.openai.com/api/docs/guides/speech-to-text#timestamps), [Firebase secrets](https://firebase.google.com/docs/functions/config-env), [API billing và ChatGPT](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).
