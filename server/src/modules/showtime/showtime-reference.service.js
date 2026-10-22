import mongoose from "mongoose";
import { Showtime } from "./showtime.model.js";

// UC16 + owner decision 2026-10-22: cancelled sessions do not block; drafts and
// published sessions block until their stored end (including cleanup). Unknown
// lifecycle or unreadable intervals fail closed. Legacy date fields are read only.
export const movieArchiveDependency = (showtime, now) => {
  if (showtime.status === "CANCELLED") return null;
  const startAt = showtime.startAt ?? showtime.startTime;
  const endAt = showtime.endAt ?? showtime.endTime;
  if (!["DRAFT", "PUBLISHED"].includes(showtime.status) || !(startAt instanceof Date) || !(endAt instanceof Date)
    || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
    return { id: String(showtime._id), message: "Showtime status or timing is incomplete or invalid; review this record before archival" };
  }
  if (endAt > now) return { id: String(showtime._id), message: startAt > now ? "Upcoming showtime" : "Running showtime" };
  return null;
};

// Movie-facing read contract. Every lifecycle/time counts, including legacy records.
// A caller changing runtime must hold the Movie scheduling guard in this session.
export const showtimeReferenceService = {
  async getMovieArchiveBlockers(movieId, now, session) {
    const showtimes = await Showtime.collection.find(
      { movieId: new mongoose.Types.ObjectId(String(movieId)) },
      { session, projection: { _id: 1, status: 1, startAt: 1, endAt: 1, startTime: 1, endTime: 1 } },
    ).toArray();
    return showtimes.map((showtime) => movieArchiveDependency(showtime, now)).filter(Boolean);
  },
  async hasMovieReferences(movieId, session) {
    return Boolean(await Showtime.exists({ movieId: new mongoose.Types.ObjectId(String(movieId)) })
      .session(session ?? null).exec());
  },
};
