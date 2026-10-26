# CON-102 — Optional food in ticket checkout

Owner: Hiếu. Implemented in the working tree on 2026-10-25, under the explicit chat approval of `CON-102-INTEGRATION-CONTRACT.md`. No standalone concession checkout, POS pickup command, refunds, vouchers or real gateway added. The earlier approval draft is superseded. No SRS changes or task-board Done updates.

## Behavior

Customer flow: Seats → original server SeatHold → optional Food & Drink / Skip → checkout → one existing mock Payment → confirmation/history. The menu uses CON-101 data, English labels, quantity controls and the screening cinema's branch. The branch cannot be chosen independently. C13 Stitch was inspected: stepper/countdown, menu/filters, quantity controls, sticky order summary and Skip are followed; sample loyalty discounts, collector promotions and express-counter promises are not business requirements.

Selecting and quoting do not reserve inventory. A signed quote binds the owner, hold, branch, expiry, current item/recipe snapshots and integer VND amounts. Submitting Booking validates that quote again, reserves the summed concession requirements across individual items and combos, and creates Booking + linked Order + reservation atomically. Zero-price food still reserves stock. Missing/invalid/inactive items and changed quotes are rejected. Shortage leaves the seats available for this Customer to edit food or Skip within the original hold window.

Booking's verified-payment transition consumes seats, confirms the linked order, consumes inventory and writes one online SALE per expanded concession in a single Mongo transaction. Repeated submit/callback/release does not repeat these effects. A rejected food consumption aborts the seat consumption too. Late success goes through existing Payment reconciliation with no food pickup entitlement. Payment aggregate persistence still follows the existing Payment owner's workflow outside the Booking transaction; its existing process-crash/reconciliation boundary is unchanged.

Explicit **Cancel entire checkout** expires Booking + Order and releases seats/stock in one transaction. Canceling/declining an individual mock payment attempt keeps the live checkout available for retry until the original expiry. No new ten-minute window is granted. Confirmation and history show snapshot items and the pickup order code only after both Booking and Payment are confirmed. The existing E-Ticket remains a `PENDING_TICKET_MODULE` preview, not a new issued ticket.

## Changed files

- Client: `booking/api/bookingApi.js`; new `pages/ConcessionSelectionPage.jsx` and `components/ConcessionOrderSummary.jsx`; checkout, confirmation/history pages; `checkoutFlow.js`/`checkoutSession.js`; Seat Selection handoff; mock modal/instruction labels translated to English; shared router adds the Customer-only optional-food route. Existing ticket-only role behavior is preserved.
- Booking: model, validation, controller/routes, service and module composition. Booking delegates stock/order transitions to the Concession owner port and retains the SeatHold owner port.
- Concession: new `checkout.validation.js`, `checkout.routes.js`, `checkout.service.js`, `order.model.js`.
- Inventory: new `stock-reservation.model.js`/`stock-reservation.service.js`; optional reserved counter/audit fields; public stock read subtracts active reservations.
- Payment: additive amount breakdown, read-side expiry recognizes persisted EXPIRED bookings; expiry writes use compare-and-set so a concurrent terminal Payment update is retained.
- Shared: `server/src/app.js`, frontend router, schema/readiness docs and explicit index migration. Existing unrelated working-tree edits are preserved.
- Tests: new server `concession-checkout.test.js`/`concession-checkout.mongo.test.js`; extended client checkout/router tests and existing loopback-only checkout preview fixture. Fixture responses never proxy to Atlas or the development backend and are not application sample data.

## API / ownership

- `POST /api/concession-checkout/quote`: authenticated Customer + `booking.create`; `{holdId, items:[{itemType,itemId,quantity}]}`. Owner/branch/prices cannot be supplied. Empty items can read the hold/branch context for Skip. Nonempty quotes require reviewed storage indexes.
- `POST /api/bookings`: existing ticket request plus optional `concessionSelection:{quoteReference,items}`. Only Customer can add food. Same request key with different selection returns 409. No selection keeps the old contract.
- `POST /api/bookings/:bookingId/cancel-checkout`: authenticated owning Customer + `booking.create`, empty body. Pending checkout only; confirmed checkout cannot be canceled here.
- Booking create/detail adds `ticketAmount`, `concessionAmount`, `concessionOrder` for linked food bookings. Payment detail/history reuse that read model. `subtotal` remains tickets; `totalAmount` includes food. Existing Payment endpoints/methods/references remain.
- Errors: `INVALID_CONCESSION_SELECTION`, `CONCESSION_QUOTE_CHANGED`, `INSUFFICIENT_CONCESSION_STOCK`, `CONCESSION_CHECKOUT_EXPIRED`, `CONCESSION_REQUEST_KEY_REUSED`; storage unavailable is 503 with an option to continue without food.

