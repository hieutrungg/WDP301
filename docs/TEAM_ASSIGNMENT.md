# F-Cinema — Phân công công việc cho 5 thành viên

**Cập nhật:** 2026-10-09  
**Mục đích:** Một nơi duy nhất để mỗi thành viên biết mình làm gì, bàn giao gì, phối hợp với ai và phần nào chưa được tự quyết định.  
**Nguồn đối chiếu:** `AGENTS.md`, `docs/PROJECT_CONVENTIONS.md`, `docs/REQUIREMENTS_STATUS.md`, SRS, Screen Flow, Stitch project `12758682447811659045` và Google Sheet `F-Cinema — Team Development Plan`.

> File này chỉ cụ thể hóa cách thực hiện các task đã có. File không thay thế SRS, API contract hoặc decision đã được duyệt. Khi có mâu thuẫn, dừng phần bị ảnh hưởng và đưa về team review.

## 1. Việc team phải điền trước khi chia branch

| Mã thành viên | Tên thật | Module chính | Branch đề nghị |
| --- | --- | --- | --- |
| MEMBER_1 | **Hiếu** | Movie, public Movie UI | `feature/movie-discovery` |
| MEMBER_2 | **Nam** | CinemaBranch, Room, physical Seat | `feature/cinema-room` |
| MEMBER_3 | **Đạt** | Showtime, Reports/Analytics | `feature/showtime` |
| MEMBER_4 | **Hà** | Booking, SeatHold, Refund sau khi được duyệt | `feature/booking-core` |
| MEMBER_5 | **Cường** | Auth, RBAC, Payment, Ticket, shared API | `feature/rbac` |


## 2. Quy tắc làm việc chung

1. Mỗi người sở hữu module end-to-end, không chia cố định frontend/backend.
2. Feature branch tạo từ nhánh integration đã thống nhất và PR quay về nhánh đó.
3. Quy ước đã duyệt là `main <- develop <- feature/*`. Repository hiện có cả `develop` và `develops`; team phải chốt một nhánh integration duy nhất trước khi chia branch.
4. Không implement phần có status `BLOCKED_BY_DECISION`.
5. Không tự sửa API contract, enum, error code, ID hoặc database relationship.
6. Không import model/repository nội bộ của module khác. Tích hợp qua API hoặc exported contract/service đã thống nhất.
7. Stitch là nguồn hình ảnh giao diện; SRS và approved decisions là nguồn nghiệp vụ; Screen Flow là nguồn điều hướng.
8. Không lưu trạng thái booked trên physical `Seat`. Availability luôn thuộc `Showtime + Seat`.
9. Không sửa file shared cùng lúc trên nhiều branch. Người cần sửa phải ghi rõ trong PR và có reviewer của module bị ảnh hưởng.
10. Mỗi task phải báo cáo: changed files, behavior, API changes, DB changes, tests thực sự đã chạy, blockers và integration notes.

## 3. File shared và người tích hợp

Các file sau không thuộc quyền sửa độc lập của riêng một module:

- `server/src/app.js`
- frontend router và role layouts
- `client/src/components/common/Header.jsx`
- `package.json` và lockfile
- shared constants, error middleware và `AppError`
- DB validators, indexes và seed dùng chung
- `docs/PROJECT_CONVENTIONS.md`
- `docs/REQUIREMENTS_STATUS.md`

Quy trình sửa file shared:

1. Module owner hoàn thiện code trong thư mục module trước.
2. Ghi rõ yêu cầu mount route/import vào phần Integration Notes của PR.
3. Chỉ một người thực hiện bước tích hợp file shared trên branch integration.
4. Reviewer của module liên quan kiểm tra trước khi merge.

Trong đợt đầu, đề nghị Cường làm integration reviewer cho backend shared; Hiếu làm integration reviewer cho public frontend. Đây là cách phối hợp, không chuyển quyền sở hữu business rule.

## 4. MEMBER_1 — Movie và C01/C02

### Phạm vi sở hữu

- Movie schema, validation, repository, service, controller và public read API.
- Màn G01/C01/C02 liên quan tới public movie discovery.
- Movie fixture/seed và Movie-specific tests.

### Task trong bảng

- `MOV-001`: sửa Movie scaffold.
- `MOV-002`: Movie model, index và seed.
- `MOV-003`: `GET /api/movies`.
- `MOV-004`: `GET /api/movies/:id`.
- `MOV-005`: public Movie UI, C01/C02 và landing integration.

