# Báo cáo phân tích và đề xuất cải tiến thiết kế SDS – F-Cinema

## 1. Mục đích tài liệu

Tài liệu này tập hợp kết quả đọc, đối chiếu và phân tích project `SDS - G5 - V1` với repository F-Cinema hiện tại. Mục tiêu là cung cấp một tài liệu tự chứa, có thể tải lên hoặc đưa trực tiếp cho ChatGPT web để tiếp tục thảo luận, phản biện hoặc lập kế hoạch thiết kế.

Đây chỉ là báo cáo phân tích và đề xuất. Báo cáo không tự thay đổi business requirement, API contract, database relationship, enum, error code hoặc approval status. Những nội dung chưa được Project Owner duyệt vẫn phải được xem là đề xuất hoặc blocker.

## 2. Phạm vi và nguồn đã đối chiếu

### 2.1. Tài liệu trên Google Drive

- `SDS - G5 - V1.docx`.
- `F-Cinema — Team Development Plan`, bao gồm roadmap, task board, module ownership, dependency map, contract registry, decision log và test matrix.

### 2.2. Tài liệu trong repository

- `AGENTS.md`.
- `docs/PROJECT_CONVENTIONS.md`.
- `docs/REQUIREMENTS_STATUS.md`.
- `docs/DESIGN-REVIEW-SUMMARY.md`.
- `docs/1.1-software-architecture.md`.
- `docs/1.2-package-diagram.md`.
- `docs/SCREEN_FLOW.md`.
- `docs/diagrams/*.puml`.
- `docs/diagrams/class/*.puml`.
- `docs/3-detailed-design/*.md`.
- Database bootstrap và index trong `docs/ref/cinema_management_empty_db`.
- Source code hiện tại trong `server/src` và `client/src` khi cần xác minh.

### 2.3. Trạng thái source code được xác minh

Source hiện tại mới có implementation đáng kể cho:

- Authentication và account cơ bản.
- Account profile.
- Role/Permission model và role lookup cơ bản.
- Movie module đang được phát triển.
- Frontend auth/account/public movie foundation.

Các module Booking, SeatHold, Showtime runtime availability, Payment, Ticket, Refund, Inventory, Voucher và Analytics chưa có implementation tương ứng trong `server/src`. Vì vậy, các nhận xét về `BookingServiceImpl`, `RefundServiceImpl`, `AnalyticsService`, `InventoryServiceImpl` và các repository liên quan là đánh giá thiết kế trong SDS/diagram, không phải kết luận rằng source hiện tại đã chứa các service đó.

Workspace cũng đang có nhiều thay đổi chưa commit từ các công việc khác. Báo cáo này không sửa hoặc ghi đè các thay đổi đó.

## 3. Kết luận tổng quan

SDS hiện tại chưa thể dùng trực tiếp làm thiết kế implementation mà không chỉnh lý, vì các lý do sau:

1. SDS mâu thuẫn công nghệ trong cùng tài liệu: phần architecture nói Spring Boot, MySQL và JPA; phần component/database lại nói Express, MongoDB và Mongoose.
2. Database section của SDS tương đối gần với MongoDB hiện tại, nhưng class diagram và sequence diagram vẫn mang tư duy relational, dùng `ServiceImpl`, join entity và `JpaRepository`.
3. Nhiều service trong diagram gộp quá nhiều use case, repository và consistency boundary.
4. Các luồng nhạy cảm với concurrency/idempotency chưa đủ rõ: giữ ghế, callback thanh toán, phát hành Ticket, voucher, refund, QR scan và inventory.
5. Các diagram thay thế trong repository hợp lý hơn, nhưng không được mặc định tất cả đã được duyệt. Cần đối chiếu từng nội dung với decision log và `REQUIREMENTS_STATUS.md`.
6. Kiến trúc phù hợp nhất là modular monolith thực dụng. Không cần chuyển sang microservice, CQRS đầy đủ, event sourcing hoặc thay đổi công nghệ.

Một điểm đã lỗi thời trong `docs/DESIGN-REVIEW-SUMMARY.md`: phần Governance Blocker nói `PROJECT_CONVENTIONS.md` và `REQUIREMENTS_STATUS.md` không tồn tại. Hai file này hiện đã tồn tại và chứa nhiều quyết định đã được Owner duyệt. Không nên tiếp tục dùng kết luận cũ đó như blocker hiện hành.

## 4. Trạng thái quyết định quan trọng

### 4.1. Đã được Project Owner duyệt

- Kiến trúc modular monolith thực dụng; repository là optional, không áp Clean/Hexagonal đầy đủ một cách máy móc.
- Effective permission là hợp của quyền từ tất cả Role và `Account.directPermissionIds`.
- Chưa có direct deny và không được xoá `directPermissionIds`.
- Backend dùng account status và effective permissions hiện hành; thay đổi quyền hoặc khoá account có hiệu lực ở protected request kế tiếp.
- Backend RBAC là security boundary; frontend guard chỉ hỗ trợ UX/navigation.
- Physical Seat chỉ mô tả layout. Availability luôn thuộc `Showtime + Seat`.
- Room layout đã được Showtime tham chiếu không được sửa đè; thay đổi tạo layout version mới.
- SeatHold mặc định 10 phút, lấy từ cấu hình.
- Dùng SeatHold riêng có owner/checkout identity.
- Mỗi ghế trong một Showtime chỉ có tối đa một hold còn hiệu lực.
- Giữ nhiều ghế phải all-or-nothing.
- Booking MVP dùng `PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`.
- Payment success sau hold/booking expiry không tự confirm Booking và không tạo Ticket; chuyển `REFUND_REQUIRED` hoặc `REVIEW_REQUIRED`.
- Payment idempotency dùng cả unique provider reference và processing key/state.
- Callback lặp không được lặp side effect.
- Ticket chỉ được tạo đúng một lần sau authoritative confirmed Booking/Payment.
- Payment provider-neutral với deterministic mock trước; gateway thật để sau.

