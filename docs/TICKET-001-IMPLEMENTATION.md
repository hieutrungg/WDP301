# TICKET-001 / TICKET-002 / FLOW-004 — Digital Ticket

Implemented 2026-10-27 in the working tree. Owner: Cường (Payment/Ticket). Required reviewers before merge: Hà/Hiếu (Booking read port), Refund owner (invalidation/check-in ports), Hiếu (router + E2E-001), integration reviewer for `server/src/app.js`. Sources: A-19, A-20, A-22, A-23, A-29, BR-20, BR-36, BR-40, BR-56, `SCREEN_FLOW.md` §1, BOOK-010 and CON-102 reports, DB bootstrap `tickets` validator and `cinema_database_schema.md` §2.12. Stitch C15/C17 was not available in this session; C17 follows the existing C15 visual language and needs a Stitch parity review.

## Behavior

- Payment calls `ticketPort.issueTicketsForConfirmedBooking` **after** the PAID settlement is persisted (verified success, `CONFIRMED` or `ALREADY_CONFIRMED`). Ticket re-reads the Booking through the Booking read port and refuses anything not `CONFIRMED` (409 `TICKET_BOOKING_NOT_CONFIRMED`). Redirects, pending payments and late success (`REVIEW_REQUIRED`) never issue tickets.
- One Ticket per booked seat. Unique `(bookingId, seatId)` makes duplicate callbacks, replays and concurrent server instances idempotent: losers of the race hit a duplicate key and re-read. The tests cover replay on both duplicate-callback paths and 6 concurrent issuers on MongoDB.
- If issuance fails after payment is settled, the payment result is unchanged and the failure is logged. `GET /api/payments/bookings/:bookingId` and `/me/bookings` complete the missing tickets for a booking that is `CONFIRMED` + `PAID` through the same idempotent port. This also issues tickets for bookings confirmed before this module existed. It is a recovery of the authoritative success path, not a new issuance trigger. **Proposed** — reviewers should confirm this is acceptable under A-23.
- `ticketCode` is readable (`TK-` + 10 hex). `qrCode` is `FCINEMA-TICKET:v1:<ticketCode>:<128-bit random token>`, so knowing a printed code is not enough to forge an admission QR. The QR payload is returned only while the ticket is `ISSUED` (BR-40).
- Each ticket stores an immutable seat snapshot (label, row, number, type, VND unit price) and screening snapshot (movie title, age rating, cinema, room, start/end), as required by the historical-snapshot convention.

## API (additive, owner-only)

| Route | Auth | Result |
| --- | --- | --- |
| `GET /api/tickets/bookings/:bookingId` | `requireAuth` + Booking ownership | `{ bookingId, bookingStatus, tickets[] }`; 404 `BOOKING_NOT_FOUND`, 403 `BOOKING_FORBIDDEN`, 400 `INVALID_TICKET_ID` |
| `GET /api/tickets/:ticketId` | `requireAuth` + ticket owner | Ticket DTO; 404 `TICKET_NOT_FOUND`, 403 `TICKET_FORBIDDEN` |

`GET /api/payments/bookings/:bookingId` and `/me/bookings`: `ticketIssuance` is no longer a demo preview. Shape: `{ eligible, status: NOT_ISSUED | ISSUED | ISSUANCE_PENDING, ticketCount, tickets: [{ ticketId, ticketCode, seatLabel, status }] }`. The fields `isDemoPreview`, `previewReference` and `notice` and status `PENDING_TICKET_MODULE` are removed. Consumers: C15 (updated) and `CustomerBookingsPage` (still falls back to its own demo label; see follow-ups).

## Internal ports for other modules

From `server/src/modules/ticket/ticket.module.js` (`ticketService`):

- `issueTicketsForConfirmedBooking({ bookingId, ownerId, paymentId })`: Payment only.
- `listTicketsForBooking({ bookingId })`
- `getCheckInStatusByBooking({ bookingId, session? })` → `{ ticketCount, checkedInCount, checkedIn }`. Intended to replace Refund's hard-coded `checkedIn: false`.
- `invalidateTicketsByBooking({ bookingId, reason, session? })`: moves only `ISSUED` to `INVALIDATED`, never rewrites `USED`, repeatable, and can join the caller's Mongo transaction.

Refund and check-in modules are not wired by this task (other owners).

## Data and migration

