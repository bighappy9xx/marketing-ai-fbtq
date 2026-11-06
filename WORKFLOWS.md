# Hoá Đơn Tạm Ứng và Đơn Từ & Đề Xuất

## Cập nhật website và Firebase

Hai menu mới dùng giao diện tĩnh, Firestore để cập nhật danh sách trực tiếp và ba Callable Functions để kiểm tra quyền, ghi quyết định và giữ lịch sử. Cần triển khai cả giao diện, Rules và Functions; thay giao diện đơn thuần chưa bật được thao tác gửi/duyệt.

1. Cập nhật `index.html`, `styles.css`, `app.js`, `workflows-ui.js`, `workflow-reports.js`, `xlsx-export.js` trên hosting hiện tại. Các file JavaScript mới nằm cùng thư mục với `app.js`.
2. Cập nhật `functions/index.js`, `functions/workflows.js`, `functions/workflow-core.js` và `firestore.rules`.
3. Trong thư mục dự án, dùng Firebase CLI đã đăng nhập đúng dự án:

   ```sh
   npm --prefix functions install
   firebase deploy --project mediafbtq-6e1bb --only functions:createWorkflow,functions:reviewWorkflow,functions:disburseAdvance,functions:setUserRole,firestore:rules
   ```

4. Nếu dùng Firebase Hosting, triển khai thêm `firebase deploy --project mediafbtq-6e1bb --only hosting`. Nếu dùng GitHub Pages, đưa các file giao diện lên nhánh đang xuất bản.
5. Giám đốc vào **Nhân sự & phân quyền → Chỉnh quyền**, gán vai trò **Kế toán** cho đúng người; gán Chi nhánh và Phòng ban qua **Sửa đơn vị**. Người đổi vai trò đăng xuất và đăng nhập lại. Mỗi phòng cần người có vai trò Trưởng phòng và mỗi chi nhánh cần Quản lý chi nhánh.

Không có thay đổi thực tế trên ngân hàng. Nút **Xác nhận cấp tiền** ghi nhận khoản tiền kế toán đã chuyển/chi bên ngoài, kèm ngày và mã giao dịch/phiếu chi.

## Quyền và quy trình

| Hồ sơ | Bước 1 | Bước 2 | Sau khi duyệt đủ |
| --- | --- | --- | --- |
| Tạm ứng | Quản lý cùng chi nhánh | Kế toán | Kế toán ghi nhận cấp tiền |
| Xin nghỉ / đề xuất | Trưởng phòng cùng chi nhánh và phòng ban | Quản lý cùng chi nhánh | Được tính là đơn đã duyệt |

- Nhân viên tạo và xem hồ sơ của mình. Quản lý xem hồ sơ thuộc phạm vi duyệt; Giám đốc xem toàn công ty. Kế toán xem các hóa đơn tạm ứng toàn công ty và đơn từ của mình.
- Giám đốc giám sát hồ sơ; không thay thế hai vai trò duyệt được yêu cầu. Không được tự duyệt hồ sơ của mình, và hai cấp phải do hai người khác nhau xử lý.
- Mỗi bước có **Phê Duyệt / Từ Chối**; từ chối phải ghi lý do, hồ sơ dừng xử lý. Các bước không được đảo thứ tự.
- Quyền được kiểm tra bằng hồ sơ hiện tại trên máy chủ trong transaction. Các collection `advanceInvoices`, `staffRequests` chỉ cho client đọc đúng phạm vi; client không được tạo, sửa, xoá trực tiếp. Lịch sử gồm người xử lý, vai trò, thời điểm và ghi chú, không có chức năng sửa/xoá.
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

Tham khảo triển khai: [Firebase Callable Functions](https://firebase.google.com/docs/functions/callable), [Firestore Transactions](https://googleapis.dev/nodejs/firestore/latest/Transaction.html), [cấu trúc SpreadsheetML](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document).