### 4.2. Chưa được duyệt hoặc đang bị chặn

- Refund cutoff, số tiền refund, full/partial refund, gateway fee.
- Ai có quyền approve/process refund và branch scope.
- Thời điểm huỷ Booking, vô hiệu hoá Ticket và release ghế trong refund flow.
- Refund cho Ticket đã checked-in.
- Sellable unit hay ingredient/recipe cho Inventory.
- Combo trừ stock theo combo, concession item hay nguyên liệu.
- Voucher stacking, reservation, consumption và release.
- Cart/order boundary giữa ticket và concession.
- Real payment provider và signature/reconciliation protocol.
- Branch-scoped RBAC.
- Logout/session revocation strategy.

## 5. Bảng đối chiếu SDS, thiết kế và source hiện tại

| SDS section/diagram | Class/service được mô tả | Source hiện tại | Vấn đề | Rủi ro | Giải pháp đề xuất |
| --- | --- | --- | --- | --- | --- |
| 1.1 Architecture | React → Spring Boot → MySQL; component table lại dùng Express/Mongo | `server/src/app.js`, conventions | Hai stack mâu thuẫn; JPA không tồn tại | Cao | Chuẩn hoá toàn bộ architecture theo React–Express–Mongoose–MongoDB |
| 1.2 Backend Package | Global controller/service/repository/entity | Source dùng `server/src/modules/<module>` | Khuyến khích mọi service gọi mọi repository | Cao | Giữ module dọc; cross-module qua exported service/port |
| 2.1–2.2 Account/Role/Permission | Account có role/direct permission, Role có permissions | Model hiện tại có đủ các field này | DB section đúng nhưng class/sequence RBAC không đồng bộ | Cao | Bổ sung effective-permission query và protected-request sequence |
| 3.1 Authentication/Login | Login kiểm tra role/access | `/auth/me` đã union permission | Protected middleware chưa reload current permission/status | Cao | `requireAuth` + current authorization query + `requirePermission` |
| 3.4 Role & Permission | Role–RolePermission–Permission | Mongo Role chứa `permissionIds`; Account chứa `roleIds` | Thiếu Account/direct grants; relational join thừa | Cao | Role aggregate chứa permission IDs; Account giữ direct grants |
| 3.3 Online Booking | `BookingServiceImpl` khoảng 12 repository | Chưa có booking source | Gộp discovery, hold, order, payment, cancellation, history, ticket | Rất cao | Tách use case cụ thể và dùng cross-module ports |
| Room/ShowtimeSeat | Room seats + `lockedBy/lockedUntil` | Chỉ có DB bootstrap | Thiếu group hold, token, request key, multi-seat atomicity | Rất cao | Dedicated SeatHold + canonical ShowtimeSeat + transaction |
| Payment Gateway | Payment/callback/timeout | Chưa có payment source | Thiếu verification, event ID, processing state, unique provider reference | Rất cao | Verified webhook + inbox/idempotency record + CAS |
| Cancellation/Refund | RefundRequest/RefundServiceImpl | Chưa có refund source | Thiếu Booking/Payment dependencies và partial-failure model | Rất cao | Request/process use cases + state machine; chờ policy approval |
| Inventory | BranchInventory + StockTransaction | Chỉ có DB bootstrap | Quantity update và ledger insert riêng | Rất cao | Atomic mutation + immutable movement + idempotency key |
| Analytics | AnalyticsService đọc nhiều repository | Chưa có analytics source | N+1 và metric definition không đồng nhất | Trung bình–cao | Một AnalyticsReadPort với Mongo aggregation/projection |
| Movie Exploration | Movie/Genre/Showtime/Booking/Review repositories | Source mới có Movie | Truy cập trực tiếp repository module khác | Trung bình | Catalog query + ReviewEligibilityPort |
| Showtime commands | Có TicketRepository | Chưa có showtime source | Scheduling biết persistence nội bộ Ticket | Cao | Thay bằng `SalesStatusPort` |

## 6. Account, Role và Permission

### 6.1. Mô hình dữ liệu đã xác minh

Account hiện có:

- `roleIds`.
- `directPermissionIds`.
- `status`.

Role hiện có:

- `permissionIds`.

Effective permissions đã được duyệt:

```text
effectivePermissions(account)
  = union(
      permissions of every role in account.roleIds,
      account.directPermissionIds
    )
```

Không có direct deny. Nếu một permission xuất hiện từ nhiều nguồn thì deduplicate theo Permission ID hoặc stable permission code.

### 6.2. Diagram SDS chưa thể hiện đầy đủ direct permissions

- Role & Permission class diagram chỉ mô tả Role, RolePermission và Permission.
- Create Role, Update Role và Assign Permission sequences chỉ mô tả Role mutation.
- Authentication/login diagram không thể hiện cách hợp quyền từ Role và direct grants.
- Staff Management dùng `AccountRole` và Role assignment kiểu relational, không phản ánh MongoDB Account hiện tại.
- Frontend security diagram không nêu rõ frontend phải nhận effective permission do backend tính.