- `tickets` collection via `ticket.model.js` (`autoIndex: false`). It fits the bootstrap validator (`ticketCode`, `bookingId`, `showtimeId`, `seatId`, `qrCode`, `status`, `checkedInAt`) and adds `paymentId`, `customerAccountId`, `seat`, `screening`, `issuedAt`, `invalidatedAt`, `invalidationReason`.
- Status vocabulary `ISSUED`, `USED`, `INVALIDATED`. The schema doc only gives examples (`VALID/USED/CANCELLED/REFUNDED`), so this is a new shared enum and needs review.
- Run `node src/migrations/20261027-ticket-001-indexes.js` (from `server/`, against `MONGODB_URI`) before deploying. It creates `uniq_ticket_qr_code` and `uniq_ticket_booking_seat`, and reuses the bootstrap `ticketCode_1` (or creates `uniq_ticket_code`). It never drops anything. **Until it runs, issuance fails closed**: payments still settle, and `ticketIssuance.status` stays `ISSUANCE_PENDING`. **Applied to `cinema_management_dev` on 2026-10-27** at the owner's request, while `tickets` held 0 documents. Result: `uniq_ticket_code`, `uniq_ticket_qr_code`, `uniq_ticket_booking_seat` (the bootstrap `ticketCode_1` was not present). From now on, an existing `CONFIRMED` + `PAID` booking on dev gets its tickets the first time its owner opens C15 or the history page.

## Frontend

- C15 `BookingConfirmationPage`: the demo preview stub is replaced by the real tickets (`GET /api/tickets/bookings/:bookingId`, fetched only once the details say `CONFIRMED` + `PAID`), with loading/error/issuing states. There is one row per seat linking to C17, plus an "Open E-Ticket" action.
- C17 `/tickets/:ticketId` (`features/ticket/pages/ETicketPage.jsx`): fullscreen, outside the site shell, behind `ProtectedRoute`. It shows QR, ticket code, status, movie, age rating, cinema, room, date `dd/MM/yyyy` and 24-hour time (Asia/Ho_Chi_Minh, NFR 4.2.1), seat and type, with previous/next seat navigation. It has loading/error states. For `USED`/`INVALIDATED` there is no QR and the status is shown instead (UC22, BR-40). C15 uses the same date format and shows MSG19.
- QR is rendered by the shared `client/src/components/ui/QrCode.jsx` (standards-compliant, scannable; `qrcode` library approved 2026-10-27). The ticket code is also shown for manual entry.

## Changed files

- New: `server/src/modules/ticket/{ticket.constants,ticket.indexes,ticket.model,ticket.repository,ticket.service,ticket.validation,ticket.controller,ticket.routes,ticket.module}.js`, `server/src/migrations/20261027-ticket-001-indexes.js`, `server/test/ticket.test.js`, `server/test/ticket.mongo.test.js`, `server/test/helpers/{payment-harness,in-memory-ticket-repository}.js`, `client/src/features/ticket/{api/ticketApi.js,utils/ticketPresentation.js,pages/ETicketPage.jsx}`, `client/test/ticket-presentation.test.js`.
- Modified: `server/src/modules/payment/payment.service.js`, `payment.module.js`, `server/src/app.js` (shared: mounts `/api/tickets`), `server/test/payment.test.js` (harness moved to `test/helpers/payment-harness.js`; ticket assertions), `client/src/features/booking/pages/BookingConfirmationPage.jsx`, `client/src/app/router/index.jsx` (shared: `/tickets/:ticketId`), `client/test/router-integration.test.js`.

## Verification (actually run)

- `node --test test/ticket.test.js test/payment.test.js test/ticket.mongo.test.js` (server): 22 passed, 0 failed, 0 skipped. The Mongo test used a disposable `tkt001_test_*` database on the configured cluster and dropped it afterwards.
- Full `npm test` (server): 481 tests, 473 passed, 3 failed, 5 skipped. The 3 failures predate this task and belong to other owners: `concession-checkout.mongo.test.js:583` (Staff now passes the quote role guard) and `development-seed.test.js:183`. The 5 skips need `MONGODB_TEST_URI`.
- `npm run lint` (server): passed. Client: `node --test test/` 77 passed, 0 failed; ESLint on changed files passed; `npm run build` passed with the existing chunk-size advisory.
- Not run: E2E-001 browser suite (needs Playwright, not installed here).

## Integration notes and follow-ups

- **E2E-001 (`server/e2e/journey.mjs:213`) asserts that no ticket document exists after a paid checkout.** Once the ticket indexes exist in its disposable DB, that assertion must change to one ticket per seat. Owner: Hiếu.
- Refund owner: call `getCheckInStatusByBooking` for eligibility and `invalidateTicketsByBooking` inside the refund finalization transaction. The REQUIREMENTS_STATUS refund note about "no authoritative Ticket aggregate" is now outdated.
- `CustomerBookingsPage` (C16) still shows its own demo QR fallback; switching it to real tickets/C17 links is a small follow-up.
- No commit, push, merge, sheet update or development-database migration was performed.
