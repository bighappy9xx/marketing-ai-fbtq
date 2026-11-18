# Vận hành yêu cầu xóa dữ liệu Meta — FBTQ

Hai trang công khai dùng email quản trị `bighappy9xx@gmail.com`. Đây là quy trình xử lý thủ công, chưa có callback hoặc nút tự động xóa dữ liệu trong website. Người vận hành cần theo dõi email, xác minh yêu cầu và xử lý thực tế; việc đăng trang hướng dẫn không tự xóa dữ liệu.

1. Tiếp nhận thư có tiêu đề “Yêu cầu xóa dữ liệu — Media_TQ_AI_CUP”; phản hồi trong cùng chuỗi thư để xác nhận đã nhận và hỏi thông tin còn thiếu. Không yêu cầu mật khẩu, OTP, Page Token hay giấy tờ tùy thân qua email.
2. Xác định Page ID và khách/hội thoại tương ứng. Xác minh qua tài khoản đã tương tác với Trang hoặc email/tài khoản quản lý kết nối. ASID của người dùng đăng nhập Facebook và PSID của người nhắn Trang là hai định danh khác nhau; không tự coi chúng là một người chỉ vì chuỗi số giống nhau.
3. Với một hội thoại: dùng quyền quản trị Firebase Console, kiểm tra tài liệu trong `workspaces/fbtq/inbox` theo `pageId`, `senderId` và `conversationId`; đối chiếu thời gian. Tìm và xóa các tài liệu liên quan trong `workspaces/fbtq/messages` theo đúng `conversationId`; xóa inbox tương ứng và các bản ghi xử lý liên quan đã xác định. Kiểm tra `chatbotJobs`, phiên `metaOAuthSessions` nếu có dữ liệu của yêu cầu đó. Không xóa cả collection hoặc dữ liệu của khách khác.
4. Nếu ngắt/xóa kết nối Fanpage: xác minh quyền quản lý Trang, dừng bot và thu hồi ứng dụng/quyền tương ứng trong Meta Business Integrations/thiết lập Trang trước. Xóa tài liệu Trang trong `workspaces/fbtq/pages/{pageId}` để backend không tiếp tục nhận/xử lý webhook cho Trang, gồm token đã mã hóa; xử lý các hội thoại/tin nhắn thuộc phạm vi yêu cầu. Bản webhook hiện tại bỏ qua Trang có `active:false`; khi xử lý yêu cầu xóa/ngắt kết nối vẫn cần thu hồi quyền và xóa tài liệu/token tương ứng, đồng thời kiểm tra tác vụ đang chạy. Không xoay `META_TOKEN_ENCRYPTION_KEY` để xóa một Trang.
5. Kiểm tra những bản sao mà người vận hành đã tạo, dữ liệu xuất và nhật ký có chứa định danh thuộc phạm vi yêu cầu. Nếu có dữ liệu chưa thể xóa ngay hoặc nhà cung cấp ngoài cần xử lý riêng, giải thích cụ thể cho người yêu cầu, không xác nhận “đã xóa toàn bộ” khi chưa xác minh.
6. Phản hồi kết quả qua email, nêu rõ phạm vi đã xử lý, phần còn chờ và thời gian dự kiến nếu có. Không đính kèm nội dung hội thoại hoặc định danh của người khác. Ghi lại bằng chứng xử lý trong công cụ nội bộ phù hợp, không commit thư/tin nhắn/PSID thật lên GitHub.

Xóa dữ liệu trong FBTQ không xóa bản tin gốc trong Meta hoặc đảm bảo xóa tức thì dữ liệu đã gửi nhà cung cấp AI. Nếu khách nhắn tin mới sau khi yêu cầu đã hoàn tất, tương tác mới có thể tạo dữ liệu mới theo chính sách.

Đây là hướng dẫn vận hành theo cấu trúc source hiện tại; quản trị phải kiểm tra dữ liệu thực tế và phạm vi quyền trước mỗi hành động xóa.
