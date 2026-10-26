import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    items: [
      {
        _id: false,
        concessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        quantity: {
          type: Number,
          min: 1,
          required: true,
          validate: Number.isSafeInteger,
        },
      },
    ],
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "CONSUMED", "RELEASED"],
      required: true,
    },
  },
  {
    collection: "inventory_reservations",
    timestamps: true,
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
  },
);
schema.index({ orderId: 1 }, { unique: true, name: "uniq_reservation_order" });
schema.index(
  { branchId: 1, status: 1, expiresAt: 1 },
  { name: "idx_reservation_expiry" },
);
export const StockReservation = mongoose.model("StockReservation", schema);
