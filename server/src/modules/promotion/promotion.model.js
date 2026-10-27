import mongoose from "mongoose";
import { voucherSnapshotSchema } from "./promotion.contract.js";

const oid = mongoose.Schema.Types.ObjectId;
const options = (collection) => ({
  collection,
  timestamps: true,
  autoCreate: false,
  autoIndex: false,
  versionKey: false,
});
const money = { type: Number, min: 0, validate: Number.isSafeInteger };
const promotionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    discountType: { type: String, enum: ["PERCENTAGE"], required: true },
    discountValue: { type: Number, required: true, min: 0.01, max: 20 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], required: true },
    version: { type: Number, required: true, default: 0 },
    reservationFence: { type: Number, default: 0 },
    createdBy: oid,
    updatedBy: oid,
  },
  options("promotions"),
);
const voucherSchema = new mongoose.Schema(
  {
    promotionId: { type: oid, required: true },
    code: { type: String, required: true },
    usageLimit: { type: Number, default: null },
    usedCount: { ...money, required: true, default: 0 },
    reservedCount: { ...money, required: true, default: 0 },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], required: true },
    version: { type: Number, required: true, default: 0 },
    createdBy: oid,
    updatedBy: oid,
  },
  options("vouchers"),
);
const redemptionSchema = new mongoose.Schema(
  {
    bookingId: { type: oid, required: true },
    customerAccountId: { type: oid, required: true },
    voucherId: { type: oid, required: true },
    pricingVersion: Number,
    state: {
      type: String,
      enum: ["RESERVED", "CONSUMED", "RELEASED"],
      required: true,
    },
    blocking: { type: Boolean, required: true },
    expiresAt: { type: Date, required: true },
    snapshot: { type: voucherSnapshotSchema, required: true },
    paymentId: oid,
    consumedAt: Date,
    releasedAt: Date,
    reason: String,
  },
  options("voucher_redemptions"),
);
const commandSchema = new mongoose.Schema(
  {
    bookingId: { type: oid, required: true },
    requestKey: { type: String, required: true },
    fingerprint: { type: String, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  options("voucher_commands"),
);
export const Promotion =
  mongoose.models.Promotion || mongoose.model("Promotion", promotionSchema);
export const Voucher =
  mongoose.models.Voucher || mongoose.model("Voucher", voucherSchema);
export const VoucherRedemption =
  mongoose.models.VoucherRedemption ||
  mongoose.model("VoucherRedemption", redemptionSchema);
export const VoucherCommand =
  mongoose.models.VoucherCommand ||
  mongoose.model("VoucherCommand", commandSchema);