Database/collection section của SDS có `directPermissionIds`, nên vấn đề chính là inconsistency giữa database design và class/sequence design, không phải dữ liệu hoàn toàn bị thiếu trong SDS.

### 6.3. Lỗi có thể phát sinh nếu code theo diagram cũ

- Account có direct grant hợp lệ nhưng bị trả `403`.
- Account bị thu hồi quyền Role nhưng JWT cũ vẫn giữ permission snapshot.
- Account bị `DISABLED` nhưng vẫn gọi protected API đến khi token hết hạn.
- Frontend và backend tính permission theo hai cách khác nhau.
- Developer xoá `directPermissionIds` hoặc migrate sang join collection, làm mất dữ liệu hoặc break API.
- Role permission thay đổi nhưng chỉ có hiệu lực sau lần đăng nhập tiếp theo.

### 6.4. Class diagram đề xuất

```text
Account
  id
  roleIds: Set<RoleId>
  directPermissionIds: Set<PermissionId>
  status: AccountStatus

Role
  id
  permissionIds: Set<PermissionId>

Permission
  id
  code
  description

CurrentAuthorizationQuery
  loadPrincipal(accountId): AuthorizationPrincipal

AuthorizationPrincipal
  accountId
  status
  roles
  effectivePermissions
```

Role management có thể tiếp tục tập trung vào Role aggregate. Tuy nhiên diagram phải có note rằng Role diagram không phải toàn bộ authorization model và không thay thế direct grants trên Account.

### 6.5. Protected-request sequence đề xuất

```text
Client
  -> requireAuth
       verify JWT
       extract accountId only
  -> CurrentAuthorizationQuery
       load current Account
       reject if missing/disabled
       load Role.permissionIds
       load Account.directPermissionIds
       union + deduplicate
  -> requirePermission(requiredCode)
       default deny
  -> Controller
  -> Application use case
```

`requireAuth` chỉ xác minh identity. `requirePermission` mới chịu trách nhiệm authorization. Không nên dùng role name hoặc permission snapshot trong JWT làm nguồn quyết định cuối cùng.

### 6.6. Có cần thay đổi database không?

Không cần thay đổi database chỉ để tính effective permissions. Các field cần thiết đã tồn tại. Cần sửa cách mô tả và cách protected middleware đọc dữ liệu.

Nếu sau này cần cache, cache phải có authorization version hoặc invalidation rõ ràng. Với quy mô hiện tại, load từ MongoDB ở mỗi protected request là lựa chọn nhỏ và an toàn nhất.

### 6.7. Test cần có

- Permission chỉ đến từ Role.
- Permission chỉ đến từ `directPermissionIds`.
- Permission trùng ở nhiều Role/direct grant chỉ xuất hiện một lần.
- Không có token trả `401`.
- Có token nhưng thiếu permission trả `403`.
- Account vừa bị khoá bị chặn ở request kế tiếp.
- Role vừa bị thu hồi permission bị chặn ở request kế tiếp.
- Frontend guard bị bypass nhưng backend vẫn chặn.

## 7. Giữ ghế và hai yêu cầu đồng thời

### 7.1. Dữ liệu thuộc Room/physical Seat

- Seat ID ổn định trong layout version.
- Row, number, type.
- Enabled/disabled hoặc physical/configuration status.
- Room layout version.
- Capacity được tính từ enabled seats.

Physical Seat không có `isBooked`, `heldBy` hoặc customer owner. Không được lưu trạng thái booked toàn cục trên Room seat.

### 7.2. Dữ liệu thuộc Showtime + Seat

- `showtimeId`.
- `seatId`.
- Runtime state: `AVAILABLE`, `HELD`, `BOOKED` hoặc trạng thái tương đương đã được contract hoá.
- `holdId` khi đang giữ.
- `holdOwnerId`/checkout identity.
- `holdExpiresAt`.
- `bookingId` sau khi confirm.

### 7.3. SeatHold group aggregate

```text
SeatHold
  holdId
  showtimeId
  seatIds[]
  ownerAccountId/checkoutId
  holdToken hoặc proof phù hợp
  requestKey
  status
  expiresAt
  bookingId?
  createdAt
  updatedAt
```

`SeatHold` nhóm nhiều seat để hỗ trợ all-or-nothing và một countdown chung. `showtime_seats` vẫn là canonical availability cho từng seat.

### 7.4. Atomic conditional update cho một ghế

Repository chỉ update khi:

```text
showtimeId == requestedShowtime
seatId == requestedSeat
AND (
  status == AVAILABLE
  OR status == HELD AND holdExpiresAt <= now
)
```

Update đặt:

```text
status = HELD
holdId = newHoldId
holdOwnerId = owner
holdExpiresAt = requestedExpiry
```

Hai request đồng thời chỉ một request match được điều kiện.

### 7.5. Giữ nhiều ghế all-or-nothing

Với một document cho mỗi ShowtimeSeat, quy trình nên chạy trong MongoDB transaction:

1. Claim idempotency/request key.
2. Tạo SeatHold ID.
3. Conditional-update tất cả seat yêu cầu.
4. Kiểm tra số seat update bằng số seat yêu cầu.
5. Nếu thiếu một seat, abort transaction.
6. Nếu đủ, persist SeatHold `ACTIVE`.
7. Commit.

