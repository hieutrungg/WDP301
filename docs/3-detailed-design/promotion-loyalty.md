# Promotion and Loyalty Class Design

## Scope and Business Flow

Supports promotion campaigns, voucher validation/application, usage limits, and discount calculation. The SDS does not define an actual loyalty-points model, so no points ledger is invented.

## Current Design Review

- Keep Promotion, Voucher, campaign management, and validation behavior.
- Do not increment voucher usage before the related booking/order is committed. A reservation/redemption lifecycle is required to avoid lost uses or double redemption.
- `PromotionService.applyPromotion(bookingId, code)` couples pricing to Booking persistence; replace it with a quote/redemption contract.
- Replace string discount types/statuses with explicit value objects/enums and model applicability criteria.
- The shown `Promotion 1 issues * Voucher` relationship is plausible but needs campaign/voucher rules and multiplicity enforcement.

## Proposed Responsibilities and Relationships

Promotion defines eligibility and discount rules. Voucher represents a code and usage policy. `QuoteDiscount` produces a non-mutating discount quote; `ReserveVoucherRedemption` atomically reserves usage for a checkout and is confirmed or released with the sale outcome.

Open Design Question: specify customer restrictions, stacking rules, applicable products/branches/showtimes, and whether voucher codes are shared or individually issued.

