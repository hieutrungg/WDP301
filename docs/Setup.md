# F-Cinema — Hướng dẫn cài đặt và chạy dự án

Tài liệu này dành cho thành viên mới vừa clone/pull repository về máy. Dự án gồm hai ứng dụng độc lập:

- `client/`: React + Vite + Tailwind CSS v4, mặc định chạy tại `http://localhost:5173`.
- `server/`: Node.js + Express + MongoDB, mặc định chạy tại `http://localhost:5000`.

Không chạy `npm install` ở thư mục gốc vì repository không có root `package.json`. Cần cài dependency riêng trong `client/` và `server/`.

## 1. Phần mềm cần cài

### Bắt buộc

1. Git.
2. Node.js `20.19+` hoặc `22.12+`.
3. npm (được cài cùng Node.js).
4. MongoDB Community Server hoặc một MongoDB deployment tương thích.
5. MongoDB Shell (`mongosh`) và thêm `mongosh` vào `PATH`.

Có thể cài thêm MongoDB Compass để xem dữ liệu bằng giao diện, nhưng Compass không thay thế MongoDB Server hay `mongosh`.

Kiểm tra sau khi cài:

```bash
git --version
node --version
npm --version
mongosh --version
```

## 2. Clone repository

```bash
git clone <repository-url>
cd project
```

Nếu đã clone từ trước:

```bash
git pull
```

## 3. Cài dependency

Từ thư mục gốc của repository:

```bash
cd server
npm ci
cd ../client
npm ci
cd ..
```

`npm ci` sử dụng chính xác phiên bản trong `package-lock.json`. Chỉ dùng `npm install` khi chủ động thêm hoặc cập nhật package.

## 4. Khởi động MongoDB

Đảm bảo MongoDB Server đang chạy trước khi bootstrap database.

Kiểm tra nhanh:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

Nếu nhận được `ok: 1`, MongoDB đã sẵn sàng. Nếu nhận `ECONNREFUSED`, hãy khởi động MongoDB service trước.

## 5. Tạo database, validator và index

Tên database local của dự án là:

```text
cinema_management
```

Các script bootstrap là idempotent: có thể chạy lại mà không cần xóa database.

### Windows

Từ thư mục gốc repository:

```powershell
cd docs\ref\cinema_management_empty_db
.\setup_empty_db.bat
cd ..\..\..
```

Hoặc chạy thủ công:

```powershell
mongosh --file docs/ref/cinema_management_empty_db/create_empty_db.js
mongosh --file docs/ref/cinema_management_empty_db/create_indexes.js
```

### macOS/Linux

Từ thư mục gốc repository:

```bash
cd docs/ref/cinema_management_empty_db
bash setup_empty_db.sh
cd ../../..
```

Hoặc chạy thủ công:

```bash
mongosh --file docs/ref/cinema_management_empty_db/create_empty_db.js
mongosh --file docs/ref/cinema_management_empty_db/create_indexes.js
```

Bootstrap tạo các collection rỗng, MongoDB validators và index. Nó không tạo Role/Permission cần thiết cho Register.

## 6. Seed Role và Permission

Public Register bắt buộc database phải có role `CUSTOMER`. Chạy script sau từ thư mục gốc:

```bash
mongosh --file docs/ref/seedDataRegister.js
```

Script sẽ upsert:

- Các permission hệ thống.
- Các role `CUSTOMER`, `STAFF`, `MANAGER`, `ADMIN`.
- Permission tương ứng cho từng role.
- Collection/index cho email verification nếu chưa tồn tại.

Script có thể chạy lại an toàn.

Kiểm tra kết quả:

```bash
mongosh --eval "db.getSiblingDB('cinema_management').roles.find({}, { name: 1 }).toArray()"
mongosh --eval "db.getSiblingDB('cinema_management').permissions.countDocuments({})"
mongosh --eval "db.getSiblingDB('cinema_management').email_verifications.getIndexes()"
```

Kết quả đầu tiên phải có role `CUSTOMER`.

## 7. Cấu hình backend

