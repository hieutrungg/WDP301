import mongoose from "mongoose";
import { BOOKING_STATUS } from "../../src/modules/booking/booking.constants.js";
import { createBookingService } from "../../src/modules/booking/booking.service.js";
import { createPaymentService } from "../../src/modules/payment/payment.service.js";
import { createTicketService } from "../../src/modules/ticket/ticket.service.js";
import { createInMemoryTicketRepository } from "./in-memory-ticket-repository.js";

// Shared in-memory Booking + Payment + Ticket harness (moved from payment.test.js so ticket tests
// exercise the real services). Only repositories and Room/Showtime readers are faked.
export const objectId = () => new mongoose.Types.ObjectId().toString();

export const createInMemoryHarness = ({
  initialNow = new Date("2026-10-22T07:00:00.000Z"),
  ticketRepository = createInMemoryTicketRepository(),
  gateway,
  clientUrl,
  auditLog,
} = {}) => {
  let currentNow = new Date(initialNow);
  const ownerId = objectId();
  const otherOwnerId = objectId();
  const holdId = objectId();
  const showtimeId = objectId();
  const roomId = objectId();
  // Stable branch id so check-in tests can sign in a Staff member of the same branch.
  const cinemaId = objectId();
  const seatIds = [objectId(), objectId()];
  const expiresAt = new Date(currentNow.getTime() + 10 * 60 * 1000);

  const holds = new Map();
  const bookings = new Map();
  const payments = new Map();
  let holdConsumedCount = 0;
  let holdExpiredCount = 0;

  holds.set(holdId, {
    _id: new mongoose.Types.ObjectId(holdId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    showtimeId: new mongoose.Types.ObjectId(showtimeId),
    seatIds: seatIds.map((id) => new mongoose.Types.ObjectId(id)),
    status: "ACTIVE",
    expiresAt,
    priceSnapshot: {
      quoteId: "QUOTE-PAY-001",
      currency: "VND",
      lines: [
        { seatId: seatIds[0], unitPrice: 95000 },
        { seatId: seatIds[1], unitPrice: 95000 },
      ],
      totalAmount: 190000,
    },
  });

  const bookingRepository = {
    async withTransaction(work) {
      return work({ id: "tx-booking" });
    },
    async findByCustomerRequestKey(customerAccountId, requestKey) {
      for (const booking of bookings.values()) {
        if (
          String(booking.customerAccountId) === String(customerAccountId) &&
          booking.requestKey === requestKey
        ) {
          return booking;
        }
      }
      return null;
    },
    async findByHoldId(targetHoldId) {
      for (const booking of bookings.values()) {
        if (String(booking.holdId) === String(targetHoldId)) {
          return booking;
        }
      }
      return null;
    },
    async findById(targetBookingId) {
      return bookings.get(String(targetBookingId)) ?? null;
    },
    async findByCustomerAccountId(customerAccountId) {
      return [...bookings.values()].filter(
        (b) => String(b.customerAccountId) === String(customerAccountId),
      );
    },
    async findByPayableReference(payableReference) {
      for (const booking of bookings.values()) {
        if (booking.payableReference === payableReference) {
          return booking;
        }
      }
      return null;
    },
    async createPending(doc) {
      const stored = {
        ...doc,
        _id: doc._id ?? new mongoose.Types.ObjectId(),
      };
      bookings.set(String(stored._id), stored);
      return stored;
    },
    async markConfirmed({ bookingId, paymentId, confirmedAt }) {
      const existing = bookings.get(String(bookingId));
      if (!existing) return null;
      const updated = {
        ...existing,
        status: BOOKING_STATUS.CONFIRMED,
        paymentId,
        confirmedAt,
      };
      bookings.set(String(bookingId), updated);
      return updated;
    },
    async markExpired({ bookingId, expiredAt }) {
      const existing = bookings.get(String(bookingId));
      if (!existing) return null;
      const updated = {
        ...existing,
        status: BOOKING_STATUS.EXPIRED,
        expiredAt,
      };
      bookings.set(String(bookingId), updated);
      return updated;
    },
  };

  const seatHoldPort = {
    async getLiveHoldForBooking({ holdId: requestedHoldId }) {
      return holds.get(String(requestedHoldId)) ?? null;
    },
    async consumeHoldForBooking({ holdId: requestedHoldId, verifiedAt }) {
      const hold = holds.get(String(requestedHoldId));
      if (!hold) return { outcome: "EXPIRED" };
      if (new Date(hold.expiresAt).getTime() <= new Date(verifiedAt).getTime()) {
        hold.status = "EXPIRED";
        holdExpiredCount += 1;
        return { outcome: "EXPIRED" };
      }
      hold.status = "CONSUMED";
      holdConsumedCount += 1;
      return { outcome: "CONSUMED", hold };
    },
    async expireHoldForBooking({ holdId: requestedHoldId }) {
      const hold = holds.get(String(requestedHoldId));
      if (hold && hold.status !== "CONSUMED") {
        hold.status = "EXPIRED";
        holdExpiredCount += 1;
      }
    },
  };

  const showtimeReader = {
    async getBookableShowtime() {
      return {
        showtimeId,
        roomId,
        roomLayoutVersion: 1,
        movieTitle: "Dune: Part Two",
        cinemaName: "F-Cinema Landmark 81",
        roomName: "IMAX Hall 04",
        format: "IMAX 3D",
        startAt: new Date("2026-10-24T12:30:00.000Z").toISOString(),
        endAt: new Date("2026-10-24T15:30:00.000Z").toISOString(),
        // Nested projection matching showtime.service getBookableShowtimeForBooking.
        movie: { id: objectId(), title: "Dune: Part Two", ageRating: "T13" },
        cinema: { id: cinemaId, branchName: "F-Cinema Landmark 81" },
        room: { id: roomId, roomName: "IMAX Hall 04", roomType: "IMAX" },
      };
    },
  };

  const roomLayoutReader = {
    async getLayoutVersion() {
      return {
        roomId,
        layoutVersion: 1,
        seats: [
          { _id: seatIds[0], row: "G", number: 12, type: "VIP" },
          { _id: seatIds[1], row: "G", number: 13, type: "VIP" },
        ],
      };
    },
  };

  const paymentRepository = {
    async findById(paymentId) {
      return payments.get(String(paymentId)) ?? null;
    },
    async findByBookingId(bookingId) {
      for (const payment of payments.values()) {
        if (String(payment.bookingId) === String(bookingId)) {
          return payment;
        }
      }
      return null;
    },
    async findByProviderOrderCode(orderCode) {
      for (const payment of payments.values()) {
        if ((payment.attempts || []).some((attempt) => attempt.providerOrderCode === orderCode)) {
          return payment;
        }
      }
      return null;
    },
    async findByAttemptIdempotencyKey(idempotencyKey) {
      for (const payment of payments.values()) {
        if (
          (payment.attempts || []).some(
            (attempt) => attempt.idempotencyKey === idempotencyKey,
          )
        ) {
          return payment;
        }
      }
      return null;
    },
    async create(payload) {
      const _id = new mongoose.Types.ObjectId();
      const doc = {
        ...payload,
        _id,
        createdAt: new Date(currentNow),
        updatedAt: new Date(currentNow),
      };
      payments.set(String(_id), doc);
      return doc;
    },
    async saveState(paymentId, updateFields) {
      const existing = payments.get(String(paymentId));
      if (!existing) return null;
      const updated = {
        ...existing,
        ...updateFields,
        updatedAt: new Date(currentNow),
      };
      payments.set(String(paymentId), updated);
      return updated;
    },
  };

  const bookingService = createBookingService({
    repository: bookingRepository,
    seatHoldPort,
    showtimeReader,
    roomLayoutReader,
    clock: () => new Date(currentNow),
  });

  const ticketService = createTicketService({
    ticketRepository,
    bookingReader: {
      getBookingDetails: (query) => bookingService.getCustomerBookingDetails(query),
    },
    now: () => new Date(currentNow),
    ...(auditLog ? { auditLog } : {}),
  });

  const paymentService = createPaymentService({
    paymentRepository,
    bookingService,
    ticketPort: ticketService,
    now: () => new Date(currentNow),
    ...(gateway ? { gateway } : {}),
    ...(clientUrl ? { clientUrl } : {}),
  });

  const advanceTimeMs = (ms) => {
    currentNow = new Date(currentNow.getTime() + ms);
  };

  return {
    ownerId,
    otherOwnerId,
    holdId,
    showtimeId,
    cinemaId,
    seatIds,
    holds,
    bookings,
    payments,
    bookingService,
    paymentService,
    ticketService,
    ticketRepository,
    advanceTimeMs,
    now: () => new Date(currentNow),
    getStats: () => ({
      holdConsumedCount,
      holdExpiredCount,
      paymentCount: payments.size,
    }),
  };
};
