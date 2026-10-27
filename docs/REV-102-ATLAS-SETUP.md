# Cách chạy thay đổi database cho REV-102

Script đã có tại `server/src/migrations/20261027-movie-review-unique-index.js`.

Script chỉ thêm một ràng buộc chống đánh giá trùng vào collection `movie_reviews`: cùng một khách hàng không được có hai đánh giá cho cùng một phim. Không sửa/xóa đánh giá, không tạo review mẫu, không backfill, không thay validator hoặc quan hệ dữ liệu.

Database phát triển được đối chiếu ở phiên làm việc này là **cinema_management_dev**. Script kết nối đến cluster trong `server/.env` qua biến `MONGODB_URI`. Trước khi chạy, xác nhận đây là cluster phát triển bạn muốn dùng; không gửi hoặc chụp công khai chuỗi kết nối vì có thể chứa mật khẩu. Nếu `.env` trỏ sang cluster khác, cùng tên database vẫn sẽ nằm trên cluster khác đó.

## 1. Mở PowerShell trong thư mục server

```powershell
Set-Location 'D:\FPT\semester8\WDP\project\server'
```

Máy cần Node.js và các dependency server đã được cài như khi chạy backend bình thường. Không cần cài thêm thư viện cho script này.

## 2. Kiểm tra trước, chưa thay đổi database

```powershell
node .\src\migrations\20261027-movie-review-unique-index.js --database cinema_management_dev
```

Không có `--apply` thì script chỉ đọc và kiểm tra.

Kết quả kiểm tra trước đó trong phiên làm việc:

```text
database: 'cinema_management_dev'
applied: false
alreadyReady: false
checked: 0
index: 'uniq_movie_review_customer'
```

`alreadyReady: false` nghĩa là chưa có ràng buộc chống trùng. `checked: 0` nghĩa là chưa có đánh giá để kiểm tra ở thời điểm đó, không phải script đã xóa dữ liệu. Lần bạn chạy có thể ra số khác nếu dữ liệu đã thay đổi.

## 3. Áp dụng thay đổi

Chỉ chạy bước này khi bước kiểm tra đã thành công và tên database/cluster là đúng:

```powershell
node .\src\migrations\20261027-movie-review-unique-index.js --database cinema_management_dev --apply
```

Script chạy lại kiểm tra trước khi tạo ràng buộc. Lần tạo mới thành công sẽ có `applied: true`. Nếu đã có ràng buộc phù hợp, script không tạo lại và có `alreadyReady: true`; chạy lại không làm nhân đôi dữ liệu hoặc index.

## 4. Xác nhận đã xong

Chạy lại lệnh kiểm tra ở bước 2:

```powershell
node .\src\migrations\20261027-movie-review-unique-index.js --database cinema_management_dev
```

Kết quả mong đợi có `alreadyReady: true`. `applied: false` trong lần kiểm tra này là bình thường: lệnh chỉ đọc, còn ràng buộc đã được tạo ở bước 3.

Khi backend và frontend đã chạy code REV-102 mới nhất, khách có vé hợp lệ có thể gửi đánh giá. Backend kiểm tra index ở mỗi lần gửi, nên không cần khởi động lại chỉ vì vừa thêm index. Nếu backend vẫn chạy code cũ, khởi động lại theo cách phát triển thông thường để nạp code mới.

Để thử thực tế, dùng tài khoản Customer có vé đã thanh toán thành công, suất đã kết thúc kể cả thời gian dọn phòng, chưa hoàn tiền, không có yêu cầu hoàn tiền chưa giải quyết, và chưa đánh giá phim đó. Xem Movie Detail, chọn sao rồi gửi. Không cần tạo review mẫu hay seed database.

## Nếu script báo lỗi

Nếu báo dữ liệu trùng, dữ liệu cũ không hợp lệ, field ẩn/kiểm duyệt, validator khác cấu trúc đã kiểm tra hoặc index không tương thích: dừng tại đó và gửi lại **thông báo lỗi** để xử lý. Không xóa/gộp/sửa dữ liệu hoặc chạy seed để vượt lỗi. Script không tự sửa những trường hợp này.

Nếu không kết nối được Atlas, kiểm tra cấu hình kết nối, mạng và quyền truy cập bằng quy trình của dự án. Nếu báo thiếu quyền tạo index, cần người quản lý database cấp quyền phù hợp hoặc chạy script giúp; không đưa mật khẩu vào chat.

## Tình trạng bàn giao

Agent chỉ chuẩn bị script và hướng dẫn; không chạy lệnh `--apply` trên Atlas phát triển. Script đã được kiểm thử tạo index/chạy lại/dừng khi dữ liệu sai trong database test riêng ở lượt triển khai REV-102; kết quả xem `REV-102-IMPLEMENTATION.md`. Lượt bổ sung hướng dẫn này chỉ kiểm tra cú pháp JavaScript và `git diff --check`, không chạy lại migration hoặc test DB.

Không đổi API, giao diện hoặc database trong lượt bổ sung hướng dẫn. Không commit/push.
