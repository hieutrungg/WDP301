# Cinema Management System — Business Rules

## 1. Purpose

This document defines the business rules for the Cinema Management System. The rules are grouped by functional area for easier implementation and review. The original rule IDs (`BR-01` to `BR-53`) are preserved.

## 2. Account, Authentication, and Profile

| ID | Business Rule |
|---|---|
| BR-01 | The registered email must be unique in the system; two accounts are not allowed to use the same email address. |
| BR-02 | A new account can only be activated after successful verification via OTP or email. |
| BR-03 | The password must meet the minimum complexity requirements, including length, uppercase/lowercase letters, numbers, and special characters. |
| BR-04 | When changing the password, the user must enter the correct current password before being allowed to set a new password. |
| BR-05 | The password reset link/OTP is only valid for a limited period of time and can be used only once. |
| BR-06 | Access to system features is granted based on the user’s role and permissions after login. |
| BR-07 | The email address cannot be edited in the profile update function; only fields such as full name and phone number can be updated. |
| BR-28 | A disabled account cannot log in until it is reactivated. |
| BR-29 | When an account’s role is changed, the account’s access permissions must be automatically updated according to the permissions assigned to the new role. |

## 3. Movies and Public Movie Browsing

| ID | Business Rule |
|---|---|
| BR-13 | Each movie must have all required information, including title, duration, and age rating, before it can be published. |
| BR-44 | Only active and publicly visible movies can be displayed on public movie browsing, search, and movie detail pages. |
| BR-45 | Movie search and filtering can only use supported criteria such as keyword, genre, release date, language, and movie status. |

## 4. Showtimes and Cinema Rooms

| ID | Business Rule |
|---|---|
| BR-09 | Each showtime must be assigned to a specific cinema room and time slot, and the same room must not have overlapping showtimes. |
| BR-10 | Showtimes cannot be created in the past; the showtime must be scheduled for a future time. |
| BR-11 | Only upcoming showtimes that have not started yet can be updated or canceled. |
| BR-12 | When canceling a showtime that already has sold tickets, the system must trigger a notification/refund process for affected customers. |
| BR-18 | Ticket booking is only allowed for showtimes that have not started yet. |

## 5. Ticket Booking, Seat Holds, and Check-in

| ID | Business Rule |
|---|---|
| BR-14 | A seat can only be booked by one customer for one showtime; booked seats must not be shown as available. |
| BR-15 | Seats are temporarily held for a limited period of time while the customer is making payment; when the hold time expires, the seats are automatically released. |
| BR-16 | E-tickets and QR codes are only issued after successful payment. |
| BR-17 | A ticket QR code can only be scanned for check-in once; used tickets must not be accepted a second time. |
| BR-40 | Cancelled or refunded tickets must not be accepted for cinema entry or QR code validation. |

## 6. Food, Beverage, Combos, Cart, and Inventory

| ID | Business Rule |
|---|---|
| BR-19 | The quantity of concession combos/food items added to the cart must not exceed the current available stock. |
| BR-41 | Cart totals must be recalculated whenever tickets, concession items, quantities, vouchers, or item availability change. |
| BR-42 | Concession stock is deducted only after the related order/payment is successfully completed. |
| BR-47 | Only active and publicly available food and beverage items or combos can be displayed to Guests. |
| BR-48 | Stock levels must be displayed based on the latest inventory records. |
| BR-49 | Received goods quantity must be greater than zero. |
| BR-50 | Stock good levels are increased only after the stock goods transaction is confirmed. |

## 7. Orders, Payments, Vouchers, and Invoices

| ID | Business Rule |
|---|---|
| BR-20 | Tickets and invoices can only be printed after the payment transaction is successful. |
| BR-21 | An order can only be moved to the completed status after the system successfully verifies the payment. |
| BR-22 | Online payment is limited to supported digital payment methods; counter payment supports cash, card, and e-wallets. |
| BR-23 | A voucher code can only be applied if it is still valid, has remaining usage, and satisfies the applicable conditions. |
| BR-24 | Each order can only apply vouchers according to the configured rules, such as usage limits and whether voucher stacking is allowed. |
| BR-37 | Payment transaction records cannot be modified by Customers; they can only be created or updated by the system or authorized payment-related processes. |

