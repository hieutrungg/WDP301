# F-Cinema Requirements Status

Snapshot date: 2026-10-07.  
Sources: current SRS, verified source code, DB bootstrap, `SCREEN_FLOW.md`, `screen-flow.drawio`.  
Rule: `NOT IMPLEMENTED` mô tả trạng thái code; `REQUIREMENT NOT FINALIZED` mô tả readiness. Một requirement có thể đồng thời chưa implement nhưng đã sẵn sàng, hoặc chưa implement vì đang bị decision block.

## Status definitions

- `IMPLEMENTED`: behavior đã có và được kiểm chứng trong source/test.
- `APPROVED_READY`: owner đã duyệt đủ để implement; không được tự gán status này từ AI recommendation.
- `DRAFT_NEEDS_REVIEW`: có nội dung nhưng còn conflict/ambiguity hoặc chưa có owner approval.
- `BLOCKED_BY_DECISION`: thiếu quyết định ảnh hưởng trực tiếp contract/behavior.
- `FUTURE_PHASE`: được giữ trong roadmap nhưng chưa triển khai ở phase hiện tại.
- `OUT_OF_SCOPE`: không thuộc release/scope đã duyệt.

Priority (`P0`–`P3`) phản ánh mức cần giải quyết requirement/risk, không đồng nghĩa implementation phase.

## Requirement readiness matrix