Nếu deployment không hỗ trợ replica set/transaction, phương án thay thế thực sự atomic là một availability document cho cả showtime và một conditional update kiểm tra toàn bộ seat. Phương án này có trade-off về hotspot và document complexity. Update tuần tự rồi compensation không đáp ứng nghiêm ngặt all-or-nothing vì partial state có thể lộ ra.

### 7.6. Unique và partial index

- Giữ unique `(showtimeId, seatId)` trên canonical `showtime_seats`.
- Index này bảo đảm chỉ có một state row, nhưng không thay thế conditional update.
- Nếu tạo per-seat hold documents riêng, partial unique với `status: ACTIVE` có thể hỗ trợ, nhưng expiry theo thời gian không tự làm document rời index.
- Không nên dựa vào TTL để quyết định một seat có đang available hay không.

### 7.7. Expiry và release

- Mọi read/acquire phải coi `expiresAt <= now` là expired ngay cả khi cleanup job chưa chạy.
- Request mới được atomically takeover hold đã hết hạn.
- Cleanup job chỉ làm vệ sinh/trạng thái, không là nguồn correctness.
- Release chỉ update seat có cùng `holdId`.
- Hold cũ không được release seat đã được một hold mới chiếm lại.
- Confirm phải kiểm tra hold ID, owner, expiry và Booking.
- Confirm, release và expire đều idempotent.

### 7.8. Test concurrency cần có

- Hai khách cùng giữ một ghế.
- Hai request `{A1,A2}` và `{A2,A3}` chạy đồng thời.
- Request thua không được giữ một phần.
- Retry cùng request key trả cùng SeatHold.
- Hold hết hạn đúng lúc Booking được tạo.
- Confirm và expiry job chạy đồng thời.
- Release cũ chạy sau khi seat đã được hold lại.
- Transaction abort giữa seat thứ N.
- Cleanup/TTL chạy trễ.
- Booking confirm hai lần.
- Counter booking và online booking tranh cùng ghế.

### 7.9. Diagram SDS bị ảnh hưởng

- Online Booking Ticket class diagram.
- Book Ticket Online sequence.
- Sell Tickets at Counter sequence.
- Room/Branch class diagram.
- ShowtimeSeat/Booking database diagram.
- Booking state machine.

Các diagram hiện có `lockedBy/lockedUntil`, nhưng chưa biểu diễn đầy đủ group owner/token/request key, multi-seat transaction và stale-release protection.

## 8. Callback thanh toán gửi lặp

### 8.1. Nguồn xác nhận thanh toán

Browser redirect không phải bằng chứng thanh toán thành công. Redirect chỉ đưa user về UI. UI phải query trạng thái Payment từ backend.

Authoritative success chỉ đến từ:

- Verified webhook/callback; hoặc
- Server-to-server provider query/reconciliation được xác minh.

### 8.2. Xác minh callback

Gateway adapter phải kiểm tra:

- Chữ ký trên raw body/headers theo provider.
- Timestamp và replay window nếu provider hỗ trợ.
- Merchant/account identity.
- Provider event/transaction identity.
- Amount, currency và payable reference so với Payment nội bộ.

Với gateway thật, callback route phải bảo toàn raw request bytes trước khi JSON parsing nếu signature protocol yêu cầu.

### 8.3. Idempotent callback flow

```text
Webhook Controller
  -> PaymentGatewayPort.verifyWebhook(raw envelope)
  -> claim unique provider event ID / processing key
  -> load Payment by provider reference
  -> validate amount/payable
  -> conditional Payment transition
  -> authoritative CompletePayment use case
       confirm Booking once
       confirm SeatHold once
       confirm Voucher reservation once
       confirm Inventory reservation once
       issue Ticket once
  -> mark event PROCESSED
  -> return current state
```

### 8.4. Idempotency nhiều lớp

- Unique `(provider, eventId)` hoặc inbox processing key.
- Unique `(provider, providerTransactionReference)`.
- Booking compare-and-set `PENDING_PAYMENT -> CONFIRMED`.
- Ticket unique `(bookingId, seatId)`.
- Voucher confirmation có unique operation key.
- Inventory movement/confirmation có unique operation key.
- Notification có dedupe key nếu gửi bất đồng bộ.

Chỉ có một `processed=true` flag là chưa đủ, vì process có thể crash giữa các side effect.

### 8.5. Callback đến sau khi hold/booking hết hạn

Theo quyết định đã duyệt:

- Không reacquire ghế.
- Không confirm Booking.
- Không tạo Ticket.
- Ghi nhận Payment đã settled ở provider.
- Chuyển recovery state `REFUND_REQUIRED` hoặc `REVIEW_REQUIRED`.
- Automatic refund chưa được tự động thực hiện khi Refund policy chưa duyệt.

### 8.6. Trạng thái kỹ thuật cần lưu

Tên enum cuối cùng cần PAY-001 contract, nhưng cần biểu diễn được tối thiểu:

- Payment pending/processing/succeeded/failed/expired.
- Late success requiring refund/review.
- Webhook event received/processing/processed/failed-retryable.
- Attempt count, last error, received/processed timestamps.
- Provider reference và event ID.

### 8.7. Database gap

Payment schema hiện chỉ có `gatewayTransactionId`, method, amount, status, paidAt và gatewayResponse. Chưa có:

- `provider`.
- Unique provider reference index.
- Provider event ID/inbox.
- Processing key/state.
- Retry state.
- Unique ticket issuance index.
- Downstream operation keys.

Đây là DB design change cần được chốt trong PAY-001 trước implementation.

### 8.8. Test callback

