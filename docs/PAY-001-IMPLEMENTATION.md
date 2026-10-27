# PAY-001..005 / FLOW-003 / PAY-TEST-001 — Mock Payment

Owner: Cường (Payment backend, Payment UI component in C14, C15 result). Booking lifecycle and the C14 shell belong to Hiếu (BOOK-009..011); SeatHold belongs to Hà. Payment reaches them only through the Booking ports below. Sources: SRS UC30 (§3.4.1), §1.5.3.1/§1.5.3.3, BR-16/21/36/37/56/60, MSG14/18/19, A-19..A-23, BOOK-010 and CON-102 reports. This document records the implemented contract (status audited 2026-10-27); it does not change any approved decision.

## Ports and ownership boundary

| Port (Booking-owned) | Used for |
| --- | --- |
| `getBookingForPayment({ bookingId, ownerId })` | Ownership (404/403) and the authoritative `totalAmount`, `expiresAt`, `status` |
| `confirmBookingAfterVerifiedPayment({ bookingId, paymentId, verifiedAt })` → `CONFIRMED` / `ALREADY_CONFIRMED` / `EXPIRED_REVIEW_REQUIRED` | The only way a payment confirms a booking. It atomically consumes the SeatHold, or expires booking + hold, inside Booking's transaction (BOOK-010) |
| `getCustomerBookingDetails`, `listCustomerBookings` | C15 / history reads |

Payment never writes Booking or SeatHold documents. Ticket issuance goes through the Ticket port (`docs/TICKET-001-IMPLEMENTATION.md`).

## States

- Payment `status`: `PENDING`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`, `REVIEW_REQUIRED` (+ `REFUNDED`, `PARTIALLY_REFUNDED` used by Refund, A-29).
- Attempt `status`: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`, `LATE_SUCCEEDED`.
- One Payment aggregate per Booking (unique `uniq_payment_booking`), with many attempts. Each attempt has a unique `attemptId` (the transaction id, `uniq_payment_attempt_id`), a client `idempotencyKey`, a `gatewayTransactionRef` and a QR payload. The amount is always the server Booking `totalAmount`; a different client amount gives 400 `PAYMENT_AMOUNT_MISMATCH`.

## UC30 coverage

| UC30 step / alternative | Implementation |
| --- | --- |
| 4. Revalidate before paying | `initiatePayment` re-reads the Booking. An expired or not-pending booking gives 409 `BOOKING_ALREADY_EXPIRED` with **MSG14**, and pending attempts are expired (A1 before payment) |
| 5. One pending attempt with a transaction id | A new attempt supersedes (cancels) any older pending one, so only one live attempt exists. The same `idempotencyKey` returns the same attempt (`idempotent: true`); reusing a key with another method or booking gives 409 `PAYMENT_IDEMPOTENCY_KEY_REUSED` |
| 6–7. Gateway result and verification | Deterministic mock gateway (A-21). `POST /api/payments/:paymentId/attempts/:attemptId/simulate` requires auth + Payment ownership and returns 404 `MOCK_SIMULATION_DISABLED` in production. Counter cash uses `cash-confirm` (STAFF + `booking.create`) |
| 8. Idempotency check (A7) | `processedNotificationKeys` replay returns the current state; a success on an already `PAID` payment returns `duplicateNotification: true`. The Booking port answers `ALREADY_CONFIRMED`; tickets are unique per seat |
| 9. Success → fulfillment | Booking `CONFIRMED` (hold consumed atomically) → Payment `PAID` (`paidAt`, `settlementAttemptId`, `settlementReference`) → tickets issued exactly once → C15 shows **MSG19** |
| A1 after payment (late success) | Booking port returns `EXPIRED_REVIEW_REQUIRED`: Booking/hold expired, attempt `LATE_SUCCEEDED`, Payment `REVIEW_REQUIRED` with `paidAt` and `reconciliationReason: LATE_PAYMENT_AFTER_EXPIRY`, no tickets. C14/C15 show **Payment Resolution Pending** |
| A4 failed / A5 cancelled | Attempt `FAILED` / `CANCELLED`; Booking stays `PENDING_PAYMENT`; no ticket. C14 shows **MSG18** with Retry; a retry creates a new attempt on the same Payment while the hold is live |
| A6 pending / timeout | Attempt stays `PENDING`; reload reuses the same attempt via its key (E2E-001 case 04); expiry is applied lazily on read/callback |

