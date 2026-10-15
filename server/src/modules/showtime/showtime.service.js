import { movieService } from "../movie/movie.service.js";
import { findBookableShowtimeById, findPublicShowtimes } from "./showtime.repository.js";

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

export const listShowtimes = async (query, now = new Date()) => {
  if (query.movieId) await movieService.getMovie(query.movieId);

  const { items, total } = await findPublicShowtimes({
    ...query,
    dateRange: getVietnamDateRange(query.date),
    now,
  });

  return {
    data: items.map((item) => {
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
    }),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

// Exported Showtime read contract for Booking. Missing layout snapshots fail closed because
// Booking must never resolve seats from a newer mutable Room layout.
export const getBookableShowtimeForBooking = async (showtimeId, now = new Date()) => {
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
