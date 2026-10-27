# PROMO-101 — Implementation report

Date: 2026-10-27. **Backend and UI implemented in the working tree. Development Atlas migration application and human cross-owner merge review remain pending.** Hiếu approved P1–P7 and the additive contract in this chat, then explicitly requested implementation.

## Implemented behavior

- Manager lists/searches campaigns, creates/edits percentage, name, Vietnam-time validity and status; creates immutable code strings and edits code quotas/status. Codes inherit campaign dates. No fixed discounts, mock analytics, loyalty, minimum spend, discount caps or extra eligibility conditions.
- Customer C14 creates/restores the existing Booking, then applies/replaces/removes a code through strict backend commands. Input survives errors; account/showtime/checkout state is scoped. Confirmation/history display recorded discount snapshots.
- Backend floors the aggregate ticket discount once with integer basis points and BigInt arithmetic. Percentage is greater than 0, at most 20, up to two decimals. Food/combo amounts are unchanged; no client money is trusted.
- Mongo transactions, conditional counter writes and unique partial indexes enforce quota, one blocking Customer/code claim and one applied code per Booking. Campaign fences serialize eligibility against edit/disable. Unlimited total quota still enforces Customer uniqueness. Request-key replay persists across apply/remove/reapply.
- BOOK-010's existing transaction consumes/releases voucher together with seats, food and Booking. Failed payment attempts retain live reservations; whole-checkout cancellation/expiry releases once. Late success stays REVIEW_REQUIRED and cannot reacquire released quota. Lazy reclamation retains the original SeatHold deadline.
- Booking persists a pricing lock before the first Payment instruction. Voucher edits contend on the same document across Node processes. Retries keep the same amount/version. A stored Payment mismatch fails rather than being silently overwritten.
- Refund uses gross tickets minus the recorded discount plus unfulfilled food. Invalid/untraceable discounted legacy amounts fail for review. Real Refund processing was tested against MongoDB and leaves the redemption CONSUMED after Booking becomes REFUNDED.
- Runtime creates no Promotion collections/indexes on import/startup. Missing storage fails closed for voucher operations; ordinary ticket checkout does not need Promotion storage. Existing Ticket issuance, physical Seat semantics and role/direct permission union are preserved.

Example: tickets 200,005 + food 80,000, 10% code → discount 20,000, payable 260,005 VND. Refund before food fulfillment =260,005; afterward =180,005. Voucher remains used.

## Changed files

New backend:

- `server/src/modules/promotion/promotion.contract.js`, `promotion.model.js`, `promotion.repository.js`, `promotion.policy.js`, `promotion.validation.js`, `promotion.storage.js`, `promotion.service.js`, `promotion.controller.js`, `promotion.routes.js`.
- `server/src/modules/booking/booking-voucher.service.js`, `booking-voucher.routes.js`.
- `server/src/modules/payment/payment-pricing.read-service.js`.
- `server/src/migrations/20261027-promo101.js`.
- `server/test/promotion.test.js`, `promotion.mongo.test.js`.

Updated backend:

- `server/src/app.js`: route integration.
- `server/src/modules/booking/booking.model.js`, `booking.repository.js`, `booking.service.js`, `booking.module.js`: additive snapshots/versions/lock, commands and lifecycle wiring.
- `server/src/modules/payment/payment.model.js`, `payment.service.js`: frozen price/version and consistency checks.
- `server/src/modules/refund/refund.service.js`: net-paid refund validation/calculation.
- `server/test/booking.test.js`: approved additive DTO assertions.

New frontend:

- `client/src/features/promotions/api/promotionApi.js`.
- `client/src/features/promotions/pages/PromotionsPage.jsx`, `PromotionFormPage.jsx`.
- `client/src/features/promotions/components/PromotionUi.jsx`, `CheckoutVoucher.jsx`.
- `client/src/features/promotions/utils/promotionForm.js`.
- `client/src/features/booking/components/BookingPriceSummary.jsx`.
- `client/test/promotion-checkout.test.js`.

