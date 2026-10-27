import mongoose from "mongoose";
import { TICKET_INDEXES } from "./ticket.indexes.js";
import { TICKET_STATUS, TICKET_STATUSES } from "./ticket.constants.js";

const { ObjectId } = mongoose.Schema.Types;

// Immutable display snapshot taken at issuance so the E-Ticket keeps its historical truth even if
// the seat layout, movie or room is renamed later.
const seatSnapshotSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    row: { type: String, trim: true, default: "" },
    number: { type: mongoose.Schema.Types.Mixed, default: "" },
    type: { type: String, trim: true, default: "STANDARD" },
    unitPrice: {
      type: Number,
      min: 0,
      validate: {
        validator: (value) => value == null || Number.isSafeInteger(value),
        message: "Ticket price must be an integer number of VND",
      },
      default: null,
    },
  },
  { _id: false },
);

const screeningSnapshotSchema = new mongoose.Schema(
  {
    movieTitle: { type: String, trim: true, default: null },
    ageRating: { type: String, trim: true, default: null },
    cinemaName: { type: String, trim: true, default: null },
    roomName: { type: String, trim: true, default: null },
    roomType: { type: String, trim: true, default: null },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
  },
  { _id: false },
);

const ticketSchema = new mongoose.Schema(
  {
    ticketCode: { type: String, required: true, trim: true },
    qrCode: { type: String, required: true },
    bookingId: { type: ObjectId, required: true },
    paymentId: { type: ObjectId, default: null },
    showtimeId: { type: ObjectId, required: true },
    seatId: { type: ObjectId, required: true },
    customerAccountId: { type: ObjectId, required: true },
    seat: { type: seatSnapshotSchema, required: true },
    screening: { type: screeningSnapshotSchema, default: () => ({}) },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: TICKET_STATUS.ISSUED,
      required: true,
    },
    issuedAt: { type: Date, required: true },
    checkedInAt: { type: Date, default: null },
    // TICKET-101: Staff/Manager account that checked the ticket in (CR-21).
    checkedInBy: { type: ObjectId, default: null },
    invalidatedAt: { type: Date, default: null },
    invalidationReason: { type: String, trim: true, default: null },
  },
  {
    collection: "tickets",
    autoIndex: false,
    timestamps: true,
    versionKey: false,
  },
);

for (const { fields, options } of TICKET_INDEXES) {
  ticketSchema.index(fields, options);
}

export const Ticket =
  mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);
