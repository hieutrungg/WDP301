import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { BOOKING_ERROR, BOOKING_STATUS } from "./booking.constants.js";
import { bookingRepository } from "./booking.repository.js";

const error = (status, message, code) => new AppError(status, message, [], code);
const objectIdString = (value) => value?.toString?.() ?? String(value);
const sortedIds = (values) => values.map(objectIdString).sort();
const sameIds = (left, right) =>
  left.length === right.length && sortedIds(left).every((value, index) => value === sortedIds(right)[index]);

const generateReference = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;

const validatePriceSnapshot = (hold) => {
  const quote = hold.priceSnapshot;
  if (quote?.currency !== "VND" || !Number.isSafeInteger(quote.totalAmount)) return null;
  if (!Array.isArray(quote.lines) || !sameIds(hold.seatIds ?? [], quote.lines.map(({ seatId }) => seatId))) {
    return null;
  }

  const prices = new Map();
  for (const line of quote.lines) {
    const seatId = objectIdString(line.seatId);
    if (prices.has(seatId) || !Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) return null;
    prices.set(seatId, line.unitPrice);
  }

  const seatLines = hold.seatIds.map((seatId) => ({
    seatId: new mongoose.Types.ObjectId(seatId),
    unitPrice: prices.get(objectIdString(seatId)),
  }));
  const subtotal = seatLines.reduce((sum, line) => sum + line.unitPrice, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal !== quote.totalAmount) return null;

  return { currency: quote.currency, seatLines, subtotal, quoteId: quote.quoteId };
};

const serializeBooking = (booking, idempotent = false) => ({
  bookingId: objectIdString(booking._id),
  status: booking.status,
  payableReference: booking.payableReference,
  expiresAt: new Date(booking.expiresAt).toISOString(),
  amount: booking.totalAmount,
  currency: booking.currency,
  idempotent,
});

export const createBookingService = ({
  repository = bookingRepository,
  seatHoldPort,
  clock = () => new Date(),
  idFactory = () => new mongoose.Types.ObjectId(),
  bookingCodeFactory = () => generateReference("FC"),
  payableReferenceFactory = () => generateReference("PAY"),
} = {}) => {
  if (!seatHoldPort?.getLiveHoldForBooking) {
    throw new TypeError("seatHoldPort.getLiveHoldForBooking is required");
  }

  const createPendingBookingFromHold = async ({
    holdId,
    ownerId,
    priceQuoteReference,
    requestKey,
  }) => {
    const now = clock();
    const runInTransaction = repository.withTransaction?.bind(repository) ?? ((work) => work());

    try {
      return await runInTransaction(async (session) => {
        const existing = await repository.findByCustomerRequestKey(ownerId, requestKey, session);
        if (existing) {
          if (objectIdString(existing.holdId) !== objectIdString(holdId)) {
            throw error(
              409,
              "This booking request key was already used for another seat hold",
              BOOKING_ERROR.REQUEST_KEY_REUSED,
            );
          }
          return serializeBooking(existing, true);
        }

        const hold = await seatHoldPort.getLiveHoldForBooking({ holdId, ownerId, now, session });
        if (!hold || objectIdString(hold.ownerId) !== objectIdString(ownerId) || hold.status !== "ACTIVE") {
          throw error(409, "Seat hold is not available for booking", BOOKING_ERROR.HOLD_NOT_AVAILABLE);
        }
        if (new Date(hold.expiresAt).getTime() <= now.getTime()) {
          throw error(409, "Seat hold has expired", BOOKING_ERROR.HOLD_EXPIRED);
        }

        const price = validatePriceSnapshot(hold);
        if (!price || (priceQuoteReference && priceQuoteReference !== price.quoteId)) {
          throw error(
            409,
            "Seat hold does not contain a valid server-side price snapshot",
            BOOKING_ERROR.INVALID_PRICE_SNAPSHOT,
          );
        }

        const input = {
          _id: idFactory(),
          bookingCode: bookingCodeFactory(),
          payableReference: payableReferenceFactory(),
          requestKey,
          customerAccountId: new mongoose.Types.ObjectId(ownerId),
          holdId: new mongoose.Types.ObjectId(holdId),
          showtimeId: new mongoose.Types.ObjectId(hold.showtimeId),
          seatIds: hold.seatIds.map((seatId) => new mongoose.Types.ObjectId(seatId)),
          seatLines: price.seatLines,
          ...(price.quoteId ? { priceQuoteReference: price.quoteId } : {}),
          currency: price.currency,
          subtotal: price.subtotal,
          discountAmount: 0,
          totalAmount: price.subtotal,
          status: BOOKING_STATUS.PENDING_PAYMENT,
          bookingTime: now,
          expiresAt: new Date(hold.expiresAt),
        };

        const booking = await repository.createPending(input, session);
        return serializeBooking(booking);
      });
    } catch (cause) {
      if (cause?.code !== 11000) throw cause;
      const concurrent =
        (await repository.findByCustomerRequestKey(ownerId, requestKey)) ??
        (await repository.findByHoldId(holdId));
      if (concurrent && objectIdString(concurrent.holdId) !== objectIdString(holdId)) {
        throw error(
          409,
          "This booking request key was already used for another seat hold",
          BOOKING_ERROR.REQUEST_KEY_REUSED,
        );
      }
      if (concurrent && objectIdString(concurrent.holdId) === objectIdString(holdId)) {
        return serializeBooking(concurrent, true);
      }
      throw cause;
    }
  };

  return { createPendingBookingFromHold };
};

export { serializeBooking, validatePriceSnapshot };
