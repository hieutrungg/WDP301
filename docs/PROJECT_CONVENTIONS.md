# F-Cinema Project Conventions

Engineering source of truth cho repository sau khi project owner review. Mọi decision do AI đề xuất mặc định là `PROPOSED`.

## 1. Project overview

F-Cinema là modular web application quản lý rạp nhiều chi nhánh cho `Guest`, `Customer`, `Staff`, `Manager`, `Admin`. Mục tiêu governance là cho 5 developer sở hữu module end-to-end, giảm shared-file conflict và giữ một owner cho mỗi business invariant.

## 2. Technology stack

- Frontend: React 19, Vite, Tailwind CSS, React Router, Zustand, Axios, Zod; React Query chỉ dùng sau khi provider/query convention được hoàn thiện.
- Backend: Node.js, Express 5, Mongoose, MongoDB, Zod, bcrypt, JWT, Helmet, CORS, cookie-parser, rate limiting.
- Auth transport: JWT access token trong HTTP-only cookie.
- Target deployment ghi trong SRS: Azure; deployment topology chưa được approve.
- Không tự ý thêm microservices, Redis, Kafka, RabbitMQ, GraphQL, CQRS, event sourcing hoặc TypeScript migration.

## 3. Architecture

**APPROVED:** Modular Monolith, mỗi domain là một module. Layering thực dụng:

```text
Express route/controller
  -> application service/use case
  -> repository port/adapter khi query không trivial
  -> Mongoose model
  -> MongoDB
```

Frontend:

```text
route page
  -> feature hook/component
  -> feature API
  -> shared Axios client
  -> REST backend
```

Không áp Clean/Hexagonal đầy đủ một cách máy móc. Module đơn giản có thể bỏ repository layer nếu service dùng một model với query rõ ràng; controller không được chứa business rule. Module có concurrency, nhiều persistence calls hoặc external provider phải tách service/use case và adapter rõ ràng.

## 4. Repository organization

Giữ cấu trúc hiện tại và migrate incrementally:

```text
server/src/modules/<module>/
  <module>.model.js
  <module>.repository.js       # optional cho query/persistence phức tạp
  <module>.service.js
  <module>.controller.js
  <module>.validation.js
  <module>.routes.js
  <module>.constants.js        # khi module sở hữu enum/constants

client/src/
  app/
  features/<feature>/
    api/
    components/
    hooks/
    pages/
    schema/
    store/
  components/
  layouts/
  lib/
  providers/
  utils/
```

Domain dự kiến: `auth`, `accounts`, `roles`, `permissions`, `movies`, `cinemas`, `rooms`, `showtimes`, `bookings`, `tickets`, `payments`, `concessions`, `inventory`, `promotions`, `refunds`, `staff`, `reports`, `notifications`.

## 5. Backend convention

- Route chỉ khai báo URL, middleware và controller.
- Controller parse HTTP context, gọi một service/use case và map response; không gọi Mongoose trực tiếp.
- Service sở hữu workflow và invariant của module.
- Repository sở hữu query shape, atomic update và persistence mapping khi logic không trivial.
- Validation schema nằm cạnh module; validate `params`, `query`, `body` theo schema riêng khi cần.
- Cross-module call đi qua exported service/read contract; không import model/repository nội bộ của module khác.
- Scheduled job/webhook gọi lại cùng application service; không duplicate business rule.
- Atomic compare-and-set/idempotency bắt buộc cho seat hold, payment callback, ticket scan, voucher consumption và inventory movement.

## 6. Frontend convention

