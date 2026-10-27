import mongoose from "mongoose";

// Approved immutable value-object contract shared with Booking persistence.
// Promotion models/repositories are private to their module.
export const voucherSnapshotSchema = new mongoose.Schema(
  {
    voucherId: mongoose.Schema.Types.ObjectId,
    reservationId: mongoose.Schema.Types.ObjectId,
    code: String,
    promotionName: String,
    discountValue: Number,
    discountAmount: { type: Number, min: 0, validate: Number.isSafeInteger },
  },
  { _id: false },
);
