import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { createSeatAvailabilityService } from "../booking/seat-availability.service.js";
import { movieService } from "../movie/movie.service.js";
import { findBookableShowtimeById } from "./showtime.repository.js";
import * as roomService from "../room/room.service.js";
import { ticketPricingService, TicketPricingUnavailableError } from "../ticket-pricing/ticket-pricing.service.js";
import {
  SHOWTIME_CLEANUP_BUFFER_MS,
  SHOWTIME_ERROR,
  SHOWTIME_STATUS,
} from "./showtime.constants.js";
import {
  createDraftShowtime,
  cancelPublishedShowtime,
  deleteDraftShowtime,
  findShowtimeById,
  findManagerShowtimes,
  findPublicShowtimeById,
  findPublicShowtimes,
  findScheduleConflict,
  publishShowtime,
  updatePublishedShowtimeTime,
} from "./showtime.repository.js";

const getVietnamDateRange = (date) => {
  if (!date) return undefined;
  const start = new Date(`${date}T00:00:00.000+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const displayStatusAt = (startAt, endAt, now, availability) => {
  if (endAt <= now) return "ENDED";
  if (
    availability?.totalSeatCount > 0 &&
    availability.availableSeatCount === 0
  ) {
    return "SOLD_OUT";
  }
  if (startAt <= now) return "NOW_SHOWING";
  return "UPCOMING";
};

const roomLayoutReader = { getLayoutVersion: roomService.getLayoutVersionForBooking };

const seatAvailability = createSeatAvailabilityService({ roomLayoutReader });
const showtimeError = (status, message, code) =>
  new AppError(status, message, [], code);

const resolvePricing = async (startAt, roomType) => {
  try {
    return await ticketPricingService.resolveForShowtime({ startAt, roomType });
  } catch (error) {
    if (error instanceof TicketPricingUnavailableError) {
      throw showtimeError(409, error.message, SHOWTIME_ERROR.INVALID_SHOWTIME);
    }
    throw error;
  }
};

const serializeCreatedShowtime = (showtime, room) => ({
  id: showtime._id.toString(),
  movieId: showtime.movieId.toString(),
  roomId: showtime.roomId.toString(),
  cinemaId: room.branch.id,
  startAt: showtime.startAt.toISOString(),
  endAt: showtime.endAt.toISOString(),
  status: showtime.status,
  roomLayoutVersion: showtime.roomLayoutVersion,
  room: { id: room.id, roomName: room.roomName, roomType: room.roomType },
  cinema: { id: room.branch.id, branchName: room.branch.branchName },
});

export const createShowtimePublisher = ({
  getMovie = movieService.getMovie,
  getRoomLayout = roomService.getSeatLayout,
  findConflict = findScheduleConflict,
  resolvePricePlan = resolvePricing,
  createDraft = createDraftShowtime,
  initializeSeats = seatAvailability.initializeForPublishedShowtime,
  publish = publishShowtime,
  discardSeats = seatAvailability.discardForUnpublishedShowtime,
  deleteDraft = deleteDraftShowtime,
} = {}) => async (
  { movieId, roomId, startAt: startAtInput },
  now = new Date(),
) => {
  const [movie, roomDetail] = await Promise.all([
    getMovie(movieId),
    getRoomLayout(roomId),
  ]);
  const { room, layout } = roomDetail;

  if (
    !["ACTIVE", "AVAILABLE"].includes(room.status) ||
    room.branch.status !== "ACTIVE"
  ) {
    throw showtimeError(
      409,
      "Select an active room at an active cinema",
      SHOWTIME_ERROR.ROOM_UNAVAILABLE,
    );
  }
  if (
    !layout ||
    layout.summary.operationalSeatCapacity < 1 ||
    layout.layoutVersion < 1
  ) {
    throw showtimeError(
      409,
      "Configure a valid seat map before scheduling this room",
      SHOWTIME_ERROR.ROOM_LAYOUT_REQUIRED,
    );
  }
  const startAt = new Date(startAtInput);
  if (startAt <= now) {
    throw showtimeError(
      400,
      "Showtime must start in the future",
      SHOWTIME_ERROR.START_TIME_NOT_FUTURE,
    );
  }
  const endAt = new Date(
    startAt.getTime() + movie.duration * 60_000 + SHOWTIME_CLEANUP_BUFFER_MS,
  );
  const conflict = await findConflict({ roomId, startAt, endAt });
  if (conflict) {
    throw showtimeError(
      409,
      "This room already has a showtime during that time window",
      SHOWTIME_ERROR.SHOWTIME_CONFLICT,
    );
  }

  const pricing = await resolvePricePlan(startAt, room.roomType);
  const draft = await createDraft({
    movieId: new mongoose.Types.ObjectId(movieId),
    roomId: new mongoose.Types.ObjectId(roomId),
    startAt,
    endAt,
    status: SHOWTIME_STATUS.DRAFT,
    roomLayoutVersion: layout.layoutVersion,
    ticketPricePlanId: pricing.ticketPricePlanId,
  });

  try {
    await initializeSeats({
      showtimeId: draft._id,
      roomId: draft.roomId,
      roomLayoutVersion: draft.roomLayoutVersion,
      pricesBySeatType: pricing.seatTypePrices,
    });
    const published = await publish(draft._id);
    if (!published) {
      throw showtimeError(
        409,
        "The showtime could not be published. Please try again.",
        SHOWTIME_ERROR.INVALID_SHOWTIME,
      );
    }
    return serializeCreatedShowtime(published, room);
  } catch (error) {
    await Promise.allSettled([
      discardSeats(draft._id),
      deleteDraft(draft._id),
    ]);
    throw error;
  }
};

export const createShowtime = createShowtimePublisher();

const assertEditableShowtime = async (showtimeId, now) => {
  const showtime = await findShowtimeById(showtimeId);
  if (
    !showtime ||
    showtime.status !== SHOWTIME_STATUS.PUBLISHED ||
    showtime.startAt <= now
  ) {
    throw showtimeError(
      409,
      "Only upcoming published showtimes can be changed",
      SHOWTIME_ERROR.SHOWTIME_NOT_EDITABLE,
    );
  }
  if (await seatAvailability.hasActiveClaims(showtimeId, now)) {
    throw showtimeError(
      409,
      "This showtime has active seat holds or bookings and cannot be changed",
      SHOWTIME_ERROR.SHOWTIME_HAS_BOOKING_ACTIVITY,
    );
  }
  return showtime;
};

export const createShowtimeRescheduler = ({
  assertEditable = assertEditableShowtime,
  getMovie = movieService.getMovie,
  getRoomLayout = roomService.getSeatLayout,
  findConflict = findScheduleConflict,
  resolvePricePlan = resolvePricing,
  reprice = seatAvailability.repriceUnclaimedShowtime,
  updateTime = updatePublishedShowtimeTime,
} = {}) => async (
  { showtimeId, startAt: startAtInput },
  now = new Date(),
) => {
  const showtime = await assertEditable(showtimeId, now);
  const startAt = new Date(startAtInput);
  if (startAt <= now) {
    throw showtimeError(
      400,
      "Showtime must start in the future",
      SHOWTIME_ERROR.START_TIME_NOT_FUTURE,
    );
  }
  const movie = await getMovie(showtime.movieId.toString());
  const endAt = new Date(
    startAt.getTime() + movie.duration * 60_000 + SHOWTIME_CLEANUP_BUFFER_MS,
  );
  const conflict = await findConflict({
    roomId: showtime.roomId.toString(),
    startAt,
    endAt,
    excludeShowtimeId: showtimeId,
  });
  if (conflict) {
    throw showtimeError(
      409,
      "This room already has a showtime during that time window",
      SHOWTIME_ERROR.SHOWTIME_CONFLICT,
    );
  }
  let updated;
  if (showtime.ticketPricePlanId) {
    const { room } = await getRoomLayout(showtime.roomId.toString());
    const pricing = await resolvePricePlan(startAt, room.roomType);
    updated = await reprice({
      showtimeId, roomId: showtime.roomId, roomLayoutVersion: showtime.roomLayoutVersion,
      seatTypePrices: pricing.seatTypePrices, now,
      commit: (session) => updateTime({
        showtimeId, startAt, endAt, now, ticketPricePlanId: pricing.ticketPricePlanId, session,
      }),
    });
  } else {
    // Legacy prices are preserved until an explicit, reviewed migration links a plan.
    updated = await updateTime({ showtimeId, startAt, endAt, now });
  }
  if (!updated) {
    throw showtimeError(
      409,
      "This showtime can no longer be changed",
      SHOWTIME_ERROR.SHOWTIME_NOT_EDITABLE,
    );
  }
  return {
    id: updated._id.toString(),
    startAt: updated.startAt.toISOString(),
    endAt: updated.endAt.toISOString(),
    status: updated.status,
  };
};

export const rescheduleShowtime = createShowtimeRescheduler();

export const cancelShowtime = async ({ showtimeId }, now = new Date()) => {
  await assertEditableShowtime(showtimeId, now);
  const cancelled = await cancelPublishedShowtime({ showtimeId, now });
  if (!cancelled) {
    throw showtimeError(
      409,
      "This showtime can no longer be cancelled",
      SHOWTIME_ERROR.SHOWTIME_NOT_EDITABLE,
    );
  }
  return { id: cancelled._id.toString(), status: cancelled.status };
};

export const listShowtimes = async (query, now = new Date()) => {
  if (query.movieId) await movieService.getMovie(query.movieId);

  const { items, total } = await findPublicShowtimes({
    ...query,
    dateRange: getVietnamDateRange(query.date),
    now,
  });
  const availabilityByShowtime = await seatAvailability.getAvailabilitySummary(
    items.map(({ _id }) => _id),
    now,
  );

  return {
    data: items.map((item) =>
      serializePublicShowtime(
        item,
        now,
        availabilityByShowtime.get(item._id.toString()),
      ),
    ),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

export const listManagerShowtimes = async (query, now = new Date()) => {
  const { items, total } = await findManagerShowtimes({
    ...query,
    dateRange: getVietnamDateRange(query.date),
    now,
  });
  const availabilityByShowtime = await seatAvailability.getAvailabilitySummary(
    items.map(({ _id }) => _id),
    now,
  );
  return {
    data: items.map((item) => ({
      id: item._id.toString(),
      movieId: item.movieId.toString(),
      roomId: item.roomId.toString(),
      roomLayoutVersion: item.roomLayoutVersion,
      cinemaId: item.cinema.id.toString(),
      startAt: new Date(item.startAt).toISOString(),
      endAt: new Date(item.endAt).toISOString(),
      status: item.status,
      createdAt: item.createdAt?.toISOString?.() ?? null,
      updatedAt: item.updatedAt?.toISOString?.() ?? null,
      displayStatus: item.status === SHOWTIME_STATUS.CANCELLED
        ? "CANCELLED"
        : displayStatusAt(
          new Date(item.startAt),
          new Date(item.endAt),
          now,
          availabilityByShowtime.get(item._id.toString()),
        ),
      movie: { ...item.movie, id: item.movie.id.toString() },
      cinema: { ...item.cinema, id: item.cinema.id.toString() },
      room: { ...item.room, id: item.room.id.toString() },
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

const serializePublicShowtime = (item, now, availability) => {
  const startAt = new Date(item.startAt);
  const endAt = new Date(item.endAt);
  return {
    id: item._id.toString(),
    movieId: item.movieId.toString(),
    roomId: item.roomId.toString(),
    cinemaId: item.cinema.id.toString(),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    status: item.status,
    displayStatus: displayStatusAt(startAt, endAt, now, availability),
    movie: { ...item.movie, id: item.movie.id.toString() },
    cinema: { ...item.cinema, id: item.cinema.id.toString() },
    room: { ...item.room, id: item.room.id.toString() },
  };
};

export const getPublicShowtimeById = async (showtimeId, now = new Date()) => {
  const showtime = await findPublicShowtimeById(showtimeId, now);
  if (!showtime) {
    throw showtimeError(
      404,
      "Showtime not found",
      SHOWTIME_ERROR.SHOWTIME_NOT_FOUND,
    );
  }
  const availabilityByShowtime = await seatAvailability.getAvailabilitySummary(
    [showtime._id],
    now,
  );
  return serializePublicShowtime(
    showtime,
    now,
    availabilityByShowtime.get(showtime._id.toString()),
  );
};

// Exported Showtime read contract for Booking. Missing layout snapshots fail closed because
// Booking must never resolve seats from a newer mutable Room layout.
export const getBookableShowtimeForBooking = async (
  showtimeId,
  now = new Date(),
) => {
  const showtime = await findBookableShowtimeById(showtimeId, now);
  if (!showtime) return null;
  return {
    showtimeId: showtime._id.toString(),
    roomId: showtime.roomId.toString(),
    roomLayoutVersion: showtime.roomLayoutVersion,
    startAt: new Date(showtime.startAt).toISOString(),
    endAt: new Date(showtime.endAt).toISOString(),
    status: showtime.status,
    movie: { ...showtime.movie, id: showtime.movie.id.toString() },
    cinema: { ...showtime.cinema, id: showtime.cinema.id.toString() },
    room: { ...showtime.room, id: showtime.room.id.toString() },
  };
};
