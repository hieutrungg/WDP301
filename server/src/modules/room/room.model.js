import mongoose from "mongoose";
import {
  LEGACY_ROOM_ACTIVE_STATUS,
  ROOM_NAME_COLLATION,
  ROOM_STATUSES,
  SEAT_STATUS,
  SEAT_STATUSES,
  SEAT_TYPES,
} from "./room.constants.js";

// Physical seat definition. `_id` is referenced by showtime_seats, bookings and tickets, so it
// is kept stable for the same row label + seat number across layout versions.
export const seatSchema = new mongoose.Schema({
  row: { type: String, required: true },
  number: { type: Number, required: true, min: 1 },
  column: { type: Number, required: true, min: 1 },
  type: { type: String, enum: SEAT_TYPES, required: true },
  status: { type: String, enum: SEAT_STATUSES, required: true, default: SEAT_STATUS.ENABLED },
  isAccessible: { type: Boolean, default: false },
});

// Grid metadata for the UC41 builder. Cells that hold no seat are aisle/blank positions.
const seatLayoutSchema = new mongoose.Schema(
  {
    rowLabels: { type: [String], default: undefined },
    columnCount: { type: Number, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    updatedAt: { type: Date },
  },
  { _id: false },
);

// Room identity/status fields are owned by Room management (ROOM-001); UC41 only replaces
// `seatLayout`, `seats`, `capacity` and `layoutVersion`.
const roomSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    roomName: { type: String, required: true, trim: true },
    roomType: { type: String, trim: true },
    capacity: { type: Number, min: 0, default: 0 },
    status: { type: String, trim: true, enum: [...ROOM_STATUSES, LEGACY_ROOM_ACTIVE_STATUS] },
    layoutVersion: { type: Number, min: 0, default: 0 },
    seatLayout: { type: seatLayoutSchema, default: undefined },
    seats: { type: [seatSchema], default: [] },
  },
  {
    collection: "rooms",
    timestamps: true,
    versionKey: false,
  },
);

roomSchema.index({ branchId: 1, roomName: 1 }, { name: "idx_room_branch_name" });
roomSchema.index(
  { branchId: 1, roomName: 1 },
  { unique: true, collation: ROOM_NAME_COLLATION, name: "uniq_room_branch_name_normalized" },
);

export const Room = mongoose.model("Room", roomSchema);
