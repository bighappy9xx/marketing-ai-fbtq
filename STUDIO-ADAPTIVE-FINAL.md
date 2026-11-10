# Timeline tự sắp lớp và Xuất Final sang Kiểm duyệt

## Timeline

- Bỏ các hàng phân loại cố định. Chỉ hiện những lớp đang có nội dung, đánh số gọn ở bên trái; các dự án cũ vẫn mở được mà không hiện những hàng loại tư liệu đang trống.
- Thước hiển thị 00:00, 00:05, 00:10… hoặc các bước lớn hơn khi thu nhỏ. Có vạch phụ, đầu phát, thumbnail và cuộn ngang như bản trước.
- Thả tư liệu vào một hàng tại vị trí thời gian mong muốn. Nếu khoảng thời gian đó còn trống thì dùng hàng đó; nếu đè lên đoạn đang có thì tự tạo lớp chồng lên trên.
- Thả gần mép trên/dưới của hàng để thêm lớp ngay trên/dưới hàng đó. Khi kéo, vạch màu báo hướng chèn.
- Thả xuống vùng cuối timeline để tạo lớp thấp hơn. Ảnh, video, chữ, hiệu ứng hay âm thanh đều có thể được sắp theo vị trí, không cần chọn danh mục lớp trước.
- Khi không chỉ định hàng: chữ/hiệu ứng/ảnh chèn nằm phía trên; âm thanh được bố trí bên dưới. Thêm nhiều video bằng nút nhập vẫn có thể nối tiếp trên lớp video đang dùng.
- Có nút Lớp để thêm hàng trống thủ công nếu cần. Thứ tự từ trên xuống của timeline là thứ tự xếp chồng của khung hình; hiệu ứng tác động đến các lớp hình phía dưới nó.

## Nút Xuất Final → Kiểm duyệt

1. Hoàn tất dựng và đặt tên dự án. Bấm **Xuất Final → Kiểm duyệt**.
2. Nếu bản dựng hiện tại chưa được xuất, Studio dựng video thực. Nếu đã xuất đúng bản này thì tái sử dụng bản đó. Thay đổi nội dung, lớp hoặc kích thước khung buộc xuất lại, không gửi nhầm bản cũ; huỷ/lỗi xuất sẽ không chuyển sang kiểm duyệt.
3. Website mở biểu mẫu Kiểm duyệt, điền tiêu đề và nội dung từ các layer chữ đang bật, đính kèm đúng Blob video Final để xem trước. Có thể sửa caption trước khi gửi. Không cần tự tải lên Drive và dán link cho luồng Final.
4. **Chưa gửi cho quản lý ở bước chuyển biểu mẫu.** Khi bấm Gửi quản lý và xác nhận theo luồng hiện tại, hệ thống tải video lên Firebase Storage rồi lưu bài trạng thái Chờ duyệt cùng metadata video vào Firestore.
5. Quản lý mở bài, chọn Tải video Final để xem. File được đọc qua SDK với phiên đăng nhập; không lưu link blob cục bộ hoặc link download công khai vào bài gửi.
6. Phê duyệt hoặc Từ chối/yêu cầu sửa theo chức năng hiện tại. Người gửi có thể sửa nội dung rồi gửi lại, giữ video Final; để thay video bằng một bản dựng khác, xuất và gửi bản Final mới từ Studio.

Video Final tối đa 250 MB. Bản lớn hơn vẫn có thể xuất/tải về từ Studio nhưng cần dựng bản nhẹ hơn để đính kèm qua luồng này. Dự án chỉnh sửa vẫn lưu trên từng trình duyệt; chỉ video Final đã gửi duyệt được tải lên máy chủ để quản lý xem từ máy khác.

## Bật lưu trữ cho dự án mediafbtq-6e1bb

Khác với các bản frontend trước, **luồng gửi Final cần Cloud Storage hoạt động cùng Storage Rules/Firestore Rules mới**. Không cần Functions hoặc API key mới. Chưa có triển khai production trong phiên sửa mã này.

1. Mở Firebase Console, chọn mediafbtq-6e1bb → Build → Storage. Bật bucket nếu chưa có. Firebase config hiện dùng:

   `mediafbtq-6e1bb.firebasestorage.app`

