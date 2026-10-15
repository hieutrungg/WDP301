import mongoose from "mongoose";
import { seatSchema } from "./room.model.js";

// A-14: immutable snapshot of a superseded Room layout. Showtimes created against an older
// `layoutVersion` resolve their seats here, so a later structural change never rewrites them.
const roomLayoutVersionSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    layoutVersion: { type: Number, required: true, min: 0 },
    rowLabels: { type: [String], default: [] },
    columnCount: { type: Number, min: 0, default: 0 },
    seats: { type: [seatSchema], default: [] },
    capacity: { type: Number, min: 0, default: 0 },
    authoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    authoredAt: { type: Date },
    supersededAt: { type: Date, required: true },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
  },
  {
    collection: "room_layout_versions",
    versionKey: false,
  },
);

roomLayoutVersionSchema.index(
  { roomId: 1, layoutVersion: 1 },
  { unique: true, name: "uniq_room_layout_version" },
);

export const RoomLayoutVersion = mongoose.model("RoomLayoutVersion", roomLayoutVersionSchema);
