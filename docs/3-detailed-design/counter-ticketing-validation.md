# Counter Ticketing and Validation Class Design

## Scope and Business Flow

Supports staff counter sales, optional concessions, payment/cash confirmation, physical printing, and QR ticket check-in.

## Current Design Review

- Split counter sale and ticket validation; they have different actors, policies, and consistency boundaries.
- Remove the duplicated repository-heavy counter service. Reuse the Booking aggregate, seat hold mechanism, pricing, payment confirmation, and ticket issuer from online booking.
- Validation must load a ticket by a tamper-resistant QR token, verify showtime/time/status, and update it atomically so concurrent scans cannot both succeed.
- Printing is an outbound adapter and must not control sale completion.

## Proposed Responsibilities and Relationships

`CreateCounterSale` coordinates staff authorization, seat hold, price, payment method, booking confirmation, and ticket issuance. `ValidateTicket` performs an atomic `ISSUED -> CHECKED_IN` transition and records scanner/time. `TicketPrinterPort` is best-effort after the sale is committed; reprint is separately authorized.

Approved owner decision (2026-10-26): a counter cash sale creates the same Payment aggregate as other methods. Staff enters the tendered amount only to prove it is at least the authoritative payable total; change and cash-drawer/shift reconciliation are handled outside this system. Counter QR reuses the Customer mock QR Payment flow. Counter ticket sales may include optional concessions and must reuse Booking, SeatHold, Inventory reservation and Payment lifecycle services.

Standalone concession sales are approved for the Counter POS, including walk-in customers who already hold a ticket. They require an Order-first payable lifecycle without a Booking/SeatHold; this must not be represented by a synthetic ticket Booking.

