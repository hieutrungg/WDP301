# PROMO-101 — Promotion / Voucher integration contract

Date: 2026-10-27. Status: **APPROVED FOR IMPLEMENTATION by Hiếu in this chat. Cross-owner review remains required before merge.**

Implementation update: backend and Manager/C14/confirmation/history UI are now delivered in the working tree. See `PROMO-101-IMPLEMENTATION.md` for actual behavior/tests and `PROMO-101-DATABASE.md` for the pending owner-run rollout. The proposal/preparation wording below is historical and superseded by the approval and implementation records; no development migration was applied.

Approval record: after the concrete contract and a detailed explanation of P1–P7, Hiếu replied: “tôi thấy rất hợp lý, hãy chuẩn bị làm thôi bạn ơi”. This authorizes the proposed package and its dependent implementation. It does not authorize applying migrations/backfills/seeds to development Atlas, changing the SRS, committing/pushing or marking the tracking sheet Done. The proposal wording below is retained as design history; this record supersedes its pending-approval labels.

## Authority and sources

The twelve rules in the owner's PROMO-101 request are approved business scope. P1–P7 and the additive HTTP/service/persistence contract below are now approved for implementation by the subsequent owner answer recorded above. Human cross-owner integration review has not yet taken place.

Read for this review:

- `AGENTS.md`, `PROJECT_CONVENTIONS.md`, `REQUIREMENTS_STATUS.md`.
- Current [SRS - G5](https://docs.google.com/document/d/116F63OfQO-ljWkpJXMsOeYsRBHitgqcDKdS0DtPfh4c/edit), §3.4.2 **CMS_UC30 Apply Voucher**, §3.4.3 **CMS_UC31 Manage Promotions**, BR-23/24/41. Historical UC31/32 references in local tracking are stale. SRS also includes Staff, loyalty and broader discount types; this task's narrower owner instruction takes precedence. No SRS edit is proposed.
- [WDP301_G5_Project_Tracking](https://docs.google.com/spreadsheets/d/1MAx0E_PSI7R8fHpBKPF2tsIzboB8lf9Sh1ZwwFaz4O4/edit), Iter3 row 13 / task 8: PROMO-101, Hiếu, To Do, draft/blocked by stacking and per-user rules. Those two business blockers are resolved by the owner's current request; exact integration remains unapproved. This is the accessible current tracking sheet. Drive search did not locate a separately named **F-Cinema — Team Development Plan** or its contract/decision registry; those sources have not been verified and must not be represented as approved.
- `3-detailed-design/promotion-loyalty.md`, `BOOK-010-IMPLEMENTATION.md`, `CON-102-INTEGRATION-CONTRACT.md`, `SCREEN_FLOW.md` and related C14 / Manager promotion nodes in `screen-flow.drawio`.
- [Stitch project](https://stitch.withgoogle.com/projects/12758682447811659045), Promotion Management, Promotion Form and C14: executive table/search/status filters, create/edit form, red primary actions and dark F-Cinema shell; C14 split form / sticky summary and existing countdown. Read the selected screens' design descriptions. Omit sample KPI telemetry, fixed cash, free food, upgrades, membership, points, minimum spend, discount caps and daily budgets. UI inspection/testing of an implementation has not occurred.
- Current Booking, SeatHold, Concession, Payment, Ticket, Refund source and tests; package manifests; reference DB validators/index script. Git working tree was clean at the start.

## Decisions requested (recommended package)

| ID | Concrete proposal | Effect / example |
| --- | --- | --- |
| P1 | Shared reusable voucher code across Customers; Manager selects a positive integer `usageLimit` or explicitly `null` for unlimited. Limit is **per code**, no additional campaign-wide quota. | Available capacity = limit − consumed − currently reserved. Different codes in one campaign have separate limits. One successful use per Customer/code always applies. |
| P2 | Campaign has mandatory `startDate < endDate`. Each code inherits that window; persist its existing `validFrom/validTo` equal to the campaign dates, without separate date controls in this increment. Eligible for a **new reservation** when `startDate <= now < endDate`. UI enters/displays Vietnam time, API sends UTC ISO timestamps. | At the end instant no new holds. Distinct codes may overlap freely. No automatic application without a code. |
| P3 | A reservation successfully acquired while eligible keeps its original discount until original SeatHold expiry, even if campaign/code later expires or Manager disables it. | Disable stops new holds. An already held code still works on a retry within the original deadline. No hold extension. |
| P4 | Code and parent campaign are immutable after code creation. Campaign name/rate/dates may be edited, with existing reservation/sale snapshots preserved. Limit may change only to null or an integer >= consumed + unreleased held count; status remains togglable. | Never reuse/rename an old code to evade one-use-per-Customer. Editing a campaign affects subsequent reservations; existing customers retain their snapshot. All quota checks/edit/reserve share a DB write conflict boundary. |
| P5 | Percentage accepts up to two decimal places, greater than 0 and <=20. Compute ticket discount once on **aggregate ticket subtotal**, round down to whole VND using integer basis points / BigInt arithmetic. | 100,005 VND × 10% = 10,000 VND discount; food stays unchanged. No per-seat rounding or discount cap. |
| P6 | Apply/replace/remove only before **first Payment initiation**. Payment first persists a Booking pricing lock in MongoDB before creating its amount snapshot or gateway instruction. Once locked, even failed/cancelled attempts retry the same amount and same reservation until checkout ends. | Cancelling a QR attempt does not unlock prices or release voucher. Entire-checkout cancellation releases the reservation. No new Payment status or invisible gateway repricing. |
| P7 | Reuse existing `requireAuth` + `requireRole("MANAGER")` for management and `requirePermission("booking.create")` + `requireRole("CUSTOMER")` for voucher checkout commands. No new permission seed in this increment. | Manager-only management; Admin/Staff without Manager role denied. A Customer with booking.create revoked is denied. Existing middleware reloads active account/role/direct grants each request. A granular promotion permission can be a separately approved RBAC change. |

P1–P7 and the following additive contract were approved as a package through the owner answer above. None is inferred from the mockup. In particular, reservation survival after disable and freezing voucher edits after first initiation were explained as product-visible decisions before approval.

## Approved invariants (implementation acceptance criteria)

1. Percentage only, max 20%, tickets only; unchanged concession/combo prices. One code per Booking, no stacking; all branches/films/rooms/customer groups equally eligible.
2. Same Customer can successfully use the same code once across all Bookings. The same Customer cannot hold that code on two concurrent checkouts.
3. Voucher holds use the existing authoritative SeatHold deadline. Payment success consumes once; whole-checkout cancellation/expiry releases once. A failed payment attempt while retry is allowed keeps the hold.
4. Refund never restores consumed quota or per-Customer eligibility. Backend computes and snapshots money in integer VND, ignoring any client-supplied discount/total.
5. No loyalty implementation. Future reward-issued vouchers can invoke the same eligibility/pricing/reservation port after a separate issuance contract is approved.

## HTTP contract (all endpoints below are proposed)

Use existing `{ success:true,data,...meta }` and `{ success:false,code,message,errors:[] }` envelopes. Strict bodies reject unknown fields including customer IDs, totals, scope criteria, arbitrary statuses and counter values. ObjectId params are validated before repository access. No public consume/release endpoint.

| Endpoint | Request | DTO / authorization |
| --- | --- | --- |
| `GET /api/promotions` | `page=1`, `limit=20` (max 100), optional `q`, `status=ACTIVE/INACTIVE`; sort creation descending, ID tie-break | Page of PromotionDto; Manager guard P7. q matches escaped name text, never executes client regex. |
| `GET /api/promotions/:promotionId` | ObjectId | PromotionDto; Manager guard. |
| `POST /api/promotions` | `{name,discountValue,startDate,endDate,status}`; name trimmed 1–150 chars; status ACTIVE/INACTIVE | 201 PromotionDto; Manager guard. Stored discountType is PERCENTAGE, never selected by client. |
| `PATCH /api/promotions/:promotionId` | Partial create fields plus required integer `expectedVersion`; at least one changed field | PromotionDto; Manager guard; stale edit → 409. Status toggle uses this route. |
| `GET /api/promotions/:promotionId/vouchers` | Pagination as above | Page of VoucherDto; Manager guard. |
| `POST /api/promotions/:promotionId/vouchers` | `{code,usageLimit,status}`; normalized trim/uppercase ASCII `[A-Z0-9_-]{3,40}`; usageLimit safe integer >=1 or explicit null | 201 VoucherDto; Manager guard. No client usedCount/reservedCount. |
| `PATCH /api/vouchers/:voucherId` | `{expectedVersion,usageLimit?,status?}` | VoucherDto; Manager guard. Code/parent/dates not editable here. |
| `POST /api/bookings/:bookingId/voucher/quote` | `{code}` | DiscountDto; Customer guard and ownership. Read-only estimate; reserves nothing, cannot authorize payment. |
| `PUT /api/bookings/:bookingId/voucher` | `{code,requestKey,expectedPricingVersion}` | DiscountDto; Customer guard and ownership. Atomically reserve/replace and update Booking. |
| `DELETE /api/bookings/:bookingId/voucher` | `{requestKey,expectedPricingVersion}` JSON body | DiscountDto with voucher null, discount zero; Customer guard and ownership. Idempotent remove. |

`requestKey` is opaque 1–100 characters. A key replay with identical booking/command/code returns the recorded command result without side effects; reuse with different input conflicts. Results include their pricing version; UI reloads latest Booking after replay if needed. New keys must supply current expectedPricingVersion. No hard deletion endpoint for campaigns/codes with history.

DTO whitelist:

- **PromotionDto**: `id,name,discountType,discountValue,startDate,endDate,status,displayStatus,version,createdAt,updatedAt`. displayStatus derived Scheduled/Active/Expired/Disabled from time and stored ACTIVE/INACTIVE; do not persist display states.
- **VoucherDto**: `id,promotionId,code,usageLimit,usedCount,reservedCount,remainingUses,validFrom,validTo,status,version`. remainingUses null when unlimited. No Customer list/account details. Reserved count reconciled for expired reservations before capacity mutation; list reports the persisted count and its server time rather than claiming a live external metric.
- **DiscountDto**: `bookingId,pricingVersion,ticketAmount,discountAmount,concessionAmount,amount,currency,voucher,expiresAt,pricingLocked,idempotent,serverNow`. `voucher` null or `{voucherId,code,promotionName,discountValue,reservationId,status}`; all values server-derived. Quote additionally identifies `quoted:true`, with no reservationId/status pretending a hold exists.
- Existing Booking creation/detail/history and Payment booking summaries gain consistent `ticketAmount,discountAmount,concessionAmount,voucher,pricingVersion,pricingLocked`. Existing amount/totalAmount retain payable meaning. Omit private account/catalog documents and internal database errors.

## Lifecycle and cross-module contracts

Promotion owns eligibility, quota and reservations. Booking owns authoritative prices and lifecycle. Payment owns verified settlement and gateway instruction. Refund owns actual-paid refund calculation. A Customer cannot directly confirm redemption.

Proposed Promotion owner service ports (mandatory transaction session for mutations):

| Port | Trusted input / result |
| --- | --- |
| `quoteForBooking` | `{bookingId,customerAccountId,code,ticketAmount,expiresAt,now,session?}` → immutable discount values; Booking supplies trusted amount/owner/deadline. |
| `reserveForBooking` | Same trusted context + command key → snapshot + reservation; check quote eligibility again atomically; no client discount input. |
| `consumeForConfirmedBooking` | `{bookingId,reservationId,paymentId,verifiedAt,session}` → consumed or same-payment idempotent result; released reservation never reacquired here. |
| `releaseForClosedBooking` | `{bookingId,reservationId,reason,now,session}` → released/idempotent result; consumed is preserved. |
| `releaseForPricingChange` | Booking-owned pre-payment transaction only; replacing reserves the new code and releases old atomically, retaining old code if new code is invalid/full. |

Proposed Booking port `lockPricingForPayment({bookingId,ownerId,now})` uses a transaction and conditional write on Booking, checks pending/unexpired hold and attached reservation, then records pricingLockedAt/pricingVersion and returns the frozen payable DTO. Payment must use its returned values and assert any existing Payment amount/version matches; never silently overwrite a stored Payment/gateway amount. Apply/remove writes the same Booking document, so multi-process initiation races conflict in MongoDB instead of relying on the current process-local Payment lock.

- `PENDING_PAYMENT` Booking apply: reserve quota + per-Customer claim + immutable discount snapshot + Booking totals + command record in one Mongo transaction. Tickets without vouchers continue through current code.
- Successful verified payment: existing BOOK-010 transaction consumes seat/F&B and voucher and confirms Booking together. Callback replay reads same-payment confirmed state. Payment updates settlement afterward as currently; crash recovery retries the same confirmation/payment ID. Ticket remains downstream of verified success. Do not introduce a second success path.
- Attempt failure/cancellation/supersession: no voucher release while Booking remains eligible for retry. Whole checkout cancellation uses existing Booking expiry transition and releases seat/F&B/voucher transactionally.
- At `verifiedAt >= expiresAt`: BOOK-010 closes Booking and releases resources; Payment maps late money to REVIEW_REQUIRED. Released redemption cannot be consumed by late callback even if capacity is available again.
- Expired reservations reclaim capacity lazily on affected voucher mutation and Booking lifecycle reads; use the same release service in a transaction. They cannot confirm even before cleanup. No TTL deletion: historical claims and used state must survive. A worker may later invoke the same owner port; no new scheduler dependency.
- Refund calculation changes from `booking.subtotal` to `booking.subtotal - booking.discountAmount`; add unfulfilled food unchanged. Check safe nonnegative integers and consistency with captured Payment amount; unexpected legacy discounted records fail for review, no guessed repair. Refund must not call voucher release or reduce usedCount. Existing old **undiscounted** records use missing discountAmount as zero. Confirmed/consumed records remain ineligible for reuse after refund.

Example (P5): tickets 200,005; food 80,000; 10% discount 20,000; net tickets 180,005; Payment 260,005 VND. Refund before food fulfillment 260,005; after fulfillment 180,005. Voucher remains consumed in both cases.

## Persistence and concurrency proposal

Reuse existing **promotions** and **vouchers** collections and their parent relationship. Repository currently has no runtime Promotion/Voucher module. Reference bootstrap validators allow broad number/string values and only document a unique raw code index; these files are not evidence that deployed validators/indexes/data match. Live Atlas inspection has not been run.

Proposed additive changes:

- promotions: retain existing name/discountType/discountValue/startDate/endDate/status; add version and audit timestamps/actor IDs. Restrict new runtime writes to approved percentage subset after P1–P7 approval. Legacy unsupported records block voucher readiness until separately reviewed.
- vouchers: retain promotionId/code/usageLimit/usedCount/validFrom/validTo/status; add reservedCount, version and audit fields. `null` unlimited is an explicit validator change needing approval, not silently compatible with old numeric validators. Validate code normalization collisions, parent validity, date equality and integer counters before index/validator changes. Never infer historical Customer usage from usedCount.
- **voucher_redemptions**: reservation IDs, bookingId, customerAccountId, voucherId, pricingVersion, state RESERVED/CONSUMED/RELEASED, blocking flag, original expiresAt, snapshot, paymentId and event timestamps. RESERVED and CONSUMED have blocking=true; released false. Immutable released rows retain audit; each new application has a new reservation ID.
- **voucher_commands**: bookingId/requestKey + normalized command fingerprint + recorded result, for replay across apply/remove cycles without repeating quota effects.
- Booking: optional voucherId and immutable voucher snapshot, pricingVersion (legacy default 0), pricingLockedAt. Existing subtotal is gross tickets, discountAmount ticket-only, concessionAmount unchanged; totalAmount = subtotal − discountAmount + concessionAmount.
- Payment: additive pricing version provenance, frozen with existing amount. No lifecycle enum changes and no migration that rewrites old money.

Required index shapes (proposed names):

| Collection | Index / invariant |
| --- | --- |
| vouchers | Unique normalized canonical `{code:1}`; reuse equivalent existing unique raw-code index only after stored values verified canonical. |
| voucher_redemptions | Unique `{customerAccountId:1,voucherId:1}` partial `{blocking:true}`; one held or permanently consumed claim per Customer/code. |
| voucher_redemptions | Unique `{bookingId:1}` partial `{blocking:true}`; one applied code per Booking. |
| voucher_redemptions | `{voucherId:1,state:1,expiresAt:1}` for expired reservation reclamation. |
| voucher_commands | Unique `{bookingId:1,requestKey:1}` for idempotency. |

Reserve/release/consume conditionally mutate the voucher counter document and the redemption state **in one transaction**, plus Booking changes where applicable. Admission uses usedCount + reservedCount < usageLimit or explicit unlimited. Capacity edits contend on that same document. Campaign edit/disable and reserve must also write a campaign version/fence to serialize eligibility; a read-only campaign check is insufficient under snapshot isolation. Consume changes RESERVED→CONSUMED and moves one reservedCount to usedCount; release changes RESERVED→RELEASED and decrements reservedCount once. Replays never adjust counts. Reclamation checks state+deadline and cannot release a consumed row. All successful responses follow committed writes.

Require replica-set transactions, matching validators and actual unique/partial index options. Missing/mismatched index, unknown legacy policy/counters, DB failure or unavailable transaction support fails closed for voucher commands. Do not fall back to an in-process lock, frontend evidence or a non-atomic sequence. Ordinary checkout without a code remains usable. Runtime must not create collections/indexes, backfill or seed Atlas automatically.

## Proposed errors

Existing auth 401/403 and generic validation behavior stay unchanged. Additional stable identifiers require owner/consumer review:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | INVALID_PROMOTION / INVALID_VOUCHER | Strict body/param/query validation; field errors for Manager forms. |
| 404 | PROMOTION_NOT_FOUND / VOUCHER_NOT_FOUND | Unknown Manager resource. |
| 404 | BOOKING_NOT_FOUND | Missing or another Customer's Booking for new voucher endpoints; no ownership details exposed. |
| 409 | VOUCHER_UNAVAILABLE | Invalid/disabled/outside date window for new reservation; no raw DB info. |
| 409 | VOUCHER_LIMIT_REACHED | No unreserved capacity. |
| 409 | VOUCHER_ALREADY_USED / VOUCHER_HELD_ELSEWHERE | Same Customer/code consumed or held by another checkout. |
| 409 | VOUCHER_CODE_TAKEN / VOUCHER_LIMIT_CONFLICT | Manager uniqueness/counter conflict. |
| 409 | VOUCHER_REQUEST_KEY_REUSED / BOOKING_PRICING_CHANGED | Changed replay input/stale pricing version. |
| 409 | BOOKING_PRICING_LOCKED / BOOKING_HOLD_EXPIRED | Payment pricing locked or original checkout expired. |
| 409 | PROMOTION_VERSION_CONFLICT | Manager stale edit. |
| 503 | VOUCHER_STORAGE_NOT_READY | Required indexes/validators unavailable or incompatible legacy data. |

Unexpected DB errors remain sanitized 500, with no synthetic successful application. UI preserves code input for retry and only displays a held voucher returned by committed server state.

## UI integration and validation plan

Manager `/manager/promotions`, `/manager/promotions/new`, `/manager/promotions/:promotionId/edit`: existing layout/navigation, server list/search/pagination/status, campaign form and associated code creation/edit/status controls. Percentage-only input; global ticket-only scope text. No mock analytics, future buttons or configurable conditions outside approved scope. Edit shows actual usage and current version conflict recovery. Desktop table becomes readable cards/scroll region on small screens; forms have labels, field errors, visible focus and accessible pending/success announcements.

C14 adds labeled code input, Apply/Remove, error/retry state and authoritative gross tickets/discount/food/payable breakdown. Create/restore Booking using existing idempotent flow before apply. Key server state by account + Booking, clear on logout/checkout change, reject stale asynchronous results. Reload authoritative state after uncertain writes. Disable conflicting actions while busy and code changes once pricing locked; show the reason and retain payment retries. Confirmation/history consume the stored snapshot. Never recalculate discounted payment from local state.

Required verification after approval: percentage boundary/rounding/overflow; ticket-only money; no stacking; per-Customer usage across Bookings; concurrent last slot and same-Customer holds using real Mongo transactions; idempotent command replay including remove/reapply; failed replacement rollback; edit/disable/reserve races; consume/release races; duplicate callback and same/different payment IDs; full cancellation vs failed attempt; exact/late expiry and quota reclamation; refund preservation; missing indexes/validators/legacy counters/DB faults; Guest/Staff/wrong owner/locked account/revoked permission; desktop/mobile keyboard/error/retry/empty states. Include real payOS adapter amount checks without sending real money.

## Ownership, rollout and approval gate

Provider: Hiếu, Promotion/Booking implementation. Consumers/reviewers: Hiếu (checkout/history/Concession), Cường (Payment/Ticket + RBAC), Hà (SeatHold/counter reuse), Nam (food/Inventory); Refund owner also reviews net-paid refund math. Existing nominal task ownership must be checked against the unavailable separate Team Development Plan before merge. No cross-owner approval is claimed.

After approval, supply versioned migration with default inspect-only mode and explicit `--database` required for both inspection/apply; `--apply` opt-in plus exact database identity confirmation. Inspect deployed validators/index options and incompatible data first; stop on duplicates, unknown legacy redemptions/counters or unsupported types. No delete/drop/repair, no seed/backfill. Save a plan/report, rerun inspection after user application, then enable voucher readiness. Provide exact PowerShell commands only once the executable script exists; no pretend apply command in this draft. Tests use unique `promo101_test_<pid>_<timestamp>_<random>` DB, with matching exact-name and prefix assertions before cleanup, never the development DB.

This review changes no runtime endpoint, schema, enum, index, dependency or deployed database. Implementation dependent on P1–P7 is authorized but not yet delivered. Migration impact and API/service changes above are **approved for implementation**, not deployed.
