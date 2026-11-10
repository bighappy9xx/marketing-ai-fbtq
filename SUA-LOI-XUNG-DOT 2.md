# Bản sửa lỗi xung đột Git — FBTQ

Đã đối chiếu mã nguồn GitHub hiện tại và trang GitHub Pages đang chạy. Nguồn kiểm tra: commit `ff3ebbf049b6b1231cabc6dbea9a7d12546fa075` trên nhánh `main`, lấy ngày 10/11/2026.

## Lỗi được sửa

1. Có 38 khối xung đột chưa giải quyết trong 16 file. `index.html` chứa cả hai bản trang HTML nên in `<<<<<<< HEAD` lên đầu trang; các file JavaScript tương tự không thể phân tích cú pháp.
2. Bản ghép làm lặp đoạn JavaScript/CSS và làm lẫn phiên bản cũ với Studio mới. Đã khôi phục một bản HTML duy nhất, giữ Studio, AI, kho miễn phí, timeline và thông báo trên trợ lý.
3. Firestore Rules bị ghép nhầm điều kiện lịch sử chat vào phần giữ chỗ đơn nghỉ. Đã khôi phục bản Rules sạch từ gói cập nhật đã có trong chính repository, giữ quy trình Trưởng phòng → Kế toán cho tạm ứng.
4. Thư mục functions bị thiếu `workflows.js` và `package.json` dù `index.js` vẫn gọi module workflows. Đã bổ sung hai file từ gói cập nhật sạch hiện có.
5. Extension bị trộn bản 2.9 và 2.8, gồm đường dẫn về trợ lý và giao diện cũ. Đã giữ luồng điền thẳng vào báo cáo/hoá đơn và đóng gói lại bản 2.9.1.
6. Khi kiểm tra nhập báo cáo, phát hiện form có thể kéo thêm dòng báo cáo cũ không thuộc lượt nhập hiện tại. Đã giới hạn theo đúng batch extension, giữ dữ liệu lịch sử trong kho và không dùng bộ đếm liên hệ để thay cho cột Kết quả bị trống.

Không chỉ xoá các dòng dấu xung đột rồi giữ cả hai nhánh: các phần trùng, phiên bản cũ và điều kiện sai cũng đã được giải quyết.

## Áp dụng trên máy Mac/Windows

1. Giữ một bản sao thư mục dự án hiện tại nếu có thay đổi chưa lưu. Giải nén ZIP sửa lỗi; chép nội dung vào đúng thư mục dự án có `index.html`, `app.js` và `firebase.json`, cho phép thay file trùng tên. ZIP không chứa thư mục `.git` hoặc key bí mật.
2. Chạy trong thư mục dự án:

```sh
node scripts/check-source.cjs
node --test tests/*.test.cjs
node tests/extension-mapping.cjs
```

Kết quả kiểm tra bản này: Source check passed; 47 kiểm thử logic đạt; các nhóm kiểm tra ánh xạ extension và batch nhập đạt.

3. Xem `git diff --stat` và `git status`. Commit các file nguồn đã sửa và đẩy lên nhánh website như thường lệ. Không chỉ upload file ZIP lên GitHub: GitHub Pages cần các file đã giải nén. Không commit file `.env`, key bí mật hoặc node_modules.
4. Chờ GitHub Pages triển khai xong, mở lại website và tải lại mạnh (`Cmd+Shift+R` trên Mac hoặc `Ctrl+Shift+R` trên Windows). Các liên kết JS/CSS bị sửa đã đổi mã cache để tránh dùng lại bản lỗi.
5. Nếu dùng Firebase Hosting thay GitHub Pages:

```sh
firebase deploy --only hosting --project mediafbtq-6e1bb
```

Đã thêm bước kiểm tra nguồn trước khi deploy Hosting; sẽ dừng nếu còn dấu xung đột, JavaScript/JSON sai, HTML trùng ID hoặc thiếu module máy chủ.

6. Rules cần triển khai riêng nếu muốn cập nhật bản đang dùng trên Firebase:

```sh
firebase deploy --only firestore:rules --project mediafbtq-6e1bb
```

Nếu cần cài lại dependencies cho Functions, chạy `npm --prefix functions install`. Không cần triển khai lại toàn bộ Functions chỉ để đưa bản HTML/JavaScript đã sửa lên GitHub Pages.

7. Extension: trong Chrome → Extensions → Developer mode, Reload thư mục extension đã thay bằng bản mới. Trong ZIP có cả thư mục extension sạch và gói Chrome 2.9.1; khi Load unpacked, chọn thư mục có manifest.json đã giải nén.

## Phạm vi kiểm tra

Đã kiểm tra cú pháp JavaScript/JSON, module máy chủ, các ID và đường dẫn của HTML, dấu xung đột, 47 kiểm thử logic và các nhóm ánh xạ extension. Các file font/âm thanh và các tính năng mới được giữ lại.

Phiên này không triển khai hoặc push lên GitHub/Firebase, không đăng nhập tài khoản thật, không biên dịch Rules bằng emulator. Môi trường kiểm tra hiện tại không cho chạy xem trước bằng trình duyệt cục bộ, nên chưa xác nhận giao diện và đăng nhập trên hosting sau triển khai.
