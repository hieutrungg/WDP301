import mongoose from "mongoose";

const emailVerificationSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ["REGISTER_EMAIL", "RESET_PASSWORD", "CHANGE_EMAIL"],
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attemptCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "email_verifications",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

export const EmailVerification = mongoose.model(
  "EmailVerification",
  emailVerificationSchema,
);
