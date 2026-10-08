# F-Cinema Requirements Status

Snapshot date: 2026-10-08.
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
| UC09-12 + BR44-46 | Public movie discovery | APPROVED_READY | P0 | Owner decision + SRS + DB + code | C01/C02/G01 | Movie model/API | None for public discovery; review eligibility belongs to UC13 | Movie scaffold invalid and landing mock are implementation gaps, not requirement blockers | Use `DRAFT/PUBLISHED/ARCHIVED`; public only `PUBLISHED`; newest-first search/pagination; no hard-delete historical Movie | APPROVED | `GET /api/movies`, `/:id` | movies status/index/required fields | Replace mock data | Phase 1 |
| UC13 + BR38-39 | Movie reviews | BLOCKED_BY_DECISION | P2 | SRS | C18/C18b | Booking/ticket/showtime | One review/customer/movie? moderation workflow? eligible after showtime? | DB unique index enforces one review; SRS wording chưa chốt moderation | Owner approve eligibility + moderation + uniqueness | OPEN | Review read/write APIs | movie_reviews unique key/status | Review screens | Phase 5/Deferred |
| UC14-16 + BR13,44 | Manager Movie CRUD foundation | APPROVED_READY | P1 | Owner decision + SRS + design proposal | Manager Movie screens | Movie read model, RBAC | Detailed confirmation copy can follow Stitch | Delete/archive ambiguity resolved: historical Movie is never hard-deleted | Use approved lifecycle and block destructive removal of referenced Movie | APPROVED | Manager movie APIs | movies + showtime reference query | CRUD/confirm/success states | Phase 7 |
| UC17-18 + safe UC19 subset + BR09-12 | Showtime discovery/create/update-unsold | APPROVED_READY | P0 | Owner decision + SRS + screen flow | C08/C09 + Manager Showtime | Movie, Room | Pagination max remains a module contract choice; cancellation-with-sales is excluded | Existing SRS mixes safe scheduling with refund-dependent cancellation | Persist `DRAFT/PUBLISHED/CANCELLED`; derive time/availability display states; UTC storage, VN date boundary; configurable cleanup default 15m; no same-Room overlap; publish snapshots layout; safe update/cancel only before any hold/transaction | APPROVED | Showtime read/admin APIs | showtimes indexes, `roomLayoutVersion`, Room interval query | Discovery + safe manager forms | Phase 2 read; Phase 7 admin |
| UC19 | Cancel Showtime with sales | BLOCKED_BY_DECISION | P0 | SRS + owner decision | Manager Showtime | Booking, Payment, Refund, Ticket, Notification | Active hold, pending/paid booking, refund failure and notification | UC19 auto-enqueues refund while Refund policy is not final | Keep implementation blocked until Refund contract approved | DEFERRED | Cancel Showtime API | showtime/payment/refund/ticket states | Cancel outcome states missing | Deferred |
| UC20 + BR14-16,18,54-55 | Booking + seat hold core | APPROVED_READY | P0 | Owner decision + SRS draft | Seat Selection missing | Room/Seat, Showtime | Persistence/cleanup topology is a contract implementation choice, not an open business rule | Existing `lockedBy` design lacks a dedicated owner/expiry contract | Configurable 10-minute dedicated `SeatHold`; one active hold per Showtime+Seat; multi-seat acquisition all-or-nothing; Booking `PENDING_PAYMENT -> CONFIRMED/EXPIRED` | APPROVED | Hold/availability/booking APIs | dedicated hold identity + showtime-seat state + booking lifecycle | Seat selection/countdown/expired state | Phase 3 after Room/Showtime contracts |
| UC20/30 + BR56 | Ticket issuance boundary | APPROVED_READY | P0 | Owner decision + SRS | C15/C17 | Booking, Payment | QR/check-in lifecycle remains a later contract | Earlier flow could be read as issuing Ticket before verified payment | Issue Ticket/QR exactly once only after authoritative confirmed Booking/Payment; never on redirect or late payment | APPROVED | Booking completion/Ticket APIs | unique issuance/idempotency record | Confirmation and E-ticket states | Phase 4 after Booking/Payment contracts |
| UC21-23 | Booking history/cart | BLOCKED_BY_DECISION | P1 | SRS + screen flow | C16/C13 | Booking, Payment, Promotion, Inventory | Cart persistence, price snapshot, mixed ticket/concession order | DB separates bookings/orders but UI presents combined checkout | Approve payable/cart aggregate boundary; Ticket issuance rule is already approved separately | OPEN | Cart/history APIs | booking/order snapshot model | Customer self-service | Phase 4-5 |
| UC24/28/29 | Concession sales | BLOCKED_BY_DECISION | P1 | SRS + DB | C13 + Staff POS | Inventory, Payment | Standalone purchase? combo stock composition? pickup lifecycle? | SRS allows separate order; implementation contract absent | Owner choose order boundary and stock reservation behavior | OPEN | Catalog/cart/order APIs | orders, concessions, combos | Online + counter reuse | Phase 4/6 |
| UC25-27 + BR17,20,40 | Counter ticketing/QR | FUTURE_PHASE | P1 | SRS + screen flow | Staff POS/scan variants | Booking, Payment, Ticket, RBAC | Cash Payment record? scan time/cinema rules? reprint authority? | Screen flow variants incomplete | Reuse shared services; approve scan state matrix | NEEDS_REVIEW | Staff booking/payment/scan APIs | tickets atomic transition | QR result variants | Phase 6 |
| UC30 + BR21-22,56 | Provider-neutral Mock Payment + idempotent success | APPROVED_READY | P0 | Owner decision + SRS draft | C14 states missing | Booking, Ticket | Exact internal enum and persistence shape belong to PAY-001 contract | DB lacks unique provider reference/idempotency persistence | Deterministic mock first; unique provider reference + processing key/state; duplicate callback has no duplicate side effect; late success becomes `REFUND_REQUIRED/REVIEW_REQUIRED` and creates no Ticket | APPROVED | Payment init/result/query + mock callback APIs | payment unique/idempotency + processing state | Failed/pending/retry/late-review states | Phase 4 after Booking contract |
| UC30 external provider subset | Real payment gateway integration | BLOCKED_BY_DECISION | P1 | SRS draft | C14 | Payment contract, deployment, Refund | Provider, signature format, reconciliation, credentials and provider-specific timeout | No provider has been selected | Keep provider-neutral port; defer VNPay/MoMo/other adapter until separate approval | DEFERRED | Provider callback/redirect APIs | provider transaction/event records | Provider redirect/result states | Deferred after Mock Payment |
| UC31 + BR23-24 | Voucher | BLOCKED_BY_DECISION | P1 | SRS | Checkout/Promotion | Promotion, Cart, Payment | stacking, reservation, consumption/release, per-user rule | SRS says “configured rules” but no rule model | Approve voucher lifecycle before checkout integration | OPEN | Quote/reserve/release APIs | voucher redemption missing | Validation/error states | Phase 4/7 |
| UC32 | Promotion management | DRAFT_NEEDS_REVIEW | P2 | SRS + DB | Manager Promotion | Voucher/Pricing/RBAC | eligibility DSL, activation, overlap, loyalty coupling | Current DB only basic discount fields | Start with explicitly approved simple promotion subset | NEEDS_REVIEW | Manager promotion APIs | promotions/vouchers | Form/confirm/success | Phase 7 |
| UC33/34/49 + BR25,40,43 | Cancellation/Refund | BLOCKED_BY_DECISION | P0 | SRS current draft | Refund status/review missing | Booking, Payment, Ticket, Notification | cutoff, amount, concession bundle, authority, retry, failed refund, checked-in ticket | UC49 references missing BR57-59; Staff/Manager authority ambiguous | Mark future implementation blocked; owner approves policy/state matrix first | OPEN | Refund request/process/status APIs | refund/payment/booking/ticket states | Customer status + manager review | Deferred Phase |
| UC36-37 | Staff account | DRAFT_NEEDS_REVIEW | P2 | SRS | Admin Account screens | RBAC, Branch | transfer/disable/session effect/audit fields | Screen flow requires audit; DB only embedded employeeProfile | Approve staff identity/profile boundary | NEEDS_REVIEW | Admin account APIs | accounts + audit | CRUD/confirmation states | Phase 8 |
| UC38 | Staff shift | BLOCKED_BY_DECISION | P2 | SRS + DB | Staff Shift Monitoring | Staff, Branch | creation, assignment, clock-in/out, attendance, station, approval | SRS chỉ “monitor/review”; DB fields không đủ full attendance | Không invent attendance; define minimal release scope | OPEN | Shift query/command APIs | staff_shifts lifecycle | Monitoring screens | Deferred/Phase 7 |
| UC39/40 | Inventory | BLOCKED_BY_DECISION | P1 | SRS + DB | Inventory/Stock Goods | Concession, Payment, Supplier | product vs ingredient, combo recipe, reservation, ledger, correction | DB tracks concession quantity only; stock transaction lacks approved lifecycle | Approve stock unit and authoritative mutation path | OPEN | Inventory read/receive/reserve APIs | inventories + immutable movement | Staff inventory | Phase 6 |
| UC41 | Room/physical Seat foundation | APPROVED_READY | P0 | Owner decision + SRS + DB | Configure Room Seat Maps | Branch, Showtime | Seat-type pricing is a separate pricing decision | Current DB embeds seats but lacks layout version | Version Room layout after Showtime reference; preserve old versions; availability remains `Showtime + Seat`; no historical hard-delete | APPROVED | Cinema/room/seat read/admin APIs | rooms versioned physical layout | Read/manager map UI | Phase 2/7 |
| UC42 | Dashboard & Analytics | DRAFT_NEEDS_REVIEW | P2 | SRS | Manager Dashboard | Payment, Booking, Ticket, Showtime | KPI formula, timezone, refund inclusion, occupancy denominator | UC44 currently describes dashboard behavior | Define metric glossary/read model | NEEDS_REVIEW | Analytics query APIs | projection/index strategy | Dashboard charts | Phase 7 |
| UC43 | Export Revenue Reports | DRAFT_NEEDS_REVIEW | P0 | SRS | Revenue Reports | Reporting definitions | recognition basis, filters, export artifact/audit | UC43 body describes movie analysis, not export | Rewrite/approve UC43 with export flow | NEEDS_REVIEW | Export endpoint/job | read model/export metadata | export states | Phase 7 after approval |
| UC44 | Analyze Movie Sales | DRAFT_NEEDS_REVIEW | P0 | SRS | Movie Sales Analytics | Reporting definitions | metric/filter definitions | UC44 body describes general dashboard, not movie sales | Rewrite/approve UC44 with movie metrics | NEEDS_REVIEW | Movie analytics endpoint | read projection | analytics screen | Phase 7 after approval |
| UC45-47 + BR32-35 | Role/Permission management | DRAFT_NEEDS_REVIEW | P1 | SRS + code | Admin Role screens | Audit, session policy | role deletion, system role protection, immediate propagation | Basic role model exists; mutation APIs absent | Approve management lifecycle; keep seed names stable | NEEDS_REVIEW | Role/permission APIs | roles/permissions/audit | Admin screens | Phase 8 |
| UC48 + BR51-53 | Branch management | APPROVED_READY | P1 | Owner decision + SRS + DB | Admin Branch | Room, Showtime, Booking, Payment | Admin CRUD confirmation/audit details remain Phase 8; operating hours and branch-scoped RBAC are deferred | DB bootstrap is empty and needs idempotent development seed | `branchName/address` required; `email/hotline` optional; `ACTIVE/INACTIVE`; public only active; no historical hard-delete; block disable with future published Showtime | APPROVED | Public Cinema API approved; admin APIs follow later contract | branches unique normalized name + status; seed Branch/Room/layout | Public list ready; admin CRUD later | Phase 2 read/8 admin |
| BR29/34 + Account direct permission | Global RBAC enforcement + role routing | APPROVED_READY | P0 | Owner decision + SRS + code | Role layouts/403 | Auth, Roles, Accounts | Branch-scoped authorization remains separate | Global grant union, backend enforcement, next-request effect and redirect priority are approved; middleware/layouts remain unimplemented | Implement `requirePermission`, current-account permission lookup, `401/403`, redirect priority `ADMIN>MANAGER>STAFF>CUSTOMER` | APPROVED | `/auth/me`, protected APIs | roleIds/directPermissionIds | guards/layouts/403 | Phase 0; branch scope later |
| NFR Performance | Capacity/latency | DRAFT_NEEDS_REVIEW | P1 | SRS | All | Deployment, workload model | percentile, endpoint classes, dataset, test environment | SRS có 300 concurrent/no degradation và CR “most screens <3s” nhưng thiếu measurable SLO | Define p95 and load-test profile | NEEDS_REVIEW | All | indexes/query plans | UX timeout/retry | Cross-phase |
| NFR Security/Audit | Security/audit | DRAFT_NEEDS_REVIEW | P0 | SRS + code | 403/error screens | Auth/RBAC/logging | CSRF strategy, audit retention, correlation, secret handling | Cookie auth + no explicit CSRF decision; audit store absent | Threat review + minimal audit contract | NEEDS_REVIEW | Protected APIs | audit collection/index | 403/session UX | Phase 0+ |

