import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, required: true },
    orderCode: { type: String, required: true },
    customerAccountId: { type: mongoose.Schema.Types.ObjectId, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ["ONLINE"], required: true },
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
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "EXPIRED"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "REVIEW_REQUIRED"],
      required: true,
    },
    pickupStatus: {
      type: String,
      enum: ["NOT_READY", "AWAITING_PICKUP"],
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
