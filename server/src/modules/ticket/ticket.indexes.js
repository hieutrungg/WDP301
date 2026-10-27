// `ticketCode_1` already exists in the DB bootstrap (create_indexes.js); the migration accepts an
// equivalent index under either name. Booking + seat uniqueness is what makes issuance idempotent.
export const TICKET_INDEXES = Object.freeze([
  {
    fields: { ticketCode: 1 },
    options: { unique: true, name: "uniq_ticket_code" },
  },
  {
    fields: { qrCode: 1 },
    options: { unique: true, name: "uniq_ticket_qr_code" },
  },
  {
    fields: { bookingId: 1, seatId: 1 },
    options: { unique: true, name: "uniq_ticket_booking_seat" },
  },
]);
