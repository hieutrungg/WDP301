# CON-102 — Proposed implementation scope for owner review

> SUPERSEDED: historical standalone-order proposal. The approved current scope is optional food in ticket checkout; see CON-102-INTEGRATION-CONTRACT.md and CON-102-IMPLEMENTATION.md.

Date: 2026-10-24. Status: PROPOSED, not implementation approval. Sources: Iter3 CON-102, current CON-101 owner approval, REQUIREMENTS_STATUS concession/Inventory blockers, existing orders design, Inventory and Payment runtime code. No API/schema/Atlas mutation in this review.

## Already decided

- A separate concession order, outside ticket-only MVP checkout (current Iter3 task).
- Guest browsing only; cart requires a signed-in Customer.
- Adding to cart does not reserve or deduct stock. Revalidation/reservation begins at checkout.
- Reuse catalog prices, integer VND, zero-price special offers and combo recipes; no independent combo stock.
- Reuse the mock Payment approach. No real gateway, voucher/refund implementation or automatic development seed.

## Decisions proposed for approval

1. First delivery: Customer online order/cart/checkout; Staff POS order creation and pickup confirmation follow separately. This completes only the agreed Customer portion if the full task also requires Staff POS; do not mark the whole task Done prematurely.
2. Cart: one branch per cart, persisted in the browser per signed-in account; changing branch asks before clearing it. Server never trusts stored names/prices/availability. On price/recipe changes at checkout, show a fresh quote and require customer reconfirmation instead of silently charging a new amount.
3. Checkout: create an expiring pending order and reserve branch stock for 10 minutes. A standalone item and every combo expand into one aggregate requirement per concessionId, so overlapping ingredients cannot oversell. Fail the entire checkout on insufficient stock. Persist reservation separately from on-hand quantity: available stock = on-hand minus live reservations. Stock goods still increases on-hand; Inventory remains the authority.
4. Payment outcome: verified success before expiry confirms the order, consumes reservation and records SALE exactly once through an Inventory-owned contract. Failure/cancel/expiry releases reservations exactly once; a retry starts a fresh checkout reservation. Late success does not fulfill or deduct; use Payment review handling. If an entire order totals zero, skip the mock gateway and confirm/consume atomically without pretending money was collected.
5. Collection/fulfillment: paid orders display an order code and selected pickup branch; no delivery, preparation workflow, self-confirmed pickup, customer cancellation or automatic refund in this delivery. Staff fulfillment is deferred with the Staff POS scope above.
6. Permission and persistence integration: approve additive Order/stock-reservation persistence plus review of order/pickup status fields and indexes before runtime writes. Extend Payment to target exactly one Booking or Order; keep ticket Payment consumers backward compatible. Inventory must supply reserve/consume/release contracts without requiring Customer to have inventory permissions. Online SALE audit attribution must support the actual customer/system actor; never impersonate a Staff account to satisfy the current required recordedBy field.

## Proposed technical handoff (needs owner/consumer review)

- Hieu owns Order/cart UI, server-side quotes, embedded immutable item and recipe snapshots, order authorization and lifecycle.
- Nam reviews/provides Inventory reserve/consume/release and availability projection. Both catalog availability and checkout use reservation-aware availability. No direct Concession module writes to Inventory collections.
- Cuong reviews the Payment payable-target contract, backward compatibility, callback idempotency and late-success handling. Existing Payment requires bookingId; orderId alone cannot work as-is.
- Initial proposed HTTP surface: POST /api/concession-orders/quote, POST /api/concession-orders (idempotent checkout from confirmed quote), GET /api/concession-orders/:orderId, and an additive order-payment initiation command. Exact DTO/error/status/index contracts are to be written for review once the above business choices are accepted; no claim that they are already approved or implemented.
- Reuse the existing orders document shape where possible. Reservations require a dedicated durable record with order/branch/component quantities/expiry/lifecycle and unique idempotency enforcement; avoid reusing SeatHold or physical Seat state.
- Test only isolated databases: same last item bought concurrently, overlapping combo/item requirements, repeated submit/callback/release, stock-in during reservations, exact expiry, late success, zero total, changed price/recipe, unauthorized/other-account requests, and ticket Payment regressions.

## Current blockers

CON-102 and sale-time Inventory mutations are still BLOCKED_BY_DECISION in REQUIREMENTS_STATUS and Iter3. No Order/cart/Inventory mutation implementation is authorized merely by reading this proposal. Owner decisions above and Inventory/Payment shared contract review are required; the existing catalog read scope stays independently approved. BOOK-010 work in the current checkout is preserved.