| UC / BR ID | Feature | Requirement Status | Priority | Source | Screen | Dependencies | Open Questions | Conflicts | Proposed Resolution | Approval Status | API Impact | Database Impact | UI Impact | Implementation Phase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UC01/02/03 + BR01-03,06 | Register/Login/Logout | IMPLEMENTED | P0 | SRS + code | G02/G03/Verify Email | Account, Role, Permission, email | Logout revocation? | SRS/token docs chưa định nghĩa revocation; runtime JWT-only | Giữ behavior hiện tại; decision session nâng cao tách riêng | Verified behavior; business approval not recorded | `/api/auth/*` đã có | accounts, roles, permissions, email_verifications | Auth UI đã có | Phase 0 |
| UC04 + BR05 | Forgot/Reset Password | DRAFT_NEEDS_REVIEW | P1 | SRS + screen flow | G04/G04b/G04c/G04d | Email OTP, account | Single-use reset, attempt/rate limits, session invalidation | DB enum có `RESET_PASSWORD`, code chưa có | Reuse verification foundation; owner approve reset policy | NEEDS_REVIEW | Auth endpoints mới | email_verifications có thể reuse | 4 screens chưa có | Phase 0 |
| UC05-08 | Profile/password/history | DRAFT_NEEDS_REVIEW | P2 | SRS | C20 family | Auth, account, payment/read models | Editable fields, email immutable, history pagination | Screen flow có VIP/security/saved cards vượt current contract | Tách profile commands và history queries | NEEDS_REVIEW | Profile/history APIs | Account profile snapshots | Customer account screens | Phase 5 |
| UC09-12 + BR44-46 | Public movie discovery | DRAFT_NEEDS_REVIEW | P0 | SRS + DB + code | C01/C02/G01 | Movie model/API | Public status enum, default sort, review visibility | Movie scaffold invalid; landing dùng mock | Approve Movie read contract trước implementation | NEEDS_REVIEW | `GET /api/movies`, `/:id` | movies indexes/required fields | Replace mock data | Phase 1 |
| UC13 + BR38-39 | Movie reviews | BLOCKED_BY_DECISION | P2 | SRS | C18/C18b | Booking/ticket/showtime | One review/customer/movie? moderation workflow? eligible after showtime? | DB unique index enforces one review; SRS wording chưa chốt moderation | Owner approve eligibility + moderation + uniqueness | OPEN | Review read/write APIs | movie_reviews unique key/status | Review screens | Phase 5/Deferred |
| UC14-16 + BR13,44 | Manager Movie CRUD | DRAFT_NEEDS_REVIEW | P1 | SRS + design proposal | Manager Movie screens | Movie read model, RBAC | Publish/archive statuses, archival dependency rule | Screen flow says block future references; SRS BR chưa đầy đủ | Approve status transitions and archive check | NEEDS_REVIEW | Manager movie APIs | movies + showtime reference query | CRUD/confirm/success states | Phase 7 |
| UC17-19 + BR09-12 | Showtime management | BLOCKED_BY_DECISION | P0 | SRS + screen flow | C08/C09 + Manager Showtime | Movie, Room, Refund, Notification | Modify/cancel with paid booking, active hold, pending payment, refund failure | UC19 auto-enqueues refund while refund policy not final | Split safe create/read from cancellation; defer cancel until policy approval | OPEN | Showtime read/admin APIs | showtimes, showtime_seats | Cancel outcome states missing | Phase 2 read; Phase 7 admin; cancel Deferred |
| UC20 + BR14-16,18,54-55 | Booking + seat hold | DRAFT_NEEDS_REVIEW | P0 | SRS current draft | Seat Selection missing | Room/Seat, Showtime, Payment | `lockedBy` identity, hold expiry cleanup, late payment, transaction topology | BR54/55 appear in SRS but owner context says review progress ~P0-04 | Treat 10 minutes/atomic rule as draft until owner confirms; approve Booking contract first | NEEDS_REVIEW | Hold/availability/booking APIs | showtime_seats + booking lifecycle | Seat selection/expired state | Phase 3 after dependencies |
| UC21-23 | Booking history/ticket/cart | BLOCKED_BY_DECISION | P1 | SRS + screen flow | C16/C17/C13 | Booking, Payment, Ticket, Promotion, Inventory | Cart persistence, price snapshot, mixed ticket/concession order | DB separates bookings/orders but UI presents combined checkout | Approve payable/cart aggregate boundary | OPEN | Cart/history/ticket APIs | booking/order snapshot model | Customer self-service | Phase 4-5 |
| UC24/28/29 | Concession sales | BLOCKED_BY_DECISION | P1 | SRS + DB | C13 + Staff POS | Inventory, Payment | Standalone purchase? combo stock composition? pickup lifecycle? | SRS allows separate order; implementation contract absent | Owner choose order boundary and stock reservation behavior | OPEN | Catalog/cart/order APIs | orders, concessions, combos | Online + counter reuse | Phase 4/6 |
| UC25-27 + BR17,20,40 | Counter ticketing/QR | FUTURE_PHASE | P1 | SRS + screen flow | Staff POS/scan variants | Booking, Payment, Ticket, RBAC | Cash Payment record? scan time/cinema rules? reprint authority? | Screen flow variants incomplete | Reuse shared services; approve scan state matrix | NEEDS_REVIEW | Staff booking/payment/scan APIs | tickets atomic transition | QR result variants | Phase 6 |
| UC30 + BR21-22,56 | Payment | BLOCKED_BY_DECISION | P0 | SRS current draft | C14 states missing | Booking, Inventory, Voucher, Ticket | Provider, signature, reconciliation, timeout, retry, cash/card/e-wallet | UC30 strong idempotency draft; DB lacks unique gateway/idempotency constraint | Approve payment state machine + transaction boundary before gateway work | OPEN | Payment/init/callback/query APIs | payment unique/idempotency + event record | Failed/pending/retry | Phase 4 |
| UC31 + BR23-24 | Voucher | BLOCKED_BY_DECISION | P1 | SRS | Checkout/Promotion | Promotion, Cart, Payment | stacking, reservation, consumption/release, per-user rule | SRS says “configured rules” but no rule model | Approve voucher lifecycle before checkout integration | OPEN | Quote/reserve/release APIs | voucher redemption missing | Validation/error states | Phase 4/7 |
| UC32 | Promotion management | DRAFT_NEEDS_REVIEW | P2 | SRS + DB | Manager Promotion | Voucher/Pricing/RBAC | eligibility DSL, activation, overlap, loyalty coupling | Current DB only basic discount fields | Start with explicitly approved simple promotion subset | NEEDS_REVIEW | Manager promotion APIs | promotions/vouchers | Form/confirm/success | Phase 7 |
| UC33/34/49 + BR25,40,43 | Cancellation/Refund | BLOCKED_BY_DECISION | P0 | SRS current draft | Refund status/review missing | Booking, Payment, Ticket, Notification | cutoff, amount, concession bundle, authority, retry, failed refund, checked-in ticket | UC49 references missing BR57-59; Staff/Manager authority ambiguous | Mark future implementation blocked; owner approves policy/state matrix first | OPEN | Refund request/process/status APIs | refund/payment/booking/ticket states | Customer status + manager review | Deferred Phase |
| UC36-37 | Staff account | DRAFT_NEEDS_REVIEW | P2 | SRS | Admin Account screens | RBAC, Branch | transfer/disable/session effect/audit fields | Screen flow requires audit; DB only embedded employeeProfile | Approve staff identity/profile boundary | NEEDS_REVIEW | Admin account APIs | accounts + audit | CRUD/confirmation states | Phase 8 |
| UC38 | Staff shift | BLOCKED_BY_DECISION | P2 | SRS + DB | Staff Shift Monitoring | Staff, Branch | creation, assignment, clock-in/out, attendance, station, approval | SRS chỉ “monitor/review”; DB fields không đủ full attendance | Không invent attendance; define minimal release scope | OPEN | Shift query/command APIs | staff_shifts lifecycle | Monitoring screens | Deferred/Phase 7 |
| UC39/40 | Inventory | BLOCKED_BY_DECISION | P1 | SRS + DB | Inventory/Stock Goods | Concession, Payment, Supplier | product vs ingredient, combo recipe, reservation, ledger, correction | DB tracks concession quantity only; stock transaction lacks approved lifecycle | Approve stock unit and authoritative mutation path | OPEN | Inventory read/receive/reserve APIs | inventories + immutable movement | Staff inventory | Phase 6 |
| UC41 | Room seat map | DRAFT_NEEDS_REVIEW | P0 | SRS + DB | Configure Room Seat Maps | Branch, Showtime | layout version, edit lock, seat type pricing | Room embeds seats; no layout version; screen flow demands conflict/version check | Approve physical seat contract before Showtime/Booking | NEEDS_REVIEW | Cinema/room/seat read/admin APIs | rooms embedded layout | Read/manager map UI | Phase 2/7 |
| UC42 | Dashboard & Analytics | DRAFT_NEEDS_REVIEW | P2 | SRS | Manager Dashboard | Payment, Booking, Ticket, Showtime | KPI formula, timezone, refund inclusion, occupancy denominator | UC44 currently describes dashboard behavior | Define metric glossary/read model | NEEDS_REVIEW | Analytics query APIs | projection/index strategy | Dashboard charts | Phase 7 |
| UC43 | Export Revenue Reports | DRAFT_NEEDS_REVIEW | P0 | SRS | Revenue Reports | Reporting definitions | recognition basis, filters, export artifact/audit | UC43 body describes movie analysis, not export | Rewrite/approve UC43 with export flow | NEEDS_REVIEW | Export endpoint/job | read model/export metadata | export states | Phase 7 after approval |
| UC44 | Analyze Movie Sales | DRAFT_NEEDS_REVIEW | P0 | SRS | Movie Sales Analytics | Reporting definitions | metric/filter definitions | UC44 body describes general dashboard, not movie sales | Rewrite/approve UC44 with movie metrics | NEEDS_REVIEW | Movie analytics endpoint | read projection | analytics screen | Phase 7 after approval |
| UC45-47 + BR32-35 | Role/Permission management | DRAFT_NEEDS_REVIEW | P1 | SRS + code | Admin Role screens | Audit, session policy | role deletion, system role protection, immediate propagation | Basic role model exists; mutation APIs absent | Approve management lifecycle; keep seed names stable | NEEDS_REVIEW | Role/permission APIs | roles/permissions/audit | Admin screens | Phase 8 |
| UC48 + BR51-53 | Branch management | DRAFT_NEEDS_REVIEW | P1 | SRS + DB | Admin Branch | Room, Showtime, Booking, Payment | unique name/address, disable dependencies, operating hours | DB has `branchName/address/email/status`; SRS mentions hotline/hours | Approve branch fields and disable checks | NEEDS_REVIEW | Cinema read/admin APIs | branches indexes/required fields | Public list + admin CRUD | Phase 2 read/8 admin |
| BR29/34 + Account direct permission | RBAC effective permission | BLOCKED_BY_DECISION | P0 | SRS + code | Role redirect missing | Auth, Roles, Accounts | branch scope, permission-change session effect | Owner đã approve role grants + direct grants và chưa có direct deny; backend enforcement/session effect vẫn chưa hoàn thiện | Implement approved grant union; tiếp tục review branch scope và session effect | OPEN | `/auth/me`, admin APIs | roleIds/directPermissionIds | guards/layouts | Phase 0/8 |
| NFR Performance | Capacity/latency | DRAFT_NEEDS_REVIEW | P1 | SRS | All | Deployment, workload model | percentile, endpoint classes, dataset, test environment | SRS có 300 concurrent/no degradation và CR “most screens <3s” nhưng thiếu measurable SLO | Define p95 and load-test profile | NEEDS_REVIEW | All | indexes/query plans | UX timeout/retry | Cross-phase |
| NFR Security/Audit | Security/audit | DRAFT_NEEDS_REVIEW | P0 | SRS + code | 403/error screens | Auth/RBAC/logging | CSRF strategy, audit retention, correlation, secret handling | Cookie auth + no explicit CSRF decision; audit store absent | Threat review + minimal audit contract | NEEDS_REVIEW | Protected APIs | audit collection/index | 403/session UX | Phase 0+ |

