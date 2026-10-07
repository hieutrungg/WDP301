# F-Cinema Repository Audit

Audit date: 2026-10-07  
Scope: repository, SRS `SRS - Group 5`, `SCREEN_FLOW.md`, `screen-flow.drawio`, setup docs, DB bootstrap/index/seed, source code và tests.  
Constraint: audit này không sửa SRS hoặc business code.

## Evidence reviewed

- Toàn bộ tracked file list và working-tree status.
- `client/` và `server/` package/config/source/test.
- `docs/Setup.md`, `docs/PROJECT_STRUCTURE.md`, screen design docs.
- `docs/ref/cinema_management_empty_db/*` gồm 23 collection placeholders, validators và indexes.
- `docs/ref/seedDataRegister.js`.
- Các tài liệu/PlantUML thiết kế đang untracked; đây là recommendation, không phải approved contract.
- Google Doc `SRS - Group 5`, revision đọc tại thời điểm audit.
- `docs/screen-flow.drawio`: đã đọc nội dung thực tế 5 page bằng parser draw.io, không chỉ dựa vào filename.

## Working tree safety

Tại thời điểm bắt đầu audit:

- Branch: `hieu/register`, tracking `origin/hieu/register`.
- Modified: `client/src/App.jsx` (thêm `closeButton` cho toaster).
- Untracked có `.codex-tmp/`, các tài liệu architecture/design và `docs/diagrams/`.
- Audit không sửa hoặc overwrite các thay đổi trên.

## Verified completed functionality

### Backend

- Express 5 app với `/api/health`, Helmet, CORS credentials, JSON parser, cookie parser, 404 và global error handler.
- Auth API được mount tại `/api/auth`.
- Register với validation server-side, bcrypt hash, duplicate email/username handling và default role `CUSTOMER`.
- Email verification OTP 6 số, expiry 5 phút, tối đa 5 lần sai, resend cooldown 60 giây và rate limiting.
- Account lifecycle `PENDING_VERIFICATION -> ACTIVE`.
- Login bằng email/username; JWT access token trong HTTP-only cookie.
- Remember Me: 7 ngày; không bật: JWT 8 giờ và browser-session cookie.
- `/auth/me`, logout và effective permission union từ role permissions + `directPermissionIds`.
- Mongoose models hiện dùng thực tế: `Account`, `Role`, `Permission`, `EmailVerification`.
- Auth E2E test kiểm tra register/OTP/activate/login/me/logout.

### Frontend

- React 19 + Vite + Tailwind foundation, public router/layout và landing page.
- Login/Register/Verify Email UI kết nối API thật.
- Axios `withCredentials: true`.
- Zustand auth state, bootstrap session qua `/auth/me`.
- `ProtectedRoute` và `PermissionRoute` tồn tại ở mức foundation.
- Common loading/error/empty primitives và auth form validation.

### Database bootstrap

- Script idempotent tạo 23 collections, Mongo validators và indexes.
- Unique indexes cho account identity/codes, `showtimeId + seatId`, branch inventory và review uniqueness.
- TTL index cho email verification.
- Seed có 4 roles (`CUSTOMER`, `STAFF`, `MANAGER`, `ADMIN`) và permission catalog.
- Physical seat nằm trong room layout; availability có collection `showtime_seats`, phù hợp invariant `Showtime + Seat`.

## Partially completed functionality

- RBAC: model, seed, effective permission serialization và frontend guard đã có; backend `permissionMiddleware.js` rỗng và chưa có server-side permission enforcement.
- Role layouts: file tồn tại nhưng `CustomerLayout`, `StaffLayout`, `ManagerLayout`, `AdminLayout` đều rỗng; router chưa mount protected surfaces.
- Movie module: folder/layer scaffold tồn tại nhưng không usable. Nhiều file rỗng; `movie.model.js` đang chứa account-like schema; `movie.controller.js` tham chiếu `authService` chưa import/định nghĩa; route không được mount.
- React Query dependency/config có nhưng `QueryProvider.jsx` rỗng và chưa được compose; current API flow dùng direct Axios calls.
- Database validators mô tả nhiều domain nhưng phần lớn field không `required`, enum/status không bị giới hạn và chưa có matching Mongoose models/service.
- Screen flow mô tả đầy đủ roadmap và role surface nhưng chủ yếu là planning asset, chưa phải runtime implementation.

## Missing functionality

- Backend `requirePermission(...)`, permission middleware và default-deny policy.
- Forgot Password / Reset Password flow.
- Role-based redirect và 403 route.
- Movie API thật, movie seed, search/filter/pagination và landing integration.
- CinemaBranch/Room/Seat/Showtime modules và APIs.
- Booking, seat hold, payment, ticket, QR, promotion, inventory, refund, reporting và admin operations.
- Backend unit/integration tests ngoài auth register flow.
- Frontend automated tests.
- Observability/logging chuẩn hóa và audit log persistence.
- Session revocation/refresh token rotation (không tự thêm trong phase này).

## Architectural risks