2. Cloud Storage for Firebase hiện cần gói Blaze với tài khoản thanh toán hoạt động. Nếu Billing vẫn bị đóng/chưa kích hoạt như lỗi trước đây, phần chỉnh sửa cục bộ vẫn dùng được nhưng gửi Final sẽ chưa tải file lên được. Mã nguồn không tự nâng gói hoặc thanh toán thay bạn. Tham khảo chính thức:

   https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

3. `firebase.json` đã khai báo `storage.rules`. Triển khai trong thư mục dự án bằng Firebase CLI đã đăng nhập đúng tài khoản:

```powershell
firebase deploy --only "hosting,firestore:rules,storage" --project mediafbtq-6e1bb
```

4. Lần đầu Storage Rules đọc hồ sơ/quyền trong Firestore, Firebase có thể yêu cầu bật quyền kết nối Storage–Firestore. Hoàn tất yêu cầu đó trong Console/CLI để quy tắc hoạt động. Tài liệu:

   https://firebase.google.com/docs/storage/security/rules-conditions

5. Bật CORS để trình duyệt tải video qua getBlob có xác thực, bằng Google Cloud CLI trong đúng thư mục:

```powershell
gcloud storage buckets update "gs://mediafbtq-6e1bb.firebasestorage.app" --cors-file="storage-cors.json"
```

`storage-cors.json` chứa ba origin đang được biết: website Firebase web.app, firebaseapp.com và bighappy9xx.github.io. Nếu dùng tên miền khác, thêm đúng origin (không có path) vào file trước khi chạy. Không cần mở public bucket. Tài liệu:

https://firebase.google.com/docs/storage/web/download-files

## Phân quyền đi kèm

- Người đã được duyệt chỉ upload vào `studioFinals/{uid của mình}/{exportId}/final.mp4` hoặc `final.webm`, đúng MIME và tối đa 250 MB.
- File đã tạo không bị ghi đè. Không cho xoá qua client khi bài kiểm duyệt tương ứng đã tồn tại.
- Người tạo đọc được file của mình; director/branch_manager/department_manager đọc được file gắn với bài kiểm duyệt tương ứng. Không mở cho mọi tài khoản hoặc khách chưa đăng nhập.
- Firestore chỉ chấp nhận Final có owner, exportId, path, MIME và dung lượng khớp hợp đồng dữ liệu của bài. Cách gửi link Google Drive cũ vẫn được giữ.
- Nếu tải file xong nhưng lưu bài thất bại, form vẫn giữ video. Gửi lại tái sử dụng file bất biến cùng ID, không tự tạo thêm bản upload. Nếu bỏ ngang sau lỗi, có thể còn file riêng tư chưa gắn bài; cần quản trị dọn theo chính sách lưu trữ của dự án.

Rules trong ZIP dựa trên mã nguồn hiện tại của máy Windows. Nếu production hoặc máy Mac có Rules mới hơn, hợp nhất phần `validContentReviewVideo`/các validator liên quan trước khi triển khai, tránh ghi đè thay đổi riêng. Nếu bucket đang dùng cho ứng dụng khác, hợp nhất Storage Rules theo prefix `studioFinals` thay vì thay thế chính sách các prefix khác.

## Kiểm chứng và giới hạn

- 37 kiểm thử logic trong checkout hiện tại đạt, gồm tự sắp lớp, thời điểm chồng, vị trí trên/dưới, định dạng thước, chữ ký bản xuất và từ chối metadata Final sai owner/path/dung lượng.
- Chrome: timeline ban đầu không có các hàng loại tư liệu; thêm/chồng/dưới; dựng video thực; chuyển Final sang biểu mẫu mà chưa upload trước khi gửi; giả lập lỗi metadata rồi retry không trùng upload; quản lý xem, trả sửa, người gửi gửi lại và quản lý phê duyệt.
- Upload và đọc Storage được kiểm thử qua adapter mô phỏng có xác thực; chưa truy cập tài khoản Firebase thật và chưa kiểm thử Rules bằng emulator trong môi trường này. Cần kiểm tra với hai tài khoản thật sau triển khai: người gửi và quản lý; một nhân viên khác phải không đọc được file.
- Các kiểm thử giao diện timeline px, kéo thả/phím tắt và nội dung video xuất tiếp tục được duy trì. Trình duyệt kiểm thử vẫn huỷ bước download hệ điều hành như các bản trước; đã xác nhận Blob video mã hoá thực và nội dung hình/âm thanh thay thế.