Updated frontend:

- `client/src/app/router/index.jsx`, `client/src/layouts/ManagerLayout.jsx`: routes/menu/breadcrumb.
- `client/src/features/booking/pages/CheckoutPage.jsx`, `BookingConfirmationPage.jsx`, `CustomerBookingsPage.jsx`: code commands and recorded breakdown.
- `client/src/features/booking/utils/checkoutSession.js`: verify discounted Booking replay against unchanged gross ticket/food quote.

Documents: `docs/PROMO-101-CONTRACT-REVIEW.md`, this report, `docs/PROMO-101-DATABASE.md`, additive PROMO status in `docs/REQUIREMENTS_STATUS.md`.

Initial working tree contained only three earlier PROMO preparation documents. No unrelated team edits overwritten. No dependency/package/lockfile, SRS, seed or tracking-sheet Done change. No commit/push.

## API and integration

Implemented contract: `docs/PROMO-101-CONTRACT-REVIEW.md`. All inputs are strict and DTOs allowlisted. No raw account/catalog documents are returned.

- Manager: requireAuth + current MANAGER role. `GET/POST /api/promotions`, `GET/PATCH /api/promotions/:promotionId`, `GET/POST /api/promotions/:promotionId/vouchers`, `PATCH /api/vouchers/:voucherId`.
- Customer: requireAuth + current booking.create + CUSTOMER role, own Booking only. `POST /api/bookings/:bookingId/voucher/quote`, `PUT /api/bookings/:bookingId/voucher`, `DELETE /api/bookings/:bookingId/voucher` (JSON command body). Quote reserves nothing; there is no public consume endpoint.
- Booking calls Promotion owner ports inside its own lifecycle transaction. Payment calls lockPricingForPayment before instructions. Payment's pricing read service exposes only existence for legacy protection. Booking imports the immutable schema from promotion.contract.js rather than Promotion models.
- Additive Booking/Payment booking DTO fields: ticketAmount, discountAmount, concessionAmount, pricingVersion, pricingLocked, voucher summary. Existing amount/totalAmount retain payable meaning. No shared lifecycle enum or permission code changed.

## Database rollout

Reuse promotions/vouchers. Add voucher_redemptions and voucher_commands, strict Promotion validators and unique/expiry indexes. Booking adds optional voucherId/voucherSnapshot/pricingVersion/pricingLockedAt; Payment adds optional pricingVersion. No backfill, seed or historical amount rewrite.

Versioned script defaults to INSPECT_ONLY with explicit --database. Apply requires --apply, exact --confirm-database and --allow-remote for Atlas. Incompatible records/indexes stop application without delete/repair. Equivalent safe indexes are reused. See `docs/PROMO-101-DATABASE.md` for executable PowerShell commands.

Read-only inspection of cinema_management_dev: no incompatible Promotion/Voucher data reported; all four Promotion validators and five required indexes need rollout. Actual Booking/Payment/SeatHold/Order validator/index metadata was read: additive fields are permitted, and existing Booking/Payment/hold/food indexes are present. Promotion/Voucher retain old permissive validators with only _id_ indexes. **No development Atlas DDL or business data was written.**

## Verification