Integration reviewers: Hiếu (Concession/Booking UI), Nam (Inventory reservation/audit), Hà (SeatHold expiry/session handoff), Cường (combined Payment/retry/receipt). User approval authorizes implementation; these shared contracts and indexes still require cross-owner review before merge.

## Database / rollout

Additive only: Booking optional `concessionAmount`/`concessionFingerprint`; `orders.bookingId` and immutable food/recipe snapshots with the original hold expiry; new durable `inventory_reservations`; optional `inventories.reservedQuantity` (missing reads as zero); optional online SALE source/order/booking references. `quantity` stays physical on-hand stock. Stock Goods continues to increment it and does not reset inventory daily. Staff/Manager stock screens still show physical on-hand quantity, while public catalog availability excludes live reservations. Online SALE uses the actual Customer account, never a fabricated Staff actor.

No TTL deletion of reservation evidence. Catalog ignores logically expired reservations. Before a new food Booking, Inventory releases expired counters in independently committed batches of at most 100. Checkout also reconciles a bounded batch inside its transaction to handle intervening expiry. Order/Booking terminal state is lazily reconciled by existing reads/callbacks. There is no new background worker.

**Development Atlas was not migrated, seeded or backfilled.** Tests create uniquely named `con102_test_*`, `book010_test_*` and `cinema_con101_test_*` databases and drop only those isolated databases. Deploying food checkout requires reviewed indexes; without them ticket-only/Skip remains usable.

From `server/`, inspect the migration without connecting or writing:

```powershell
node src/migrations/20261025-concession-checkout.js --db cinema_management_dev
```

After Inventory/Payment review, explicitly apply to the intended database:

```powershell
node src/migrations/20261025-concession-checkout.js --db cinema_management_dev --apply --allow-remote
```

The migration uses the configured URI without printing it. It creates indexes only; never drops/replaces indexes, edits menu items, rewrites stock or inserts seed food. Existing incompatible indexes/duplicate legacy data cause failure requiring owner review. Existing database validators are not overwritten; the deployment owner must review compatibility of any externally managed validators with these approved additive fields/statuses.

## Validation

See final verification results below. The isolated Mongo suite covers price/owner/branch authority, no reservation on quote, amount breakdown, idempotent submit/concurrent callback, last-item race and Skip, combo + loose-item demand, transaction rollback, cancellation, boundary expiry, zero-price stock, expired-counter reuse, real mock Payment failure/retry/late review, and HTTP role/input boundaries. Client tests cover signed selection handoff, combined-total verification, reload replay, recoverable food rejection versus uncertain network failure, and route guards.

Manual browser verification uses only the loopback test fixture: Seats → optional food → quantity change/reload with unchanged expiry → quote review → combined checkout → mock success → real receipt component and pickup code. This is UI integration verification; the separate Mongo suite verifies actual persistence, concurrency and Payment/Booking services.


### Final verification — 2026-10-25

- Backend: 42 Booking/lifecycle/Payment/SeatHold/availability regression tests passed; 2 new CON-102 validation/migration tests passed.
- MongoDB: BOOK-010 13/13, CON-101 16/16 and final CON-102 14/14 passed on isolated databases (43 total, parent tests included). No skips in those runs. CON-102 includes concurrent food confirmation, changed recipe/inactive products, cancellation rollback and missing-index Skip behavior. Test databases were removed after runs; an interrupted test run was also explicitly cleaned up.
- Frontend: checkout/router/login 19/19 plus catalog/seat-pricing 6/6 passed (25 total).
- ESLint on affected client and server implementation/test files passed. Client production build passed with the existing large-bundle advisory. The full-project client lint has a previously observed unrelated ManagerShowtimesPage immutability error; that module was not changed by CON-102.
- Browser: original hold/countdown retained on food-page reload, quantity retained, 110500 + 30000 = one 140500 VND payment, pickup code only after paid confirmation, confirmation reload preserved food receipt; a new Skip checkout showed food 0 and total 110500. Browser checks used the loopback fixture, never development Atlas.
- git diff --check passed. No commit, push, task-status update or development migration/seed performed. Cross-owner review and an explicit target-database migration remain deployment prerequisites.
