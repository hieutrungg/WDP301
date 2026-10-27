# REP-103 Dashboard Analytics Implementation

Status: implemented in the working tree; pending review.

## Behavior

- Manager dashboard period controls: Today, week-to-date (Monday start), and quarter-to-date in `Asia/Ho_Chi_Minh`; the end boundary is the snapshot generation time.
- Revenue totals and daily trend use successful payment `paidAt` and successful refund `processedAt`. Gross is collected amount; net subtracts refunds recorded in the selected period. VND remains integer amounts.
- Occupancy uses published showtimes that start within the selected period and have ended by the cutoff. Valid tickets are `ISSUED` or `USED`; refunded bookings are excluded. Capacity is the showtime's non-`UNAVAILABLE` seat count. A zero denominator returns `null`.
- Trending showtimes rank by valid tickets issued in the selected period, with deterministic start-time/ID ordering for ties; response is limited to five.
- The dashboard also returns the total valid tickets issued in the period for the admissions KPI; the leaderboard remains limited to five.
- Scope comes from `req.auth.account.employeeProfile.branchId`. Missing branch assignment returns `403 DASHBOARD_BRANCH_REQUIRED`; no branch query parameter is accepted.

## API and authorization

`GET /api/analytics/dashboard?period=TODAY|WTD|QTD` returns the revenue series and totals, occupancy summary, total valid tickets sold, and the top-five showtime list.

Requires authentication, `analytics.view`, and role `MANAGER`. The Manager permission reference includes the existing `analytics.view` permission; migration `server/src/migrations/20261027-rep-103-analytics-permission.js` grants it idempotently to the existing MANAGER role. No shared enum or API error contract was changed.

## Database

No schema or collection change and no migration. The reporting adapter runs read-only aggregation pipelines over existing payment, refund, booking, showtime, room, ticket, and showtime-seat collections in a Mongo snapshot transaction.

## Changed files

- `server/src/app.js`
- `server/src/modules/reporting/dashboard.repository.js`
- `server/src/modules/reporting/dashboard.service.js`
- `server/src/modules/reporting/dashboard.controller.js`
- `server/src/modules/reporting/reporting.routes.js`
- `server/src/modules/reporting/reporting.module.js`
- `server/src/migrations/20261027-rep-103-analytics-permission.js`
- `client/src/features/manager-dashboard/api/managerDashboardApi.js`
- `client/src/features/manager-dashboard/pages/ManagerDashboardPage.jsx`
- `client/src/app/router/index.jsx`
- `client/src/layouts/ManagerLayout.jsx`
- `docs/ref/seedDataRegister.js`
- `docs/SCREEN_FLOW.md`
- `docs/3-detailed-design/analytics.md`
- `docs/REQUIREMENTS_STATUS.md`
- `docs/REP-103-METRIC-CONTRACT.md`

## Verification and integration

No tests have been run. The permission migration has not been run against a database. Review the reporting aggregation and mounted route with the Payment, Refund, Showtime, and Ticket owners before merge. The existing REP-102 read model remains an internal totals service; REP-103 uses its own branch-scoped transaction-date series.
