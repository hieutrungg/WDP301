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
| `GET /api/cinemas`                   | `q`, `status`, `page`, `limit`                                                                               | `id`, `branchName`, `address`, `email`, `status`                                                                                                                               | `INVALID_QUERY`                         | Public |
| `GET /api/showtimes`                 | `movieId`, `cinemaId`, `roomId`, `date`, `status`, `page`, `limit`                                     | `id`, `movieId`, `roomId`, `cinemaId` projection, `startTime`, `endTime`, `status`                                                                                         | `INVALID_QUERY`, `INVALID_DATE_RANGE` | Public |
| `GET /api/movies/:movieId/showtimes` | cùng filter cinema/date                                                                                             | cùng showtime summary, scope bởi movie                                                                                                                                                 | `MOVIE_NOT_FOUND`, `INVALID_QUERY`    | Public |

Open contract questions: public movie status enum, timezone/date boundary, cinema projection source từ room, default sort, pagination max và unpublished visibility.

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
- Role/permission/account-status change phải xác định session effect; hiện chưa approve immediate invalidation hay effective at next request/login.
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

## 22. Proposed decisions awaiting approval

Các business/API/data decision chưa được owner duyệt tiếp tục nằm trong `docs/REQUIREMENTS_STATUS.md` và tab `Requirement Decisions` của Team Development Plan. Không suy diễn các decision đó từ các quyết định chung A-01 đến A-12.

## 23. Change-control policy

1. Owner decision được ghi vào decision record và đổi status `PROPOSED -> APPROVED`.
2. Requirement approval được cập nhật tại `docs/REQUIREMENTS_STATUS.md` trước khi task chuyển `READY`.
3. Shared API/data/status change phải liệt kê affected modules, owner, consumers, migration và tests.
4. Source conflict với approved decision không được tự sửa im lặng; tạo blocker/PR note.
5. Deprecated contract phải có replacement và removal phase.
6. Governance change cần reviewer độc lập; không merge kèm workaround business feature nếu không liên quan.
