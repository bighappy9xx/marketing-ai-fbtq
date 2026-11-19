# Phát hành website và bảo vệ mã nguồn

`npm ci --ignore-scripts` và `npm run build:web` dựng gói công khai trong `web-dist`. Gói chỉ gồm các trang trình duyệt, module đã rút gọn, tài nguyên giao diện và gói tiện ích Chrome dành cho cài đặt. Gói phát hành không chứa source map, Functions, quy tắc dữ liệu, tệp môi trường, bản sao dự án hoặc ZIP sao lưu.

Firebase Hosting phát hành từ `web-dist`. Với GitHub Pages, chuyển **Settings → Pages → Build and deployment → Source → GitHub Actions**, sau đó chạy workflow **Publish browser build**. File `_config.yml` bổ sung danh sách loại trừ khi kho còn dùng phát hành từ nhánh.

Kho GitHub công khai vẫn cho phép tải mã nguồn và lịch sử dù website đã dùng gói dựng. Chủ kho cần đổi visibility sang **Private** để ngừng phân phối mã gốc qua GitHub. Nếu gói GitHub hiện tại không chạy Pages từ kho riêng, hãy kiểm tra các redirect OAuth, danh sách tên miền đăng nhập và URL của tiện ích Chrome trước khi đổi sang Firebase Hosting và tắt Pages cũ. Việc đổi visibility không thu hồi các bản sao đã được tải trước đó.

Firebase browser API key và App Check site key có mặt ở phía trình duyệt theo thiết kế. Chúng không thay quyền Firebase Auth và Security Rules. Các khóa OpenAI, Gemini, Meta App Secret và khóa mã hóa thuộc Secret Manager. Hãy thu hồi và cấp lại mọi khóa riêng từng dán vào cuộc trò chuyện hoặc đăng công khai.

Tài khoản mới chỉ tạo được hồ sơ chờ duyệt. Giám đốc có thể duyệt bằng luồng lời mời hoặc chỉnh quyền thành viên đã có. Firestore chỉ cho tài khoản đã được duyệt truy cập dữ liệu workspace.