- Cùng callback gửi nhiều lần tuần tự.
- Cùng callback chạy đồng thời.
- Hai event ID khác nhau cho cùng transaction.
- Invalid signature.
- Wrong merchant, amount hoặc currency.
- Browser redirect success nhưng webhook chưa đến.
- Handler crash sau Payment success nhưng trước Booking confirm.
- Crash sau Booking confirm nhưng trước Ticket insert.
- Duplicate callback không trừ voucher/stock hai lần.
- Late success sau expiry.
- Ticket insert conflict rồi retry.

## 9. Hoàn tiền lỗi hoặc được thử lại

### 9.1. Ranh giới requirement

Refund vẫn `BLOCKED_BY_DECISION`. Không được tự quyết định:

- Cutoff.
- Full/partial refund.
- Gateway fee.
- Approval authority.
- Checked-in behavior.
- Release timing.
- Customer/staff/manager exception policy.

Phần dưới chỉ là khung kỹ thuật để xử lý lỗi và retry an toàn.

### 9.2. Không gộp mọi thứ vào Booking status

Cần phân biệt các sự thật độc lập:

- Customer đã yêu cầu cancellation.
- Request đã được approve hay chưa.
- Ticket còn được check-in hay không.
- Gateway đã refund hay chưa.
- Local system đã ghi nhận refund hay chưa.
- Seat/voucher/inventory đã được compensation hay chưa.

### 9.3. State model khái niệm

```text
Booking
  CONFIRMED
  CANCELLATION_PENDING
  CANCELLED

RefundRequest
  REQUESTED
  APPROVED/PENDING_PROCESSING
  PROCESSING
  SUCCEEDED
  FAILED_RETRYABLE
  FAILED_FINAL
  REVIEW_REQUIRED

CompensationStep
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED_RETRYABLE
```

Tên state chính thức phải được Owner và module owners duyệt.

### 9.4. Các phương án thứ tự

#### Phương án A: Gateway refund thành công rồi mới huỷ Booking

Ưu điểm:

- Không có booking đã huỷ nhưng chưa trả tiền.

Nhược điểm:

- Trong lúc gateway retry, Ticket có thể còn dùng được.
- Cần block Ticket khi Booking đang `CANCELLATION_PENDING`.

#### Phương án B: Huỷ vận hành ngay rồi refund bất đồng bộ

Ưu điểm:

- Ngăn check-in ngay.
- Có thể release seat sớm.

Nhược điểm:

- Refund fail khiến khách mất quyền sử dụng nhưng chưa nhận tiền.
- Cần review/escalation/SLA rõ ràng.

#### Khung đề xuất

1. Validate ownership và approved policy.
2. Snapshot refund amount/reason/policy version.
3. Booking vào `CANCELLATION_PENDING`.
4. Ticket validation từ chối hoặc Ticket được block.
5. Tạo RefundRequest với stable idempotency key.
6. Gọi gateway ngoài MongoDB transaction.
7. Nếu gateway thành công, local transaction ghi refund success, complete cancellation và invalidate Ticket.
8. Chạy seat/voucher/inventory compensation idempotently.
9. Retry từng failed compensation step.
10. Không gọi refund gateway lần nữa khi provider đã refund.

Thời điểm release ghế phải do Owner quyết định.

### 9.5. Chống refund trùng

- Một business RefundRequest có một idempotency key ổn định.
- Provider refund reference unique.
- Retry sử dụng cùng provider idempotency key.
- Nếu provider timeout và kết quả không rõ, reconcile/query provider trước khi gửi lệnh mới.
- Nếu gateway đã refund nhưng local chưa ghi, callback/reconciliation hoàn tất local state, không refund lần hai.

### 9.6. Xử lý lỗi một phần

- Ticket invalidation dùng conditional transition.
- Seat release chỉ áp dụng đúng Booking/Hold owner.
- Voucher release kiểm tra redemption state.
- Inventory compensation ghi movement với unique operation key.
- Mỗi step lưu attempt, last error và next retry time.
- Refund đã thành công ở provider không được rollback; lỗi local chuyển recovery/review.

### 9.7. Test Refund

- Booking pending cancellation nhưng gateway refund fail.
- Gateway success, process crash trước local save.
- Hai retry đồng thời.
- Hai manager process cùng request.
- Ticket invalidation fail sau gateway success.
- Seat/voucher/inventory chỉ một phần thành công.
- Callback refund và reconciliation job chạy đồng thời.
- Provider báo duplicate/already refunded.
- Payment amount và refund snapshot không khớp.
- Ticket đã checked-in.

## 10. Cập nhật tồn kho đồng thời

### 10.1. Vấn đề của thiết kế hiện tại

SDS mô tả `InventoryServiceImpl` update BranchInventory rồi lưu StockTransaction bằng các thao tác riêng. Điều này có thể dẫn đến:

- Quantity thay đổi nhưng ledger chưa được ghi.
- Ledger được ghi nhưng quantity chưa đổi.
- Hai order cùng mua sản phẩm cuối cùng.
- Retry trừ/cộng stock hai lần.
- Stock-in và sale ghi đè nhau nếu dùng read-modify-save.

### 10.2. So sánh lựa chọn