- Route-level screen ở `features/<feature>/pages` hoặc existing `pages/` trong quá trình migrate; không đổi hàng loạt chỉ để đẹp.
- Feature API dùng `httpClient`; component không gọi Axios trực tiếp.
- Zustand dành cho cross-route client state (session, small workflow state). Server state nên dùng feature query hooks khi QueryProvider đã sẵn sàng.
- Shared UI không import business feature.
- Feature có thể import shared `components`, `lib`, `hooks`, `utils`; shared code không import feature.
- Loading/error/empty state là bắt buộc cho data screen.
- `ProtectedRoute` kiểm tra identity; `PermissionRoute` hỗ trợ navigation/UX, không thay server authorization.
- Role surface dùng layout riêng: `CustomerLayout`, `StaffLayout`, `ManagerLayout`, `AdminLayout`.

## 7. API convention

### Existing verified format

Auth success hiện dùng một trong hai dạng:

```json
{ "success": true, "message": "..." }
```

```json
{ "success": true, "data": {} }
```

Error hiện tại:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Enter a valid email address" }]
}
```

Không break auth API.

### APPROVED additive standard cho API mới

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

```json
{
  "success": false,
  "code": "MOVIE_NOT_FOUND",
  "message": "Movie not found",
  "errors": []
}
```

- Prefix: `/api`.
- Resource route dùng plural kebab-case: `/movies`, `/cinemas`, `/showtimes`.
- ID là Mongo ObjectId trên wire dưới dạng string; path param tên cụ thể (`:movieId`) khi nested.
- Pagination: `page` bắt đầu từ 1, `limit` có max do module quy định; list response có `meta`.
- Filtering dùng query param có tên domain (`status`, `genre`, `cinemaId`, `date`).
- Search dùng `q`; sorting dùng `sort=<field>` và `order=asc|desc` nếu endpoint hỗ trợ.
- Timestamp trên API là ISO 8601 UTC; UI format theo locale đã approve.
- `400` invalid syntax/query, `401` unauthenticated, `403` authenticated but forbidden, `404` not found, `409` state/uniqueness conflict, `422` business validation khi team approve distinction, `429` rate limited, `500` unexpected.
- Error `code` là stable technical identifier; `message` có thể hiển thị nhưng không được dùng làm programmatic condition.

### PROPOSED public discovery contracts

Các contract sau là draft, không phải implementation authorization.

| Endpoint                               | Query/path                                                                                                           | Response data                                                                                                                                                                            | Errors                                    | Auth   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------ |
| `GET /api/movies`                    | `q`, `genre`, `language`, `releaseFrom`, `releaseTo`, `status`, `page`, `limit`, `sort`, `order` | page gồm movie summary:`id`, `title`, `synopsis`, `genres`, `duration`, `releaseDate`, `language`, `director`, `ageRating`, `posterUrl`, `trailerUrl`, `status` | `INVALID_QUERY`                         | Public |
| `GET /api/movies/:id`                | ObjectId                                                                                                             | movie detail cùng fields trên; showtime không embedded authoritative                                                                                                                  | `INVALID_MOVIE_ID`, `MOVIE_NOT_FOUND` | Public |
| `GET /api/cinemas`                   | `q`, `page`, `limit`                                                                                         | page gồm `id`, `branchName`, `address`, `email`, `hotline`, `status`; public chỉ trả `ACTIVE`                                                                                | `INVALID_QUERY`                         | Public |
| `GET /api/showtimes`                 | `movieId`, `cinemaId`, `roomId`, `date`, `page`, `limit`                                                   | page gồm `id`, `movieId`, `roomId`, `cinemaId` projection, `startAt`, `endAt`, stored `status`, derived `displayStatus`; public chỉ trả `PUBLISHED` chưa bắt đầu | `INVALID_QUERY`, `INVALID_DATE_RANGE` | Public |
| `GET /api/movies/:movieId/showtimes` | cùng filter cinema/date                                                                                             | cùng showtime summary, scope bởi movie                                                                                                                                                 | `MOVIE_NOT_FOUND`, `INVALID_QUERY`    | Public |

Open contract questions: pagination max và các Movie query detail chưa được chốt trong bảng này. Showtime date filter dùng ngày `Asia/Ho_Chi_Minh` rồi chuyển thành UTC range, `cinemaId` được chiếu từ Room, và default sort là `startAt` tăng dần.

## 8. Database convention

- Collection: plural `snake_case` khi nhiều từ (`email_verifications`, `showtime_seats`).
- Field: `camelCase`; reference kết thúc bằng `Id`/`Ids`.
- Mongoose timestamps dùng `createdAt`, `updatedAt`; event timestamp có tên semantic như `paidAt`, `checkedInAt`.
- Reference khi entity có lifecycle/ownership độc lập; embed immutable snapshot/value object khi cần historical truth và không query độc lập.
- Unique invariant phải có DB unique index, không chỉ app check.
- Normal index phải xuất phát từ verified query/use case; không thêm speculative index.
- Archive bằng status/timestamp, không hard-delete record có lịch sử giao dịch.
- Audit-sensitive mutation cần `actorId`, timestamp và correlation/audit record khi contract được approve.
- Money không dùng floating point tùy ý. **APPROVED:** lưu VND integer đồng cho persistence và API contract.
- Schema migration phải có versioned script; DB bootstrap không được silently phá dữ liệu hiện có.
- Historical booking/order/ticket cần snapshot tên/giá/policy cần thiết; không phụ thuộc hoàn toàn vào mutable catalog document.
- Mongo transaction chỉ dùng cho invariant thực sự span nhiều documents và deployment hỗ trợ replica set; vẫn cần idempotency.

### Core relations

```text
CinemaBranch -> Room -> embedded physical Seat layout
Movie -> Showtime -> Room
Showtime + Seat -> availability/hold/booking state
Booking -> Payment -> Ticket
```

Không lưu `Seat.isBooked = true` global. `Room.seats[].status` chỉ được hiểu là trạng thái physical/layout (ví dụ enabled/disabled), không phải booking status.

## 9. Authentication

- Giữ JWT access token trong HTTP-only cookie.
- `requireAuth` verify token và đặt authenticated principal vào request context.
- Login chỉ cho account `ACTIVE`.
- Cookie production phải `secure`; `sameSite`/domain strategy cần review khi frontend/backend deploy khác origin.
- Không log token, password, OTP hoặc SMTP secrets.
- Logout hiện chỉ clear cookie; revocation/refresh rotation là open decision, không tự implement.
- Network/5xx khi gọi `/auth/me` không nên mặc định tương đương 401 trong UX; behavior mới cần task riêng.

## 10. RBAC

- Protected backend route mặc định deny nếu thiếu identity/permission.
- Pattern mục tiêu: `requireAuth`, sau đó `requirePermission("movie.create")`.
- Middleware phải load effective permissions server-side hoặc dùng verified authorization context phù hợp.
- Frontend guard không phải security boundary.
- `roles + directPermissionIds` hiện hợp nhất theo union; không có direct deny.
- Không xóa `directPermissionIds` trong phase governance.
- Protected request phải dùng account status và effective permissions hiện hành từ backend; account bị khóa hoặc quyền bị thu hồi có hiệu lực ở protected request tiếp theo.
- Role redirect mặc định: `ADMIN -> /admin`, `MANAGER -> /manager`, `STAFF -> /staff`, `CUSTOMER -> /`; account nhiều role dùng thứ tự ưu tiên này.
- Branch-scoped authorization chưa có contract; không suy ra từ global permission code.

## 11. Validation

- Validate client để UX; validate server là bắt buộc.
- Normalize email/identity trước query; không normalize secret/password.
- Param ObjectId phải validate trước repository call.
- Query pagination/filter phải whitelist.
- Business eligibility nằm trong service/policy, không chỉ Zod schema.
- Cross-document reference phải verify trong application layer vì Mongo validator không enforce foreign key.

## 12. Error handling

- Operational error dùng `AppError` hoặc module error mapped centrally.
- Controller chuyển error qua `next(error)`.
- 5xx không lộ internal stack/message ra client; server log giữ correlation context.
- Validation error trả field-level `errors`.
- New domain error cần stable `code`; migration của auth error format phải backward-compatible.

## 13. Logging

**PROPOSED:** structured application log với `timestamp`, `level`, `message`, `requestId/correlationId`, `module`, `actorId` khi hợp lệ. Không log PII/secret thừa. Audit log là immutable business evidence và tách khỏi diagnostic log.

## 14. Domain boundaries

- `movies`: catalog state và movie API semantics.
- `cinemas/rooms`: branch, physical room và seat layout.
- `showtimes`: scheduling, overlap, lifecycle.
- `bookings`: booking lifecycle và seat hold owner.
- `payments`: transaction lifecycle, callback validation/idempotency.
- `tickets`: issue/check-in lifecycle.
- `concessions/inventory`: catalog/order line snapshots và authoritative stock movement.
- `promotions`: campaign/voucher eligibility/reservation.
- `refunds`: request/refund lifecycle, chỉ implement sau policy approval.
- `reports`: read models/export, không mutate operational aggregates.
- `auth/accounts/roles/permissions`: identity và authorization.

Online và counter flow phải reuse cùng Booking/Payment/Ticket/Promotion/Inventory service. Controller theo channel không sở hữu invariant riêng.

## 15. Shared constants/enums

- Enum nằm trong owning module.
- Shared chỉ chứa primitive ổn định, không là dumping ground.
- Mọi thay đổi status/permission/error code phải có owner, consumers, migration note và approval.
- Không duplicate string enum giữa DB bootstrap, model và service mà không có sync/test plan.

## 16. Testing

- Service/policy: unit test cho invariant và state transition.
- Repository: integration test với MongoDB cho index, atomic query, concurrency-sensitive behavior.
- Route: integration/E2E cho auth, validation, permission và response contract.
- Client: component/flow test cho loading/error/empty/permission UX khi framework được chọn.
- Payment callback, seat hold, ticket scan và inventory cần duplicate/concurrent scenario test.
- Test DB phải tách khỏi development DB và cleanup an toàn.
- Không đánh dấu fully verified khi infrastructure test không chạy.

## 17. Git workflow

**APPROVED:** `main` <- stable milestone; `develop` <- integration; `feature/<task-or-module>` từ `develop`, PR về `develop`.

- Không push trực tiếp `main`.
- Branch ngắn hạn, tên gắn task/module.
- Không trộn unrelated change.
- Trước PR: `git status`, lint/build/relevant tests.
- Shared files cần reviewer từ affected modules.

## 18. PR rules

- Một PR có objective rõ, acceptance criteria và task ID.
- Mô tả API/DB/shared contract change riêng.
- Không merge khi required check fail hoặc decision blocker chưa giải quyết.
- Reviewer kiểm tra permission, validation, negative path, migration và backward compatibility.
- Screenshot chỉ bổ sung, không thay automated verification.

## 19. Integration rules

- Consumer và provider thống nhất contract trước implementation phụ thuộc.
- Dùng fixtures/contract examples thay vì import internal model module khác.
- Booking owner và Payment owner chốt transaction/idempotency boundary trước Phase 4.
- Route mount/shared enum/DB index change cần integration reviewer.
- Feature branch không chỉnh governance để che conflict.

## 20. Definition of Done

Task chỉ `DONE` khi applicable:

- implementation và acceptance criteria hoàn tất;
- lint/build/relevant tests pass;
- validation và backend permission enforcement có;
- loading/error/empty states có;
- mock data được bỏ nếu task yêu cầu API thật;
- docs/contract cập nhật đúng approval version;
- không còn TODO ảnh hưởng acceptance criteria;
- PR reviewed và integrated vào `develop`;
- infrastructure limitation được ghi nếu verification chưa đầy đủ.

## 21. Approved decisions

Các decision dưới đây đến trực tiếp từ project owner request.

### Decision A-01

Decision: Giữ stack React/Vite/Tailwind và Node/Express/Mongoose/MongoDB.
Reason: Stack hiện tại và owner constraint.
Affected modules: All.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-02

Decision: Giữ JWT access token trong HTTP-only cookie ở phase hiện tại.
Reason: Architecture đang chạy; không tự đổi session model.
Affected modules: `auth`, client session.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-03

Decision: Physical Seat không có booked state global; booking state thuộc `Showtime + Seat`.
Reason: Cùng ghế có availability khác nhau theo suất chiếu.
Affected modules: `rooms`, `showtimes`, `bookings`.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-04

Decision: Backend enforce authorization; frontend guard chỉ hỗ trợ UX.
Reason: Client không phải security boundary.
Affected modules: All protected APIs/routes.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-05

Decision: Không xóa `directPermissionIds` trong task/phase governance.
Reason: Policy giữ/bỏ direct permission chưa chốt.
Affected modules: `accounts`, `roles`, `permissions`, `auth`.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-06

Decision: Dùng pragmatic Modular Monolith với module ownership end-to-end và optional repository layer.
Reason: Phù hợp team 5 người, code hiện tại và deployment đơn.
Affected modules: All.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-07

Decision: API mới dùng additive `code` và `meta`, không break auth response hiện tại.
Reason: Stable client handling và pagination thống nhất.
Affected modules: API clients và backend modules.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-08

Decision: Effective permission = union role grants + direct grants; chưa có direct deny.
Reason: Khớp verified implementation, giảm ambiguity ngắn hạn.
Affected modules: `auth`, `accounts`, RBAC.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-09

Decision: Dùng integer VND cho monetary persistence/API contract.
Reason: Tránh floating-point error.
Affected modules: booking, payment, promotion, inventory, reporting.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-10

Decision: Dùng Git flow `main`/`develop`/`feature/*`.
Reason: Tách stable release và integration cho 5 developers.
Affected modules: Team workflow.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-11

Decision: Dùng module ownership end-to-end theo tab `Module Ownership` trong Team Development Plan; không chia team cố định theo frontend/backend.
Reason: Giảm duplicate business logic và giúp mỗi thành viên chịu trách nhiệm trọn vẹn một domain.
Affected modules: All.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-12

Decision: Stitch project `12758682447811659045` là nguồn thiết kế trực quan cho UI; SRS và approved requirement quyết định nghiệp vụ; `SCREEN_FLOW.md`/`screen-flow.drawio` quyết định luồng điều hướng.
Reason: Mockup không được tự thay đổi business rule, permission, API, database hoặc state transition.
Affected modules: Frontend, requirements, UX.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-13

Decision: Movie dùng lifecycle `DRAFT`, `PUBLISHED`, `ARCHIVED`; public API chỉ trả `PUBLISHED`, không hard-delete Movie đã có lịch sử; danh sách mặc định mới nhất trước và hỗ trợ search/pagination.
Reason: Tách rõ dữ liệu đang soạn, dữ liệu công khai và dữ liệu lịch sử để Movie owner có contract ổn định.
Affected modules: `movies`, public Movie UI, Manager Movie.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-14

Decision: Physical Seat chỉ mô tả layout; availability thuộc `Showtime + Seat`. Room layout đã được Showtime tham chiếu không sửa đè; thay đổi cấu trúc tạo layout version mới, dữ liệu lịch sử tiếp tục tham chiếu version cũ.
Reason: Tránh làm sai lịch sử Showtime/Booking và loại bỏ booked state toàn cục.
Affected modules: `cinemas`, `rooms`, `showtimes`, `bookings`.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-15

Decision: Showtime lưu thời gian UTC và hiển thị theo `Asia/Ho_Chi_Minh`; cùng Room không được overlap, khác Room có thể đồng thời; hai suất liền nhau chỉ hợp lệ khi `endAt` đã bao gồm thời gian dọn phòng. Read/filter/create và update Showtime chưa bán vé được phép; cancel Showtime đã bán vé bị defer đến khi Refund contract approved.
Reason: Cho phép Showtime discovery tiến độc lập nhưng không tự invent cancellation/refund behavior.
Affected modules: `showtimes`, `rooms`, public discovery, Manager Showtime.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-16

Decision: Protected API kiểm tra account status và effective permissions hiện hành ở backend; unauthenticated trả `401`, thiếu quyền trả `403`; account bị khóa/quyền bị thu hồi có hiệu lực ở protected request tiếp theo. Role redirect và priority là `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`. Branch-scoped authorization là decision riêng chưa được duyệt.
Reason: Backend là security boundary và thay đổi quyền không được phụ thuộc vào state cũ ở frontend.
Affected modules: `auth`, `accounts`, RBAC, protected routes và role layouts.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-17

Decision: Seat hold mặc định 10 phút, lấy từ cấu hình; UI hiển thị thời gian còn lại và hold hết hạn phải được giải phóng theo cách idempotent.
Reason: Cho khách thời gian hoàn tất checkout nhưng không khóa ghế vô thời hạn hoặc ghi cứng policy trong nhiều module.
Affected modules: `bookings`, `showtimes`, Seat Selection UI.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-18

Decision: Dùng `SeatHold` riêng gắn với `Showtime + Seat` và owner/checkout identity. Một ghế trong một Showtime chỉ có tối đa một hold còn hiệu lực; yêu cầu giữ nhiều ghế phải all-or-nothing và chống concurrent double booking.
Reason: Physical Seat chỉ mô tả layout; hold cần owner, expiry và atomic acquisition rõ ràng.
Affected modules: `rooms`, `showtimes`, `bookings`.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-19

Decision: Booking MVP dùng các trạng thái `PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`; đường đi ban đầu là `PENDING_PAYMENT -> CONFIRMED` hoặc `PENDING_PAYMENT -> EXPIRED`. Cancellation/refund states chưa thuộc MVP này.
Reason: Cho phép triển khai Booking core mà không tự suy diễn chính sách hoàn tiền chưa được duyệt.
Affected modules: `bookings`, `payments`, customer checkout.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-20

Decision: Payment báo thành công sau khi SeatHold/Booking đã hết hạn không được tự confirm Booking hoặc phát hành Ticket. Giao dịch phải được đánh dấu `REFUND_REQUIRED` hoặc `REVIEW_REQUIRED`; automatic refund chờ Refund contract, trước đó Manager xử lý thủ công.
Reason: Không được bán lại ghế đã hết quyền giữ hoặc tạo Ticket cho một ghế có thể đã thuộc khách khác.
Affected modules: `payments`, `bookings`, `tickets`, `refunds`.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-21

Decision: Payment được thiết kế provider-neutral và triển khai deterministic mock adapter trước. Tích hợp VNPay/MoMo hoặc gateway thật không thuộc Gói C và tiếp tục defer.
Reason: Hoàn thiện và kiểm thử Booking-Payment contract trước khi phụ thuộc nhà cung cấp ngoài.
Affected modules: `payments`, checkout UI.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-22

Decision: Payment idempotency dùng cả provider reference duy nhất và processing key/state. Callback hoặc retry lặp chỉ trả trạng thái hiện hành, không lặp Booking confirmation, Ticket issuance hoặc side effect khác.
Reason: Gateway có thể gửi callback nhiều lần hoặc request có thể retry sau timeout.
Affected modules: `payments`, `bookings`, `tickets` và downstream ports.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-23

Decision: Ticket/QR chỉ được phát hành đúng một lần sau khi Booking/Payment được xác nhận thành công qua authoritative success path; redirect query và late payment không đủ điều kiện phát hành Ticket.
Reason: Ngăn vé giả, vé trùng và side effect phát sinh trước khi thanh toán được xác minh.
Affected modules: `payments`, `bookings`, `tickets`, C15/C17.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-24

Decision: CinemaBranch dùng trạng thái `ACTIVE`, `INACTIVE`; public chỉ thấy `ACTIVE`. Không hard-delete Branch đã có dữ liệu tham chiếu và không cho chuyển sang `INACTIVE` khi còn Showtime `PUBLISHED` trong tương lai.
Reason: Giữ lịch sử Room, Showtime, Booking và giao dịch ổn định trong khi vẫn cho phép ngừng vận hành chi nhánh.
Affected modules: `cinemas`, `rooms`, `showtimes`, public discovery.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-25

Decision: Branch M0 có `branchName` và `address` bắt buộc, `email` và `hotline` tùy chọn, cùng `status`; `branchName` phải unique theo dạng đã normalize. Operating hours và branch-scoped RBAC không thuộc M0. Development seed phải có Branch/Room/layout và chạy lặp không tạo trùng.
Reason: Đủ dữ liệu cho discovery và Showtime phát triển mà không tự mở rộng sang lịch vận hành hoặc authorization theo chi nhánh.
Affected modules: `cinemas`, `rooms`, seed, RBAC.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-26

Decision: Showtime chỉ persist `DRAFT`, `PUBLISHED`, `CANCELLED`. `UPCOMING`, `NOW_SHOWING`, `ENDED`, `SOLD_OUT` là trạng thái hiển thị được tính từ thời gian và availability, không persist như lifecycle state.
Reason: Tránh cron/job chỉ để đổi trạng thái theo đồng hồ và tránh đồng bộ sai giữa trạng thái lịch và ghế.
Affected modules: `showtimes`, public discovery, bookings.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-27

Decision: Manager chọn `startAt`; hệ thống tính `endAt` dùng cho conflict từ Movie duration cộng cleanup buffer cấu hình, mặc định 15 phút. Cùng Room dùng interval `[startAt, endAt)` nên suất sau được phép bắt đầu đúng `endAt` của suất trước.
Reason: Một nguồn tính thời gian thống nhất và có khoảng dọn phòng rõ ràng cho overlap validation.
Affected modules: `movies`, `rooms`, `showtimes`, Manager Showtime UI.
Status: APPROVED.
Owner/Approver: Project owner.

### Decision A-28

Decision: Publish Showtime chỉ hợp lệ khi Movie, Branch, Room active/eligible, thời gian tương lai, không overlap và Room layout hợp lệ; publish chốt `roomLayoutVersion`. Showtime `PUBLISHED` chỉ được sửa hoặc hủy trước giờ chiếu khi chưa có active SeatHold, Booking, Payment hoặc Ticket. `CANCELLED` là terminal; cancel đã có giao dịch tiếp tục defer đến Refund contract.
Reason: Bảo vệ layout/availability và không tạo mutation cần hoàn tiền trước khi Refund policy được duyệt.
Affected modules: `showtimes`, `rooms`, `bookings`, `payments`, `tickets`, `refunds`.
Status: APPROVED.
Owner/Approver: Project owner.

## 22. Proposed decisions awaiting approval

Các business/API/data decision chưa được owner duyệt tiếp tục nằm trong `docs/REQUIREMENTS_STATUS.md` và tab `Requirement Decisions` của Team Development Plan. Không suy diễn các decision đó từ các quyết định đã được duyệt A-01 đến A-28.

## 23. Change-control policy

1. Owner decision được ghi vào decision record và đổi status `PROPOSED -> APPROVED`.
2. Requirement approval được cập nhật tại `docs/REQUIREMENTS_STATUS.md` trước khi task chuyển `READY`.
3. Shared API/data/status change phải liệt kê affected modules, owner, consumers, migration và tests.
4. Source conflict với approved decision không được tự sửa im lặng; tạo blocker/PR note.
5. Deprecated contract phải có replacement và removal phase.
6. Governance change cần reviewer độc lập; không merge kèm workaround business feature nếu không liên quan.
