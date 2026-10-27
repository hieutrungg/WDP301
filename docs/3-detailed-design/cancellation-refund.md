# Cancellation and Refund Class Design

## Scope and Business Flow

Supports customer cancellation requests, eligibility/refund calculation, booking cancellation, seat release, gateway refund, status enquiry, retries, and staff/admin exception handling.

## Current Design Review

- Keep RefundRequest, gateway abstraction, controller, and retry scheduler.
- The current sequence marks Booking canceled before knowing whether the refund is accepted and has no ticket invalidation/seat-release coordination.
- `RefundServiceImpl` lacks Booking and Payment ports even though refund eligibility and amount depend on them.
- Refund amount must be determined by an explicit policy and snapshotted; gateway retries must be idempotent.
- A scheduler should invoke the same use case as manual retry, not contain business logic.

## Proposed Responsibilities and Relationships

`RequestCancellation` checks ownership and policy, creates a RefundRequest, and moves Booking into `CANCELLATION_PENDING` when money has settled. `ProcessRefund` calls the gateway once per idempotency key, then finalizes booking cancellation, ticket invalidation, seat release, voucher/inventory compensation, and notification through ports/events.

Approved owner decision (2026-10-27): cancellation becomes effective only after refund success. Customer requests close 45 minutes before showtime; checked-in tickets are rejected; refundable value is ticket price plus F&B not yet `FULFILLED`; fulfilled F&B is excluded; no service fee or monthly limit applies. Manager approves or rejects; Staff cannot approve. Digital payments use an idempotent mock refund adapter representing the original payment method, while cash is returned manually outside the system. Provider failure produces `FAILED` and supports safe retry.

SHOW-103 owner approval (2026-10-27) defines a separate paid-Showtime cancellation flow: the Showtime is cancelled immediately; pending-payment Bookings and active holds expire/release; paid Bookings receive an idempotent cancellation refund. A previously rejected Customer request is retained and does not block this distinct refund. Cash remains pending until a Manager confirms the external payment. Successful settlement marks Booking `REFUNDED` and Payment `REFUNDED` or `PARTIALLY_REFUNDED` when the refundable sum excludes fulfilled F&B. Provider failure leaves Booking/Payment/seats/F&B unchanged and can be retried. Notification and Ticket check-in/invalidation integration remain deferred. Implementation details are in `docs/SHOW-103-IMPLEMENTATION.md`.