## Deferred / Unfinished SRS Requirements

### Cancellation / Refund

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Cần owner chốt cutoff, eligibility, full/partial amount, ticket/concession bundle, checked-in behavior, Staff/Manager authority, auto/manual path, retry và state matrix. UC49 hiện tham chiếu BR57-59 không tồn tại.

### Showtime cancellation

Safe lifecycle đã `APPROVED` nhưng `NOT IMPLEMENTED`: `DRAFT/PUBLISHED/CANCELLED`, derived display states, configurable 15-minute default cleanup, layout snapshot on publish và edit/cancel chỉ trước khi có hold/giao dịch. Cancellation có paid/pending transaction tiếp tục `BLOCKED_BY_DECISION` đến khi Refund contract được duyệt.

### Seat holding / Double booking

Core behavior đã `APPROVED` nhưng `NOT IMPLEMENTED`: configurable default 10 phút, dedicated `SeatHold`, owner/checkout identity, một active hold cho mỗi `Showtime + Seat`, multi-seat all-or-nothing và expiry/release idempotent. BOOK-001 vẫn phải chốt persistence/index/cleanup topology và test strategy trước BOOK-003; đây là contract implementation task, không còn là business-decision blocker.

### Payment timeout / idempotency

Mock Payment boundary đã `APPROVED` nhưng `NOT IMPLEMENTED`: provider-neutral deterministic mock, unique provider reference + processing key/state, duplicate callback không lặp side effect, late success không confirm Booking/không phát hành Ticket và chuyển `REFUND_REQUIRED/REVIEW_REQUIRED`. Gateway thật, signature/reconciliation theo provider và automatic refund tiếp tục `DEFERRED`.

