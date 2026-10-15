import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { createSeatAvailabilityService } from "../booking/seat-availability.service.js";
import { movieService } from "../movie/movie.service.js";
import { findBookableShowtimeById } from "./showtime.repository.js";
import * as roomService from "../room/room.service.js";
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

const displayStatusAt = (startAt, endAt, now) => {
  if (startAt > now) return "UPCOMING";
  if (endAt > now) return "NOW_SHOWING";
  return "ENDED";
};

const roomLayoutReader = {
  async getLayoutVersion(roomId, roomLayoutVersion) {
    const { layout } = await roomService.getSeatLayout(roomId);
    if (!layout || layout.layoutVersion !== roomLayoutVersion) return null;
    return {
      seats: layout.positions
        .filter(({ positionType }) => positionType === "SEAT")
        .map(({ seatId, status }) => ({
          _id: seatId,
          status: status ?? "ENABLED",
        })),
    };
  },
};

const seatAvailability = createSeatAvailabilityService({ roomLayoutReader });
const showtimeError = (status, message, code) =>
  new AppError(status, message, [], code);

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

export const createShowtime = async (
  { movieId, roomId, startAt: startAtInput },
  now = new Date(),
) => {
  const [movie, roomDetail] = await Promise.all([
    movieService.getMovie(movieId),
    roomService.getSeatLayout(roomId),
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
  const conflict = await findScheduleConflict({ roomId, startAt, endAt });
  if (conflict) {
    throw showtimeError(
      409,
      "This room already has a showtime during that time window",
      SHOWTIME_ERROR.SHOWTIME_CONFLICT,
    );
  }

  const draft = await createDraftShowtime({
    movieId: new mongoose.Types.ObjectId(movieId),
    roomId: new mongoose.Types.ObjectId(roomId),
    startAt,
    endAt,
    status: SHOWTIME_STATUS.DRAFT,
    roomLayoutVersion: layout.layoutVersion,
  });

  try {
    await seatAvailability.initializeForPublishedShowtime({
      showtimeId: draft._id,
      roomId: draft.roomId,
      roomLayoutVersion: draft.roomLayoutVersion,
    });
    const published = await publishShowtime(draft._id);
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
      seatAvailability.discardForUnpublishedShowtime(draft._id),
      deleteDraftShowtime(draft._id),
    ]);
    throw error;
  }
};

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

export const rescheduleShowtime = async (
  { showtimeId, startAt: startAtInput },
  now = new Date(),
) => {
  const showtime = await assertEditableShowtime(showtimeId, now);
  const startAt = new Date(startAtInput);
  if (startAt <= now) {
    throw showtimeError(
      400,
      "Showtime must start in the future",
      SHOWTIME_ERROR.START_TIME_NOT_FUTURE,
    );
  }
  const movie = await movieService.getMovie(showtime.movieId.toString());
  const endAt = new Date(
    startAt.getTime() + movie.duration * 60_000 + SHOWTIME_CLEANUP_BUFFER_MS,
  );
  const conflict = await findScheduleConflict({
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
  const updated = await updatePublishedShowtimeTime({
    showtimeId,
    startAt,
    endAt,
    now,
  });
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

  return {
    data: items.map((item) => serializePublicShowtime(item, now)),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

const serializePublicShowtime = (item, now) => {
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
    displayStatus: displayStatusAt(startAt, endAt, now),
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
  return serializePublicShowtime(showtime, now);
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
