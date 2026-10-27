# Analytics Class Design

## UC mapping

The current SRS maps **UC44 to Analyze Movie Sales**. UC42 is the separate general Dashboard & Analytics use case; UC43 is Export Revenue Reports. This mapping is consistent across SRS §3.6.1–§3.6.3, the Use Case List, and the detailed use-case tables `CMS_UC43` and `CMS_UC44`.

## Scope and Business Flow

UC44 analyzes movie and showtime performance. It summarizes and compares movies, then provides per-showtime detail. SRS metrics include tickets sold, gross/refunded/net ticket revenue, scheduled and completed showtimes, available seat capacity, valid tickets, occupancy, and average ticket revenue. BR-62 uses screening date as the default reporting-period criterion for movie sales analytics. General dashboard KPIs belong to UC42, not UC44.

## Current Design Review

- The current AnalyticsService joins six operational repositories and performs calculations in one service. This is tightly coupled, slow, and risks inconsistent date/status filters.
- Room capacity, sold tickets, completed bookings, and paid amounts require consistent definitions and a common time/branch filter.
- Analytics is a read concern and should not depend on mutable domain entities or `JpaRepository`.
- Movie-by-movie loops should be replaced by aggregation queries/projections.

## UC42 / REP-103 Dashboard

The approved Manager dashboard contract is recorded in `docs/REP-103-METRIC-CONTRACT.md`. `GET /api/analytics/dashboard?period=TODAY|WTD|QTD` returns gross and net VND revenue by Vietnam transaction date, completed-showtime occupancy, and up to five showtimes ranked by valid tickets issued during the selected period. Period boundaries use `Asia/Ho_Chi_Minh` with Monday as the first day of the week. The route requires `analytics.view` and role `MANAGER`; branch scope is taken only from the authenticated account's `employeeProfile.branchId`.

The dashboard query is read-only and uses a Mongo snapshot transaction across payment, refund, occupancy, and ticket aggregates. Occupancy excludes refunded bookings and invalidated tickets; zero seat capacity serializes as `ratePercent: null`. No new collection or migration is required. The reference Manager permission seed now includes the existing `analytics.view` permission.

## Proposed Responsibilities and Relationships

`AnalyticsQueryService` accepts one explicit filter and calls `AnalyticsReadPort`, implemented by Mongo aggregation or a materialized projection. Metric definitions are named value objects and returned as dashboard/movie-sales read models. The service does not mutate operational data.

The current SRS gives the occupancy calculation as valid tickets sold divided by available seat capacity for the included showtimes. Remaining implementation decisions include the reporting timezone, the authoritative source for valid tickets and showtime completion, refund period attribution when analytics are filtered by screening date, and the exact authorized branch-scope source. REP-101 resolves only the UC mapping; REP-102/103/105 and owner review must settle the remaining reporting contracts before implementation.

