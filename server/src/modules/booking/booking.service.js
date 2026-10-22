import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import {
  BOOKING_CONFIRMATION_OUTCOME,
  BOOKING_ERROR,
  BOOKING_STATUS,
} from "./booking.constants.js";
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

const serializeDetailedBooking = (booking, { seatDetails = [] } = {}) => ({
  bookingId: objectIdString(booking._id),
  bookingCode: booking.bookingCode,
  payableReference: booking.payableReference,
  customerAccountId: objectIdString(booking.customerAccountId),
  holdId: objectIdString(booking.holdId),
  showtimeId: objectIdString(booking.showtimeId),
  seatIds: (booking.seatIds ?? []).map(objectIdString),
  seatLines: (booking.seatLines ?? []).map((line) => ({
    seatId: objectIdString(line.seatId),
    unitPrice: line.unitPrice,
  })),
  seats: seatDetails,
  currency: booking.currency,
  subtotal: booking.subtotal,
  discountAmount: booking.discountAmount ?? 0,
  amount: booking.totalAmount,
  totalAmount: booking.totalAmount,
  status: booking.status,
  bookingTime: booking.bookingTime ? new Date(booking.bookingTime).toISOString() : null,
  expiresAt: new Date(booking.expiresAt).toISOString(),
  confirmedAt: booking.confirmedAt ? new Date(booking.confirmedAt).toISOString() : null,
  expiredAt: booking.expiredAt ? new Date(booking.expiredAt).toISOString() : null,
});

