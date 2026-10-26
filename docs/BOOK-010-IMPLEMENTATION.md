# BOOK-010 — Confirm / expire Booking

Implemented 2026-10-24. Owner: Hieu (Booking); consumers/reviewers: Cuong (Payment), Ha (SeatHold). Sources: current Iter2 row 31, approved decisions A-17 through A-23 in PROJECT_CONVENTIONS, UC20/UC30 requirements recorded in REQUIREMENTS_STATUS and the online-booking/payment-gateway design documents. No UI change.

## Resulting behavior

- The existing internal confirmBookingAfterVerifiedPayment port is called by Payment after verified success. No public HTTP endpoint can directly confirm a Booking. Its response fields and CONFIRMED / ALREADY_CONFIRMED / EXPIRED_REVIEW_REQUIRED outcomes stay unchanged.
- PENDING_PAYMENT becomes CONFIRMED only after the SeatHold owner port reports CONSUMED and the Booking compare-and-set returns a persisted CONFIRMED record. The repository also requires expiresAt > confirmedAt. Missing transaction/transition adapters, invalid verification time/payment ID, unknown Booking/hold results and failed conditional writes fail closed; no synthetic successful state is returned.
- Replay of an already confirmed Booking for the same payment is read-only and remains successful even after the original deadline. A different payment ID cannot rebind that Booking. EXPIRED is terminal.
- At the exact expiry instant, or later, a verified success expires the pending Booking and releases its hold in one transaction. Payment continues to map this outcome to REVIEW_REQUIRED using its existing logic. This task does not issue Tickets/QR or implement refunds.
- A rejected multi-seat consumption can already have modified some claims inside its transaction. Booking aborts that entire transaction, then reloads and expires/releases through the SeatHold owner port in a fresh transaction. Claims owned by another hold are preserved. No SeatHold repository implementation was duplicated or changed.
- Customer detail/history reads of an overdue pending Booking re-read it inside a transaction before releasing the hold and marking EXPIRED. A concurrent confirmation is preserved. Failure to persist expiry rolls back the release. A consumed hold cannot be expired by this read path.

## Integration and persistence

Changed runtime files: server/src/modules/booking/booking.service.js and booking.repository.js. Added tests: server/test/booking-lifecycle.test.js and booking-lifecycle.mongo.test.js. This document is the task report.

No HTTP API, route, status enum, new error code, schema, index, seed, dependency or migration change. The existing BOOKING_HOLD_NOT_AVAILABLE code is used for transition conflicts. Existing Payment callers already supply paymentId and use Booking-owned transactions. Lifecycle adapters are now required instead of being optional successful no-ops; review this stricter internal behavior with Payment/SeatHold owners before merge.

An optional external Mongo session remains supported. The caller must own commit/rollback: rejected seat consumption throws HoldConsumptionRejected to abort partial writes. It must not swallow that error and commit; after rollback it may retry without an external session to obtain the ordinary expiry/review outcome. Current Payment code does not pass an external session.

Expiry persistence is lazy, through verified callback or customer detail/history access, as in the existing workflow. There is no new timer/background cleanup worker. An idle document may retain PENDING_PAYMENT until accessed, but expired time cannot grant confirmation. Scheduled cleanup topology and automatic refunds are not introduced here.

Payment writes its settlement after the Booking transaction in the current Payment-owned workflow. Crash recovery between those two writes, distributed Payment callback coordination and real Ticket issuance remain Payment/Ticket integration concerns; this task does not claim atomicity across Payment + Booking or completion of E2E-001.

## Verification

- node --test test/booking-lifecycle.test.js test/booking.test.js test/booking-authorization.test.js test/payment.test.js test/seat-hold.test.js: 50 passed, 0 failed, 0 skipped.
- node --test test/booking-lifecycle.mongo.test.js: 13 passed, 0 failed, 0 skipped (12 subtests plus their parent). Real replica-set transactions in a uniquely named book010_test_* database, automatically dropped in finally. Includes concurrent confirmations, exact/late expiry, partial-seat rollback, failed Booking-write rollback, transactional expiry rollback, stale detail reads, competing expiry/confirmation transactions, dependency/verification guards, external-session rollback and actual Payment repository/service integration with duplicate callback.
- Backend npm run lint and git diff --check: passed.
- Existing Mongoose deprecation notices about the new option are informational; no related dependency or SeatHold changes were made.

No development Atlas data was written. No task-board state, commit, push or merge was performed. No new business-decision blocker for the scoped Booking changes; shared lifecycle integration review remains required before merge. This task is backend-only and does not constitute a full browser-to-Ticket E2E test.

## Reverification — 2026-10-25

Rechecked against HEAD 688a68c plus the existing BOOK-010 working-tree implementation after the latest pull. Payment calls the Booking port with its persisted paymentId and server verification time; booking.module.js forwards consume/expire commands through the SeatHold service. No additional runtime change was necessary in this pass.

Reran the 50 Booking/authorization/Payment/SeatHold/unit checks and all 13 isolated MongoDB lifecycle checks: all passed, none skipped. Backend lint and diff check passed. The MongoDB suite exercised real Payment persistence plus Booking/hold/seat transactions in book010_test_* and dropped that disposable database afterward. Development data was untouched. INT-FE-001 and other working-tree changes were preserved. Human cross-owner review has not been performed by these automated checks.


CON-102 integration (2026-10-25): approved optional linked food now joins the same Booking/SeatHold confirmation and expiry transactions through the Concession owner port. Ticket-only behavior remains supported. See CON-102-IMPLEMENTATION.md for additive amounts, cancellation and migration.
