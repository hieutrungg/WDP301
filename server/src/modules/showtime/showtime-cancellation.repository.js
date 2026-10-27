import mongoose from "mongoose";
import { Booking } from "../booking/booking.model.js";
import { SeatHold } from "../booking/seat-hold.model.js";
import { SHOWTIME_SEAT_STATE } from "../booking/seat-hold.constants.js";
import { ShowtimeSeat } from "../booking/showtime-seat.model.js";
import { ConcessionOrder } from "../concession/order.model.js";
import { releaseStock } from "../inventory/stock-reservation.service.js";
import { Payment } from "../payment/payment.model.js";
import { Showtime } from "./showtime.model.js";
import { RefundRequest } from "../refund/refund.model.js";
import { REFUND_REQUEST_TYPE, REFUND_STATUS } from "../refund/refund.constants.js";

const asId = (value) => value?.toString?.() ?? String(value);

const refundSnapshot = async (booking, payment, showtime, now, session) => {
  const order = await ConcessionOrder.findOne({ bookingId: booking._id }).session(session).lean();
  const fulfillmentSnapshot = !order ? "NONE" : order.pickupStatus === "FULFILLED" ? "FULFILLED" : "NOT_FULFILLED";
  const ticketAmount = booking.subtotal;
  const concessionAmount = fulfillmentSnapshot === "NOT_FULFILLED" ? (order?.totalAmount ?? 0) : 0;
  const refundAmount = ticketAmount + concessionAmount;
  const type = REFUND_REQUEST_TYPE.SHOWTIME_CANCELLATION;
  const customerRequest = await RefundRequest.findOne({ bookingId: booking._id, $or: [{ requestType: REFUND_REQUEST_TYPE.CUSTOMER_REQUEST }, { requestType: { $exists: false } }] }).session(session).lean();
  const cancellationRequest = await RefundRequest.findOne({ bookingId: booking._id, requestType: type }).session(session).lean();
  if (cancellationRequest) return cancellationRequest;
  if (customerRequest && customerRequest.status !== REFUND_STATUS.REJECTED) return customerRequest;
  return (await RefundRequest.create([{
    bookingId: booking._id,
    showtimeId: showtime._id,
    requestType: type,
    paymentId: payment._id,
    customerAccountId: booking.customerAccountId,
    reason: `Showtime ${asId(showtime._id)} was cancelled`,
    status: REFUND_STATUS.REQUESTED,
    ticketAmount,
    concessionAmount,
    refundAmount,
    paymentAmount: payment.amount,
    currency: payment.currency ?? "VND",
    paymentMethod: payment.method,
    fulfillmentSnapshot,
    policySnapshot: {
      cutoffMinutes: 0,
      showtimeStartAt: showtime.startAt,
      requestedAt: now,
      checkedIn: false,
    },
    idempotencyKey: `showtime-cancel:${asId(showtime._id)}:${asId(payment._id)}`,
    requestedAt: now,
  }], { session }))[0].toObject();
};

export const cancelShowtimeWithSales = async ({ showtimeId, managerId, now }) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const showtime = await Showtime.findById(showtimeId).session(session).lean();
      if (!showtime) return { missing: true, refunds: [] };
      if (showtime.status === "PUBLISHED") {
        if (new Date(showtime.startAt) <= now) return { notCancellable: true, refunds: [] };
        const changed = await Showtime.updateOne(
          { _id: showtimeId, status: "PUBLISHED", startAt: { $gt: now } },
          { $set: { status: "CANCELLED" } },
          { session },
        );
        if (changed.modifiedCount !== 1) return { notCancellable: true, refunds: [] };
      } else if (showtime.status !== "CANCELLED") {
        return { notCancellable: true, refunds: [] };
      }

      const pendingBookings = await Booking.find({ showtimeId, status: "PENDING_PAYMENT" }).session(session).lean();
      const pendingIds = pendingBookings.map(({ _id }) => _id);
      if (pendingIds.length) {
        const orders = await ConcessionOrder.find({ bookingId: { $in: pendingIds }, status: "PENDING_PAYMENT" }).session(session).lean();
        for (const order of orders) await releaseStock({ orderId: order._id, session });
        await ConcessionOrder.updateMany({ bookingId: { $in: pendingIds }, status: "PENDING_PAYMENT" }, { $set: { status: "EXPIRED", pickupStatus: "CANCELLED" } }, { session });
        await Payment.updateMany({ bookingId: { $in: pendingIds }, status: "PENDING" }, { $set: { status: "CANCELLED" } }, { session });
        await Booking.updateMany({ _id: { $in: pendingIds }, status: "PENDING_PAYMENT" }, { $set: { status: "EXPIRED", expiredAt: now } }, { session });
      }
      await SeatHold.updateMany({ showtimeId, status: "ACTIVE" }, { $set: { status: "RELEASED", releasedAt: now } }, { session });
      await ShowtimeSeat.updateMany({ showtimeId, state: SHOWTIME_SEAT_STATE.HELD }, { $set: { state: SHOWTIME_SEAT_STATE.AVAILABLE }, $unset: { holdId: 1, holdOwnerId: 1, holdExpiresAt: 1 } }, { session });

      const paidBookings = await Booking.find({ showtimeId, status: "CONFIRMED", paymentId: { $exists: true } }).session(session).lean();
      const refunds = [];
      for (const booking of paidBookings) {
        const payment = await Payment.findOne({ _id: booking.paymentId, status: "PAID" }).session(session).lean();
        if (!payment) continue;
        refunds.push(await refundSnapshot(booking, payment, showtime, now, session));
      }
      return { showtimeId: asId(showtimeId), status: "CANCELLED", refunds, managerId: asId(managerId) };
    });
  } finally {
    await session.endSession();
  }
};
