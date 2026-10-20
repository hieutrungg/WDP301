# Booking/pricing conflict resolution — 2026-10-20

Base being integrated: `eb9448f` (PR #19, Showtime/seat UI updates). The conflicts came from applying the local booking/pricing/checkout stash over the updated branch. Neither side alone preserves the full functionality.

## File decisions

| File | Updated upstream | Local stash | Resolution |
| --- | --- | --- | --- |
| `client/src/features/seat-selection/pages/SeatSelectionPage.jsx` | Selection timer/expiry/restart, live availability wording, toolbar above the seat map; unfinished F&B/Payment actions | Missing-price guards, pair price display, saved checkout and navigation | Keep upstream toolbar, selection timeout and recovery. Keep local quote guards and Checkout route. The confirm action now navigates to the existing checkout instead of ending at disabled F&B/Payment buttons. Reservation is created by checkout's existing SeatHold command. |
| `server/src/modules/booking/seat-availability.service.js` | `pricesBySeatType` initialization input and summary used by SOLD_OUT | Complete price validation and safe repricing | Preserve upstream input name and summary; combine validation/repricing exports. Update local pricing tests to use the upstream initializer/publisher parameter. |
| `server/src/modules/booking/seat-hold.repository.js` | Availability summary aggregation; write seat prices on initialization | Immutable initialization validation, safe repricing transaction, stale-price claim guard | Preserve both read and write capabilities. Only include `priceSnapshot` in an insert when supplied; never overwrite an existing conflicting snapshot. |
| `server/src/modules/showtime/showtime.service.js` | Public SOLD_OUT projection, Manager schedule/history, fixed MVP price table | Atlas plans by Vietnam date, exact historical layout port, safe linked-showtime reschedule | Preserve upstream list/detail/Manager projections. New publication resolves the approved Atlas plan and passes it as `pricesBySeatType`. Use the Room version reader and transactional reschedule from the local work. Remove fixed-table validation from this runtime path. |

The upstream selection clock is a UI selection window, not a database SeatHold. It now measures elapsed wall time so background throttling does not stretch the window; refreshing availability does not restart it. On checkout, only the server hold expiry controls the reservation. A saved checkout offers Resume rather than claiming the selection clock is the hold clock. This preserves the incoming UX without introducing a new server hold duration or expiry transition.

The old fixed-price module remains available to its existing development seed consumer. No seed was executed or changed as part of conflict resolution. Existing Showtime/Booking/SeatHold prices were not migrated or rewritten.

## Verification

- Existing backend selection: 71 tests, 66 passed, 5 skipped, 0 failed. Covers Booking/RBAC, SeatHold, price plans/seeds/migrations, backfill and pricing publication/reschedule.
- Added `server/test/showtime-merge-integration.test.js`: 3 passed. Exercises combined summary/reprice interface, upstream price input validation, public list/detail SOLD_OUT and Manager upcoming/cancelled/ended states with isolated persistence adapters.
- Frontend checkout/pricing/movie navigation: 15 passed.
- ESLint for the affected backend/client files and added tests: passed. Client production build: passed, with the existing large-bundle warning.
- Browser on the isolated in-memory fixture: selection countdown, VIP B3 price, toolbar Confirm action and navigation to checkout with server reservation countdown verified. No Atlas requests/writes were made by this fixture.
- Replica-set integration tests were skipped because `MONGODB_TEST_URI` is not configured. Unit/adapter tests do not verify real MongoDB races.

## Integration notes

No new HTTP endpoint, request/response shape, permission, enum, index or database relationship was introduced by resolving these conflicts. The previously staged `ticketPricePlanId` relationship remains part of the pricing change awaiting cross-module review: Hiếu implements, Đạt reviews Showtime, Hà reviews SeatHold/selection, Nam reviews Room version reads. Payment remains unavailable until Cường's integration; this merge does not complete BOOK-010 or Payment/Ticket.

Changed beyond the four conflicted files: three initializer/publisher parameter references in `server/test/ticket-pricing.test.js`, the new merge regression test and this report. Other staged changes were preserved. No commit, push, stash drop, migration or live seed was performed.

Recovery copies of the original conflicted working files and Git stages 1/2/3 are under `.git/codex-conflict-backups/2026-10-20T11-34-53-133Z/`. The source stash is retained.
