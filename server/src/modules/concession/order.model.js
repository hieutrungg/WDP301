import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId },
    orderCode: { type: String, required: true },
    customerAccountId: { type: mongoose.Schema.Types.ObjectId },
    branchId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ["ONLINE", "COUNTER"], required: true },
    createdByStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    items: [
      {
        _id: false,
        itemType: String,
        itemId: mongoose.Schema.Types.ObjectId,
        name: String,
        size: String,
        unitPrice: Number,
        quantity: Number,
        subtotal: Number,
        components: [
          {
            _id: false,
            concessionId: mongoose.Schema.Types.ObjectId,
            quantity: Number,
          },
        ],
      },
    ],
    totalAmount: {
      type: Number,
      min: 0,
      validate: Number.isSafeInteger,
      required: true,
    },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "EXPIRED", "CANCELLED"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "REVIEW_REQUIRED", "REFUNDED"],
      required: true,
    },
    pickupStatus: {
      type: String,
      enum: ["NOT_READY", "AWAITING_PICKUP", "FULFILLED", "CANCELLED"],
      required: true,
    },
  },
  {
    collection: "orders",
    timestamps: true,
    versionKey: false,
    autoIndex: false,
    autoCreate: false,
  },
);
schema.index(
  { bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: { bookingId: { $type: "objectId" } },
    name: "uniq_concession_booking",
  },
);
schema.index(
  { orderCode: 1 },
  { unique: true, name: "uniq_concession_order_code" },
);
export const ConcessionOrder = mongoose.model("ConcessionOrder", schema);