## 8. Cancellation and Refunds

| ID | Business Rule |
|---|---|
| BR-25 | Cancellation/refund requests are only accepted for bookings that meet the cinema’s policy conditions, such as time and ticket status. |
| BR-43 | Cancellation/refund request status can only be updated by authorized Staff or Manager. |

## 9. Staff Accounts, Roles, and Permissions

| ID | Business Rule |
|---|---|
| BR-26 | Only Admins have permission to create and update staff accounts and assign roles. |
| BR-27 | When creating a staff account, the Admin must assign at least one role. |
| BR-32 | Only Admins have permission to create and update roles and assign permissions. |
| BR-33 | Permissions can only be selected from the predefined permission list of the system. |
| BR-34 | When the permissions of a role are updated, the changes are applied to all accounts currently assigned to that role. |
| BR-35 | A role defines the base permissions that an account inherits. |

## 10. Customer Data, Reviews, and Ratings

| ID | Business Rule |
|---|---|
| BR-08 | Only logged-in Customers are allowed to post movie ratings/reviews. |
| BR-36 | Customers can only view and access their own personal data, including profile information, transaction history, booking history, digital tickets, and cancellation/refund requests. |
| BR-38 | Customers can only post movie ratings/reviews for movies with eligible completed bookings. |
| BR-39 | Movie review content must follow system moderation rules before being publicly displayed. |
| BR-46 | Only approved and publicly visible movie reviews can be displayed to Guests. |

## 11. Reports and Exports

| ID | Business Rule |
|---|---|
| BR-30 | Reports must support filtering by time period, such as day, month, or year, or by a specific movie. |
| BR-31 | Revenue reports can only be exported in supported formats, such as Excel and PDF. |

## 12. Cinema Branches

| ID | Business Rule |
|---|---|
| BR-51 | Each cinema branch must have a unique branch name or address in the system. |
| BR-52 | A cinema branch cannot be disabled if it still has active cinema rooms, upcoming showtimes, or pending bookings. |
| BR-53 | Disabled cinema branches cannot be used for new showtime scheduling or ticket booking. |

## 13. Implementation Notes

- Treat the rules above as the source requirements; do not assume additional policy details that are not stated here.
- Where a rule refers to a configurable policy (for example, password complexity, seat-hold duration, voucher conditions, cancellation/refund eligibility, or review moderation), the exact values and detailed behavior must be defined by the relevant system configuration or separate specification.
- Enforce rules on the server side. Frontend validation may improve usability but must not be the only enforcement mechanism.
- Apply authorization checks to protected operations and verify ownership when Customers access personal records.
- For time-sensitive and inventory-sensitive operations, validate the latest persisted state at the point of the operation to prevent stale availability or conflicting updates.


## 14. Screen Authorization

### 14.1 Purpose

Screen Authorization defines which user roles are allowed to access each screen in the Cinema Management System. The matrix below is transcribed from the supplied `1.4.2 Screen Authorization.docx`.

- `X` means the role is allowed to access the screen.
- A blank cell means the source matrix does not grant that role access to the screen.
- Screen access must be checked against the authenticated user's role.
- This matrix defines screen-level access. It does not replace server-side authorization for individual APIs or actions.

### 14.2 Screen Authorization Matrix

