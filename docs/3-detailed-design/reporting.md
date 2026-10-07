# Reporting Class Design

## Scope and Business Flow

Supports filtered revenue/operational reports and exports to Excel/PDF.

## Current Design Review

- Remove the generic `Report` entity/repository unless the business requires stored report artifacts. The flow generates a report on demand.
- Do not query Booking, Order, and Payment repositories independently in application code; totals will drift and require large in-memory joins.
- Define revenue semantics and expose one reporting read model/projection.
- Export is an adapter behind a format-specific port; reporting calculation must not depend on a file library.

## Proposed Responsibilities and Relationships

`GenerateRevenueReport` validates criteria and requests a stable projection from `RevenueReportReadPort`. `ExportReport` chooses an exporter by format. The read adapter may use Mongo aggregation pipelines or maintained projections. Generated report data is immutable and need not be a domain aggregate.

Open Design Question: define revenue recognition, refund treatment, time zone, tax, and whether report snapshots must be retained for audit.

