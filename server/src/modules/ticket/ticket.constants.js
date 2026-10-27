// Ticket lifecycle owned by TICKET-001. ISSUED is the only admissible state; USED is set by
// check-in (Iter3) and INVALIDATED by refund/cancellation callers through the module port.
export const TICKET_STATUS = Object.freeze({
  ISSUED: "ISSUED",
  USED: "USED",
  INVALIDATED: "INVALIDATED",
});

export const TICKET_STATUSES = Object.freeze(Object.values(TICKET_STATUS));

// Payment-facing summary of whether a paid Booking already has its tickets.
export const TICKET_ISSUANCE_STATUS = Object.freeze({
  NOT_ISSUED: "NOT_ISSUED",
  ISSUED: "ISSUED",
  ISSUANCE_PENDING: "ISSUANCE_PENDING",
});

// Module-local until the shared API owner reviews the mounted Ticket route.
export const TICKET_ERROR = Object.freeze({
  INVALID_TICKET_ID: "INVALID_TICKET_ID",
  TICKET_NOT_FOUND: "TICKET_NOT_FOUND",
  TICKET_FORBIDDEN: "TICKET_FORBIDDEN",
  BOOKING_NOT_CONFIRMED: "TICKET_BOOKING_NOT_CONFIRMED",
  // TICKET-101 check-in (BR-17, BR-40).
  CHECK_IN_VALIDATION_FAILED: "TICKET_CHECK_IN_VALIDATION_FAILED",
  ALREADY_USED: "TICKET_ALREADY_USED",
  INVALIDATED: "TICKET_INVALIDATED",
  SHOWTIME_UNAVAILABLE: "TICKET_SHOWTIME_UNAVAILABLE",
  WRONG_BRANCH: "TICKET_WRONG_BRANCH",
  TOO_EARLY: "TICKET_CHECK_IN_TOO_EARLY",
  SHOWTIME_ENDED: "TICKET_SHOWTIME_ENDED",
  BRANCH_NOT_ASSIGNED: "BRANCH_NOT_ASSIGNED",
});

// Owner decision 2026-10-27: check-in opens 30 minutes before the showtime starts and closes at
// the showtime's stored end; Staff check in only tickets of their own branch, one ticket per code.
export const CHECK_IN_OPENS_BEFORE_MINUTES = 30;

// Readable code printed on the E-Ticket, e.g. TK-1A2B3C4D5E.
export const TICKET_CODE_PATTERN = /^TK-[A-F0-9]{10}$/;

export const QR_PAYLOAD_PREFIX = "FCINEMA-TICKET:v1";
