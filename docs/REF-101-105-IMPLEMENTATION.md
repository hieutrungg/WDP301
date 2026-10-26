# REF-101–105 Refund Demo Implementation

Date: 2026-10-27. Owner approval was given in this chat for the bounded demo policy recorded as Decision A-29.

## Implemented scope

- Customer request and history at `/refunds`.
- Manager review queue at `/manager/refunds`; Manager alone may approve, reject, or retry.
- Server policy: 45-minute cutoff; confirmed/paid owner only; checked-in tickets rejected when the future Ticket port reports that state.
- Refund amount is the immutable ticket subtotal plus an attached concession order only while it is not `FULFILLED`.
- Provider-neutral idempotent mock refund; CASH records manual out-of-system settlement.
- `FAILED` requests are retryable. Booking, Payment, ShowtimeSeat and unfulfilled ConcessionOrder are finalized in one Mongo transaction only after provider success.

## API

- `POST /api/refunds` — Customer request.
- `GET /api/refunds/me` — Customer history.
- `GET /api/refunds/manager` — Manager queue.
- `POST /api/refunds/:refundId/approve` — Manager process.
- `POST /api/refunds/:refundId/reject` — Manager reject.
- `POST /api/refunds/:refundId/retry` — Manager retry a failed request.

## Data and migration

Run `server/src/migrations/20261027-refund-workflow.js` against the target database after backup/review. It adds unique booking/idempotency indexes and queue/history indexes to `refund_requests`. Booking gains `REFUNDED`, Payment gains `REFUNDED/PARTIALLY_REFUNDED`, and the attached order gains refund/cancellation fulfillment states.

## Integration limitation

The repository has no authoritative Ticket model or scan lifecycle. Production eligibility currently receives `checkedIn: false` because no issued ticket can be checked in in this codebase. Do not claim Ticket invalidation complete and do not deploy the refund workflow with a separately introduced Ticket module until that module supplies a checked-in read port and transactional invalidation port. Paid-showtime cancellation and real gateway refunds remain deferred.
