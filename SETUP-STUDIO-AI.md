# Studio AI — cấu hình và sử dụng

Đã tích hợp sẵn lời thoại tiếng Việt có mốc thời gian, tách câu, cắt khoảng lặng, cảnh báo cụm từ và tạo ảnh bằng prompt. Chưa triển khai Cloud Functions và chưa gọi API thật trong phiên cập nhật này.

## Tìm khoảnh khắc hấp dẫn bằng Gemini

**Studio AI → Tìm khoảnh khắc hấp dẫn** dùng Firebase AI Logic để phân tích video, lập bảng timecode, viết tiêu đề/mô tả/hashtag và gợi ý dựng từng clip. Tính năng này chạy trên Spark với Gemini Developer API và App Check, không cần cấu hình OpenAI bên dưới. Xem [STUDIO-HIGHLIGHTS.md](STUDIO-HIGHLIGHTS.md).

## Cấu hình OpenAI cho phiên âm và tạo ảnh

1. Giải nén ZIP, chép các file vào dự án đang dùng, giữ đúng thư mục `functions`. Các file JavaScript/CSS mới của Studio phải được đưa lên hosting cùng `index.html` và `app.js` mới.
2. Mở Terminal trong thư mục dự án. Dùng tài khoản có quyền triển khai Firebase và dự án có billing hoạt động cho Cloud Functions/Secret Manager. Kiểm tra project trước khi deploy:

```sh
firebase login
firebase use mediafbtq-6e1bb
npm --prefix functions install
```

3. Tích hợp dùng secret `OPENAI_API_KEY` hiện có của hệ thống. Nếu đã cấu hình key OpenAI đang dùng được, không cần đặt lại. Nếu chưa có, chạy và dán key vào lời nhắc kín của CLI:

```sh
firebase functions:secrets:set OPENAI_API_KEY --project mediafbtq-6e1bb
```

Key thuộc dự án OpenAI API có quyền tạo ảnh và phiên âm, với hạn mức/billing API hoạt động. Gói ChatGPT trong trình duyệt không phải cấu hình API của website. Không đặt key trong index.html, firebase-config.js hoặc JavaScript phía trình duyệt; không gửi key vào cuộc trò chuyện.

4. Mặc định tạo ảnh bằng `gpt-image-1.5` (JPEG, chất lượng medium, một ảnh/yêu cầu), nhận dạng tiếng Việt bằng `whisper-1` (mốc từ và câu). Có thể thêm `STUDIO_AI_IMAGE_MODEL=gpt-image-1.5` vào `functions/.env.mediafbtq-6e1bb` nếu muốn cấu hình model tách biệt; đây không phải nơi đặt secret key.
5. Triển khai ba hàm mới và giao diện:

```sh
firebase deploy --only "functions:getStudioAISetup,functions:transcribeStudioAudio,functions:generateStudioImage,hosting" --project mediafbtq-6e1bb
```

Nếu website được đưa lên GitHub Pages, cập nhật các file frontend ở nơi hosting đó và chỉ deploy ba Cloud Functions qua Firebase. Phần Studio AI mới này không thêm quyền đọc Firestore/Storage cho trình duyệt. Hạn mức dùng dịch vụ nằm trong collection máy chủ `studioAIUsage`; không mở quyền ghi collection này cho client.

6. Đăng nhập bằng user đã được phê duyệt, mở Studio → Studio AI → Kiểm tra kết nối AI. Thông báo đã cấu hình key chỉ xác nhận secret được gán vào hàm máy chủ; cần thử phân tích hoặc tạo ảnh để xác nhận quyền model và quota thực tế. Nếu thiếu hàm, key, quyền model hoặc quota, giao diện hiển thị lỗi; không thay bằng kết quả giả.

## Cắt và cảnh báo lời thoại