| Lựa chọn | Khi phù hợp | Hạn chế |
| --- | --- | --- |
| Conditional atomic `$inc` | Một SKU, một inventory document | Không tự đảm bảo ledger document được ghi cùng lúc |
| Optimistic version | Admin adjustment hoặc aggregate có nhiều field | Caller phải retry; vẫn cần available condition |
| MongoDB transaction | Multi-SKU, reservation + ledger, confirm/release | Cần replica set; transaction phải ngắn |
| Reservation → confirm/release | Checkout/payment async | Cần expiry, idempotency và reserved quantity |
| Immutable movement ledger | Audit, reconciliation, retry detection | Không cần biến thành event sourcing; vẫn có current balance |

### 10.3. Model đề xuất

```text
InventoryItem
  branchId
  stockItemId
  onHand
  reserved
  reorderThreshold
  version

InventoryReservation
  reservationId
  orderRef
  lines[]
  status
  expiresAt

StockMovement
  movementId
  operationKey (unique)
  branchId
  stockItemId
  delta
  type
  actor/source
  occurredAt
```

Available quantity:

```text
available = onHand - reserved
```

### 10.4. Quy trình

- Reserve một SKU: atomic update nếu `onHand - reserved >= qty`.
- Reserve nhiều SKU/combo: transaction.
- Payment success: giảm `reserved`, giảm `onHand`, ghi `SALE_CONFIRMED` movement.
- Payment failure/expiry: giảm `reserved`, ghi `RESERVATION_RELEASED`.
- Stock receipt: tăng `onHand` và ghi `STOCK_RECEIVED` trong cùng transaction.
- Retry cùng `operationKey` trả kết quả đã có.

### 10.5. Database gap

Current inventories chỉ có `quantity`. Stock transactions chưa có:

- Operation key.
- Reservation/order reference.
- Version.
- Signed delta hoặc movement semantics rõ ràng.
- Unique index chống retry duplicate.

Schema chỉ được hoàn thiện sau khi Owner chốt sellable unit/ingredient/combo rule.

### 10.6. Test Inventory

- Hai order mua sản phẩm cuối cùng.
- Hai multi-line order giao nhau.
- Stock-in đồng thời với sale/reservation.
- Retry stock receipt.
- Retry payment confirmation.
- Crash giữa balance và ledger.
- Reservation expiry đồng thời payment success.
- Confirm/release đồng thời.
- Ledger reconciliation phát hiện balance lệch.
- Combo composition thay đổi sau khi order đã snapshot.

## 11. Phân tích service gọi nhiều repository

Không được dùng số lượng repository như tiêu chí duy nhất. Một service có thể cần nhiều nguồn dữ liệu hợp lý. Vấn đề xuất hiện khi service sở hữu nhiều workflow không liên quan, vượt module boundary hoặc không có transaction/failure strategy.

### 11.1. BookingServiceImpl

SDS mô tả service này xử lý:

- Discovery/options.
- Seat locking.
- Booking/order creation.
- Payment.
- Cancellation.
- History.
- Ticket generation.

Phân loại: service ôm quá nhiều luồng và consistency boundary.

Dependency nên giữ trong Booking module:

- BookingRepository.
- SeatHoldRepository hoặc SeatAvailabilityRepository.

Dependency nên qua port/service:

- PricingPort.
- PaymentCommandPort.
- TicketIssuer.
- VoucherReservationPort.
- InventoryReservationPort.
- Showtime/Room read contract.

Nên chia thành:

- `BookingQueryService`.
- `HoldSeats`.
- `CreateBooking`.
- `CompleteBookingPayment`.
- Cancellation để Refund workflow riêng sau khi được duyệt.

Đây không phải over-engineering vì các use case có trigger, invariant và failure mode khác nhau. Không cần tách thành microservices.

### 11.2. AnalyticsService

Đọc Booking, Payment, Ticket, Movie, Showtime và Room là hợp lý vì analytics cần nhiều nguồn. Vấn đề là application service tự loop từng phim và gọi sáu repository.

Giải pháp nhỏ nhất:

- Một `AnalyticsQueryService`.
- Một `AnalyticsReadPort`.
- Mongo adapter thực hiện aggregation/projection.
- Metric glossary thống nhất timezone, refund inclusion và occupancy denominator.

Không cần chia thành nhiều service hoặc module nhỏ.

### 11.3. RoleManagementServiceImpl

SDS dùng RoleRepository, RolePermissionRepository, PermissionRepository và AuditLogRepository.

Với MongoDB hiện tại:

- Role aggregate sở hữu `permissionIds`.
- Không cần bắt buộc có RolePermission join entity/repository.
- Permission list đi qua `PermissionCatalog`.
- Audit đi qua `AuditPort`.
- Account-role/direct-permission assignment là use case khác của Identity & Access, không nên nhét vào Role mutation service.

### 11.4. Movie Exploration

Browse/detail và submit review là hai capability khác nhau.

- `MovieCatalogQueryService` dùng một catalog read port có thể join/projection showtimes.
- `SubmitMovieReview` dùng ReviewRepository và ReviewEligibilityPort.
- Booking module chỉ cung cấp câu trả lời eligibility, không lộ BookingRepository.

Review uniqueness/moderation vẫn bị blocker requirement.

### 11.5. Showtime command

Showtime command thực sự cần:

- ShowtimeRepository.
- MovieCatalogPort.
- RoomCatalogPort.
- ScheduleConflictPolicy.
- SalesStatusPort.
- SeatAvailabilityInitializer khi publish.

Không nên phụ thuộc trực tiếp TicketRepository. Câu hỏi nghiệp vụ là “showtime có hold/transaction/ticket chưa”, không phải “query ticket collection như thế nào”.

### 11.6. RefundServiceImpl

Refund service phải có dữ liệu Booking và Payment, nhưng không nên import repository implementation nội bộ của hai module.

