# Hai URL công khai để khai báo Meta

Các trang độc lập, không cần đăng nhập:

- Privacy policy URL: https://mediafbtq-6e1bb-meta.web.app/privacy.html
- User data deletion → **Data deletion instructions URL**: https://mediafbtq-6e1bb-meta.web.app/data-deletion.html
- Email liên hệ: bighappy9xx@gmail.com
- Ứng dụng: Media_TQ_AI_CUP, App ID 1679762183550015.

Firebase Hosting site riêng `mediafbtq-6e1bb-meta` nằm trong project `mediafbtq-6e1bb`. Không phải preview channel có thời hạn. Hai URL dùng tên miền Firebase; không thay URL website/OAuth GitHub Pages của ứng dụng. Không điền URL trang hướng dẫn vào trường Data Deletion Callback URL.

Source: `privacy.html`, `data-deletion.html`, `legal.css`. Để cập nhật chỉ ba tệp này lên site công khai, chạy:

```sh
node scripts/publish-meta-pages.cjs
```

Trình xuất bản dùng một thư mục tạm chứa đúng ba tệp cho site chính sách, không triển khai toàn bộ website. Cần Firebase CLI đã đăng nhập và quyền triển khai Hosting.

Các trang mô tả luồng Messenger theo source hiện tại, gồm tin nhắn, ID và tệp đính kèm, quyền chủ kết nối/quản lý, Page Token mã hóa, nhà cung cấp Firebase/Meta/AI và xử lý xóa qua email. Không có callback xóa tự động, không có biểu mẫu tự gửi email và không tự xóa dữ liệu chỉ vì người dùng mở URL.

Người vận hành cần thực sự theo dõi email liên hệ và xử lý yêu cầu theo `META-DATA-DELETION-OPERATIONS.md`; cập nhật nội dung/ngày hiệu lực nếu cách xử lý hoặc đầu mối thay đổi. Đây không phải xác nhận Meta đã duyệt ứng dụng.
