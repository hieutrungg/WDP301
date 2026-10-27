# TICKET-101 — Ticket check-in by code: implementation report

Owner: Cường (Ticket). Date: 2026-10-27. Branch: `cuong/payment` (working tree only).

Scope: Staff check a customer in by typing or pasting the ticket code from the E-Ticket (UC25-27 scan subset, BR-17, BR-40). Refund eligibility reads the real check-in state. Builds on TICKET-001 (`docs/TICKET-001-IMPLEMENTATION.md`).

## 1. Decisions (Cường, chat 2026-10-27; recorded in `REQUIREMENTS_STATUS.md` → Approval queue)

| Topic | Decision |
| --- | --- |
| Input | Typed or pasted ticket code only (`TK-` + 10 hex). No camera QR scan (hard to demo) and no new dependency. Spaces and letter case are ignored. |
| Window | Check-in opens 30 minutes before the showtime `startAt` and closes at its stored `endAt` (which includes cleanup, A-27). |
| Branch | Staff check in only tickets of the branch in their own `employeeProfile.branchId`. The branch never comes from the request. Missing branch → 403 `BRANCH_NOT_ASSIGNED` (same rule as Inventory/Staff shift). |
| Unit | One code admits one seat, once. Other tickets of the same booking are untouched. |

## 2. API

`POST /api/tickets/check-in`:
- Guards: `requireAuth` → `requirePermission("ticket.validate")` → `requireRole("STAFF", "MANAGER")`.
- Body: `{ "ticketCode": "TK-1A2B3C4D5E" }` (strict schema).
- 200 response: `{ success, message: "Ticket checked in successfully.", data: { ticket, bookingCheckIn: { bookingId, ticketCount, checkedInCount, checkedIn } } }`. `ticket` is the usual ticket DTO, now `USED`, with `checkedInAt` set and no QR.

Checks run in this order:

| Order | Check | Error |
| --- | --- | --- |
| 1 | Staff has a branch | 403 `BRANCH_NOT_ASSIGNED` |
| 2 | Code format (MSG01/MSG03) | 400 `TICKET_CHECK_IN_VALIDATION_FAILED` |
| 3 | Ticket exists | 404 `TICKET_NOT_FOUND` "No ticket matches this code." |
| 4 | Not already used (BR-17) | 409 `TICKET_ALREADY_USED` "Ticket … was already checked in at dd/MM/yyyy HH:mm. It cannot be used again." |
| 5 | Not invalidated; Booking still `CONFIRMED` (BR-40) | 409 `TICKET_INVALIDATED`. A `REFUNDED` booking also has its `ISSUED` tickets invalidated on the spot. |
| 6 | Showtime `PUBLISHED` with start/end | 409 `TICKET_SHOWTIME_UNAVAILABLE` |
| 7 | Showtime branch = Staff branch | 403 `TICKET_WRONG_BRANCH` "This ticket is for {branch}. It can only be checked in at that branch." |
| 8 | Window | 409 `TICKET_CHECK_IN_TOO_EARLY` (names the opening time, Asia/Ho_Chi_Minh) / 409 `TICKET_SHOWTIME_ENDED` |
| 9 | Atomic `ISSUED → USED` | The loser of a concurrent race gets 409 `TICKET_ALREADY_USED` |

