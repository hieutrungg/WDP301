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

