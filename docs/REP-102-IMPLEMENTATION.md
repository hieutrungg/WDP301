# REP-102 Revenue Read Model

## Implemented calculation

The read model returns VND totals for collected payments, completed refunds, and net revenue:

`netRevenueAmount = totalCollectedAmount - totalRefundedAmount`

It sums `Payment.amount` only when Payment is `PAID`, `PARTIALLY_REFUNDED`, or `REFUNDED`. These statuses represent a successful settlement, including payments that were later partially or fully refunded. It sums `RefundRequest.refundAmount` only when the refund status is `REFUNDED`. Requests, processing, rejected, failed, pending, cancelled, expired, and review-required payments do not contribute.

Refund events are the source for refunded totals. The model does not add `Payment.refundedAmount`, which would count the same completed refund twice. A cash refund contributes only after the Manager confirms the external return and the existing refund flow finalizes it.

## Period and consistency

`getRevenueSummary({ fromAt, toAt })` accepts optional date instants with an explicit UTC offset. If supplied, the period is half-open: `fromAt` is inclusive and `toAt` is exclusive. Payment totals filter on `paidAt`; refund totals filter on `processedAt`, matching BR-62. No user timezone conversion is performed in this internal service. The caller must provide UTC instants after an approved reporting timezone policy exists.

The payment and refund aggregations run sequentially in one MongoDB transaction so the returned totals use a consistent read snapshot. Net revenue is not clamped at zero. Amounts are validated as safe integer VND values.

## Integration boundary

The reporting service consumes read ports exposed by Payment and Refund. No HTTP route, Manager permission, branch filter, UI, or file exporter is added by REP-102. The source SRS requires a Manager's authorized reporting scope, but the repository has no approved branch-scope resolution contract for reports. Adding a route before that contract is reviewed could expose cross-branch financial totals. REP-104 can add filters/export after scope and timezone decisions are approved.

The source module and consumer contracts are additive: Payment provides settled-payment totals; Refund provides completed-refund totals; Reporting combines them. Review with Cường (Payment), Hà (Refund), and Đạt (Reporting) before integration. No shared enum or error code changed.

## Database and verification

No collection or document fields were added. Two read indexes were added to `payments` and `refund_requests`, with the opt-in migration `server/src/migrations/20261027-revenue-report-indexes.js`. The migration was not run against any database.

Tests were not run. The relevant verification still needed before merge is a Mongo replica-set test covering paid/partial/full-refund status inclusion, non-success exclusions, transaction-date boundaries, refund event de-duplication, and snapshot consistency.
