# Trợ lý FBTQ tự thao tác bằng AI

## Hành vi mới
Mặc định câu hỏi tự nhiên trong chat được gửi đến mô hình đã chọn để tạo kế hoạch có cấu trúc. Bộ thực thi có danh sách thao tác cụ thể, tự lấy thông tin tài khoản/dữ liệu đang được phép xem, tự điền đủ biểu mẫu và tự đưa đến bảng xác nhận. Người dùng không phải nhập lại từng trường. Nếu thiếu ngày, buổi, lý do, số tiền, người nhận hoặc bản ghi đích, AI hỏi tiếp trong chat và dùng câu trả lời để hoàn tất.

Ví dụ:
- Xin nghỉ chiều mai vì có việc gia đình.
- Tạo tạm ứng 2 triệu ngày hôm nay cho Facebook Ads để chạy chiến dịch Bonbon.
- Giao cho Lan dựng 5 video, hoàn thành lúc 17 giờ ngày 12/11/2026.
- Sửa chi tiêu báo cáo Bonbon ngày 8/11/2026 thành 50000 đồng vì trước đó nhập nhầm.
- Hoàn thành công việc [tên/mã công việc].
- Trả lời khách trong hội thoại đang chọn: Cảm ơn bạn, bên mình sẽ kiểm tra và phản hồi.

Người dùng kiểm tra thông tin cụ thể trong bảng xác nhận và chọn Phê Duyệt/Từ Chối. Đây là xác thực trước khi ghi, không phải yêu cầu nhập biểu mẫu thủ công. Việc gửi đề nghị nghỉ/tạm ứng không đồng nghĩa đã được trưởng phòng/quản lý/kế toán duyệt; hai quy trình vẫn được giữ riêng.

## Các bộ thực thi đã tích hợp
- Tạo đơn nghỉ, đề xuất và tạm ứng cho chính người đăng nhập.
- Tạo báo cáo ngày từ số liệu được cung cấp; sửa báo cáo do mình tạo, đồng bộ revenueEntries và giữ ID qua report-editor.
- Giao việc (quản lý), đổi trạng thái công việc được phép xử lý và sửa hạn (quản lý).
- Phê duyệt/từ chối đơn từ, tạm ứng đúng bước được cấp quyền; xét duyệt nội dung và hóa đơn theo quyền hiện tại.
- Gửi tin tới đúng hội thoại đang chọn, qua API có kiểm tra cửa sổ và quyền Fanpage.
- Mời thành viên và thay đổi vai trò qua setUserRole, chỉ giám đốc có quyền.
- Kế toán ghi nhận cấp tiền cho hồ sơ đã duyệt khi người dùng xác nhận đã chi/chuyển tiền và cung cấp ngày + mã giao dịch. Không tự chuyển tiền ngân hàng.
- Mở các trang và trả lời câu hỏi thông thường.

Không phải công cụ thực thi mã tuỳ ý hoặc có quyền quản trị mặc định. Các thao tác ngoài danh sách không được tự đổi thành thao tác khác. Kết nối Facebook vẫn cần cấp quyền của Meta; chọn tệp PDF vẫn cần người dùng cung cấp tệp/extension chuyển vào. AI không thể tự truy cập các tệp chưa được chọn hoặc tự vượt qua đăng nhập. Cấu hình bot, xoá dữ liệu, các thao tác chưa có executor không được tuyên bố đã thực hiện. Mỗi kế hoạch chỉ có một thao tác, không chạy chuỗi nhiều thay đổi ngoài một lần xác nhận.

## Cài trên website và Firebase (macOS)
1. Giữ một bản mã nguồn hiện tại. Giải nén gói vào thư mục dự án. Các tệp giao diện có app.js/index.html/styles.css và các module mới. Hai tệp backend mới là functions/assistant-agent.js và functions/agent-core.js. Gói không thay toàn bộ functions/index.js của bạn.
2. Mở Terminal ở thư mục có firebase.json, chạy:

