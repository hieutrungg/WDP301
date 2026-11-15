# Ticket QR and automatic admission

Project owner requested QR codes containing the readable ticket code and automatic check-in after scanning (2026-11-15).

Ticket owner: Cường. Consumers: E-Ticket UI, ticket email, Staff admission UI and Refund's existing check-in state reader. Cross-owner review is required before merge.

- Newly persisted QR payloads and the ticket DTO `qrCode` contain `ticketCode`. Reading an existing ISSUED ticket returns its code, so existing on-screen tickets use the new payload without a DB migration. Previously emailed images remain unchanged.
- The E-Ticket QR encodes the code directly, rather than a `/ticket-info` URL. Old structured QR payloads and URLs containing the code remain readable by the existing normalization helper.
- A focused check-in field accepts a keyboard-style reader. A complete valid code automatically calls the existing authenticated `POST /api/tickets/check-in` API. Manual submission remains available.
- Camera scanning uses the browser BarcodeDetector API and getUserMedia, with no new package. It needs camera permission, a secure context, and browser QR detection support; unsupported browsers display a reader/manual fallback message. Capture stops after one valid code or on leaving the page.
- Backend role/permission, branch, time window, booking status and atomic ISSUED-to-USED checks remain authoritative. A scanned code is not admission until the server succeeds.

No API route/body, lifecycle enum, database relationship or index changes. Payload content changes with owner authorization above. No production database updates were performed.

Verification: 19 backend Ticket/email tests and 9 client check-in/presentation tests passed. Real camera/reader hardware and live MongoDB concurrency were not exercised.
