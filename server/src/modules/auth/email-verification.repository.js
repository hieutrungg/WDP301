import { EmailVerification } from "./email-verification.model.js";

export const deleteVerifications = (accountId, purpose) =>
  EmailVerification.deleteMany({ accountId, purpose }).exec();

export const createVerification = (verification) =>
  EmailVerification.create(verification);

export const findVerification = (accountId, purpose) =>
  EmailVerification.findOne({ accountId, purpose })
    .sort({ createdAt: -1 })
    .select("+otpHash")
    .exec();

export const incrementAttemptCount = (verificationId) =>
  EmailVerification.updateOne(
    { _id: verificationId },
    { $inc: { attemptCount: 1 } },
  ).exec();

export const deleteVerificationById = (verificationId) =>
  EmailVerification.deleteOne({ _id: verificationId }).exec();