### Công việc phải làm

1. Nhận toàn bộ thay đổi Movie/C01 đang tồn tại trong working tree hiện tại và đưa về branch `feature/movie-discovery` mà không làm mất thay đổi Auth mới kéo về.
2. Hoàn thiện Movie lifecycle đã duyệt: `DRAFT`, `PUBLISHED`, `ARCHIVED`; public chỉ trả `PUBLISHED`; không hard-delete Movie có lịch sử.
3. Hoàn thiện Movie fields đã duyệt: title, synopsis, genres, cast, duration, releaseDate, language, director, ageRating, posterUrl, trailerUrl và status.
4. Hoàn thiện seed Movie idempotent và bảo đảm dữ liệu development có đủ ba lifecycle để test visibility.
5. Hoàn thiện API list/detail với validation, error code, response envelope và pagination meta.
6. Hoàn thiện C01 theo Stitch: danh sách, search, filter đã được contract hỗ trợ, loading, error, empty và no-result.
7. Bấm Movie Card phải đi đến `/movies/:movieId`; C02 có thể được phát triển trong cùng module nhưng không được embed Showtime như nguồn dữ liệu authoritative.
8. Thay mock trên các target view bằng Movie API thật khi API đã ổn định.
9. Viết/rà soát model, repository, route và UI integration tests.

### Được phép sửa chính

- `server/src/modules/movie/**`
- `server/src/seeds/seed-movies.js`
- `server/test/movie*.test.js`
- `client/src/features/movie-showtime/**` trong phạm vi Movie
- `client/src/pages/public/MoviesPage.jsx`
- trang Movie Detail thuộc feature Movie

### Phải phối hợp với

- **MEMBER_3:** thống nhất `MovieSummary` và trạng thái nào được phép tạo/publish Showtime.
- **MEMBER_5:** review error envelope và thay đổi shared error middleware.
- **MEMBER_4:** review navigation từ Movie sang booking/showtime; không đưa Booking rule vào Movie.

### Phần cần team chốt trước khi merge

- Đồng bộ `API-01` và `API-02` trong Sheet từ `PROPOSED` sang trạng thái được owner xác nhận.
- Chốt chính xác default/max page size và danh sách sort/filter public; code hiện tại không được tự biến lựa chọn kỹ thuật thành business approval.
- Chốt ai là người duy nhất sửa `server/src/app.js`, frontend router và Header trong đợt tích hợp.

### Không làm trong task này

- Movie review.
- Manager Movie CRUD của Phase 7.
- Promotion/Voucher.
- Showtime, Booking hoặc Payment logic.

### Hoàn thành khi

- Movie API dùng dữ liệu thật và chỉ public `PUBLISHED`.
- C01 có đủ loading/error/empty/no-result và bám Stitch.
- Landing/C01 không còn phụ thuộc Movie mock ở target views.
- Server lint, Movie tests, client lint và client build pass.
- PR nêu rõ thay đổi shared file và có reviewer tương ứng.

## 5. MEMBER_2 — CinemaBranch, Room và physical Seat

### Phạm vi sở hữu

- CinemaBranch lifecycle và public/admin contract phù hợp từng phase.
- Room, physical Seat layout và layout version.
- Inventory ở phase sau, chưa triển khai trong M0.

### Task trong bảng

- `CIN-001`: hoàn thiện Branch contract/model.
- `ROOM-001`: hoàn thiện physical Room/Seat contract.
- `ROOM-002`: Branch/Room/Seat read APIs sau khi contract sẵn sàng.
- `INV-001`: để phase sau, hiện đang blocked.

### Công việc phải làm

1. Hoàn thiện CinemaBranch với `branchName`, `address`, optional `email`, optional `hotline`, `ACTIVE/INACTIVE`.
2. Public chỉ trả Branch `ACTIVE`; không hard-delete Branch có dữ liệu lịch sử.
3. Khi làm admin mutation sau này, chặn chuyển `INACTIVE` nếu còn Showtime `PUBLISHED` trong tương lai.
4. Hoàn thiện Room thuộc đúng một Branch, có room identity, type, capacity, status và `layoutVersion`.
5. Định nghĩa physical Seat gồm row, number, type và trạng thái layout như enabled/disabled.
6. Bảo đảm physical Seat không có `isBooked`, `lockedBy` hoặc booking status.
7. Layout đã được Showtime tham chiếu không được sửa đè; thay đổi cấu trúc tạo version mới và giữ version lịch sử.
8. Duy trì seed 2 Branch, 4 Room và layout ghế idempotent.
9. Viết test cho unique identity, reference Branch, capacity/layout consistency, version rule và invariant “không có global booked state”.
10. Hoàn thiện module export để sau đó integrator mount route; không tự sửa `server/src/app.js` trong PR module.

