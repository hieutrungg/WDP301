import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import {
  BOOKING_CONFIRMATION_OUTCOME,
  BOOKING_ERROR,
  BOOKING_STATUS,
} from "./booking.constants.js";
import { bookingRepository } from "./booking.repository.js";
import { bookingPricingDto, assertVoucherBookingSnapshot } from "./booking-voucher.service.js";

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
  ...bookingPricingDto(booking),
  bookingId: objectIdString(booking._id),
  status: booking.status,
  payableReference: booking.payableReference,
  expiresAt: new Date(booking.expiresAt).toISOString(),
  amount: booking.totalAmount,
  currency: booking.currency,
  idempotent,
});

const serializeDetailedBooking = (booking, { seatDetails = [] } = {}) => ({
  ...bookingPricingDto(booking),
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
  ...(booking.concessionFingerprint ? { ticketAmount: booking.subtotal, concessionAmount: booking.concessionAmount } : {}),
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
  concessionPort,
  promotionPort,
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

  const describeBooking = async (booking, idempotent, session) => {
    const data = serializeBooking(booking, idempotent);
    if (booking.concessionFingerprint) {
      if (!concessionPort) throw new TypeError("Concession lifecycle port is required");
      data.ticketAmount = booking.subtotal;
      data.concessionAmount = booking.concessionAmount;
      data.concessionOrder = await concessionPort.read(booking._id, session);
    }
    return data;
  };

  const createPendingBookingFromHold = async ({
    holdId,
    ownerId,
    priceQuoteReference,
    requestKey,
    concessionSelection,
  }) => {
    if (concessionSelection && !concessionPort) throw new TypeError("Concession checkout port is required");
    const fingerprint = concessionSelection ? concessionPort.fingerprint(concessionSelection) : undefined;
    if (concessionSelection) {
      await concessionPort.assertReady();
      if (concessionPort.prepare && !await repository.findByCustomerRequestKey(ownerId, requestKey)) {
        await concessionPort.prepare({ ownerId, holdId });
      }
    }
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
          if (existing.concessionFingerprint !== fingerprint) throw error(409, "This checkout key already has a different food selection", "CONCESSION_REQUEST_KEY_REUSED");
          return describeBooking(existing, true, session);
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

        if (concessionSelection) {
          const food = await concessionPort.createPending({ bookingId: input._id, ownerId, hold, selection: concessionSelection, session });
          input.concessionAmount = food.amount;
          input.concessionFingerprint = fingerprint;
          input.totalAmount = input.subtotal + food.amount;
          if (!Number.isSafeInteger(input.totalAmount)) throw error(409, "Invalid checkout total", BOOKING_ERROR.INVALID_PRICE_SNAPSHOT);
        }
        const booking = await repository.createPending(input, session);
        return describeBooking(booking, false, session);
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
        if (concurrent.concessionFingerprint !== fingerprint) throw error(409, "This checkout key already has a different food selection", "CONCESSION_REQUEST_KEY_REUSED");
        return describeBooking(concurrent, true);
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

  // Payment calls this internal port only after verifying its result. No HTTP route confirms a Booking.
  const transitionConflict = () =>
    error(
      409,
      "Booking or seat hold changed; reload the current payment state",
      BOOKING_ERROR.HOLD_NOT_AVAILABLE,
    );

  const requireTransitionPorts = () => {
    for (const name of ["withTransaction", "findById", "markConfirmed", "markExpired"]) {
      if (typeof repository[name] !== "function") {
        throw new TypeError(`Booking repository.${name} is required for lifecycle transitions`);
      }
    }
    for (const name of ["consumeHoldForBooking", "expireHoldForBooking"]) {
      if (typeof seatHoldPort[name] !== "function") {
        throw new TypeError(`seatHoldPort.${name} is required for lifecycle transitions`);
      }
    }
  };

  const expireInTransaction = async (booking, now, session) => {
    if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) throw transitionConflict();
    const hold = await seatHoldPort.expireHoldForBooking({ holdId: booking.holdId, now, session });
    if (hold?.status === "CONSUMED") throw transitionConflict();
    if (booking.voucherSnapshot) {
      if (!promotionPort) throw new TypeError("Promotion lifecycle port is required");
      await promotionPort.releaseForClosedBooking({ reservationId: booking.voucherSnapshot.reservationId, now, session });
    }
    if (booking.concessionFingerprint) {
      if (!concessionPort) throw new TypeError("Concession lifecycle port is required");
      await concessionPort.release({ bookingId: booking._id, now, session });
    }
    const expired = await repository.markExpired(
      { bookingId: booking._id, expiredAt: now },
      session,
    );
    if (!expired || expired.status !== BOOKING_STATUS.EXPIRED) throw transitionConflict();
    return expired;
  };

  // A rejected multi-seat consumption may already have touched some claims. Abort that entire
  // transaction before expiring/releasing the hold in a fresh transaction through its owner port.
  class HoldConsumptionRejected extends Error {
    constructor() {
      super("Seat consumption was rejected; abort the transaction before releasing the hold");
      this.name = "HoldConsumptionRejected";
    }
  }

  const confirmBookingAfterVerifiedPayment = async ({
    bookingId,
    payableReference,
    paymentId,
    verifiedAt = clock(),
    session: externalSession,
  }) => {
    requireTransitionPorts();
    if (!mongoose.isValidObjectId(paymentId) || !Number.isFinite(new Date(verifiedAt).getTime())) {
      throw new TypeError("A verified payment ID and valid verification time are required");
    }
    const result = (outcome, booking) => ({ outcome, booking: serializeDetailedBooking(booking) });
    const load = (session) => getBookingForPayment({ bookingId, payableReference, session });
    const alreadyConfirmed = (booking) => {
      if (objectIdString(booking.paymentId) !== objectIdString(paymentId)) throw transitionConflict();
      return result(BOOKING_CONFIRMATION_OUTCOME.ALREADY_CONFIRMED, booking);
    };
    const expiredResult = (booking) =>
      result(BOOKING_CONFIRMATION_OUTCOME.EXPIRED_REVIEW_REQUIRED, booking);
    const run = async (session) => {
      const booking = await load(session);
      if (booking.status === BOOKING_STATUS.CONFIRMED) return alreadyConfirmed(booking);
      if (booking.status === BOOKING_STATUS.EXPIRED) return expiredResult(booking);
      assertVoucherBookingSnapshot(booking);
      if (
        booking.status !== BOOKING_STATUS.PENDING_PAYMENT ||
        !Number.isFinite(new Date(booking.expiresAt).getTime())
      ) throw transitionConflict();
      if (new Date(booking.expiresAt).getTime() <= new Date(verifiedAt).getTime()) {
        return expiredResult(await expireInTransaction(booking, verifiedAt, session));
      }
      const holdResult = await seatHoldPort.consumeHoldForBooking({
        holdId: booking.holdId,
        bookingId: booking._id,
        ownerId: booking.customerAccountId,
        seatIds: booking.seatIds,
        verifiedAt,
        session,
      });
      if (holdResult?.outcome === "EXPIRED") throw new HoldConsumptionRejected();
      if (holdResult?.outcome !== "CONSUMED") throw transitionConflict();
      if (booking.concessionFingerprint) {
        if (!concessionPort) throw new TypeError("Concession lifecycle port is required");
        if (!await concessionPort.consume({ bookingId: booking._id, now: verifiedAt, session })) throw new HoldConsumptionRejected();
      }
      if (booking.voucherSnapshot) {
        if (!promotionPort) throw new TypeError("Promotion lifecycle port is required");
        if (!await promotionPort.consumeForConfirmedBooking({ bookingId: booking._id, reservationId: booking.voucherSnapshot.reservationId, paymentId, verifiedAt, session })) throw new HoldConsumptionRejected();
      }
      const confirmed = await repository.markConfirmed(
        { bookingId: booking._id, paymentId, confirmedAt: verifiedAt },
        session,
      );
      if (!confirmed || confirmed.status !== BOOKING_STATUS.CONFIRMED) throw transitionConflict();
      return result(BOOKING_CONFIRMATION_OUTCOME.CONFIRMED, confirmed);
    };
    if (externalSession != null) {
      // The caller owns commit/rollback. A failed consumption must escape so it cannot commit
      // partial claims; it can retry this port without an external session after rollback.
      return run(externalSession);
    }
    try {
      return await repository.withTransaction(run);
    } catch (cause) {
      if (!(cause instanceof HoldConsumptionRejected)) throw cause;
      return repository.withTransaction(async (session) => {
        const booking = await load(session);
        if (booking.status === BOOKING_STATUS.CONFIRMED) return alreadyConfirmed(booking);
        if (booking.status === BOOKING_STATUS.EXPIRED) return expiredResult(booking);
        return expiredResult(await expireInTransaction(booking, verifiedAt, session));
      });
    }
  };

  const getCustomerBookingDetails = async ({ bookingId, ownerId }) => {
    const now = clock();
    let booking = await getBookingForPayment({ bookingId, ownerId });
    if (
      booking.status === BOOKING_STATUS.PENDING_PAYMENT &&
      new Date(booking.expiresAt).getTime() <= now.getTime()
    ) {
      requireTransitionPorts();
      booking = await repository.withTransaction(async (session) => {
        const current = await getBookingForPayment({ bookingId, ownerId, session });
        if (
          current.status !== BOOKING_STATUS.PENDING_PAYMENT ||
          new Date(current.expiresAt).getTime() > now.getTime()
        ) return current;
        return expireInTransaction(current, now, session);
      });
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

    const details = serializeDetailedBooking(booking, { seatDetails });
    if (booking.concessionFingerprint) {
      if (!concessionPort) throw new TypeError("Concession lifecycle port is required");
      details.concessionOrder = await concessionPort.read(booking._id);
    }
    return { booking: details, showtime };
  };

  const cancelPendingCheckout = async ({ bookingId, ownerId }) => {
    requireTransitionPorts();
    return repository.withTransaction(async session => {
      const booking = await getBookingForPayment({ bookingId, ownerId, session });
      if (booking.status === BOOKING_STATUS.CONFIRMED) throw transitionConflict();
      if (booking.status === BOOKING_STATUS.EXPIRED) return serializeDetailedBooking(booking);
      return serializeDetailedBooking(await expireInTransaction(booking, clock(), session));
    });
  };

  const listCustomerBookings = async ({ ownerId, limit = 50 }) => {
    if (!repository.findByCustomerAccountId) {
      return [];
    }

    const rawBookings = await repository.findByCustomerAccountId(ownerId, {
      limit,
    });
    const results = [];
    for (const raw of rawBookings) {
      const detail = await getCustomerBookingDetails({
        bookingId: raw._id,
        ownerId,
      });
      results.push(detail);
    }
    return results;
  };

  return {
    confirmBookingAfterVerifiedPayment,
    createPendingBookingFromHold,
    getBookingForPayment,
    getCustomerBookingDetails,
    listCustomerBookings,
    cancelPendingCheckout,
  };
};

export { serializeBooking, serializeDetailedBooking, validatePriceSnapshot };
