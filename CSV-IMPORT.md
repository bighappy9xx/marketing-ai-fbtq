# Nhập CSV trong báo cáo quảng cáo hàng ngày

1. Mở **Hiệu suất marketing → Báo cáo hàng ngày**.
2. Trong **Chi tiết chiến dịch**, bấm **Up file CSV** cạnh **Thêm dòng**.
3. Chọn file CSV xuất từ Meta hoặc bảng CSV có tiêu đề tương ứng với form. Các dòng chiến dịch trong file thay thế những dòng đang hiển thị. Thông tin bổ sung và ghi chú chung đang nhập được giữ lại.
4. Kiểm tra ngày báo cáo, chỉ số và tổng hợp rồi bấm **Lưu báo cáo**. Chọn file không tự gửi dữ liệu lên Firebase.

| Cột CSV Meta | Trường trên form |
| --- | --- |
| ID tài khoản quảng cáo / Tài khoản quảng cáo | Tên TKQC |
| Chiến dịch / Tên chiến dịch / Campaign name | Bài chạy |
| Phân phối / Delivery | Trạng thái |
| Kết quả / Results | Số Mess |
| Chi phí trên mỗi kết quả / Cost per result | Giá Mess TB |
| Ngân sách / Budget | Ngân sách/ngày |
| Số tiền đã chi tiêu / Amount spent | Chi tiêu thực tế/ngày |

Các cột SĐT/Camp, Doanh thu SĐT/Camp, KPI/ngày, Giá số TB, Tỷ lệ xin số mới, Ngưỡng, Ngưỡng đã chi, Vấn đề/Nguyên nhân và Hướng giải quyết cũng được điền khi có trong CSV. Các trường thiếu để trống để người nhập bổ sung; dấu gạch ngang không bị đổi thành số 0 khi nhập. Cột kết quả Meta vẫn ánh xạ trực tiếp sang Số Mess theo cấu hình yêu cầu, kể cả khi loại kết quả là tương tác hoặc ThruPlay.

Hỗ trợ UTF-8, UTF-8 BOM, UTF-16 có BOM, dấu phân cách phẩy/chấm phẩy/tab và các ô có ngoặc kép hoặc xuống dòng. Số `30.000` được đọc là 30000; số `1.234,50` là 1234.5. Giới hạn 10 MB và 2.000 chiến dịch mỗi file. Bỏ dòng tổng cộng; file có dữ liệu trùng cùng chiến dịch/tài khoản cần xuất lại ở cấp Chiến dịch, không chia nhỏ.

Nếu CSV có đúng một ngày báo cáo thì form cập nhật ngày đó khi không ở tương lai. CSV có nhiều ngày/khoảng ngày sẽ hiện nhắc kiểm tra và giữ nguyên ngày đang chọn. Không phân chia số liệu khoảng ngày thành từng ngày.

## Cập nhật website

Thay `app.js`, `index.html`, `styles.css` và thêm `daily-csv.js` cùng thư mục. Giữ các module khác đang có trên website, sau đó tải lại trang. Tính năng này sử dụng quy trình lưu báo cáo hiện có.

## Kiểm tra

```sh
node --test tests/daily-csv.test.cjs
node tests/daily-csv-browser.cjs
```

Kiểm tra trình duyệt dùng Playwright + Chrome, dữ liệu giả lập và không kết nối Firebase thật.

## Nhập ngay tại Trợ lý FBTQ

Trong menu Trợ lý FBTQ hoặc cửa sổ trợ lý nổi, chọn Nhập CSV / JSON hoặc Nhập hóa đơn PDF. Chọn tệp rồi kiểm tra biểu mẫu. Có thể dùng lệnh Nhập số liệu chiến dịch hoặc Nhập hóa đơn để mở form. JSON từ Meta Helper được nhận theo danh sách campaigns/rows/data. Hai loại dữ liệu gửi từ extension cũng mở biểu mẫu tại Trợ lý, thay cho điều hướng sang Hiệu suất marketing hoặc Báo cáo hóa đơn. Để dùng trực tiếp tại Trợ lý, chỉ cần các tệp CSV/JSON hoặc PDF đã tải về máy; quét dữ liệu trực tiếp trên trang Meta vẫn cần Meta Helper.
