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

Open Design Question: define whether cash sales create a Payment record and how cash drawer/shift reconciliation is captured.