### Voucher

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Chưa chốt stacking, reservation, consumption/release và concurrency.

### Inventory

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Chưa chốt sellable unit vs ingredient, combo recipe, reservation, correction và ledger.

### Staff shift

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Không được suy diễn thành full attendance system từ UC “monitor shifts”.

### RBAC direct permission

Effective union và global enforcement policy đã `APPROVED`; `/auth/me` union hiện `IMPLEMENTED`, còn middleware/layout implementation chưa làm. Branch-scoped authorization và Role Management lifecycle vẫn chưa final. Không xóa `directPermissionIds`.

### Loyalty

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. Screen flow có VIP/points/rewards sâu hơn rule/data contract hiện có; đưa `FUTURE_PHASE`.

### Reporting

`REQUIREMENT NOT FINALIZED` và `NOT IMPLEMENTED`. UC43/UC44 semantic bị đảo; metric glossary/revenue recognition/timezone/refund inclusion thiếu.

### NFR gaps

`REQUIREMENT NOT FINALIZED`. Thiếu measurable p95/error rate/availability target, load-test dataset, backup RPO/RTO, audit retention, CSRF/cookie deployment policy, accessibility/browser matrix và observability acceptance criteria.

## Approval queue

Thứ tự đề nghị owner review:

1. P0/P1: Ticket-only Checkout MVP hay gồm Cart/Concession; seat-type pricing source.
2. P0: UC43/UC44 correction.
3. P0/P1: Cancellation/Refund + Showtime cancellation policy.
4. P1: Branch-scoped RBAC, Voucher, Inventory và Cart/Order boundary.
5. P2: Staff shift, loyalty và advanced administration.
