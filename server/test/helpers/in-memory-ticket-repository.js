import mongoose from "mongoose";
import { TICKET_STATUS } from "../../src/modules/ticket/ticket.constants.js";

// In-memory stand-in for ticket.repository.js that enforces the same unique keys as
// TICKET_INDEXES: ticketCode, qrCode and (bookingId, seatId).
export const createInMemoryTicketRepository = () => {
  const tickets = new Map();
  let insertCalls = 0;

  const duplicateOf = (doc) =>
    [...tickets.values()].some(
      (existing) =>
        existing.ticketCode === doc.ticketCode ||
        existing.qrCode === doc.qrCode ||
        (String(existing.bookingId) === String(doc.bookingId) &&
          String(existing.seatId) === String(doc.seatId)),
    );

  return {
    tickets,
    getInsertCalls: () => insertCalls,
    async findById(ticketId) {
      return tickets.get(String(ticketId)) ?? null;
    },
    async findByBookingId(bookingId) {
      return [...tickets.values()]
        .filter((ticket) => String(ticket.bookingId) === String(bookingId))
        .sort((left, right) => left.seat.label.localeCompare(right.seat.label));
    },
    async insertMissing(documents) {
      insertCalls += 1;
      for (const doc of documents) {
        if (duplicateOf(doc)) continue;
        const _id = new mongoose.Types.ObjectId();
        tickets.set(String(_id), {
          ...doc,
          _id,
          checkedInAt: null,
          invalidatedAt: null,
          invalidationReason: null,
        });
      }
    },
    async invalidateIssuedByBooking(bookingId, { at, reason }) {
      let modified = 0;
      for (const ticket of tickets.values()) {
        if (String(ticket.bookingId) === String(bookingId) && ticket.status === TICKET_STATUS.ISSUED) {
          Object.assign(ticket, {
            status: TICKET_STATUS.INVALIDATED,
            invalidatedAt: at,
            invalidationReason: reason,
          });
          modified += 1;
        }
      }
      return modified;
    },
  };
};