## Deferred / Unfinished SRS Requirements

### Cancellation / Refund

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Cần owner chốt cutoff, eligibility, full/partial amount, ticket/concession bundle, checked-in behavior, Staff/Manager authority, auto/manual path, retry và state matrix. UC49 hiện tham chiếu BR57-59 không tồn tại.

### Showtime cancellation

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Safe read/create Showtime có thể tiến độc lập sau khi Room/Movie contract approve; cancellation có paid booking phải block.

### Seat holding / Double booking

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. SRS hiện có draft 10 phút và atomic all-or-nothing, nhưng chưa có owner approval record. Cần chốt hold owner/id, expiry cleanup, late payment và deployment transaction capability.

### Payment timeout / idempotency

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. UC30/BR56 có draft strong idempotency nhưng provider, signature, reconciliation và unique/idempotency persistence chưa chốt.

### Voucher

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Chưa chốt stacking, reservation, consumption/release và concurrency.

### Inventory

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Chưa chốt sellable unit vs ingredient, combo recipe, reservation, correction và ledger.

### Staff shift

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Không được suy diễn thành full attendance system từ UC “monitor shifts”.

### RBAC direct permission

`REQUIREMENT NOT FINALIZED`; effective union hiện `IMPLEMENTED` cho `/auth/me`, nhưng management/enforcement/session effect chưa implement. Không xóa field cho đến khi owner quyết định.

### Loyalty

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Screen flow có VIP/points/rewards sâu hơn rule/data contract hiện có; đưa `FUTURE_PHASE`.

### Reporting

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. UC43/UC44 semantic bị đảo; metric glossary/revenue recognition/timezone/refund inclusion thiếu.

### NFR gaps

`REQUIREMENT NOT FINALIZED`. Thiếu measurable p95/error rate/availability target, load-test dataset, backup RPO/RTO, audit retention, CSRF/cookie deployment policy, accessibility/browser matrix và observability acceptance criteria.

## Approval queue

Thứ tự đề nghị owner review:

1. P0: Movie public status/API contract; Room/Seat physical contract; Showtime read/overlap contract.
2. P0: RBAC permission enforcement và role/session change effect; direct grant union đã approved.
3. P0: Seat-hold/Booking state matrix và transaction capability.
4. P0: Payment state/idempotency/late-callback boundary.
5. P0: UC43/UC44 correction.
6. P0/P1: Cancellation/Refund + Showtime cancellation policy.
7. P1: Voucher, Inventory và Cart/Order boundary.
8. P2: Staff shift, loyalty và advanced administration.