Nên dùng:

- RefundRequestRepository.
- BookingCancellationPort.
- PaymentReadPort.
- RefundGatewayPort.
- Ticket/Seat/Voucher/Inventory compensation ports.

Tách:

- `RequestCancellation`.
- `ProcessRefund`.
- Retry job gọi lại `ProcessRefund`, không chứa business logic riêng.

### 11.7. InventoryServiceImpl

Inventory đọc Branch, Concession và Supplier là hợp lý, nhưng authoritative mutation phải thuộc Inventory.

- Query stock dùng InventoryReadPort.
- Receive/adjust/reserve dùng InventoryRepository atomic method.
- Supplier và concession đi qua catalog ports.
- Inventory update và StockMovement phải commit cùng transaction hoặc qua một repository operation có consistency rõ ràng.

## 12. Diagram cần cập nhật

### 12.1. Architecture diagram

- Chuẩn hoá React–Express–Mongoose–MongoDB.
- Thêm webhook và scheduled jobs như entry points.
- External payment/refund/notification qua adapters.
- Module không truy cập trực tiếp infrastructure/repository module khác.
- Không bắt buộc full Clean Architecture ở mọi module.

### 12.2. Backend package diagram

- Identity authorization query và permission middleware.
- Booking/SeatHold.
- Payment webhook/inbox.
- Ticket issuer/validator.
- Refund processor/retry.
- Inventory reservation/movement.
- Cross-module exported contracts.

### 12.3. Frontend package diagram

- Effective permissions lấy từ backend.
- Permission route chỉ hỗ trợ UX.
- Seat hold countdown/expired state.
- Payment pending/failed/retry/late review.
- Refund pending/failed/review sau approval.

### 12.4. Class diagrams

- Authentication.
- Role & Permission.
- Staff Management.
- Room & Branch.
- Showtime Management.
- Online Booking.
- Counter Ticketing.
- Payment Gateway.
- Cancellation & Refund.
- Promotion/Voucher.
- Concession Store/Cart.
- Inventory Management.
- Reporting/Analytics.

### 12.5. Sequence diagrams

- Login/protected request.
- Create/Update Role và Assign Permission.
- Book Ticket Online.
- Sell Tickets at Counter.
- Payment Process.
- Handle Timeout Payment.
- Browser redirect/result query.
- Request/Process Cancellation/Refund.
- Cancel Showtime with sales, nhưng tiếp tục đánh dấu blocked.
- Buy Concession Online.
- Stock Goods.
- Track Stock.
- View Dashboard/Analyze Movie Sales.

### 12.6. Database/collection diagram

- Account–Role–Permission effective union.
- SeatHold group identity và ShowtimeSeat owner/expiry.
- Payment provider event/idempotency.
- Ticket unique issuance.
- Refund provider reference/retry/step states.
- Inventory reservation/current balance/version/movement operation key.
- Voucher redemption reservation nếu được duyệt.

## 13. Phân loại đề xuất

### 13.1. Có thể giữ nguyên

- Account `roleIds` và `directPermissionIds`.
- Role `permissionIds`.
- `/auth/me` union logic.
- Room chứa physical seat layout.
- Unique `(showtimeId, seatId)`.
- Booking, Payment và Ticket là lifecycle riêng.
- Modular monolith.
- Reporting/analytics là read-only concern.

### 13.2. Chỉ cần làm rõ diagram

- Effective permission union.
- Current authorization reload ở request kế tiếp.
- Physical Seat status không phải booked state.
- Browser redirect không phải payment proof.
- Analytics cần nhiều nguồn dữ liệu không đồng nghĩa service sai.
- Aggregation adapter đọc nhiều collection không giống service import nhiều repository xuyên module.

### 13.3. Cần sửa thiết kế trước khi code

- SeatHold persistence và multi-seat transaction.
- Payment webhook inbox/idempotency/provider reference.
- Ticket unique issuance.
- Late-payment recovery state.
- Inventory reservation và ledger atomicity.
- Refund technical state/reconciliation sau policy approval.
- Cross-module contracts giữa Booking, Payment, Ticket, Voucher và Inventory.

### 13.4. Cần Project Owner quyết định

- Refund policy và authority.
- Release timing trong cancellation.
- Inventory stock unit và combo rule.
- Voucher lifecycle.
- Ticket/concession order boundary.
- Real gateway.
- Guest seat hold.
- Branch RBAC.
- Logout/session revocation.
- Cash payment record và counter reconciliation.

### 13.5. Đang bị chặn vì requirement chưa rõ

- Refund implementation.
- Showtime cancellation có giao dịch.
- Inventory implementation.
- Combo stock deduction.
- Voucher reservation/consumption.
- Real gateway integration.
- Combined checkout/cart boundary.

## 14. Kế hoạch cải tiến từng bước

### Bước 1: Chuẩn hoá source of truth

- Gắn `APPROVED`, `PROPOSED`, `BLOCKED` cho từng diagram/section.
- Chuẩn hoá stack.
- Loại JPA/relational terminology khỏi MongoDB conceptual design.
- Không sửa SRS nếu không có task/approval rõ ràng.

### Bước 2: Hoàn thiện RBAC nhỏ nhất

- CurrentAuthorizationQuery.
- `requirePermission` default-deny.
- Account status/effective permission reload mỗi protected request.
- Test direct grant, role grant và revoke-next-request.

### Bước 3: Hoàn thiện BOOK-001

