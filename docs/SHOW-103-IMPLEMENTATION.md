# SHOW-103 — Cancel Showtime with Sales

## Approval and scope

The project owner approved the contract in chat on 2026-10-27. A Manager cancels a future published Showtime and the Showtime becomes `CANCELLED` immediately. Each paid confirmed Booking receives an idempotent refund workflow. Pending-payment Bookings expire and their holds are released. Customer notification and Ticket check-in/invalidation are explicitly deferred until those modules have reviewed contracts.

Refund value is ticket amount plus concession amount unless the concession order is already `FULFILLED`; fulfilled F&B is excluded. Digital methods use the existing mock provider and represent a return to the original method. A provider error leaves Payment, Booking, ShowtimeSeat and concession fulfillment state unchanged and marks the request `FAILED` for retry. Cash is returned outside the system; the refund remains pending until a Manager confirms the external return. Booking becomes `REFUNDED` after settlement, while Payment becomes `PARTIALLY_REFUNDED` when the refunded amount is lower than the amount charged (for example, fulfilled F&B was excluded).

An existing customer refund request that is `REQUESTED`, `PROCESSING`, or `FAILED` is reused. A customer request in `REJECTED` state is preserved and a separate `SHOWTIME_CANCELLATION` refund is created. Repeated cancellation calls resume eligible digital refunds and remain idempotent.

## Changed contract

- `POST /api/showtimes/:showtimeId/cancel` remains Manager-only. Its response retains `id` and `status` and adds a `refunds` summary: `total`, `refunded`, `failed`, `awaitingManual`, `processing`, and per-refund `items`.
- `POST /api/refunds/:refundId/confirm-cash` is Manager-only. It records settlement only after an operator confirms that cash was returned outside the system. Generic approve/retry cannot settle a CASH request.
- Manager refund queue identifies customer requests versus showtime cancellation refunds and exposes the cash confirmation action.
- Refund requests add `requestType` (`CUSTOMER_REQUEST` or `SHOWTIME_CANCELLATION`) and optional `showtimeId`.

## Persistence and rollout

The old unique index allowed only one RefundRequest per Booking. The versioned script `server/src/migrations/20261027-showtime-cancellation-refunds.js` backfills legacy rows to `CUSTOMER_REQUEST`, drops `uniq_refund_booking`, and creates unique `{ bookingId, requestType }` as `uniq_refund_booking_type`. Apply this migration to each target database before deploying this code. No database migration was run by this task.

Cancellation and pending Booking/hold/concession reservation cleanup run in one MongoDB transaction. Digital provider calls happen after that transaction; a failed provider call does not finalize the refund. Successful finalization uses the existing Refund transaction to update Payment/Booking, release sold seats, and cancel unfulfilled concessions. The existing Manager role guard is retained because this repository has no approved dedicated Showtime/Refund permission code; backend routes remain protected and Staff cannot invoke Manager actions.

## Integration and limits

- Showtime owner: Đạt. Booking/SeatHold and concession checkout: affected module owners. Payment/Refund: Hà/Cường reviewers. Manager UI consumer: Showtime and Refund screens. RBAC reviewer: confirm Manager-only route policy for this addition.
- Ticket check-in and issued-ticket invalidation are not implemented because the Ticket module contract is incomplete; notifications are also deferred. Cancellation only targets future Showtime starts, where check-in should not yet be possible.
- Cash refund completion depends on the Manager's truthful manual confirmation; the app does not move money.
- No SRS, workbook, external database, or task-board status was changed.

## Verification

Tests were not run in this task. Review/verification should include the existing refund tests plus a Mongo replica-set integration test for transaction rollback, pending holds, duplicate cancellation, rejected-customer-request coexistence, provider failure/retry, partial refund, and manual cash confirmation.
