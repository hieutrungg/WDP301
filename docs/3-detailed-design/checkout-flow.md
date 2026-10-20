# FLOW-002 — Checkout shell

Implemented scope, 2026-10-20: ticket seat reservation → explicit checkout confirmation → server-created `PENDING_PAYMENT` Booking. Payment initiation/result and ticket issuance remain integration dependencies.

## Sources and ownership

- Current Team Development Plan, `Iter2!A8:N8`: FLOW-002 is `APPROVED_READY`; Hiếu owns Booking UI/API, Hà supplies SeatHold, Cường owns Payment/result UI. The sheet was read, not edited.
- SRS UC20/UC30, `SCREEN_FLOW.md` §1 and customer flow in `screen-flow.drawio`: create an expiring hold, then pending Booking before payment. Confirmation/Ticket requires verified payment.
- Decisions A-17–A-23: expiry, idempotency, Booking states and the verified payment boundary.
- Stitch project `12758682447811659045`: C14 node and project design tokens were inspected. Its full screen content did not load through the canvas in this session; exact C14 visual parity still needs UI review. This shell follows the existing application surfaces and components.
- Mixed cart, concessions and vouchers remain blocked by their existing decisions; this implementation does not add them.

## Behavior and recovery

1. Seat Selection saves an account/showtime-scoped attempt in this tab's `sessionStorage`, before sending a reservation command. It navigates to `/booking/:showtimeId/checkout`.
2. Checkout calls the existing acquire endpoint using the saved checkout key. Replaying the command recovers the same hold and original expiry. No Booking is created just by opening checkout.
3. Seat lines and totals come from the server hold quote; saved labels are display metadata. Owner/showtime/seat set/currency/quote totals are checked before displaying a payable checkout.
4. The clock uses server time plus elapsed wall time, including time spent in the background. It does not count down by counting interval ticks or grant ten new minutes on reload.
5. **Confirm checkout** saves `bookingRequested` and the original request key before POST. A failed/ambiguous response can be retried or recovered by reloading, using exactly that key and hold. Local prices/owner/status are never sent as authority.
6. Booking state, amount, payable reference and expiry come from the Booking response. Expired/unavailable reservation blocks further submission. The UI does not persist `EXPIRED` or `CONFIRMED` into MongoDB.
7. A saved attempt can be resumed from Seat Selection. Before a Booking request has been attempted, the customer can release the hold and return to selection. After submission, the shell does not offer release while pending/unknown. Expired checkouts can return to selection without mutating Booking.
8. Fresh tabs without saved state show an empty checkout with a selection link. Account/showtime changes remount the checkout state; stored state never grants authorization. Closing the tab loses local recovery metadata; global Booking history remains BOOK-011.

## Files and contracts

- Client router: protected `/booking/:showtimeId/checkout` route; existing routes preserved. Shared router review: Hiếu, Hà and Cường.
- `features/booking/pages/CheckoutPage.jsx`: review, clock, submit/retry, pending/expired/error/empty UI.
- `features/booking/api/bookingApi.js`: existing `POST /api/bookings` adapter.
- `features/booking/utils/checkoutSession.js` and `checkoutFlow.js`: scoped recovery, quote verification and server handoff shape.
- `features/seat-selection/pages/SeatSelectionPage.jsx`: selection → checkout and resume action. Existing price guards retained.
- `client/test/checkout-flow.test.js`: recovery/failure tests. `client/test/fixtures/checkout-preview.mjs`: optional manual browser fixture on loopback port 5174; intercepts every `/api` request in memory and never proxies to Atlas.

No backend API, shared enum, database relationship, validator/index or migration was added by FLOW-002. It consumes existing POST SeatHold, DELETE SeatHold, GET availability and POST Booking contracts. No seed or Atlas mutation was run for this task.

## Payment integration still required

The current checkout has no customer Payment route or Payment API. The pending screen therefore disables Payment and explains its availability. It never shows a successful payment or a QR code as a substitute.

`paymentHandoff(booking)` prepares the existing server fields `bookingId`, `payableReference`, `amount`, `currency`, `expiresAt`. Cường must agree the route/init contract before this can be wired to Payment. Payment's backend must independently resolve ownership, current Booking/hold state, expiry and amount; session storage or route state is never a payment authority. This is a proposed client handoff, not a newly approved shared API contract.

BOOK-010 still owns server confirmation/expiry transitions. In particular, an existing pending record can remain `PENDING_PAYMENT` after its reservation clock expires; the shell shows the reservation as expired and blocks payment, without pretending it has performed the server transition. Cross-tab/external hold release and payment races require the BOOK-010/Payment transaction contract and integration tests.

FLOW-002's Booking shell is implemented; end-to-end handoff to Payment remains pending. Do not mark the complete Booking→Payment→Ticket journey done based on this shell.

## Verification

- `node --test test/checkout-flow.test.js test/seat-pricing.test.js test/movie-search-params.test.js` in client: 15 passed.
- `node --test test/booking.test.js test/booking-authorization.test.js test/seat-hold.test.js` in server: 37 passed.
- ESLint on the changed client runtime files: passed. Client production build: passed; existing chunk-size warning remains.
- Browser with the in-memory fixture: selected VIP B3, entered checkout, submitted Booking with simulated HTTP 503 after commit, reloaded, recovered the same pending Booking. Fixture recorded one hold, one Booking and two Booking POSTs using the same request key. Countdown continued rather than resetting. Expired server response showed 00:00, hid Payment and offered seat selection.
- No authenticated browser journey against Atlas or real MongoDB concurrency test was run for this task. Database tests above use their existing isolated adapters.
