# Online Booking Class Design

## Scope and Business Flow

Supports browsing booking options, selecting a showtime, atomically holding seats, adding concessions, applying a voucher, creating a pending booking, paying, viewing history, and receiving digital tickets.

## Current Design Review

- The current `BookingServiceImpl` depends on roughly a dozen repositories and owns discovery, seat locking, orders, payment, cancellation, history, and ticket generation. This is a god service and an unsafe consistency boundary.
- `ShowtimeSeat.lockSeat()` has no owner/token/expiry rules, and creation of Booking/Order/Payment/Ticket is not shown as an atomic or compensating workflow.
- `Order`, `Booking`, and `Payment` duplicate totals/status without defining the source of truth.
- Read operations should use query ports; booking commands should operate on aggregates.

## Proposed Responsibilities and Relationships

`BookingQueryService` handles browse/history views. `SeatHoldService` atomically acquires/release expiring holds. `CreateBooking` creates a `PENDING_PAYMENT` Booking from a valid hold and price quote. `CompleteBookingPayment` consumes a verified payment result, confirms the hold, and issues tickets exactly once. Concession selection and promotion pricing are ports owned by their modules.

## Key Invariants

- A showtime seat can have at most one active hold or confirmed sale.
- A hold has an owner and expiry; confirmation requires the same owner/booking.
- Server-side prices are snapshotted at booking time.
- Payment callback handling and ticket issuance are idempotent.
- Booking status transitions are explicit and monotonic except defined cancellation/refund paths.

Open Design Question: confirm whether order is a required independent aggregate or whether Booking is the sale aggregate for ticket-plus-concession purchases.

