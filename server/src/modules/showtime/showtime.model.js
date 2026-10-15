import mongoose from "mongoose";
import { SHOWTIME_STATUS } from "./showtime.constants.js";

const showtimeSchema = new mongoose.Schema(
  {
    movieId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Movie" },
    roomId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Room" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(SHOWTIME_STATUS),
      required: true,
      default: SHOWTIME_STATUS.DRAFT,
    },
    roomLayoutVersion: { type: Number, required: true, min: 1 },
  },
  {
    collection: "showtimes",
    timestamps: true,
    versionKey: false,
  },
);

showtimeSchema.index({ roomId: 1, status: 1, startAt: 1, endAt: 1 }, { name: "idx_showtime_room_schedule" });
showtimeSchema.index({ movieId: 1, status: 1, startAt: 1 }, { name: "idx_showtime_movie_schedule" });

export const Showtime = mongoose.models.Showtime || mongoose.model("Showtime", showtimeSchema);
