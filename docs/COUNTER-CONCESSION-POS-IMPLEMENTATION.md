# Counter Concession POS implementation

Implemented 2026-10-27 from the approved UC24/28/29 owner decision.

## Runtime behavior

- `/staff/concessions` is a two-column POS: branch/category/product picker on the left and the current sale on the right.
- Clicking an available item increments its quantity. Staff can decrement, remove, clear, search and switch categories. Switching branch with a non-empty sale requires confirmation and clears the sale because price/stock are branch-scoped.
- Checkout creates a standalone `COUNTER` ConcessionOrder. It never creates a Booking, SeatHold or Ticket.
- Cash requires the tendered amount to be at least the authoritative server total; change remains outside the system. Bank transfer reuses the existing Payment gateway router: payOS creates the VietQR instruction when configured, and the Staff status-check endpoint verifies payOS before settlement. Local development retains the existing mock fallback when payOS credentials are absent.
- Inventory is reserved while QR is pending and consumed only when Cash/QR is confirmed. The receipt is printable only after `PAID`.

## API and persistence

- `POST /api/counter-concessions/orders`
- `POST /api/counter-concessions/orders/:orderId/confirm-qr` (provider-status verification for payOS attempts)
- `POST /api/counter-concessions/orders/:orderId/simulate-payment` (non-production Staff demo settlement; closes a live payOS link when possible)
- Both routes require authenticated `STAFF`. Server reloads catalog price/recipe/stock and ignores client totals.
- `orders.bookingId`, `orders.customerAccountId`, `payments.bookingId` and `inventory_reservations.bookingId` become optional for Order-first walk-in sales. `orders.type` adds `COUNTER` and records `createdByStaffId`; Payment adds the existing optional `orderId` relationship with a unique partial index.
- Migration `20261027-counter-concession-pos.js` is opt-in and dry-run by default. It was not applied to any database.

## Deferred

- A provider webhook for order-only payments, cash drawer reconciliation, runner/kitchen ticket and pickup fulfillment remain outside this slice. The Staff UI explicitly checks payOS status; booking-payment webhook behavior is unchanged.
- A dedicated concession-sale permission remains unapproved, so this demo slice uses the approved Staff-only role boundary without coupling a standalone food order to ticket-booking permission.