## API (all under `requireAuth`)

| Route | Notes |
| --- | --- |
| `POST /api/payments` | `{ bookingId, method, idempotencyKey, amount?, contactDetails? }` → 201 new / 200 idempotent; `CASH` needs STAFF |
| `GET /api/payments/bookings/:bookingId` | Booking + Payment + latest attempt + `ticketIssuance` (owner only) |
| `GET /api/payments/me/bookings` | Customer history with the same fields |
| `POST /api/payments/:paymentId/attempts/:attemptId/cancel` | Cancel a pending attempt; the checkout stays live |
| `POST /api/payments/:paymentId/attempts/:attemptId/simulate` | Mock notification `{ outcome: SUCCESS|FAILED|EXPIRED, notificationKey? }`; non-production only |
| `POST /api/payments/:paymentId/attempts/:attemptId/cash-confirm` | Counter cash `{ tenderedAmount }`; STAFF |

Errors: `INVALID_PAYMENT`, `PAYMENT_NOT_FOUND`, `PAYMENT_FORBIDDEN` (403, BR-36/37), `PAYMENT_ALREADY_SETTLED`, `BOOKING_ALREADY_EXPIRED`, `PAYMENT_ATTEMPT_NOT_FOUND`, `PAYMENT_ATTEMPT_NOT_PENDING`, `PAYMENT_IDEMPOTENCY_KEY_REUSED`, `PAYMENT_AMOUNT_MISMATCH`, `MOCK_SIMULATION_DISABLED`. The SRS display texts are in `PAYMENT_MESSAGE` (`payment.constants.js`).

## Persistence and migration

Indexes are in `payment.indexes.js` (`autoIndex: false`): `uniq_payment_order`, `uniq_payment_booking`, `uniq_payment_payable_reference`, `uniq_payment_attempt_id`, `idx_payment_customer_history`. **Applied to `cinema_management_dev` on 2026-10-27** with `node src/migrations/20261022-pay-001-indexes.js`, after a read-only check found no duplicate `bookingId`, `payableReference` or `attemptId` among the 9 existing payments. Before that run only `uniq_payment_order` existed. No document was modified.

## Conflict to review (not changed)

The SRS text (§1.5.3.3, BR-60) says a late success keeps Payment `Success/PAID` and moves the **Booking** to `Payment Resolution Pending`. The implemented and approved behavior (A-20, BOOK-010) instead marks the **Payment** `REVIEW_REQUIRED` and the Booking `EXPIRED`. The safety guarantees are the same: money recorded with `paidAt`, no confirmation, no ticket, kept for reconciliation, idempotent. Only the state names differ, and the Booking status belongs to Hiếu. The UI uses the SRS wording "Payment Resolution Pending". Owner decision needed if the persisted states must match the SRS names.

## Known limitations

- The per-booking lock is in-process; across instances, safety comes from the Booking compare-and-set plus the unique indexes.
- A success notification for an attempt that was superseded or cancelled is rejected (409). This is acceptable for the mock gateway; a real provider would need reconciliation (deferred with A-21).
- Payment expiry is lazy (no worker).

## Verification

`server/test/payment.test.js` (PAY-TEST-001: 10 tests including UC30 A1 and A4/A5 + retry), `ticket.test.js`, `ticket.mongo.test.js`, `booking-lifecycle*.test.js`, E2E-001 browser cases 01/04/07 (Hiếu). Results are in the task report.
