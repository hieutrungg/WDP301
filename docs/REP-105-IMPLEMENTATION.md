# REP-105 Movie Sales Tests

## Completed verification in the working tree

Added `server/test/reporting-analytics.test.js` with three focused regression tests:

1. UC43 movie-filtered report uses an inclusive `Asia/Ho_Chi_Minh` date range and calculates net revenue as successful gross payments minus successful refunds.
2. Invalid report pagination (including `NaN`) is rejected before reaching the report repository.
3. UC42's Today period starts at Vietnam local midnight, including the UTC date rollover, and nets same-day successful refunds.

Verification: `node --test test/reporting-analytics.test.js` — 3 passed, 0 failed.

## Newly approved UC44 test constraints

The project owner approved these constraints in chat on 2026-10-27:

- Period boundaries use `Asia/Ho_Chi_Minh`.
- Valid movie-sales tickets have status `ISSUED` or `USED`; bookings in refunded state are excluded.
- Manager branch scope is resolved from authenticated `employeeProfile.branchId`.
- Successfully processed refund amounts are attributed to the linked Showtime's screening date.

## Remaining UC44 dependency

No UC44 movie-sales service, repository, route, or UI exists in the current working tree. Therefore the new tests cover existing UC42/UC43 behavior but cannot yet exercise UC44's per-movie/per-showtime metrics end to end. The approved UC44 constraints are recorded for its implementation. Gross ticket revenue for combined ticket + concession bookings with a booking-level discount still needs a reviewed allocation rule; REP-104 documents the same data-model limitation. Ticket check-in/invalidation reconciliation also depends on the unfinished Ticket/refund integration documented by SHOW-103.

The REP-105 sheet row was not marked Done. Do not treat UC44 test coverage as complete until the movie-sales read API exists and its remaining metric/source contract is reviewed.