Không sửa và không điền secret vào `server/.env.example`. Mỗi thành viên phải tạo file `server/.env` riêng.

### Windows PowerShell

```powershell
Copy-Item server/.env.example server/.env
```

### macOS/Linux

```bash
cp server/.env.example server/.env
```

Mở `server/.env` và cấu hình:

```env
PORT=5000

MONGODB_URI=mongodb://localhost:27017/cinema_management

JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-another-long-random-secret

CLIENT_URL=http://localhost:5173

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-sender@gmail.com
EMAIL_PASS=your-16-character-app-password
EMAIL_FROM=F-Cinema <your-sender@gmail.com>
```

Tạo JWT secret bằng Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Chạy lệnh hai lần để tạo hai giá trị khác nhau cho `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`.

### Cấu hình Gmail gửi OTP

Nếu sử dụng Gmail:

1. Bật xác minh hai bước cho tài khoản Google gửi mail.
2. Mở `https://myaccount.google.com/apppasswords`.
3. Tạo App Password, ví dụ đặt tên `F-Cinema Local`.
4. Google cấp mật khẩu 16 ký tự.
5. Điền mật khẩu đó vào `EMAIL_PASS`; không dùng mật khẩu Gmail thông thường.
6. Nếu Google hiển thị App Password có khoảng trắng, hãy bỏ khoảng trắng khi điền vào `.env`.

Mỗi thành viên nên sử dụng App Password của tài khoản gửi mail do nhóm thống nhất. Không gửi App Password qua chat, không ghi vào tài liệu và không commit lên Git.

Nếu sử dụng SMTP khác Gmail, thay `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` và `EMAIL_FROM` theo tài liệu của nhà cung cấp.

Sau mỗi lần thay đổi `.env`, phải dừng và chạy lại backend. Nodemon không đảm bảo tự reload khi `.env` thay đổi.

## 8. Cấu hình frontend

### Windows PowerShell

```powershell
Copy-Item client/.env.example client/.env
```

### macOS/Linux

```bash
cp client/.env.example client/.env
```

Nội dung mặc định:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Sau khi thay đổi `client/.env`, cần restart Vite dev server.

## 9. Chạy dự án

Mở hai terminal tại thư mục gốc repository.

### Terminal 1 — Backend

```bash
cd server
npm run dev
```

Backend hợp lệ sẽ hiển thị tương tự:

```text
MongoDB connected
Server running on port 5000
```

### Terminal 2 — Frontend

```bash
cd client
npm run dev
```

Mở trình duyệt:

```text
http://localhost:5173
```

Các route Auth:

- Login: `http://localhost:5173/login`
- Register: `http://localhost:5173/register`
- Verify email: `http://localhost:5173/verify-email`

## 10. Kiểm tra nhanh sau khi setup

### Kiểm tra backend health

Trình duyệt hoặc curl:

```bash
curl http://localhost:5000/api/health
```

Kết quả mong đợi:

```json
{
  "success": true,
  "message": "Server is running"
}
```

### Kiểm tra Register

1. Mở `/register`.
2. Nhập email nhận mail thật.
3. Submit form.
4. Kiểm tra Inbox và Spam của email đăng ký.
5. Nhập OTP 6 chữ số trong vòng 5 phút.
6. Sau khi verify thành công, đăng nhập bằng email hoặc username.

## 11. Lint, build và test

### Frontend

```bash
cd client
npm run lint
npm run build
```

### Backend Auth

```bash
cd server
npm run lint:auth
npm test
```

Integration test sử dụng database tạm `cinema_management_register_test`, tự tạo dữ liệu test và drop database này sau khi chạy. Không đổi tên database test thành `cinema_management`.

## 12. MongoDB Atlas thay cho MongoDB local

Nếu nhóm sử dụng Atlas:

1. Tạo cluster và database user.
2. Cho phép IP của máy phát triển truy cập cluster.
3. Đặt `MONGODB_URI` trong `server/.env` bằng connection string Atlas và database `cinema_management`.
4. Chạy bootstrap/seed với connection string có quyền tạo collection/index:

