import mongoose from "mongoose";
import {
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
} from "./payment.constants.js";
import { PAYMENT_INDEXES } from "./payment.indexes.js";

const integerMoney = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: "Money must be stored as an integer number of VND",
  },
};

const contactSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    citizenId: { type: String, trim: true },
    instantZalo: { type: Boolean, default: true },
  },
  { _id: false },
);

const paymentAttemptSchema = new mongoose.Schema(
  {
    attemptId: { type: String, required: true, trim: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    idempotencyKey: { type: String, required: true, trim: true },
    provider: {
      type: String,
      required: true,
      default: "INTERNAL_MOCK_GATEWAY",
    },
    method: { type: String, required: true, enum: PAYMENT_METHOD_VALUES },
    amount: integerMoney,
    currency: { type: String, required: true, enum: ["VND"], default: "VND" },
    status: {
      type: String,
      required: true,
      enum: PAYMENT_ATTEMPT_STATUSES,
    },
    gatewayTransactionRef: { type: String, required: true, trim: true },
    qrPayload: { type: String, required: true },
    instruction: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, default: null },
    notificationKey: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    payableReference: {
      type: String,
      required: true,
      trim: true,
    },
    customerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    gatewayTransactionId: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      required: true,
      enum: PAYMENT_METHOD_VALUES,
    },
    amount: integerMoney,
    currency: {
      type: String,
      required: true,
      enum: ["VND"],
      default: "VND",
    },
    status: {
      type: String,
      required: true,
      enum: PAYMENT_STATUSES,
      default: PAYMENT_STATUS.PENDING,
    },
    settlementAttemptId: {
      type: String,
      trim: true,
      default: null,
    },
    settlementReference: {
      type: String,
      trim: true,
      default: null,
    },
    reconciliationReason: {
      type: String,
      trim: true,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    contactSnapshot: {
      type: contactSnapshotSchema,
    },
    attempts: {
      type: [paymentAttemptSchema],
      default: [],
    },
    processedNotificationKeys: {
      type: [String],
      default: [],
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ provider: "INTERNAL_MOCK_GATEWAY" }),
    },
  },
  {
    collection: "payments",
    autoIndex: false,
    timestamps: true,
    versionKey: false,
  },
);

for (const { fields, options } of PAYMENT_INDEXES) {
  paymentSchema.index(fields, options);
}

export const Payment =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