```bash
node install-ai-agent.cjs
```

Lệnh chỉ thêm đăng ký endpoint vào functions/index.js nếu chưa có; có bản sao lưu functions/index.js.before-ai-agent và không thêm trùng. Nếu thiếu các helper của backend FBTQ, script dừng và giữ nguyên index. Không commit bản sao lưu chưa kiểm tra hoặc file chứa secret.

3. Nếu dùng Gemini: bảo đảm GEMINI_API_KEY đã được đặt trong Secret Manager và project đã bật Billing hoạt động. Dùng model ID thực tế được tài khoản hỗ trợ nếu cấu hình ASSISTANT_GEMINI_MODEL trong functions/.env.mediafbtq-6e1bb. Khoá không nhập trên giao diện chat và không đưa lên GitHub. Triển khai:

```bash
firebase deploy --project mediafbtq-6e1bb --only functions:planAssistantGemini
```

Nếu chọn OpenAI hoặc Claude, cấu hình secret tương ứng và triển khai endpoint tương ứng:

```bash
firebase deploy --project mediafbtq-6e1bb --only functions:planAssistantOpenai
firebase deploy --project mediafbtq-6e1bb --only functions:planAssistantClaude
```

Chỉ cần triển khai mô hình muốn dùng; mỗi endpoint chỉ ràng buộc secret của nó. Các helper backend và dependencies cũ của dự án phải có trước; nếu chưa cài dependencies, chạy npm --prefix functions install.

4. Các hành động gửi tin và phân quyền dùng sendChatbotMessage / setUserRole hiện có, cần triển khai sẵn chúng nếu muốn dùng các thao tác đó. Các thao tác Firestore trực tiếp vẫn do Rules hiện có bảo vệ; không có Rules mới nới quyền. Không sửa báo cáo người khác nếu Rules chỉ cho chủ báo cáo sửa.
5. Commit/push phần website và chờ GitHub Pages xuất bản. Tải lại bằng Command + Shift + R. Chọn đúng mô hình đã triển khai trong Trợ lý. Không cần đổi extension 2.9.0.
6. Thử câu xin nghỉ đầy đủ. Nếu thiếu, trả lời câu hỏi ngay trong chat. Khi bảng xác nhận xuất hiện, kiểm tra người thực hiện, ngày/buổi/lý do rồi chọn Phê Duyệt hoặc Từ Chối.

Chỉ cập nhật website chưa đủ: nếu chưa có planAssistantGemini/Openai/Claude trên Firebase, AI không thể lập kế hoạch. Lỗi API key/quota/model không hợp lệ vẫn cần xử lý tại nhà cung cấp; không thể thay bằng việc nhận lệnh theo từ khoá để gọi là AI tự động.

## Dữ liệu và kiểm tra
Chỉ gửi ngữ cảnh đã tải theo quyền hiện có: tối đa 40 bản ghi mỗi loại, báo cáo chỉ của chính tài khoản; lịch sử ngắn của phiên để hỏi đáp bổ sung. Các kế hoạch chưa thực thi không được khôi phục thành quyền thao tác khi tải lại lịch sử chat. Quyền và dữ liệu vẫn được kiểm tra khi ghi. AI không tự phê duyệt thay người dùng.

Đã kiểm thử bằng mô hình/API giả lập: hỏi bổ sung → nhận câu trả lời → điền đúng ngày/buổi/lý do → requestSubmit đi vào luồng xác nhận, chưa ghi dữ liệu; chặn action lạ, thuộc tính trái phép, số tiền âm, sửa chủ báo cáo, yêu cầu vượt vai trò và đổi tài khoản khi chờ AI. 31 unit tests đạt, các kiểm tra ánh xạ extension cũ vẫn đạt. Chưa gọi mô hình thật, chưa thử trên Chrome và Firebase production trong phiên này.
