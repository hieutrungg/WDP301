import { Showtime } from "./showtime.model.js";
import { SHOWTIME_STATUS } from "./showtime.constants.js";

// Owner read contract; endAt is the stored scheduling boundary, including cleanup.
export const isEndedShowtimeForReview = async ({ showtimeId, movieId, now, session }) => {
  const showtime = await Showtime.findOne({ _id: showtimeId, movieId,
    status: SHOWTIME_STATUS.PUBLISHED, endAt: { $lte: now } })
    .select({ startAt: 1, endAt: 1 }).session(session ?? null).lean();
  return Boolean(showtime?.startAt instanceof Date && showtime.endAt instanceof Date &&
    showtime.startAt < showtime.endAt && showtime.endAt <= now);
};
