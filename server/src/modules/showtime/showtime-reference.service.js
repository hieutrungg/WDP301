import mongoose from "mongoose";
import { Showtime } from "./showtime.model.js";

// Movie-facing read contract. Every lifecycle/time counts, including legacy records.
// A caller changing runtime must hold the Movie scheduling guard in this session.
export const showtimeReferenceService = {
  async hasMovieReferences(movieId, session) {
    return Boolean(await Showtime.exists({ movieId: new mongoose.Types.ObjectId(String(movieId)) })
      .session(session ?? null).exec());
  },
};
