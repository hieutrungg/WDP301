import mongoose from "mongoose";
import { REFUND_STATUSES, REFUND_STATUS } from "./refund.constants.js";

const money = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };

const schema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Booking" },
  paymentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Payment" },
  customerAccountId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Account" },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, required: true, enum: REFUND_STATUSES, default: REFUND_STATUS.REQUESTED },
  ticketAmount: money,
  concessionAmount: money,
  refundAmount: money,
  paymentAmount: money,
  currency: { type: String, enum: ["VND"], default: "VND" },
  paymentMethod: { type: String, required: true },
  fulfillmentSnapshot: { type: String, enum: ["NONE", "NOT_FULFILLED", "FULFILLED"], required: true },
  policySnapshot: {
    cutoffMinutes: { type: Number, required: true },
    showtimeStartAt: { type: Date, required: true },
    requestedAt: { type: Date, required: true },
    checkedIn: { type: Boolean, required: true },
  },
  idempotencyKey: { type: String, required: true, trim: true },
  providerRefundReference: { type: String, trim: true, default: null },
  failureReason: { type: String, trim: true, default: null },
  requestedAt: { type: Date, required: true },
  processedAt: { type: Date, default: null },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  rejectionReason: { type: String, trim: true, default: null },
}, { collection: "refund_requests", timestamps: true, versionKey: false, autoIndex: false });

schema.index({ bookingId: 1 }, { unique: true, name: "uniq_refund_booking" });
schema.index({ idempotencyKey: 1 }, { unique: true, name: "uniq_refund_idempotency" });
schema.index({ status: 1, requestedAt: 1 }, { name: "idx_refund_manager_queue" });
schema.index({ customerAccountId: 1, requestedAt: -1 }, { name: "idx_refund_customer_history" });

export const RefundRequest = mongoose.models.RefundRequest || mongoose.model("RefundRequest", schema);