- Chọn một đoạn video/âm thanh, mở Studio AI và bấm Nhận dạng lời thoại. Chỉ âm thanh trong phần đang chọn được trích thành WAV mono 16 kHz rồi gửi lên OpenAI.
- Giới hạn mỗi lần phân tích: đoạn tối đa 3 phút, file nguồn tối đa 80 MB. Nếu trình duyệt không giải mã được âm thanh MP4/WebM, dùng file âm thanh WAV/MP3 riêng. Đây là phiên âm file, không dùng micro hoặc nghe trực tiếp liên tục.
- Chế độ Tự phân tích khi chọn đoạn mới có thể bật thủ công. Mỗi đoạn nguồn/điểm cắt chỉ tự gửi một lần trong phiên; không tự thử lại liên tục khi lỗi. Việc tự phân tích có dùng hạn mức API.
- Nhập danh sách từ/cụm từ muốn cảnh báo. Danh sách lưu cục bộ theo tài khoản; không có sẵn danh sách được coi là “từ cấm chính thức” của Facebook/TikTok. So khớp theo cả từ, có phân biệt dấu tiếng Việt.
- Các mốc cảnh báo xuất hiện trên thước thời gian; danh sách có nút nhảy tới vị trí. Khi phát qua vị trí có cảnh báo, cạnh đồng hồ hiện cụm từ. Việc kiểm tra lại danh sách và mốc sau khi chỉnh sửa diễn ra từ bản lời thoại đã có, không gọi API theo mỗi khung hình.
- Tách theo câu chỉ chia đoạn đã chọn, giữ thời lượng. Cắt khoảng lặng bỏ những vùng không có lời thoại của đoạn đã phân tích, có chừa đệm hai phía; các lớp đang nằm trong khoảng đó đều được cắt và dồn cùng nhau để giữ đồng bộ. Cần mở khoá các lớp bị ảnh hưởng.
- Luôn xem bản đề xuất, sau đó bấm Xác nhận áp dụng bản cắt. Nếu timeline thay đổi sau lúc đề xuất, hệ thống yêu cầu tạo lại đề xuất. Không tự áp dụng bản cắt cũ. Hoàn tác khôi phục các lớp trước khi cắt; file nguồn vẫn giữ nguyên.
- Chỉ cắt khi bản lời thoại bao phủ đầy đủ phần đang chọn. Lưu dự án để giữ bản lời thoại kèm từng lớp. Phiên âm và mốc có thể sai, đặc biệt với tiếng ồn, nhạc, giọng địa phương; cần nghe lại. Cảnh báo không bảo đảm nội dung được nền tảng phê duyệt.

## Tạo ảnh

Chọn tab Chỉnh sửa hình ảnh → Tạo ảnh AI (hoặc nút Studio AI). Nhập prompt, chọn vuông/ngang/dọc rồi tạo. Ảnh được xem trước trước khi bấm Thêm ảnh vào thiết kế & kho tư liệu. Có thể lưu PNG từ thiết kế và dùng trong video như các ảnh khác. Không tự phát sinh nhiều ảnh hay tự gửi lại API khi lỗi.

Hạn mức bảo vệ sẵn trên máy chủ: 8 ảnh và 40 lần phiên âm cho mỗi tài khoản/ngày UTC; mỗi tài khoản chỉ có một tác vụ Studio AI chạy đồng thời. Yêu cầu đã bắt đầu được tính vào hạn mức kể cả khi API lỗi. Đây là giới hạn số yêu cầu của ứng dụng, không phải giới hạn chi phí toàn dự án; quản trị viên nên đặt ngân sách/hạn mức riêng ở nhà cung cấp. Tạo ảnh và phiên âm qua API có thể phát sinh phí.

## Kiểm thử và phạm vi

Đã kiểm tra logic so khớp tiếng Việt, mốc nguồn sau khi trim, dồn nhiều lớp, tách câu, WAV, quyền người dùng, hạn mức và chặn yêu cầu đồng thời. Kiểm tra trình duyệt dùng âm thanh WAV thật và API mô phỏng để xác minh nhận lời thoại, đánh dấu, xem trước/xác nhận, từ chối bản cắt cũ, hoàn tác, xem ảnh trước khi thêm, lưu ảnh riêng từng user và bỏ kết quả trả về sau khi đổi tài khoản. Chưa kiểm thử kết quả nhận dạng/tạo ảnh bằng API thật, chưa triển khai Firebase.

Tham khảo API chính thức: [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text), [Image generation](https://developers.openai.com/api/docs/guides/image-generation).
