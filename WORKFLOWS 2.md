# Hoá Đơn Tạm Ứng và Đơn Từ & Đề Xuất

## Cập nhật website và Firebase

Hai menu **Hoá Đơn Tạm Ứng** và **Đơn Từ & Đề Xuất** dùng Firestore trực tiếp, cập nhật danh sách ngay và không cần Cloud Functions. Vai trò, phạm vi chi nhánh/phòng ban, hai bước duyệt, lịch sử và khóa trùng buổi nghỉ được kiểm tra bằng Firestore Security Rules. Quy trình này dùng được trên Spark miễn phí trong hạn mức Firestore.

1. Đẩy `index.html`, `app.js`, `workflows-ui.js`, `workflow-reports.js` và các tệp website liên quan lên nhánh GitHub Pages đang xuất bản.
2. Triển khai Rules và indexes cho dự án `mediafbtq-6e1bb`:

   ```sh
   firebase deploy --project mediafbtq-6e1bb --only "firestore:rules,firestore:indexes"
   ```

3. Giám đốc vào **Nhân sự & phân quyền → Chỉnh quyền**, gán vai trò **Kế toán** cho đúng người; gán chi nhánh và phòng ban qua **Sửa đơn vị**. Mỗi phòng cần người có vai trò Trưởng phòng và mỗi chi nhánh cần Quản lý chi nhánh.

Các phần ChatGPT/Claude, chatbot Messenger, Meta webhook và một số xử lý máy chủ khác vẫn phụ thuộc Cloud Functions; các phần đó không được triển khai khi dự án ở Spark. Chỉ hai quy trình trong tài liệu này đã chuyển sang Firestore trực tiếp.

## Khi hai menu báo không tải được hồ sơ

Cần Publish Rules của chính dự án `mediafbtq-6e1bb`; cập nhật file trong GitHub không tự triển khai Firestore Rules. Trong thư mục dự án, chạy:

```sh
firebase deploy --project mediafbtq-6e1bb --only "firestore:rules,firestore:indexes"
```

Nếu chưa có Firebase CLI, cài `npm install -g firebase-tools` và chạy `firebase login` bằng tài khoản quản trị đúng dự án trước. Chờ index `staffRequests` theo `branch` + `department` sẵn sàng, cập nhật website rồi đăng xuất/đăng nhập lại.

Giao diện bản sửa hiển thị collection, mã lỗi và mã dự án:

- `permission-denied`: Firebase từ chối truy vấn. Kiểm tra Rules đã Publish đúng dự án, vai trò và đơn vị được gán.
- `failed-precondition` kèm index: triển khai `firestore.indexes.json` và chờ index Ready.
- `unauthenticated`: đăng nhập lại.
- `unavailable`: kiểm tra mạng rồi Tải lại.

Lịch sử `requests` cũ được tải độc lập; nếu nguồn cũ bị lỗi thì hồ sơ mới vẫn hiển thị và xuất được khi đã tải đủ các nguồn hồ sơ mới. Nếu một nguồn hồ sơ mới bị từ chối thì giao diện tiếp tục báo rõ dữ liệu chưa đầy đủ và không xuất thống kê thiếu dữ liệu.

Không có thay đổi thực tế trên ngân hàng. Nút **Xác nhận cấp tiền** ghi nhận khoản tiền kế toán đã chuyển/chi bên ngoài, kèm ngày và mã giao dịch/phiếu chi.

## Quyền và quy trình

| Hồ sơ | Bước 1 | Bước 2 | Sau khi duyệt đủ |
| --- | --- | --- | --- |
| Tạm ứng | Quản lý cùng chi nhánh | Kế toán | Kế toán ghi nhận cấp tiền |
| Xin nghỉ / đề xuất | Trưởng phòng cùng chi nhánh và phòng ban | Quản lý cùng chi nhánh | Được tính là đơn đã duyệt |