### Được phép sửa chính

- `server/src/modules/cinema/**` hoặc module name đã được repository thống nhất.
- `server/src/modules/room/**`
- `server/src/seeds/seed-branches.js`
- `server/src/seeds/seed-rooms.js`
- test riêng cho Branch/Room/layout.
- frontend room map chỉ khi task UI tương ứng được mở.

### Phải phối hợp với

- **MEMBER_3:** bàn giao Room identity, status, capacity và `layoutVersion` cho Showtime.
- **MEMBER_4:** bàn giao immutable physical `SeatDefinition`; không nhận booking state từ MEMBER_4 vào Room.
- **MEMBER_5:** review public/protected boundary và permission khi có admin route.

### Phần cần team chốt trước khi ROOM-002 merge

- Chuyển `API-04` từ `DRAFT` sang trạng thái được duyệt.
- Chốt public Room visibility và chính xác các seat type trong M0.
- Chốt nguồn giá theo seat type; không đưa giá vào Room khi pricing source chưa được duyệt.
- Chốt normalized unique rule cho Branch name và Room name trong một Branch.

### Không làm trong M0

- Seat availability, hold hoặc booked state.
- Branch-scoped RBAC.
- Operating hours nâng cao.
- Inventory vì `INV-001` còn blocked.

### Hoàn thành khi

- Contract/model/seed/tests của Branch và Room nhất quán.
- Seed chạy lặp không tạo duplicate.
- Physical Seat không chứa booking state.
- MEMBER_3 và MEMBER_4 ký xác nhận các interface họ tiêu thụ.

## 6. MEMBER_3 — Showtime và overlap

### Phạm vi sở hữu

- Showtime lifecycle, query, scheduling và overlap rule.
- C08/C09 khi read API đã tích hợp.
- Reports/Analytics ở Phase 7 sau khi UC43/44 được sửa và duyệt.

### Task trong bảng

- `SHOW-001`: hoàn thiện Showtime contract artifact.
- `SHOW-002`: Showtime read APIs.
- `SHOW-003`: C08/C09 discovery UI.
- `SHOW-004`: overlap validation.
- `REP-001`: blocked, không implement lúc này.

### Công việc phải làm

1. Hoàn thiện Showtime model/contract với movieId, roomId, roomLayoutVersion, startAt, endAt và status.
2. Chỉ persist `DRAFT`, `PUBLISHED`, `CANCELLED`.
3. Derive `UPCOMING`, `NOW_SHOWING`, `ENDED`, `SOLD_OUT` khi đọc; không lưu các trạng thái này làm nguồn truth.
4. Lưu thời gian UTC; filter theo ngày Việt Nam bằng cách chuyển ngày `Asia/Ho_Chi_Minh` thành UTC range.
5. Manager chọn startAt; hệ thống tính endAt từ Movie duration cộng cleanup cấu hình, mặc định 15 phút.
6. Cùng Room không được overlap; được phép back-to-back khi suất sau bắt đầu đúng endAt của suất trước.
7. Publish phải dùng active Movie/Room, không overlap và snapshot `roomLayoutVersion`.
8. Published Showtime chỉ được sửa/hủy trước giờ chiếu và khi chưa có hold/giao dịch. Cancellation có bán vé tiếp tục bị chặn.
9. Viết unit/integration tests cho boundary time, overlap, back-to-back, invalid reference, timezone và derived status.
10. Sau khi Movie và Room read contract ổn định, làm API-05/API-06 và C08/C09 với loading/error/empty states.

### Được phép sửa chính

- `server/src/modules/showtime/**`
- test riêng cho Showtime/overlap.
- `client/src/features/showtime/**` hoặc tên feature được team thống nhất.
- C08/C09 sau khi `SHOW-002` sẵn sàng.

### Phải phối hợp với

- **MEMBER_1:** nhận Movie duration và schedulable/public identity contract.
- **MEMBER_2:** nhận Room active state, layoutVersion và room interval identity.
- **MEMBER_4:** bàn giao bookable Showtime state; Booking không được tự định nghĩa lại.

### Phần cần team chốt trước khi code route tích hợp