| Screen | Guest | Customer | Staff | Manager | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Home Page | X | X | X | X | X |
| Register Account | X |  |  |  |  |
| Login | X | X | X | X | X |
| Reset Password | X | X | X | X | X |
| Movie List / Browse Movies | X | X | X | X | X |
| Movie Details & Trailer | X | X | X | X | X |
| Movie Reviews | X | X | X | X | X |
| Customer Dashboard |  | X |  |  |  |
| Book Ticket |  | X | X |  |  |
| Select Seats |  | X | X |  |  |
| Manage Cart / Add Combos |  | X | X |  |  |
| Process Payment |  | X | X |  |  |
| Booking Confirmation |  | X | X |  |  |
| Print Tickets & Invoices |  | X | X |  |  |
| Digital Ticket / QR Code |  | X | X |  |  |
| Booking History |  | X |  |  |  |
| Request Cancellation / Refund |  | X |  |  |  |
| Post Movie Review |  | X |  |  |  |
| My Profile |  | X | X | X | X |
| Staff Dashboard |  |  | X |  |  |
| Sell Tickets at Counter |  |  | X |  |  |
| Scan Ticket QR Code |  |  | X |  |  |
| Sell Concession Combos |  |  | X |  |  |
| Track Concession Stock Level |  |  | X | X |  |
| Manager Dashboard & Analytics |  |  |  | X |  |
| Analyze Movie Sales |  |  |  | X |  |
| Export Revenue Reports |  |  |  | X |  |
| Movie Management |  |  |  | X |  |
| Showtime Management |  |  |  | X |  |
| Configure Room Seat Maps |  |  |  | X |  |
| Manage Promotions |  |  |  | X |  |
| Monitor Staff Shifts |  |  |  | X |  |
| Staff Management |  |  |  | X |  |
| Admin Dashboard |  |  |  |  | X |
| Account Management |  |  |  |  | X |
| Role Management |  |  |  |  | X |
| Branch Management |  |  |  |  | X |

### 14.3 Role-Based Screen Access Summary

- **Guest:** Can access the home page, register, log in, reset a password, browse movies, view movie details/trailers, and view movie reviews.
- **Customer:** Can access public movie screens and customer features, including the customer dashboard, booking flow, cart, payment, booking confirmation, tickets/invoices, booking history, cancellation/refund requests, movie reviews, and their profile.
- **Staff:** Can access public movie screens, their profile, ticket-booking and payment-related screens listed in the matrix, the staff dashboard, counter ticket sales, QR check-in, concession sales, and concession stock levels.
- **Manager:** Can access public movie screens, their profile, concession stock levels, manager dashboard/analytics, movie sales analysis, revenue report export, movie and showtime management, room seat-map configuration, promotions, staff shifts, and staff management.
- **Admin:** Can access public movie screens, their profile, admin dashboard, account management, role management, and branch management.

### 14.4 Screen Authorization Rules for Implementation

1. **Check authentication before protected screens.** Screens assigned only to Customer, Staff, Manager, or Admin must not be accessible to Guests.
2. **Check the role, not merely whether a token exists.** A valid logged-in session does not automatically grant access to every protected screen.
3. **Restrict navigation and direct URLs.** Hide or disable navigation links that the current role cannot use, and guard protected routes so users cannot access them by typing a URL directly.
4. **Enforce authorization on the backend too.** Every protected API and sensitive operation must independently verify the authenticated identity and required role/permission. Frontend route guards alone are not security controls.
5. **Verify resource ownership.** For customer-specific screens and APIs (such as booking history, digital tickets, profile, and cancellation/refund requests), Customers must only access their own records, consistent with BR-36.
6. **Apply business rules in addition to screen access.** Being allowed to open a screen does not bypass the related business rules. For example, payment must be verified before issuing e-tickets (BR-16), and only eligible bookings can be reviewed (BR-38).
7. **Re-evaluate access after role or account changes.** Disabled accounts must not log in (BR-28), and role changes must update effective permissions (BR-29).
8. **Fail closed.** If the user is unauthenticated, the role is missing/unknown, or access cannot be verified, deny access to protected screens and APIs.
9. **Do not infer permissions absent from the matrix.** A blank cell means access is not granted by this source document. If the team wants to allow additional access, update the authorization matrix and requirements explicitly.

### 14.5 Important Scope Notes

- The supplied matrix marks **Staff** as allowed to access the booking, seat selection, cart, payment, booking confirmation, ticket/invoice, and digital ticket screens. Implement this as screen access only; the source does not specify whether Staff can perform every Customer action or access Customer-owned booking records.
- The supplied matrix grants **Manager** access to Staff Management, while BR-26 and BR-27 state that only Admins may create/update staff accounts and assign roles. Therefore, the Manager's Staff Management screen must not expose those Admin-only actions unless the requirements are formally changed.
- The supplied matrix allows **Staff and Manager** to access My Profile. It does not specify which profile fields each role can edit; apply BR-07 and any applicable account-management policy.
- The matrix does not explicitly assign screen access for every business function described in the Business Rules. Do not invent additional screens or role grants; clarify gaps with the project team when implementing them.

