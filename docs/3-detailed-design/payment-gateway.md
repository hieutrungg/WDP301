# Payment Gateway Class Design

## Scope and Business Flow

Supports creation of a payment attempt, gateway redirection, signed asynchronous callback/webhook processing, expiry, retry, and publication of payment outcomes.

## Current Design Review

- Keep Payment, gateway abstraction, controller callback, and timeout job.
- Separate initiation from callback handling and expiry; a single PaymentService currently owns unrelated triggers.
- Callback verification must use raw signed payload/headers and an idempotency key, not a generic Map.
- Do not trust redirect query parameters as payment success. The verified gateway callback is authoritative.
- `findExpiredPayments` should be an infrastructure query invoked by a scheduled adapter, while the application use case owns transitions.

## Proposed Responsibilities and Relationships

Payment is an aggregate with explicit attempts/status. `InitiatePayment` creates a pending payment and calls the gateway port. `HandlePaymentWebhook` verifies and deduplicates provider events before applying a transition. `ExpirePayments` is idempotent and publishes failure/expiry events to Booking/Order handlers.

Assumption: one booking/order may have multiple payment attempts but at most one successful settlement.