- Xác nhận `SHOW-001` đã có contract artifact và đổi trạng thái phù hợp trên Task Board.
- Chốt page limit cho Showtime nếu chưa được ghi trong contract.
- Chốt vị trí cấu hình cleanup time và người sở hữu cấu hình.
- Chốt error codes cho overlap, inactive reference và unsafe update/cancel.

### Không làm

- Cancellation với hold/booking/payment/ticket đã tồn tại.
- Refund và notification saga.
- Import Movie/Room repository nội bộ.
- Reports/Analytics khi `REP-001` còn blocked.

### Hoàn thành khi

- Contract và tests chứng minh đúng overlap/back-to-back/timezone.
- API-05/API-06 chỉ được tích hợp sau khi dependency contract sẵn sàng.
- C08/C09 dùng API thật và không chứa Booking rule.

## 7. MEMBER_4 — Booking, SeatHold và Seat Availability

### Phạm vi sở hữu

- Showtime-scoped Seat availability.
- SeatHold và Booking lifecycle.
- Refund sau khi policy được duyệt; hiện không được implement.

### Task trong bảng

- `BOOK-001`: hoàn thiện Booking/SeatHold contract và transaction plan.
- `BOOK-002`: Seat availability.
- `BOOK-003`: atomic SeatHold và expiry.
- `UI-001`: booking/payment/error screens sau khi contract/design sẵn sàng.
- `REF-001`: blocked, không implement.

### Công việc phải làm

1. Viết contract artifact cho SeatHold identity, owner/checkout identity, status, expiresAt, release và idempotency.
2. Dùng thời lượng hold cấu hình, mặc định 10 phút; UI sau này hiển thị countdown theo expiresAt của server.
3. Một `Showtime + Seat` chỉ có tối đa một active hold.
4. Giữ nhiều ghế phải all-or-nothing; một ghế lỗi thì không giữ một phần các ghế còn lại.
5. Merge physical Room layout với Showtime-scoped state để tạo availability; không sửa physical Seat.
6. Booking MVP chỉ dùng `PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`.
7. Expiry/release phải idempotent. Payment đến sau expiry không tự confirm Booking và không tạo Ticket.
8. Chốt persistence/index/cleanup topology và test strategy trong `BOOK-001` trước khi làm `BOOK-003`.
9. Viết test plan và sau đó integration/concurrency tests: cạnh tranh cùng ghế, multi-seat partial failure, expiry, release lặp, cùng seat khác Showtime và late payment.
10. Cung cấp port/contract rõ cho MEMBER_5 dùng trong Payment; MEMBER_5 không được mutate Booking internals trực tiếp.

### Được phép sửa chính

- `server/src/modules/booking/**`
- module SeatHold/showtime-seat theo cấu trúc được `BOOK-001` duyệt.
- test riêng cho availability, atomic hold và booking lifecycle.
- seat selection UI khi Room/Showtime APIs và design đã sẵn sàng.

### Phải phối hợp với

- **MEMBER_2:** nhận `SeatDefinition` và roomLayoutVersion.
- **MEMBER_3:** nhận bookable Showtime contract và lịch chiếu.
- **MEMBER_5:** thống nhất payable reference, expiry và verified payment success boundary.

### Phần cần team chốt trước khi BOOK-003

- Persistence chính xác cho SeatHold/showtime-seat.
- Unique/partial index hoặc atomic compare-and-set strategy.
- Cơ chế cleanup expiry: lazy cleanup, scheduled worker hoặc phương án khác phù hợp deployment.
- Test MongoDB có hỗ trợ replica set/transaction hay không.
- Auth requirement cho availability public và tạo hold authenticated.

### Không làm

- Payment callback logic.
- Ticket/QR issuance.
- Refund/cancellation policy.
- `Seat.isBooked` trên Room.

### Hoàn thành khi

- `BOOK-001` được owner/reviewer duyệt.
- Concurrency tests chứng minh không double hold và không partial hold.
- Expiry/release idempotent.
- Payment port đủ rõ để MEMBER_5 triển khai mà không import Booking internals.

## 8. MEMBER_5 — Auth, RBAC, Payment, Ticket và shared API

### Phạm vi sở hữu

- Auth/session behavior hiện có và account access.
- Global RBAC enforcement, role routing và shared API/error foundation.
- Payment/Ticket ở phase sau Booking.

### Task trong bảng