- `node --test --test-concurrency=1 test/promotion.mongo.test.js test/promotion.test.js`: **19 passed, 0 failed/skipped**. Real MongoDB last-slot concurrency, Customer uniqueness, replay/remove/reapply, rollback, snapshots after edits/disable, payment lock race, failure/retry, duplicate callback, exact expiry/late success, lazy quota recovery, real Refund processing, storage readiness, legacy data and real HTTP RBAC/validation/revocation/locked accounts. Includes untraceable/altered Booking snapshot guards and a mismatched frozen-amount Payment replay regression.
- Related backend command over booking.test.js, booking-lifecycle.test.js, payment.test.js, refund.test.js, booking-authorization.test.js, concession-checkout.test.js, payos.test.js, seat-hold.test.js, counter-concession.test.js: **74 passed, 0 failed/skipped**. Provider tests use adapters, no real money.
- Additional booking-lifecycle.mongo.test.js: **13 passed**, no failures/skips.
- Combined BOOK-010 + CON-102 Mongo run: **25 passed / 2 failed**, where failures are one CON-102 scenario and its parent. Existing test/concession-checkout.mongo.test.js:583 expects Staff quote access=403 but gets409. Existing HEAD checkout.routes.js and booking.routes.js already admit CUSTOMER/STAFF; neither route was changed by PROMO-101. Remaining CON-102 scenarios passed. Actor-scope mismatch needs its owner.
- Frontend `node --test --test-concurrency=1 test/*.test.js`: **87 passed, 0 failed**.
- Backend npm run lint: passed. Frontend ESLint on changed runtime files/new test: passed.
- Full frontend npm run lint: existing ManagerShowtimesPage.jsx:115 react-hooks/immutability error and line813 dependency warning; file unchanged.
- Frontend npm run build: passed, with existing large-bundle warning.
- git diff --check: passed during implementation; final verification recorded at handoff.

Browser uses real React + Express + a uniquely named disposable MongoDB, with actual isolated Manager/Customer login. Manager empty state, campaign/code creation, enable/disable and desktop/mobile layouts were exercised. At 390×844 a too-small search field was found, fixed to a stacked layout and visually rechecked. Customer invalid-code input preservation and apply/remove/reapply with authoritative 200,005 →180,005 VND totals were verified. Checkout reload retained the recorded code/discount; actual seat-hold expiry disabled voucher/payment actions without extending the deadline. A new checkout then successfully reused the expired code. Payment initiation locked voucher editing; simulated failure/retry retained the same amount and original hold deadline; simulated success produced CONFIRMED Booking / PAID Payment and one admission Ticket through the existing verified success path. Confirmation displayed gross tickets 200,005, code CINEMA10 / 10%, discount 20,000, food 0, total paid 180,005 VND. Keyboard Tab reached the code action with a visible focus ring; mobile checkout fit at 390×844. QA screenshots: `.codex-tmp/promo101-manager-desktop.png`, `promo101-manager-mobile.png`, `promo101-checkout-mobile.png`, `promo101-confirmation.png`. Test cleanup uses exact database name and a test-prefix assertion; development data is never selected for cleanup.

## Remaining integration notes

Final browser-fixture database assertions before cleanup: voucher usedCount=1, reservedCount=0; Booking CONFIRMED; Payment PAID / amount=180005; exactly one Ticket. Confirmation reload retained the code/discount and Ticket. The agent-created browser tab was closed, its viewport override reset, temporary QA API/Vite processes stopped, and only the exact disposable UI test database was dropped with post-cleanup verification. Screenshot files remain available locally. Final changed-file ESLint/build/checkout tests and Git diff checks were rerun after the UI replay/read handling changes.

- Hiếu must apply development storage using the guide. Before that, voucher/Manager operations return readiness errors while ordinary ticket checkout works.
- Reviewers before merge: Hiếu (Promotion/Booking/checkout), Cường (Payment/Ticket/RBAC), Hà (SeatHold/counter reuse), Nam (food/Inventory), Refund reviewer for net-paid math. Owner approved implementation; human review sign-off is not invented.
- SRS/Stitch and accessible WDP tracking Iter3 were read during preparation. The separately titled Team Development Plan registry could not be located; no unseen registry approval or sheet completion is claimed. Current SRS uses UC30/UC31.
- Payment still persists settlement after Booking's transaction. Existing crash recovery/distributed callback coordination remains Payment's integration concern; this task serializes price changes in MongoDB and makes redemption effects idempotent without redesigning Payment.
- Expiry is lazy; no new production worker. No real payOS transfer, production webhook registration, live provider refund or screen-reader certification is claimed.
