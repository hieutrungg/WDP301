# Analytics Class Design

## Scope and Business Flow

Supports dashboard KPIs, occupancy, revenue trends, movie sales analysis, and top-selling movies.

## Current Design Review

- The current AnalyticsService joins six operational repositories and performs calculations in one service. This is tightly coupled, slow, and risks inconsistent date/status filters.
- Room capacity, sold tickets, completed bookings, and paid amounts require consistent definitions and a common time/branch filter.
- Analytics is a read concern and should not depend on mutable domain entities or `JpaRepository`.
- Movie-by-movie loops should be replaced by aggregation queries/projections.

## Proposed Responsibilities and Relationships

`AnalyticsQueryService` accepts one explicit filter and calls `AnalyticsReadPort`, implemented by Mongo aggregation or a materialized projection. Metric definitions are named value objects and returned as dashboard/movie-sales read models. The service does not mutate operational data.

Open Design Question: confirm KPI formulas, reporting time zone, canceled/refunded inclusion, and whether occupancy uses room capacity or sellable showtime-seat capacity.