- `PLAT-001`: `requirePermission` backend.
- `PLAT-002`: role routing/layout sau PLAT-001.
- `QA-001`: shared contract/error/RBAC test foundation.
- `AUTH-001/002`: blocked cho đến khi reset policy được duyệt.
- `PAY-001`: Payment contract artifact sau Booking contract.
- `PAY-002/003`: blocked theo dependency.

### Công việc phải làm ngay

1. Implement `requirePermission(permissionCode)` chạy sau `requireAuth` và default-deny.
2. Không token trả 401; có identity nhưng thiếu permission trả 403; có effective permission mới đi tiếp.
3. Effective permission là union của role grants và `directPermissionIds`; không xóa direct grants và chưa thêm direct deny.
4. Protected request phải dùng account status/effective permission hiện hành để khóa account hoặc thu hồi quyền có hiệu lực ở request tiếp theo.
5. Viết route/integration tests cho no token, missing permission, role permission, direct permission, inactive account và revoked permission.
6. Chuẩn bị test helpers dùng test database tách khỏi Atlas development.
7. Sau khi PLAT-001 ổn định mới làm PLAT-002 với redirect priority `ADMIN > MANAGER > STAFF > CUSTOMER` và trang 403.
8. Không sửa Header/router cho đến khi MEMBER_1 commit/merge phần Movie đang dở; sau đó chỉ một integrator xử lý conflict.

### Công việc phase sau

1. Cùng MEMBER_4 hoàn thiện `PAY-001`.
2. Implement deterministic mock payment, unique provider reference và processing key/state.
3. Duplicate callback không được lặp side effect.
4. Chỉ phát hành Ticket đúng một lần sau verified successful Booking/Payment.
5. Late success chuyển `REFUND_REQUIRED/REVIEW_REQUIRED`, không confirm Booking và không tạo Ticket.

### Được phép sửa chính

- `server/src/modules/auth/**`
- `server/src/modules/account/**`
- `server/src/modules/role-permission/**`
- RBAC/auth middleware và tests.
- Payment/Ticket modules khi dependency đã sẵn sàng.
- shared API/error chỉ khi ghi rõ consumer, migration impact và reviewer.

### Phải phối hợp với

- **MEMBER_1:** review shared error/API thay đổi và frontend integration conflict.
- **MEMBER_2:** permission cho Branch/Room admin ở phase sau.
- **MEMBER_4:** Booking-Payment transaction boundary và Ticket issuance.

### Phần cần team chốt

- Test database URI và cleanup strategy an toàn.
- CSRF/cookie policy khi frontend và backend deploy khác origin.
- Forgot/reset password single-use/rate-limit/session behavior trước AUTH-002.
- Branch-scoped RBAC trước Staff/Manager/Admin operations theo branch.
- Payment persistence/state enum trong PAY-001 trước PAY-002.

### Không làm ngay

- Forgot/reset password implementation khi AUTH-001 chưa duyệt.
- Payment trước BOOK-001/BOOK-003.
- Real gateway.
- Branch-scoped RBAC.
- Thay business permission rule của module khác.

### Hoàn thành PLAT-001 khi

- `requirePermission` có test 401/403/success.
- Direct grants và role grants đều được test.
- Account inactive/revoked permission không vượt qua protected route.
- Không dựa vào frontend guard làm security boundary.

## 9. Dependency và thứ tự bàn giao

```text
MEMBER_1: Movie contract/API -----------+
                                         +--> MEMBER_3: Showtime API/UI
MEMBER_2: Branch/Room/Layout contract --+                 |
                                                           v
                                               MEMBER_4: Availability/Hold/Booking
                                                           |
                                                           v
MEMBER_5: RBAC -------------------------------> Payment/Ticket integration
```

Các điểm bàn giao bắt buộc:

| Provider | Consumer | Nội dung bàn giao | Điều kiện consumer được bắt đầu |
| --- | --- | --- | --- |
| MEMBER_1 | MEMBER_3 | Movie ID, duration, public/schedulable status | Movie contract + tests ổn định |
| MEMBER_2 | MEMBER_3 | Room ID, active status, layoutVersion, capacity | ROOM-001 được review |
| MEMBER_2 | MEMBER_4 | Immutable physical SeatDefinition | ROOM-001 được review |
| MEMBER_3 | MEMBER_4 | Bookable Showtime state và interval | SHOW-001/002 ổn định |
| MEMBER_4 | MEMBER_5 | Booking payable reference, hold expiry, success port | BOOK-001/003 ổn định |
| MEMBER_5 | Tất cả | `requirePermission`, error envelope và test helpers | PLAT-001/QA-001 ổn định |

