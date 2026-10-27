# Reporting Class Design

## UC mapping

The current SRS maps **UC43 to Export Revenue Reports** and **UC44 to Analyze Movie Sales**. UC42 is the separate general Dashboard & Analytics use case. This mapping is consistent across SRS §3.6.1–§3.6.3, the Use Case List, and detailed use-case tables `CMS_UC43` and `CMS_UC44`. Do not swap the UC numbers or treat UC44 as the general dashboard.

## Scope and Business Flow

UC43 produces a filtered revenue report preview and exports it to a supported format such as PDF or Excel. Its filters include period, branch, movie, and revenue category where applicable. It aggregates verified financial transactions and reports ticket/concession gross revenue, successfully processed refunds, net revenue, and relevant sales counts. BR-62 says the default reporting period is based on payment or refund transaction date.

## Current Design Review

- Remove the generic `Report` entity/repository unless the business requires stored report artifacts. The flow generates a report on demand.
- Do not query Booking, Order, and Payment repositories independently in application code; totals will drift and require large in-memory joins.
- Define revenue semantics and expose one reporting read model/projection.
- Export is an adapter behind a format-specific port; reporting calculation must not depend on a file library.

## Proposed Responsibilities and Relationships

`GenerateRevenueReport` validates criteria and combines payment and refund read ports inside one MongoDB read transaction. The REP-102 on-demand summary uses Mongo aggregation pipelines; it is not a persisted projection. `ExportReport` chooses an exporter by format. Generated report data is immutable and need not be a domain aggregate.

The mapping and metric names above come from the SRS. REP-102 implements core VND totals; REP-104 adds the Manager report API, preview, filters, PDF/Excel export, and export audit metadata in `docs/REP-104-IMPLEMENTATION.md`. Report dates use `Asia/Ho_Chi_Minh`, branch scope is resolved from the authenticated Manager profile, and API filters are server-validated. The approved combined checkout stores a booking-level discount without allocating it between ticket and concession components; component revenue after discount needs a team decision before that breakdown can be treated as authoritative. Completed concession sales currently count successful paid sales, not pickup fulfillment.

