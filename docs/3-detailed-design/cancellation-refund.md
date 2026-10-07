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

Open Design Question: define whether booking cancellation is effective immediately or only after refund success, and how partial gateway failure is surfaced.