```bash
mongosh "<atlas-connection-string>" --file docs/ref/cinema_management_empty_db/create_empty_db.js
mongosh "<atlas-connection-string>" --file docs/ref/cinema_management_empty_db/create_indexes.js
mongosh "<atlas-connection-string>" --file docs/ref/seedDataRegister.js
```

Không commit connection string chứa username/password.

## 13. Lỗi thường gặp

### `Missing required environment variables`

Backend không đọc được `MONGODB_URI`, `JWT_ACCESS_SECRET` hoặc `CLIENT_URL`.

- Kiểm tra file nằm đúng tại `server/.env`.
- Không chỉ sửa `server/.env.example`.
- Restart backend sau khi sửa.

### `Email verification service is not configured`

- Kiểm tra `EMAIL_HOST` và `EMAIL_FROM` trong `server/.env`.
- Với Gmail, kiểm tra đủ `EMAIL_USER` và `EMAIL_PASS`.
- `EMAIL_PASS` phải là Google App Password, không phải mật khẩu Gmail.
- Restart backend sau khi sửa `.env`.

### Gmail báo `Invalid login` hoặc `Username and Password not accepted`

- Bật xác minh hai bước.
- Tạo App Password mới.
- Bỏ khoảng trắng trong App Password.
- Kiểm tra `EMAIL_USER` đúng với tài khoản đã tạo App Password.

### Không nhận được OTP

- Kiểm tra Inbox, Spam/Junk và tab Promotions.
- Kiểm tra log backend có lỗi SMTP hay không.
- OTP hết hạn sau 5 phút.
- Resend có cooldown 60 giây và rate limit chống spam.

### `CUSTOMER role is not configured`

Chưa seed Role/Permission hoặc đang kết nối nhầm database:

```bash
mongosh --file docs/ref/seedDataRegister.js
```

Kiểm tra `MONGODB_URI` phải trỏ tới `cinema_management`.

### MongoDB `ECONNREFUSED`

- MongoDB Server chưa chạy.
- Sai host/port trong `MONGODB_URI`.
- Nếu dùng Atlas, kiểm tra Network Access và database user.

### Frontend gọi sai API hoặc bị CORS

- `client/.env`: `VITE_API_BASE_URL=http://localhost:5000/api`.
- `server/.env`: `CLIENT_URL=http://localhost:5173`.
- Restart cả client và server sau khi sửa env.

### Port đã được sử dụng

Đóng process đang giữ port `5000` hoặc `5173`, hoặc đổi đồng bộ `PORT`, `CLIENT_URL` và `VITE_API_BASE_URL`.

## 14. Quy tắc bảo mật khi làm việc nhóm

- Chỉ commit `.env.example`, tuyệt đối không commit `.env`.
- `.env.example` chỉ chứa placeholder, không chứa credential thật.
- Không gửi JWT secret, MongoDB URI có password hoặc App Password lên Git/chat.
- Nếu một secret từng xuất hiện trong commit, pull request hoặc chat, phải revoke/rotate secret đó; chỉ xóa khỏi file là chưa đủ.
- Trước khi commit, chạy:

```bash
git status
git diff --check
```

Đảm bảo `server/.env` và `client/.env` không xuất hiện trong danh sách file được commit.

## 15. Checklist cho thành viên mới

- [ ] Cài Git, Node.js, MongoDB Server và `mongosh`.
- [ ] Clone repository.
- [ ] Chạy `npm ci` trong `server/` và `client/`.
- [ ] Khởi động MongoDB.
- [ ] Chạy `create_empty_db.js` và `create_indexes.js`.
- [ ] Chạy `seedDataRegister.js`.
- [ ] Tạo `server/.env` từ `.env.example` và điền JWT/SMTP.
- [ ] Tạo `client/.env` từ `.env.example`.
- [ ] Chạy backend và frontend trong hai terminal.
- [ ] Kiểm tra `/api/health`.
- [ ] Test Register → OTP → Verify → Login.
- [ ] Chạy lint, build và test trước khi tạo pull request.
