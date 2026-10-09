# F-Cinema screen flow and implementation order

Source reviewed: Stitch project `CinemaManagementSystem-WDP-G5` on 2026-10-06.

The Stitch canvas contains 73 visual items: 71 runtime screens/modals and 2 design references (`F-Cinema Brand Logo`, `Blockbuster Cinema Experience`). The runtime screens should be implemented as five connected product flows rather than in their current canvas order.

## Recommended implementation roadmap

| Phase | Goal | Screens / modules | Depends on |
| --- | --- | --- | --- |
| 0. Foundation | Stabilize navigation, identity and shared UI | Brand Logo, Blockbuster Cinema Experience, G01 Home, G02 Register, G03 Sign In, Verify Email (already in repo), G04 Forgot Password, G04b Verify OTP, G04c Reset Password, G04d Reset Success | None |
| 1. Discovery | Let guests find a film and a valid session | C01 Movies / Now Showing, C02 Movie Detail & Trailer, C08/C09 Showtimes & Theatre Selection | Foundation; movie, branch, room and showtime APIs |
| 2. Booking MVP | Complete the revenue-critical customer journey | **Add missing Seat Selection screen**, C13 Food & Drink Combos, C14 Checkout & Payment, C15 Booking Confirmation & E-Ticket, C17 Fullscreen E-Ticket | Discovery; booking hold, pricing, promotion, payment and ticket APIs |
| 3. Customer self-service | Reduce support workload and build loyalty | My Dashboard, C16 My Bookings & Tickets, Request Cancellation / Refund, Transaction History, My Profile, Edit Profile, C20 and C20a/b/c/d/e, password/2FA/audit modals, C18/C18b reviews, C19/C19b rewards | Booking MVP; account, refund, review, voucher and points APIs |
| 4. Staff operations | Operate counters, gates and concessions | Staff Operations Dashboard, Sell Tickets at Counter, Counter Payment, Print Ticket & Invoice, Scan Ticket, Sell Concessions, Counter Concession Payment, Concession Inventory, Stock Goods | Booking/ticket/payment services; role guards; inventory APIs |
| 5. Manager operations | Configure the catalogue and run cinemas | Manager Dashboard & Analytics, Movie Management, Add/Update/Archive Movie, Showtime Management, Create/Modify/Cancel Showtime, Configure Room Seat Maps, Promotion Management/Form, Staff Shift Monitoring, Movie Sales Analytics, Revenue Reports | Stable staff operations; reporting projections; audit log |
| 6. System administration | Govern people, permissions and branches | Admin Dashboard, Staff Account Management, Create/Update Staff Account, Assign Staff Roles & Permissions, Role Management, Create/Update Role, Assign Permissions to Role, Cinema Branch Management | Mature permission model, audit log and manager workflows |

## 1. Customer acquisition and booking

```text
G01 Home
  -> C01 Movies / Now Showing
  -> C02 Movie Detail & Trailer
  -> C08/C09 Showtimes & Theatre Selection
  -> [NEW] Seat Selection
  -> C13 Food & Drink Combos (optional)
  -> C14 Checkout & Payment
  -> C15 Booking Confirmation & E-Ticket
  -> C17 Fullscreen E-Ticket
```

Authentication is a reusable branch entered when checkout or an account-only action requires identity:

```text
G03 Sign In
  <- G02 Register -> Verify Email
  <- G04 Forgot Password -> G04b Verify OTP -> G04c Reset / Set New Password
     -> G04d Password Reset Success -> G03 Sign In
```

Important implementation rule: create an expiring seat hold, then create a `PENDING_PAYMENT` Booking before taking payment. A verified successful payment confirms the Booking and issues its Ticket exactly once. Failed or timed-out payment expires/releases the hold. Payment success received after expiry must not confirm the Booking or issue a Ticket; it moves to `REFUND_REQUIRED`/`REVIEW_REQUIRED` handling.

## 2. Customer account, loyalty and support

