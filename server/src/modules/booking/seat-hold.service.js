import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import {
  DEFAULT_SEAT_HOLD_DURATION_MS,
  SEAT_HOLD_ERROR,
} from "./seat-hold.constants.js";
import { SeatClaimConflictError, seatHoldRepository } from "./seat-hold.repository.js";

const error = (status, message, code, errors = []) => new AppError(status, message, errors, code);

const normalizeSeatIds = (seatIds) => [...new Set(seatIds.map(String))].sort();

const commandHash = ({ showtimeId, seatIds }) =>
  createHash("sha256")
    .update(JSON.stringify({ showtimeId: String(showtimeId), seatIds: normalizeSeatIds(seatIds) }))
    .digest("hex");

const serializeHold = (hold, serverNow, idempotent = false) => ({
  holdId: hold._id.toString(),
  ownerId: hold.ownerId.toString(),
  checkoutKey: hold.checkoutKey,
  showtimeId: hold.showtimeId.toString(),
  seatIds: hold.seatIds.map(String),
  status: hold.status,
  heldAt: new Date(hold.heldAt).toISOString(),
  expiresAt: new Date(hold.expiresAt).toISOString(),
  serverNow: serverNow.toISOString(),
  priceQuote: hold.priceSnapshot,
  idempotent,
});

const validatePriceQuote = (quote, seatIds) => {
  if (quote?.currency !== "VND" || !Number.isSafeInteger(quote.totalAmount)) return false;
  if (!Array.isArray(quote.lines) || quote.lines.length !== seatIds.length) return false;
  const prices = new Map(quote.lines.map((line) => [String(line.seatId), line.unitPrice]));
  return seatIds.every((seatId) => Number.isSafeInteger(prices.get(seatId)) && prices.get(seatId) >= 0);
};

export const createSeatHoldService = ({
  repository = seatHoldRepository,
  showtimeReader,
  roomLayoutReader,
  priceQuoter,
  clock = () => new Date(),
  holdDurationMs = DEFAULT_SEAT_HOLD_DURATION_MS,
} = {}) => {
  const acquireSeatHold = async ({ ownerId, checkoutKey, showtimeId, seatIds }) => {
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      throw error(400, "Select at least one seat", SEAT_HOLD_ERROR.INVALID_SEAT_IDS);
    }
    const normalizedSeatIds = normalizeSeatIds(seatIds);
    if (normalizedSeatIds.length !== seatIds.length) {
      throw error(400, "Seat ids must be unique", SEAT_HOLD_ERROR.INVALID_SEAT_IDS);
    }
    const hash = commandHash({ showtimeId, seatIds: normalizedSeatIds });
    const now = clock();
    const existing = await repository.findByOwnerAndCheckoutKey(ownerId, checkoutKey);

    if (existing) {
      if (existing.commandHash !== hash) {
        throw error(
          409,
          "This checkout key was already used for a different seat selection",
          SEAT_HOLD_ERROR.IDEMPOTENCY_KEY_REUSED,
        );
      }
      return serializeHold(existing, now, true);
    }

    const showtime = await showtimeReader.getBookableShowtime(showtimeId, now);
    if (!showtime) {
      throw error(409, "Showtime is not available for booking", SEAT_HOLD_ERROR.SHOWTIME_NOT_BOOKABLE);
    }

    const layout = await roomLayoutReader.getLayoutVersion(
      showtime.roomId,
      showtime.roomLayoutVersion,
    );
    const enabledSeatIds = new Set(
      layout?.seats
        ?.filter(({ status }) => status === "ENABLED")
        .map(({ seatId, _id }) => String(seatId ?? _id)) ?? [],
    );
    const invalidSeatIds = normalizedSeatIds.filter((seatId) => !enabledSeatIds.has(seatId));
    if (invalidSeatIds.length > 0) {
      throw error(
        409,
        "One or more seats are not selectable in this room layout",
        SEAT_HOLD_ERROR.SEAT_NOT_IN_LAYOUT,
        invalidSeatIds.map((seatId) => ({ field: "seatIds", message: `Seat ${seatId} is not selectable` })),
      );
    }

    const priceQuote = await priceQuoter.quote(showtimeId, normalizedSeatIds, ownerId, now);
    if (!validatePriceQuote(priceQuote, normalizedSeatIds)) {
      throw error(409, "A valid seat price quote could not be created", SEAT_HOLD_ERROR.PRICE_QUOTE_FAILED);
    }

    const holdInput = {
      ownerId: new mongoose.Types.ObjectId(ownerId),
      checkoutKey,
      commandHash: hash,
      showtimeId: new mongoose.Types.ObjectId(showtimeId),
      roomLayoutVersion: showtime.roomLayoutVersion,
      seatIds: normalizedSeatIds.map((seatId) => new mongoose.Types.ObjectId(seatId)),
      heldAt: now,
      expiresAt: new Date(now.getTime() + holdDurationMs),
      priceSnapshot: priceQuote,
    };

    try {
      const { hold, created } = await repository.acquire(holdInput);
      if (!created && hold.commandHash !== hash) {
        throw error(
          409,
          "This checkout key was already used for a different seat selection",
          SEAT_HOLD_ERROR.IDEMPOTENCY_KEY_REUSED,
        );
      }
      return serializeHold(hold, now, !created);
    } catch (cause) {
      if (cause instanceof SeatClaimConflictError) {
        throw error(409, "One or more seats are no longer available", SEAT_HOLD_ERROR.SEAT_UNAVAILABLE);
      }
      throw cause;
    }
  };

  const releaseSeatHold = async ({ holdId, ownerId }) => {
    const now = clock();
    const result = await repository.release({ holdId, ownerId, now });
    if (result.outcome === "NOT_FOUND") {
      throw error(404, "Seat hold not found", SEAT_HOLD_ERROR.HOLD_NOT_FOUND);
    }
    if (result.outcome === "FORBIDDEN") {
      throw error(403, "You cannot release this seat hold", SEAT_HOLD_ERROR.HOLD_FORBIDDEN);
    }
    return {
      holdId: result.hold._id.toString(),
      status: result.hold.status,
      expiresAt: new Date(result.hold.expiresAt).toISOString(),
      releasedAt: result.hold.releasedAt?.toISOString?.() ?? null,
      alreadyFinal: result.outcome === "FINAL",
      serverNow: now.toISOString(),
    };
  };

  const getLiveHoldForBooking = ({ holdId, ownerId, now = clock(), session } = {}) =>
    repository.findLiveForBooking({ holdId, ownerId, now, session });

  return { acquireSeatHold, getLiveHoldForBooking, releaseSeatHold };
};

export { commandHash, normalizeSeatIds, serializeHold, validatePriceQuote };