- Chốt Mongo transaction topology.
- Chốt SeatHold schema/index.
- Chốt acquire/retry/release/expire/confirm sequence.
- Chốt guest/authenticated owner model.
- Viết concurrency test plan trước BOOK-003.

### Bước 4: Hoàn thiện PAY-001

- Payment state machine.
- Provider reference/event ID/processing key.
- One authoritative completion owner.
- Unique Ticket contract.
- Mock gateway trước.

### Bước 5: Chốt downstream idempotency

- Ticket issuance.
- Voucher confirm/release.
- Inventory confirm/release.
- Notification dedupe.
- Recovery after process crash.

### Bước 6: Giữ Refund bị chặn

- Owner duyệt eligibility, amount, authority, release timing và checked-in behavior.
- Sau đó mới chốt RefundRequest schema và sequence.

### Bước 7: Giữ Inventory bị chặn

- Owner chọn stock unit/combo model.
- Sau đó chốt reservation/current balance/ledger contract.

### Bước 8: Giảm coupling theo use case

- Tách god service theo workflow cụ thể.
- Giữ repository optional.
- Không rewrite toàn bộ hệ thống sang full Clean Architecture.
- Không tạo infrastructure mới nếu conditional update, unique index và Mongo transaction đã đủ.

### Bước 9: Verification

- Repository integration tests cho atomic/index behavior.
- Concurrent SeatHold/Payment/Inventory tests.
- Route tests cho `401/403`.
- Failure injection giữa external call và local persistence.
- Test database tách biệt và hỗ trợ replica set nếu production contract dùng transaction.

## 15. Câu hỏi cụ thể cần Hiếu – Project Owner trả lời

1. Seat hold chỉ dành cho Customer đã đăng nhập hay guest checkout cũng được phép?
2. MongoDB production/test có replica set để dùng multi-document transaction không?
3. Có chấp nhận `showtime_seats` là canonical runtime state và `SeatHold` là group aggregate không?
4. Ticket và concession checkout là một payable chung hay hai aggregate/payment riêng?
5. Voucher reserve ở lúc nào: tạo Booking, bắt đầu payment hay sau payment success?
6. Nếu late payment xảy ra, Manager nào được xử lý và SLA là gì?
7. Ticket bị block ngay khi cancellation được chấp nhận hay chỉ sau refund success?
8. Ghế release khi `CANCELLATION_PENDING` hay sau refund success?
9. Refund là full hay partial; concession, voucher và gateway fee xử lý ra sao?
10. Staff hay Manager nào có quyền approve/process refund? Có branch scope không?
11. Refund cho Ticket đã checked-in có bị cấm hoàn toàn không?
12. Inventory MVP theo sellable concession item hay ingredient/recipe?
13. Combo có stock riêng hay trừ các item/nguyên liệu cấu thành?
14. Stock được reserve trong thời gian payment hay chỉ deduct sau success?
15. Inventory adjustment cần approval, reason và audit nào?
16. Real payment provider nào sẽ dùng?
17. Provider có event ID, idempotency key và reconciliation API không?
18. Một Booking có thể có nhiều payment attempts nhưng tối đa một settlement thành công không?
19. System role có được xoá hay chỉ protected/archive?
20. Direct permissions có UI quản trị trong Phase 8 không? Ai có quyền cấp?
21. Branch-scoped permission được đưa vào release nào?
22. Giữ JWT-only hay cần refresh token/session revocation?
23. Revenue được ghi nhận theo payment time, showtime completion hay net after refund?

## 16. Prompt gợi ý để hỏi ChatGPT web

Có thể tải file này lên ChatGPT web và dùng prompt sau:

```text
Hãy đóng vai trò Software Architect và reviewer cho một dự án modular monolith dùng React, Express, Mongoose và MongoDB.

Đọc toàn bộ file báo cáo đính kèm. Không tự coi các đề xuất là business requirement đã được duyệt. Phải phân biệt rõ:
1. Quyết định đã được Project Owner duyệt.
2. Đề xuất kỹ thuật.
3. Requirement đang bị BLOCKED_BY_DECISION.

Hãy phản biện thiết kế theo các tiêu chí:
- correctness dưới concurrent requests;
- idempotency và retry safety;
- MongoDB transaction/index design;
- module ownership và cross-module dependency;
- backward compatibility với Account.roleIds, Account.directPermissionIds và Role.permissionIds;
- khả năng triển khai dần trong modular monolith hiện tại;
- tránh microservice, CQRS đầy đủ hoặc event sourcing nếu không cần thiết.

Sau đó hãy cung cấp:
- các điểm đồng ý và không đồng ý với báo cáo;
- các assumption còn thiếu;
- state machine đề xuất cho SeatHold, Booking, Payment và Refund;
- index/constraint đề xuất;
- sequence pseudocode cho seat hold và payment webhook;
- test matrix cho concurrency và retry;
- danh sách quyết định cần Project Owner xác nhận trước implementation.
```

## 17. Báo cáo thay đổi của task tạo file

- Changed files: chỉ thêm file `docs/SDS-G5-V1-DESIGN-ANALYSIS.md`.
- Implemented behavior: không có thay đổi behavior; chỉ tạo báo cáo phân tích.
- API changes: không có.
- DB changes: không có.
- Diagram/SDS/Google Drive changes: không có.
- Tests run: không chạy test vì không có source implementation thay đổi.
- Blockers: Refund, Inventory, Voucher, combined checkout, real gateway và branch-scoped RBAC còn thiếu quyết định.

