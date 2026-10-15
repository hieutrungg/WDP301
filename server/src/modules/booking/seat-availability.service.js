import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import {
  SEAT_HOLD_ERROR,
  SHOWTIME_SEAT_STATE,
} from "./seat-hold.constants.js";
import {
  seatHoldRepository,
  ShowtimeSeatInitializationConflictError,
} from "./seat-hold.repository.js";

const error = (status, message, code) => new AppError(status, message, [], code);

const seatIdentity = (seat) => String(seat.seatId ?? seat._id);

const projectAvailability = ({ seat, state, ownerId, now, unitPrice }) => {
  let availability = state.state;
  let holdExpiresAt;

  if (seat.status !== "ENABLED" || state.state === SHOWTIME_SEAT_STATE.UNAVAILABLE) {
    availability = SHOWTIME_SEAT_STATE.UNAVAILABLE;
  } else if (state.state === SHOWTIME_SEAT_STATE.HELD) {
    if (state.holdExpiresAt instanceof Date && state.holdExpiresAt <= now) {
      availability = SHOWTIME_SEAT_STATE.AVAILABLE;
    } else if (
      state.holdExpiresAt instanceof Date &&
      ownerId &&
      state.holdOwnerId?.toString() === ownerId.toString()
    ) {
      availability = "HELD_BY_CURRENT_OWNER";
      holdExpiresAt = state.holdExpiresAt.toISOString();
    }
  }

  return {
    seatId: seatIdentity(seat),
    row: seat.row,
    number: seat.number,
    type: seat.type,
    availability,
    ...(holdExpiresAt ? { holdExpiresAt } : {}),
    ...(Number.isSafeInteger(unitPrice) ? { price: unitPrice } : {}),
  };
};

export const createSeatAvailabilityService = ({
  repository = seatHoldRepository,
  showtimeReader,
  roomLayoutReader,
  priceQuoter,
  clock = () => new Date(),
} = {}) => {
  const initializeForPublishedShowtime = async ({ showtimeId, roomId, roomLayoutVersion }) => {
    const layout = await roomLayoutReader.getLayoutVersion(roomId, roomLayoutVersion);
    if (!layout || !Array.isArray(layout.seats) || layout.seats.length === 0) {
      throw error(
        409,
        "The published room layout snapshot is unavailable",
        SEAT_HOLD_ERROR.SHOWTIME_SEATS_NOT_INITIALIZED,
      );
    }

    const seats = layout.seats.map((seat) => ({
      seatId: new mongoose.Types.ObjectId(seatIdentity(seat)),
      state:
        seat.status === "ENABLED"
          ? SHOWTIME_SEAT_STATE.AVAILABLE
          : SHOWTIME_SEAT_STATE.UNAVAILABLE,
    }));

    try {
      const initialized = await repository.initializeShowtimeSeats({
        showtimeId: new mongoose.Types.ObjectId(showtimeId),
        roomLayoutVersion,
        seats,
      });
      return { showtimeId, roomLayoutVersion, seatCount: initialized.length };
    } catch (cause) {
      if (cause instanceof ShowtimeSeatInitializationConflictError) {
        throw error(
          409,
          "Showtime seats were initialized from a different room layout snapshot",
          SEAT_HOLD_ERROR.SHOWTIME_SEATS_ALREADY_INITIALIZED,
        );
      }
      throw cause;
    }
  };

  const getSeatAvailability = async ({ showtimeId, ownerId }) => {
    const now = clock();
    const showtime = await showtimeReader.getBookableShowtime(showtimeId, now);
    if (!showtime) {
      throw error(409, "Showtime is not available for booking", SEAT_HOLD_ERROR.SHOWTIME_NOT_BOOKABLE);
    }

    const [layout, states] = await Promise.all([
      roomLayoutReader.getLayoutVersion(showtime.roomId, showtime.roomLayoutVersion),
      repository.listByShowtime(showtimeId),
    ]);
    if (!layout || states.length !== layout.seats.length) {
      throw error(
        409,
        "Seat availability has not been initialized for this showtime",
        SEAT_HOLD_ERROR.SHOWTIME_SEATS_NOT_INITIALIZED,
      );
    }

    const stateBySeat = new Map(states.map((state) => [state.seatId.toString(), state]));
    if (layout.seats.some((seat) => !stateBySeat.has(seatIdentity(seat)))) {
      throw error(
        409,
        "Seat availability does not match the published room layout",
        SEAT_HOLD_ERROR.SHOWTIME_SEATS_NOT_INITIALIZED,
      );
    }

    const enabledSeatIds = layout.seats
      .filter(({ status }) => status === "ENABLED")
      .map(seatIdentity);
    const quote = await priceQuoter.quote(showtimeId, enabledSeatIds, ownerId, now);
    const priceBySeat = new Map(
      quote?.lines?.map(({ seatId, unitPrice }) => [String(seatId), unitPrice]) ?? [],
    );

    return {
      showtimeId,
      roomId: String(showtime.roomId),
      roomLayoutVersion: showtime.roomLayoutVersion,
      generatedAt: now.toISOString(),
      currency: quote?.currency ?? "VND",
      seats: layout.seats.map((seat) =>
        projectAvailability({
          seat,
          state: stateBySeat.get(seatIdentity(seat)),
          ownerId,
          now,
          unitPrice: priceBySeat.get(seatIdentity(seat)),
        }),
      ),
    };
  };

  return { getSeatAvailability, initializeForPublishedShowtime };
};

export { projectAvailability, seatIdentity };

