import mongoose from "mongoose";
import { Booking } from "../booking/booking.model.js";
import { SHOWTIME_SEAT_STATE } from "../booking/seat-hold.constants.js";
import { ShowtimeSeat } from "../booking/showtime-seat.model.js";
import { ConcessionOrder } from "../concession/order.model.js";
import { Payment } from "../payment/payment.model.js";
import { Showtime } from "../showtime/showtime.model.js";
import { RefundRequest } from "./refund.model.js";

export const refundRepository = {
  async loadEligibility(bookingId) {
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return null;
    const [payment, showtime, order] = await Promise.all([
      Payment.findById(booking.paymentId).lean(), Showtime.findById(booking.showtimeId).lean(),
      ConcessionOrder.findOne({ bookingId: booking._id }).lean(),
    ]);
    return { booking, payment, showtime, order, checkedIn: false };
  },
  findById(id) { return RefundRequest.findById(id).lean(); },
  findByBookingId(bookingId) { return RefundRequest.findOne({ bookingId }).lean(); },
  listForCustomer(customerAccountId) { return RefundRequest.find({ customerAccountId }).sort({ requestedAt: -1 }).lean(); },
  listForManager() { return RefundRequest.find().sort({ requestedAt: 1 }).limit(200).lean(); },
  async create(input) { const [doc] = await RefundRequest.create([input]); return doc.toObject(); },
  claimForProcessing(id, actorId, now) {
    return RefundRequest.findOneAndUpdate(
      { _id: id, status: { $in: ["REQUESTED", "FAILED"] } },
      { $set: { status: "PROCESSING", processedBy: actorId, failureReason: null, updatedAt: now } },
      { new: true, runValidators: true },
    ).lean();
  },
  markFailed(id, reason, now) {
    return RefundRequest.findOneAndUpdate({ _id: id, status: "PROCESSING" }, { $set: { status: "FAILED", failureReason: reason, updatedAt: now } }, { new: true }).lean();
  },
  reject(id, actorId, reason, now) {
    return RefundRequest.findOneAndUpdate({ _id: id, status: "REQUESTED" }, { $set: { status: "REJECTED", rejectedBy: actorId, rejectedAt: now, rejectionReason: reason, processedAt: now } }, { new: true }).lean();
  },
  async finalize(refund, providerResult, now) {
    const session = await mongoose.connection.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const current = await RefundRequest.findOne({ _id: refund._id, status: "PROCESSING" }).session(session).lean();
        if (!current) { result = await RefundRequest.findById(refund._id).session(session).lean(); return; }
        const paymentUpdate = await Payment.updateOne({ _id: current.paymentId, status: "PAID" }, { $set: { status: current.refundAmount === current.paymentAmount ? "REFUNDED" : "PARTIALLY_REFUNDED", refundedAmount: current.refundAmount, refundedAt: now, refundReference: providerResult.reference } }, { session, runValidators: true });
        if (paymentUpdate.modifiedCount !== 1) throw new Error("Payment is no longer refundable");
        const bookingUpdate = await Booking.updateOne({ _id: current.bookingId, status: "CONFIRMED" }, { $set: { status: "REFUNDED", refundedAt: now, refundRequestId: current._id } }, { session, runValidators: true });
        if (bookingUpdate.modifiedCount !== 1) throw new Error("Booking is no longer refundable");
        await ShowtimeSeat.updateMany({ bookingId: current.bookingId, state: SHOWTIME_SEAT_STATE.SOLD }, { $set: { state: SHOWTIME_SEAT_STATE.AVAILABLE }, $unset: { bookingId: 1, priceSnapshot: 1, holdId: 1, holdOwnerId: 1, holdExpiresAt: 1 } }, { session });
        if (current.fulfillmentSnapshot !== "FULFILLED") {
          await ConcessionOrder.updateOne({ bookingId: current.bookingId, pickupStatus: { $ne: "FULFILLED" } }, { $set: { status: "CANCELLED", paymentStatus: "REFUNDED", pickupStatus: "CANCELLED" } }, { session, runValidators: true });
        }
        result = await RefundRequest.findOneAndUpdate({ _id: current._id, status: "PROCESSING" }, { $set: { status: "REFUNDED", processedAt: now, providerRefundReference: providerResult.reference } }, { new: true, session, runValidators: true }).lean();
      });
      return result;
    } finally { await session.endSession(); }
  },
};
