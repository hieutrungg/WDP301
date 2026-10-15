import mongoose from "mongoose";
import { SEAT_HOLD_STATUS, SEAT_HOLD_STATUSES } from "./seat-hold.constants.js";

const priceLineSchema = new mongoose.Schema(
  {
    seatId: { type: mongoose.Schema.Types.ObjectId, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const priceSnapshotSchema = new mongoose.Schema(
  {
    quoteId: { type: String, trim: true },
    currency: { type: String, required: true, enum: ["VND"] },
    lines: { type: [priceLineSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const seatHoldSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Account" },
    checkoutKey: { type: String, required: true, trim: true },
    commandHash: { type: String, required: true },
    showtimeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Showtime" },
    roomLayoutVersion: { type: Number, required: true, min: 1 },
    seatIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
      required: true,
      validate: {
        validator: (seatIds) => seatIds.length > 0,
        message: "A seat hold must contain at least one seat",
      },
    },
    status: {
      type: String,
      enum: SEAT_HOLD_STATUSES,
      required: true,
      default: SEAT_HOLD_STATUS.ACTIVE,
    },
    heldAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    releasedAt: Date,
    consumedAt: Date,
    priceSnapshot: { type: priceSnapshotSchema, required: true },
  },
  {
    collection: "seat_holds",
    timestamps: true,
    versionKey: false,
  },
);

seatHoldSchema.index(
  { ownerId: 1, checkoutKey: 1 },
  { unique: true, name: "uniq_seat_hold_owner_checkout" },
);
seatHoldSchema.index(
  { showtimeId: 1, status: 1, expiresAt: 1 },
  { name: "idx_seat_hold_showtime_status_expiry" },
);

export const SeatHold = mongoose.model("SeatHold", seatHoldSchema);

