import mongoose from "mongoose";
import { SHOWTIME_SEAT_STATE, SHOWTIME_SEAT_STATES } from "./seat-hold.constants.js";

const showtimeSeatSchema = new mongoose.Schema(
  {
    showtimeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Showtime" },
    seatId: { type: mongoose.Schema.Types.ObjectId, required: true },
    roomLayoutVersion: { type: Number, required: true, min: 1 },
    state: {
      type: String,
      enum: SHOWTIME_SEAT_STATES,
      required: true,
      default: SHOWTIME_SEAT_STATE.AVAILABLE,
    },
    holdId: { type: mongoose.Schema.Types.ObjectId, ref: "SeatHold" },
    holdOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    holdExpiresAt: Date,
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    priceSnapshot: { type: Number, min: 0 },
  },
  {
    collection: "showtime_seats",
    timestamps: true,
    versionKey: false,
  },
);

showtimeSeatSchema.index(
  { showtimeId: 1, seatId: 1 },
  { unique: true, name: "uniq_showtime_seat" },
);
showtimeSeatSchema.index({ holdId: 1 }, { name: "idx_showtime_seat_hold" });
showtimeSeatSchema.index(
  { showtimeId: 1, state: 1 },
  { name: "idx_showtime_seat_availability" },
);

export const ShowtimeSeat = mongoose.model("ShowtimeSeat", showtimeSeatSchema);

