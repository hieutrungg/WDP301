import { Payment } from "./payment.model.js";
import { PAYMENT_STATUS } from "./payment.constants.js";

export const hasPaidBookingForReview = async ({ paymentId, bookingId, accountId, session, lock = false }) => {
  const filter = { _id: paymentId, bookingId, customerAccountId: accountId, status: PAYMENT_STATUS.PAID,
    refundedAt: null, $or: [{ refundedAmount: null }, { refundedAmount: 0 }] };
  const payment = await Payment.findOne(filter).select({ _id: 1, updatedAt: 1 }).session(session ?? null).lean();
  if (!payment) return false;
  if (!lock) return true;
  if (!session?.inTransaction()) throw new Error("Review payment lock requires a transaction");
  // Guaranteed real write on an EXISTING field. Refund finalization writes this same
  // document, so a concurrent settlement forces transaction retry instead of a stale paid read.
  const updatedAt = new Date(Math.max(Date.now(), (payment.updatedAt?.getTime() ?? 0) + 1));
  const result = await Payment.updateOne(filter, { $set: { updatedAt } }, { session, timestamps: false });
  return result.modifiedCount === 1;
};