```text
My Dashboard
  +-> C16 My Bookings & Tickets -> C17 Fullscreen E-Ticket
  |                              -> Request Cancellation / Refund
  |                              -> C18 Rate & Review -> C18b Review Success
  +-> Transaction History
  +-> C20 User Profile & VIP Tier
      +-> My Profile -> Edit Profile
      +-> C20a Personal Info & Security
      |   -> Change Password -> C20a-modal -> C20a-2fa -> C20a-success
      |   -> C20a-audit-modal
      +-> C20b VIP Tier & Benefits Comparison
      +-> C20c F-Points Ledger & History
      +-> C20d Cinema & Viewing Preferences
      +-> C20e Saved Payment Methods
      |   -> C20f Remove Payment Method -> C20g Card Removed Success
      +-> C19 Rewards Catalog -> C19b Redemption Confirmation / E-Voucher
```

Reviews must be available only after the showtime ends. Refund eligibility must be calculated on the server from showtime time, ticket state and policy—not from UI state.

## 3. Staff counter and theatre operations

```text
G03 Sign In -> role guard -> Staff Operations Dashboard
  +-> Sell Tickets at Counter -> Counter Payment -> Print Ticket & Invoice
  +-> Scan Ticket -> valid / used / expired result
  +-> Sell Concessions -> Counter Concession Payment -> receipt / runner ticket
  +-> Concession Inventory -> Stock Goods -> updated stock ledger
```

Counter sales must reuse the same booking, payment, ticket and promotion services as the customer web flow. Avoid a separate POS-only source of truth.

## 4. Manager operations

```text
G03 Sign In -> role guard -> Manager Dashboard & Analytics
  +-> Movie Management
  |   +-> Add New Movie
  |   +-> Update Movie
  |   `-> Archive Movie Confirmation
  +-> Showtime Management
  |   +-> Create Showtime
  |   +-> Modify Showtime
  |   `-> Cancel Showtime Confirmation
  +-> Configure Room Seat Maps
  +-> Promotion Management -> Promotion Form
  +-> Staff Shift Monitoring
  `-> Movie Sales Analytics -> Revenue Reports
```

Showtime without any active SeatHold or transaction may be cancelled before it starts. Cancellation with sold/pending transactions remains unavailable until the Refund workflow and notification policy are approved. Movie archival must be blocked while future showtimes reference the movie.

## 5. System administration

```text
G03 Sign In -> role guard -> Admin Dashboard
  +-> Staff Account Management
  |   +-> Create Staff Account
  |   +-> Update Staff Account
  |   `-> Assign Staff Roles & Permissions
  +-> Role Management
  |   +-> Create Role
  |   +-> Update Role
  |   `-> Assign Permissions to Role
  `-> Cinema Branch Management
```

Role changes, account-status changes and branch-status changes need immutable audit records. Branch disablement must be blocked when active rooms, future showtimes, bookings or unsettled transactions exist.

## Missing or unclear screens to add before implementation is considered complete

1. Customer seat-selection screen between C08/C09 and C13.
2. Customer payment failed, pending and retry states; C14 currently shows only the happy path.
3. Booking-expired / seat-hold-expired state.
4. Generic 403, 404 and 500 states plus offline/retry treatment.
5. Staff scan result variants: valid, already used, cancelled/refunded and wrong cinema/showtime.
6. Refund request detail/status and manager approval/rejection outcome.
7. Confirmation/success states for staff account, role, branch, movie, showtime and promotion mutations.
8. Staff/manager/admin sign-in handoff or a clearly documented shared G03 role redirect.

## Route-family recommendation

| Surface | Suggested route family |
| --- | --- |
| Public/customer | `/`, `/movies`, `/movies/:id`, `/showtimes`, `/booking/*`, `/account/*`, `/rewards/*` |
| Staff | `/staff`, `/staff/pos/*`, `/staff/tickets/scan`, `/staff/inventory/*` |
| Manager | `/manager`, `/manager/movies/*`, `/manager/showtimes/*`, `/manager/promotions/*`, `/manager/reports/*` |
| Administrator | `/admin`, `/admin/accounts/*`, `/admin/roles/*`, `/admin/branches/*` |

Use separate layout shells and route guards for customer, staff, manager and administrator surfaces. Authorization must also be enforced by the server; client-side route guards are navigation aids, not a security boundary.