Booking status, showtime and branch are read through the existing Booking read port (`getCustomerBookingDetails` with the ticket's owner), which reads Showtime via Đạt's `getBookableShowtimeForBooking`. No other module's model is read.

## 3. Data

- `tickets.checkedInBy` (optional ObjectId, the Staff/Manager account) is new. `status`, `checkedInAt` and the bootstrap validator are unchanged.
- The write is `updateOne({ _id, status: "ISSUED" }, { status: "USED", checkedInAt, checkedInBy })`. Only the call that modifies the document succeeds.
- Each check-in appends `audit_logs` `TICKET_CHECKED_IN` (target `TICKET`). This is best-effort after the write, like the RBAC admin actions.
- No index, migration or Atlas write. Lookup by `ticketCode` uses the existing unique index `uniq_ticket_code` / `ticketCode_1`.

## 4. Refund wiring (cross-owner touch)

- `ticket/ticket-refund.adapter.js` wraps the Refund repository's `loadEligibility` so `checkedIn` comes from `ticketService.getCheckInStatusByBooking`. Before this it was hard-coded `false`.
- `refund/refund.module.js` (composition root) now injects the wrapped repository. The Refund service, repository and model are unchanged.
- A checked-in booking now gets the existing 409 "Checked-in tickets cannot be refunded through the normal flow".
- Not done (Refund owner): calling `invalidateTicketsByBooking` inside refund finalization. Until then check-in refuses REFUNDED bookings and invalidates their tickets when first presented.

## 5. Frontend

- `/staff/check-in` (`features/ticket/pages/TicketCheckInPage.jsx`), behind `PermissionRoute permission="ticket.validate"` inside the STAFF shell.
- The StaffLayout placeholder "Scan Ticket" became the working "Ticket Check-in" item.
- One large code input with a "Check in" button.
  - Client-side MSG01/MSG03 validation.
  - Success card ("Admit") shows movie, seat and type, cinema/room, showtime, age rating, check-in time and booking progress ("1 of 2 tickets in this booking checked in").
  - Failure card shows a clear title (Already checked in, Ticket not valid, Wrong branch, Too early to check in, …) and the server message.
- The screen keeps a list of the last 10 attempts and a rules panel. The input clears and refocuses after a success, ready for the next customer.
- Pure helpers: `features/ticket/utils/checkIn.js`.

### C16 My Tickets uses real tickets (same day)

`/my-tickets` (`features/booking/pages/CustomerBookingsPage.jsx`) already listed bookings from the database (`GET /api/payments/me/bookings`). Its ticket part, however, still showed a fake QR (`MockQrSvg`) built from `previewReference`, a field the server no longer sends since TICKET-001. Changes:

- **List card:** the mock QR is replaced by the persisted ticket summary from `ticketIssuance` ("2 E-Tickets · 1 checked in", ticket codes). The helper is `describeTicketIssuance` in `features/ticket/utils/ticketPresentation.js`.
- **Detail modal:** loads `GET /api/tickets/bookings/:bookingId` and shows one tab per seat.
  - Each tab shows the real scannable QR (`components/ui/QrCode.jsx`) only for `ISSUED` tickets, a copyable ticket code and the status.
  - A `USED` ticket shows its check-in time.
  - A link opens the C17 fullscreen E-Ticket.
- **Other changes:**
  - Refunded bookings have their own message.
  - Dates use `dd/MM/yyyy HH:mm` (Asia/Ho_Chi_Minh).
  - The KPI label "Confirmed tickets (Paid)" became "Paid bookings", because it counts bookings, not tickets.

No API change was needed.

## 6. Files

- Server, new: `modules/ticket/ticket-refund.adapter.js`.
- Server, changed:
  - `modules/ticket/{ticket.constants, ticket.model, ticket.repository, ticket.service, ticket.validation, ticket.controller, ticket.routes, ticket.module}.js`
  - `modules/audit/audit.constants.js`
  - `modules/refund/refund.module.js`
- Server tests:
  - `test/ticket.test.js` (+7)
  - `test/ticket.mongo.test.js` (+1, real concurrent compare-and-set)
  - `test/helpers/{in-memory-ticket-repository, payment-harness}.js`
- Client, new: `features/ticket/{pages/TicketCheckInPage.jsx, utils/checkIn.js}`, `test/ticket-check-in.test.js`.
- Client, changed: `features/ticket/api/ticketApi.js`, `app/router/index.jsx` (1 import + 1 guarded route), `layouts/StaffLayout.jsx` (menu item), `test/router-integration.test.js` (+1).
- Docs: this file, `REQUIREMENTS_STATUS.md`, `cinema_database_schema.md`, `CLAUDE.md`.

## 7. Verification (2026-10-27)

- `server`: `npm run lint` clean.
- `server`: `node --test test/ticket.test.js test/ticket.mongo.test.js`: 22/22 pass. The Mongo test used a throwaway `tkt001_test_*` database on Atlas and dropped it afterwards.
- `server`: `npm test`: 558 tests, 550 pass, 3 fail, 5 skipped.
  - The 3 failures are the same pre-existing ones in other owners' tests (`concession-checkout.mongo.test.js` 409≠403, `development-seed.test.js` price undefined).
  - The 5 skips need `MONGODB_TEST_URI`.
- `client`: `node --test test/` 98/98 pass.
- `client`: `npm run build` succeeds.
- `client`: `npm run lint` shows only the pre-existing error in `ManagerShowtimesPage.jsx:115` (Đạt).
- Not tested end-to-end over HTTP with a real Staff account. The route guards reuse the tested `requirePermission`/`requireRole` middleware, and the service rules are covered by the unit and Mongo tests.

## 8. Manual demo

1. Customer buys a ticket for a showtime at branch X that starts within 30 minutes (or move a test showtime's time). C15/C17 shows the code `TK-…`.
2. Sign in as a STAFF account whose employee profile is branch X (set it on Staff Account Management). Open **Ticket Check-in** and paste the code: the "Admit" card appears.
3. Paste the same code again: "Already checked in at …".
4. A Staff member of another branch: "Wrong branch". A showtime more than 30 minutes away: "Too early to check in".
5. As the customer, request a refund for a booking that has a checked-in ticket: it is refused.

No commit, push, merge or task-board/Google Sheet update was made.