export const createBookingService = ({
  repository = bookingRepository,
  seatHoldPort,
  showtimeReader,
  roomLayoutReader,
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

  const getBookingForPayment = async ({ bookingId, payableReference, ownerId, session } = {}) => {
    const booking = bookingId
      ? await repository.findById?.(bookingId, session)
      : await repository.findByPayableReference?.(payableReference, session);

    if (!booking) {
      throw error(404, "Booking not found", BOOKING_ERROR.BOOKING_NOT_FOUND);
    }

    if (ownerId && objectIdString(booking.customerAccountId) !== objectIdString(ownerId)) {
      throw error(403, "You do not have access to this booking", BOOKING_ERROR.BOOKING_FORBIDDEN);
    }

    return booking;
  };

  const confirmBookingAfterVerifiedPayment = async ({
    bookingId,
    payableReference,
    paymentId,
    verifiedAt = clock(),
    session: externalSession,
  }) => {
    const run = async (session) => {
      const booking = bookingId
        ? await repository.findById(bookingId, session)
        : await repository.findByPayableReference(payableReference, session);

      if (!booking) {
        throw error(404, "Booking not found", BOOKING_ERROR.BOOKING_NOT_FOUND);
      }

      if (booking.status === BOOKING_STATUS.CONFIRMED) {
        return {
          outcome: BOOKING_CONFIRMATION_OUTCOME.ALREADY_CONFIRMED,
          booking: serializeDetailedBooking(booking),
        };
      }

      const isExpiredByTime =
        new Date(booking.expiresAt).getTime() <= new Date(verifiedAt).getTime();

      if (booking.status === BOOKING_STATUS.EXPIRED || isExpiredByTime) {
        if (seatHoldPort.expireHoldForBooking && booking.holdId) {
          await seatHoldPort.expireHoldForBooking({
            holdId: booking.holdId,
            now: verifiedAt,
            session,
          });
        }
        const expiredBooking =
          booking.status === BOOKING_STATUS.PENDING_PAYMENT && repository.markExpired
            ? (await repository.markExpired(
                { bookingId: booking._id, expiredAt: verifiedAt },
                session,
              )) ?? { ...booking, status: BOOKING_STATUS.EXPIRED, expiredAt: verifiedAt }
            : booking;

        return {
          outcome: BOOKING_CONFIRMATION_OUTCOME.EXPIRED_REVIEW_REQUIRED,
          booking: serializeDetailedBooking(expiredBooking),
        };
      }

      if (seatHoldPort.consumeHoldForBooking && booking.holdId) {
        const holdResult = await seatHoldPort.consumeHoldForBooking({
          holdId: booking.holdId,
          bookingId: booking._id,
          ownerId: booking.customerAccountId,
          seatIds: booking.seatIds,
          verifiedAt,
          session,
        });

        if (holdResult?.outcome === "EXPIRED") {
          const expiredBooking = repository.markExpired
            ? (await repository.markExpired(
                { bookingId: booking._id, expiredAt: verifiedAt },
                session,
              )) ?? { ...booking, status: BOOKING_STATUS.EXPIRED, expiredAt: verifiedAt }
            : { ...booking, status: BOOKING_STATUS.EXPIRED, expiredAt: verifiedAt };

          return {
            outcome: BOOKING_CONFIRMATION_OUTCOME.EXPIRED_REVIEW_REQUIRED,
            booking: serializeDetailedBooking(expiredBooking),
          };
        }
      }

      const confirmedBooking = repository.markConfirmed
        ? (await repository.markConfirmed(
            { bookingId: booking._id, paymentId, confirmedAt: verifiedAt },
            session,
          )) ?? {
            ...booking,
            status: BOOKING_STATUS.CONFIRMED,
            confirmedAt: verifiedAt,
            paymentId,
          }
        : {
            ...booking,
            status: BOOKING_STATUS.CONFIRMED,
            confirmedAt: verifiedAt,
            paymentId,
          };

      return {
        outcome: BOOKING_CONFIRMATION_OUTCOME.CONFIRMED,
        booking: serializeDetailedBooking(confirmedBooking),
      };
    };

    if (externalSession !== undefined) {
      return run(externalSession);
    }

    const runInTransaction = repository.withTransaction?.bind(repository) ?? ((work) => work());
    return runInTransaction(run);
  };

  const getCustomerBookingDetails = async ({ bookingId, ownerId }) => {
    const now = clock();
    let booking = await getBookingForPayment({ bookingId, ownerId });

    if (
      booking.status === BOOKING_STATUS.PENDING_PAYMENT &&
      new Date(booking.expiresAt).getTime() <= now.getTime()
    ) {
      if (seatHoldPort.expireHoldForBooking && booking.holdId) {
        await seatHoldPort.expireHoldForBooking({ holdId: booking.holdId, now });
      }
      booking =
        (await repository.markExpired?.({ bookingId: booking._id, expiredAt: now })) ?? {
          ...booking,
          status: BOOKING_STATUS.EXPIRED,
          expiredAt: now,
        };
    }

    let showtime = null;
    let seatDetails = [];

    if (showtimeReader?.getBookableShowtime) {
      try {
        showtime = await showtimeReader.getBookableShowtime(
          booking.showtimeId,
          new Date(0),
        );
      } catch {
        showtime = null;
      }
    }

    if (showtime && roomLayoutReader?.getLayoutVersion) {
      try {
        const layout = await roomLayoutReader.getLayoutVersion(
          showtime.roomId,
          showtime.roomLayoutVersion,
        );
        const seatsById = new Map(
          (layout?.seats ?? []).map((seat) => [
            objectIdString(seat.seatId ?? seat._id),
            seat,
          ]),
        );
        const priceBySeat = new Map(
          (booking.seatLines ?? []).map((line) => [
            objectIdString(line.seatId),
            line.unitPrice,
          ]),
        );

        seatDetails = (booking.seatIds ?? []).map((seatId) => {
          const id = objectIdString(seatId);
          const physicalSeat = seatsById.get(id);
          return {
            seatId: id,
            row: physicalSeat?.row ?? "",
            number: physicalSeat?.number ?? "",
            label: physicalSeat
              ? `${physicalSeat.row}${physicalSeat.number}`
              : id.slice(-4).toUpperCase(),
            type: physicalSeat?.type ?? "STANDARD",
            unitPrice: priceBySeat.get(id) ?? 0,
          };
        });
      } catch {
        seatDetails = [];
      }
    }

    if (seatDetails.length === 0) {
      seatDetails = (booking.seatLines ?? []).map((line, index) => ({
        seatId: objectIdString(line.seatId),
        row: "",
        number: index + 1,
        label: `Seat ${index + 1}`,
        type: "STANDARD",
        unitPrice: line.unitPrice,
      }));
    }

    return {
      booking: serializeDetailedBooking(booking, { seatDetails }),
      showtime,
    };
  };

  return {
    confirmBookingAfterVerifiedPayment,
    createPendingBookingFromHold,
    getBookingForPayment,
    getCustomerBookingDetails,
  };
};

export { serializeBooking, serializeDetailedBooking, validatePriceSnapshot };