- Nhân viên tạo và xem hồ sơ của mình. Quản lý xem hồ sơ thuộc phạm vi duyệt; Giám đốc xem toàn công ty. Kế toán xem các hóa đơn tạm ứng toàn công ty và đơn từ của mình.
- Giám đốc giám sát hồ sơ; không thay thế hai vai trò duyệt được yêu cầu. Không được tự duyệt hồ sơ của mình, và hai cấp phải do hai người khác nhau xử lý.
- Mỗi bước có **Phê Duyệt / Từ Chối**; từ chối phải ghi lý do, hồ sơ dừng xử lý. Các bước không được đảo thứ tự.
- Quyền được kiểm tra bằng hồ sơ hiện tại trong Firestore Rules ở mỗi lần ghi. Client chỉ được tạo hồ sơ của chính mình và cập nhật đúng bước đang chờ; không thể tự sửa vai trò, đổi người duyệt, bỏ qua bước hoặc thay nội dung sau khi gửi. Lịch sử duyệt được giữ nguyên và chỉ nối thêm sự kiện.
- Mã gửi giữ nguyên khi thử lại sau lỗi mạng, tránh tạo lặp hóa đơn. Một khoản đã cấp không được cấp lần nữa.
- Mỗi đơn nghỉ chọn một ngày, nghỉ sáng, chiều hoặc cả ngày. Đơn cùng user/ngày/buổi đang chờ hoặc đã duyệt không được tạo trùng. Khi bị từ chối, buổi đó được mở lại để gửi đơn mới.
- Bộ lọc hóa đơn sử dụng ngày đề nghị; bộ lọc đơn từ sử dụng ngày áp dụng. Có lựa chọn ngày, tháng, năm, chi nhánh, user và trạng thái.

## Lịch sử cũ

Collection `requests` cũ vẫn được đọc trong menu mới, gắn nhãn **Hồ sơ cũ**. Dữ liệu lịch sử không được sửa thành hai lượt phê duyệt giả. Các hồ sơ này không được tính vào thống kê nghỉ mới vì thiếu buổi nghỉ hoặc đầy đủ hai cấp duyệt. Với yêu cầu cũ còn chờ, người gửi tạo đơn mới và chọn rõ buổi nghỉ để đi qua quy trình mới.

## Thống kê và xuất Excel

- Bảng tháng áp dụng bộ lọc **Chi nhánh** và **User**; tháng thống kê có ô chọn riêng, không phụ thuộc bộ lọc thời gian/trạng thái của danh sách đơn.
- Chỉ cộng đơn nghỉ đã duyệt đủ hai cấp: sáng 0,5 ngày, chiều 0,5 ngày, cả ngày 1 ngày. Một user/ngày/buổi chỉ tính một lần.
- Xanh dương: sáng; cam: chiều; tím: cả ngày. Ô trống nghĩa là không có đơn nghỉ đã duyệt, không xác nhận chấm công có mặt.
- File `.xlsx` gồm **Lịch nghỉ tháng**, **Chi tiết đơn nghỉ**, **Chú giải**. Giữ màu, số liệu số, bộ lọc và hàng/cột cố định. Đơn chờ/từ chối có màu trạng thái riêng và không cộng vào ngày nghỉ.
- Xuất file ngay trong trình duyệt, không gửi danh sách nhân sự ra dịch vụ khác và không tải thư viện ngoài. Chuỗi bắt đầu bằng `=` vẫn được ghi như văn bản.

## Kiểm tra

```sh
node --test tests/workflows.test.cjs
node tests/extension-mapping.cjs
node tests/workflows-browser.cjs
```

Kiểm tra trình duyệt cần Playwright và Chrome. Có thể dùng `PLAYWRIGHT_MODULE_PATH` để trỏ vào package đã cài và `PLAYWRIGHT_CHROMIUM_EXECUTABLE` để chọn trình duyệt. Bài kiểm tra dùng dữ liệu mô phỏng, chặn mạng bên ngoài, không truy cập Firebase thật. Kiểm tra Functions dùng transaction giả lập để kiểm tra nghiệp vụ; cần kiểm tra môi trường Firebase thử nghiệm sau khi triển khai Rules và Functions trước khi vận hành.

Tham khảo triển khai: [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Firestore Security Rules và getAfter](https://firebase.google.com/docs/firestore/security/rules-conditions), [cấu trúc SpreadsheetML](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document).