## 10. Việc có thể chạy song song ngay

- MEMBER_1: hoàn thiện Movie/C01 đang dở.
- MEMBER_2: hoàn thiện CIN-001 và ROOM-001, seed/model/tests; chưa mount route.
- MEMBER_3: hoàn thiện SHOW-001 và pure overlap/timezone tests; chưa tích hợp Movie/Room repository.
- MEMBER_4: hoàn thiện BOOK-001 contract, index/cleanup proposal và concurrency test plan; chưa viết DB workflow phụ thuộc Room/Showtime.
- MEMBER_5: thực hiện PLAT-001 và QA test helpers; chưa sửa Header/router.

## 11. Các quyết định cần chốt trong buổi họp team gần nhất

| Mức độ | Cần chốt | Người quyết định/review | Task bị ảnh hưởng |
| --- | --- | --- | --- |
| Bắt buộc trước khi chia branch | Mapping tên thật vào MEMBER_1–5 | Project Owner | Tất cả |
| Bắt buộc trước khi chia branch | Dùng `develop` hay `develops`; đề nghị chuẩn hóa về `develop` theo convention | Cả team/Owner | Tất cả PR |
| Bắt buộc trước khi merge Movie | Đồng bộ API-01/API-02 và MOV-002…005 với quyết định Movie đã duyệt; page limit/sort/filter cụ thể | Owner + MEMBER_1 | Movie/C01/C02 |
| Bắt buộc trước ROOM-002 | API-04 visibility, seat type và unique naming | Owner + MEMBER_2 + consumers | Room/Showtime/Booking |
| Bắt buộc trước SHOW-002/004 | Cleanup config location, page limit và error codes | MEMBER_3 + reviewers | Showtime |
| Bắt buộc trước BOOK-003 | Hold persistence, atomic index, cleanup topology và transaction-capable test DB | MEMBER_4 + MEMBER_5 | Booking |
| Bắt buộc trước full test gate | Test DB riêng; xử lý lỗi DNS/Atlas trong E2E | MEMBER_5 + team | Auth/Profile/Movie integration |
| Bắt buộc trước integration | Ai được sửa `app.js`, router và Header trong từng PR | Integration owner | Movie/RBAC/Room/Showtime |

Các phần vẫn bị chặn và không được đưa vào sprint code hiện tại: Refund, cancel Showtime có giao dịch, Voucher, Inventory, Staff Shift, Reports UC43/44, real payment gateway và branch-scoped RBAC.

## 12. Trạng thái repository tại thời điểm lập bảng

- Working tree đang có nhiều thay đổi Movie/C01 chưa commit, bao gồm cả `server/src/app.js`, frontend router, Header và shared error handling.
- Các thay đổi này phải được MEMBER_1 nhận ownership, review cùng MEMBER_5 ở phần shared, sau đó commit/PR riêng trước khi người khác sửa cùng file.
- Seed development đã có 6 Movie, 2 Branch và 4 Room trên database development được kiểm tra gần nhất.
- Client lint: pass.
- Client build: pass, có cảnh báo bundle lớn nhưng không làm build fail.
- Server lint: pass.
- Server test: 11 pass, 4 fail do không resolve/kết nối được MongoDB Atlas trong các E2E Auth/Profile; không được báo toàn bộ server tests pass.

## 13. Definition of Done áp dụng cho từng người

Một task chỉ chuyển sang `DONE` khi:

1. Acceptance criteria hoàn tất.
2. Không implement phần đang blocked.
3. Lint/build/relevant tests đã thực sự chạy và kết quả được ghi đúng.
4. API/DB/shared contract change có owner, consumer, migration impact và approval status.
5. Loading/error/empty state có trên data screen liên quan.
6. Không còn mock nếu task yêu cầu API thật.
7. Không có thay đổi unrelated hoặc ghi đè code chưa commit của người khác.
8. PR được reviewer chỉ định kiểm tra và merge vào nhánh integration đã thống nhất.

## 14. Mẫu báo cáo cuối task

```md
Task ID:
Owner:
Reviewer:

Changed files:
-

Implemented behavior:
-

API changes:
- None / mô tả chi tiết

Database changes:
- None / collection, field, index, migration/seed

Tests run và kết quả thực tế:
-

Blockers:
- None / mô tả decision hoặc dependency

Integration notes:
- Route cần mount
- Shared file cần integrator sửa
- Consumer cần cập nhật
```