1. **Critical scaffold collision:** `server/src/modules/movie/movie.model.js` định nghĩa model tên `Account`. Nếu được import cùng account model, Mongoose có nguy cơ `OverwriteModelError` hoặc dùng sai schema.
2. **Authorization gap:** mọi protected API mới sẽ không an toàn nếu chỉ dựa `PermissionRoute` phía client.
3. **Schema drift:** DB bootstrap, SRS và Mongoose model chưa dùng chung enum/required/index source; có thể chấp nhận document không đáp ứng runtime assumption.
4. **Payment integrity gap:** DB có `gatewayTransactionId` nhưng chưa có unique index/idempotency record; payment-success side effects chưa có authoritative service.
5. **Seat hold ambiguity:** `showtime_seats.lockedBy/lockedUntil` tồn tại, nhưng chưa rõ `lockedBy` là account, checkout, hold hay booking ID; thiếu hold identity/status/index expiry strategy.
6. **Cross-document consistency:** booking/payment/ticket/voucher/inventory cần transaction hoặc idempotent compensation boundary chưa được approve.
7. **Loose account status:** Mongoose `status: String`; DB validator cũng không enum, trong khi auth phụ thuộc chính xác `PENDING_VERIFICATION` và `ACTIVE`.
8. **Docs authority confusion:** các tài liệu design untracked tự ghi “Architectural Decisions”, nhưng theo governance hiện tại chúng chỉ là `PROPOSED` cho đến owner approval.
9. **Client bootstrap error handling:** mọi lỗi `/auth/me`, kể cả network/5xx, đều bị diễn giải thành logged-out; chưa phân biệt unauthenticated với unavailable.
10. **No root automation:** không có root `package.json`/CI script để chạy toàn bộ lint/build/test thống nhất.

## Documentation mismatch

### Code vs initial summary

- Summary nói RBAC “mới chỉ hoàn thiện một phần” là đúng, nhưng cần nhấn mạnh `permissionMiddleware.js` hoàn toàn rỗng.
- Summary nói “Movie data landing là mock” đúng; backend movie module không phải partial API mà là invalid scaffold và chưa mount.
- Summary nói layouts chưa có; thực tế file có nhưng rỗng.

### SRS internal conflicts

- `CMS_UC43 - Export Revenue Reports` lại mô tả “Deep Movie Performance Analysis”, ranking theo Movie ID; không mô tả export.
- `CMS_UC44 - Analyze Movie Sales` lại mô tả dashboard KPI tổng quan. UC43/UC44 đang bị đảo semantic so với tên và Use Case List.
- `CMS_UC49` tham chiếu `BR-57`, `BR-58`, `BR-59`, nhưng bảng Business Rules hiện kết thúc ở `BR-56`.
- `CMS_UC19` tự động đưa paid sales vào refund queue nhưng refund policy, authority, retry/failure state chưa đủ approved.
- SRS đã có `BR-54` hold mặc định 10 phút, `BR-55` atomic all-or-nothing và `BR-56` payment idempotency; tuy nhiên owner context cho biết review mới khoảng P0-04, nên các rule này phải được coi là draft chưa approved.
- SRS deployment target Azure không xuất hiện thành deploy config/IaC trong repo.

### SRS vs screen flow

- Screen flow có seat selection và payment pending/fail/retry dưới dạng required gaps, chưa có concrete screen spec.
- Screen flow yêu cầu 403/404/500/offline, QR result variants, refund detail/review và role redirect; runtime router chưa có.
- Screen flow khẳng định “payment success creates booking and ticket atomically”, trong khi SRS UC20 nói booking confirmed sau payment nhưng transaction boundary chưa được định nghĩa.
- Screen flow có loyalty/VIP/saved payment screens sâu hơn mức rule/contract được chốt trong SRS.

### Docs vs implementation

- `README.md` ở root chỉ có title; onboarding thực tế nằm ở `docs/Setup.md`.
- `docs/PROJECT_STRUCTURE.md` liệt kê nhiều module/folder chưa tồn tại và dùng `store/` trong khi code hiện dùng `stores`/feature store pattern.
- `.env.example` có `JWT_REFRESH_SECRET`, nhưng runtime không đọc/dùng refresh token.
- Untracked design docs đề xuất Clean/Hexagonal nhiều tầng; cấu trúc hiện tại là module + optional repository đơn giản. Không nên rewrite hàng loạt chỉ để khớp design proposal.

## Existing conventions worth preserving

- ESM và double quotes ở backend; single quotes/no semicolon ở frontend theo code hiện tại.
- Feature/module-oriented structure.
- Controller chỉ map HTTP; auth business logic nằm trong service; DB calls nằm trong repository.
- Zod validation middleware ở server và form schema ở client.
- Uniform `success` boolean và `errors` array cho auth/error path.
- `AppError` + global error handler.
- HTTP-only cookie + `withCredentials` pairing.
- DB seed/bootstrap idempotent.
- Tests dùng isolated database và captured test email, không gửi SMTP thật.

## Verification result

| Check | Result | Evidence |
| --- | --- | --- |
| Client lint | PASS | `npm run lint` |
| Client build | PASS | Vite built 2,075 modules |
| Server lint | FAIL | `movie.controller.js:3` — `authService` is not defined |
| Server test | PASS | 16 tests passed, 0 failed |
| SRS read | PASS | Google Doc accessible and section text inspected |
| Screen-flow diagram read | PASS | 5 pages parsed; components and relations inspected |

Backend test pass chỉ xác nhận auth register flow hiện có; không xác nhận các module nghiệp vụ chưa implement.
