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
| 6–7. Gateway result and verification | `BANK_TRANSFER` uses **payOS** (real VietQR transfer; see the payOS section). The server settles only after reading payOS status `PAID` with an amount at least the booking total. The other C14 methods use the deterministic mock gateway. `POST /api/payments/:paymentId/attempts/:attemptId/simulate` (demo button, also on bank-transfer attempts) requires auth + Payment ownership and returns 404 `MOCK_SIMULATION_DISABLED` in production. Counter cash uses `cash-confirm` (STAFF + `booking.create`) |
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
| `POST /api/payments/:paymentId/attempts/:attemptId/simulate` | Mock notification `{ outcome: SUCCESS|FAILED|EXPIRED, notificationKey? }`; non-production only. On a payOS attempt it also cancels the real payOS link |
| `POST /api/payments/:paymentId/attempts/:attemptId/verify` | Owner asks the server to check a payOS attempt; settles on verified `PAID`. Polled every 4 s by the C14 modal; throttled to one payOS call per attempt per 2 s |
| `POST /api/payments/providers/payos/webhook` | **Public** (no cookie), payOS server-to-server. Checksum signature verified (400 `INVALID_PROVIDER_SIGNATURE`), then the same payOS status check runs. Unknown `orderCode` (payOS registration test) → 200 `matched: false` |
| `POST /api/payments/:paymentId/attempts/:attemptId/cash-confirm` | Counter cash `{ tenderedAmount }`; STAFF |

Errors: `INVALID_PAYMENT`, `PAYMENT_NOT_FOUND`, `PAYMENT_FORBIDDEN` (403, BR-36/37), `PAYMENT_ALREADY_SETTLED`, `BOOKING_ALREADY_EXPIRED`, `PAYMENT_ATTEMPT_NOT_FOUND`, `PAYMENT_ATTEMPT_NOT_PENDING`, `PAYMENT_IDEMPOTENCY_KEY_REUSED`, `PAYMENT_AMOUNT_MISMATCH`, `MOCK_SIMULATION_DISABLED`, `PAYMENT_PROVIDER_UNAVAILABLE` (503), `PAYMENT_PROVIDER_ERROR` (502), `INVALID_PROVIDER_SIGNATURE` (400). The SRS display texts are in `PAYMENT_MESSAGE` (`payment.constants.js`).

## payOS bank transfer (approved 2026-10-27)

- **Configuration:** `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` (optional `PAYOS_API_BASE_URL`) in `server/.env` only; `.env.example` has empty placeholders. With no credentials, development keeps `BANK_TRANSFER` on the mock (offline runs and E2E-001 unchanged); production answers 503.
- **Adapter** `payos-gateway.js`, with no SDK dependency (`fetch` + HMAC-SHA256):
  - Each attempt creates a payment link `POST /v2/payment-requests` with `orderCode` (time + random), `amount` = booking total, 9-character transfer content `FC…`, `expiredAt` = hold expiry, and returnUrl `/bookings/:bookingId/confirmation` (C15) / cancelUrl `/booking/:showtimeId/checkout` (C14). It is signed over `amount&cancelUrl&description&orderCode&returnUrl`.
  - The attempt stores `providerOrderCode`, the VietQR string (`qrPayload`), bank account, `checkoutUrl` and `paymentLinkId` (in `instruction`).
- **Verification:** payOS can't call localhost, so settlement is driven by the server reading `GET /v2/payment-requests/{orderCode}`. This happens from three places: the C14 modal polling, C15 load (`getBookingPaymentDetails` re-checks a pending payOS attempt when the customer returns from the payOS page), and the webhook once deployed. Server-to-server calls (API key over TLS) are authoritative; the inbound webhook must pass the key-sorted data checksum.
- **Status mapping:**
  - `PAID` with `amountPaid ≥ amount` → the normal success path: Booking port, Payment `PAID`, tickets, with `gatewayResponse.providerSettlement` holding the amount, bank transaction references and verification time. An underpaid transfer is never settled.
  - `CANCELLED` → attempt `FAILED` (`PAYOS_LINK_CANCELLED`).
  - `EXPIRED` → attempt `EXPIRED`.
  - `PENDING`/`PROCESSING` → no change.
- **Real money is never dropped:** a payOS link is cancelled (best effort) when its attempt is superseded, cancelled by the customer, or settled/failed by simulation. If payOS still reports `PAID` for such an attempt, the success path reopens it:
  - If the booking is still unpaid and live, it is confirmed.
  - If the hold has expired, it goes to late-payment review.
  - If another attempt already settled, the booking is unchanged and the Payment gets `reconciliationReason: DUPLICATE_PROVIDER_PAYMENT` plus `gatewayResponse.duplicateProviderPayments[]` for a manual refund.
- **Demo:** "Simulate successful payment" / "Simulate failure" stay available on bank-transfer attempts outside production. They settle locally, close the payOS link, and mark `gatewayResponse.simulatedSettlement`.
- **Live check 2026-10-27:** a 2,000 VND link was created, read (`PENDING`) and cancelled (`CANCELLED`) against the configured merchant. No transfer was made. The webhook signature was verified by unit tests only; no public webhook URL is registered yet.

## Persistence and migration

Indexes are in `payment.indexes.js` (`autoIndex: false`): `uniq_payment_order`, `uniq_payment_booking`, `uniq_payment_payable_reference`, `uniq_payment_attempt_id`, `idx_payment_provider_order_code` (sparse, non-unique; payOS itself rejects a reused orderCode), `idx_payment_customer_history`. **Applied to `cinema_management_dev` on 2026-10-27** with `node src/migrations/20261022-pay-001-indexes.js`. The first run followed a read-only check that found no duplicate `bookingId`, `payableReference` or `attemptId` among the 9 existing payments; a second run added the provider-order index. Before that only `uniq_payment_order` existed. No document was modified. `BANK_TRANSFER` passes the live `payments` validator, where `method` is any string.

## Conflict to review (not changed)

The SRS text (§1.5.3.3, BR-60) says a late success keeps Payment `Success/PAID` and moves the **Booking** to `Payment Resolution Pending`. The implemented and approved behavior (A-20, BOOK-010) instead marks the **Payment** `REVIEW_REQUIRED` and the Booking `EXPIRED`. The safety guarantees are the same: money recorded with `paidAt`, no confirmation, no ticket, kept for reconciliation, idempotent. Only the state names differ, and the Booking status belongs to Hiếu. The UI uses the SRS wording "Payment Resolution Pending". Owner decision needed if the persisted states must match the SRS names.

## Known limitations

- The per-booking lock is in-process; across instances, safety comes from the Booking compare-and-set plus the unique indexes.
- A mock success notification for an attempt that was superseded or cancelled is rejected (409). Provider-verified payOS money is the exception: it reopens the attempt (see above).
- Payment expiry is lazy (no worker). payOS status is checked only while someone is on C14/C15, or by the webhook once deployed. A transfer made after the customer closed the browser on local is picked up when they next open C15.
- Refunds of payOS money (late or duplicate payments) are manual; automatic payOS refund is not implemented.

## Verification

`server/test/payment.test.js` (PAY-TEST-001: 10 tests including UC30 A1 and A4/A5 + retry), `server/test/payos.test.js` (12 tests: adapter signature, provider errors, webhook signature, router fallback, verify/throttle, underpaid, cancelled, simulation closing the link, reopened and duplicate payments, late transfer, C15 return, webhook, HTTP auth), `ticket.test.js`, `ticket.mongo.test.js`, `booking-lifecycle*.test.js`, E2E-001 browser cases 01/04/07 (Hiếu). Results are in the task report.
