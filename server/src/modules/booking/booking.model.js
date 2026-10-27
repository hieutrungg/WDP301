import mongoose from "mongoose";
import { BOOKING_STATUS, BOOKING_STATUSES } from "./booking.constants.js";
import { BOOKING_INDEXES } from "./booking.indexes.js";
import { voucherSnapshotSchema } from "../promotion/promotion.contract.js";

const integerMoney = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: "Money must be stored as an integer number of VND",
  },
};

const bookingSeatLineSchema = new mongoose.Schema(
  {
    seatId: { type: mongoose.Schema.Types.ObjectId, required: true },
    unitPrice: integerMoney,
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, trim: true },
    payableReference: { type: String, required: true, trim: true },
    requestKey: { type: String, required: true, trim: true },
    customerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Account",
    },
    channel: {
      type: String,
      enum: ["ONLINE", "COUNTER"],
      required: true,
      default: "ONLINE",
    },
    createdByStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
    },
    holdId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "SeatHold",
    },
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Showtime",
    },
    seatIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
      required: true,
      validate: {
        validator: (seatIds) => seatIds.length > 0,
        message: "A booking must contain at least one seat",
      },
    },
    seatLines: {
      type: [bookingSeatLineSchema],
      required: true,
      validate: {
        validator: (lines) => lines.length > 0,
        message: "A booking must snapshot the price of every seat",
      },
    },
    // Opaque pricing provenance (for example a future TicketPricePlan quote/version).
    // Settlement always uses the immutable seatLines snapshot instead of recalculating here.
    priceQuoteReference: { type: String, trim: true },
    currency: { type: String, required: true, enum: ["VND"] },
    subtotal: integerMoney,
    concessionAmount: { type: Number, min: 0, validate: Number.isSafeInteger },
    concessionFingerprint: String,
    discountAmount: { ...integerMoney, default: 0 },
    totalAmount: integerMoney,
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
    voucherSnapshot: { type: voucherSnapshotSchema, default: undefined },
    pricingVersion: { type: Number, min: 0, validate: Number.isSafeInteger },
    pricingLockedAt: Date,
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      required: true,
      default: BOOKING_STATUS.PENDING_PAYMENT,
    },
    bookingTime: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    confirmedAt: { type: Date },
    expiredAt: { type: Date },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    refundedAt: Date,
    refundRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefundRequest",
    },
  },
  {
    collection: "bookings",
    // The versioned migration reuses equivalent legacy indexes even when their names differ.
    // Mongoose must not recreate them using the names declared below on application startup.
    autoIndex: false,
    timestamps: true,
    versionKey: false,
  },
);

for (const { fields, options } of BOOKING_INDEXES) {
  bookingSchema.index(fields, options);
}

export const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
