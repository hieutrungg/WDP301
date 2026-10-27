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
});

export const QR_PAYLOAD_PREFIX = "FCINEMA-TICKET:v1";
