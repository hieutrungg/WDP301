import { AppError } from "../../utils/AppError.js";
import { BOOKING_STATUS } from "../booking/booking.constants.js";
import { PAYMENT_STATUS } from "../payment/payment.constants.js";
import { REFUND_CUTOFF_MINUTES, REFUND_ERROR, REFUND_REQUEST_TYPE, REFUND_STATUS } from "./refund.constants.js";

const fail = (status, message, code = REFUND_ERROR.NOT_ELIGIBLE) => new AppError(status, message, [], code);
const id = (value) => value?.toString?.() ?? String(value);
const serialize = (refund) => refund && ({
  refundId: id(refund._id), bookingId: id(refund.bookingId), paymentId: id(refund.paymentId), showtimeId: refund.showtimeId ? id(refund.showtimeId) : null, requestType: refund.requestType ?? REFUND_REQUEST_TYPE.CUSTOMER_REQUEST,
  status: refund.status, reason: refund.reason, ticketAmount: refund.ticketAmount,
  concessionAmount: refund.concessionAmount, refundAmount: refund.refundAmount,
  currency: refund.currency, paymentMethod: refund.paymentMethod,
  fulfillmentSnapshot: refund.fulfillmentSnapshot, policySnapshot: refund.policySnapshot,
  providerRefundReference: refund.providerRefundReference, failureReason: refund.failureReason,
  rejectionReason: refund.rejectionReason, requestedAt: refund.requestedAt,
  processedAt: refund.processedAt,
});

export const createRefundService = ({ repository, provider, clock = () => new Date() }) => ({
  getSuccessfulRevenueTotals: ({ fromAt, toAt, session } = {}) =>
    repository.aggregateSuccessfulRevenue({ fromAt, toAt, session }),
  async request({ bookingId, customerAccountId, reason }) {
    const now = clock();
    const data = await repository.loadEligibility(bookingId);
    if (!data) throw fail(404, "Booking not found", REFUND_ERROR.BOOKING_NOT_FOUND);
    if (id(data.booking.customerAccountId) !== id(customerAccountId)) throw fail(403, "This booking does not belong to you", REFUND_ERROR.BOOKING_FORBIDDEN);
    if (data.booking.status !== BOOKING_STATUS.CONFIRMED || data.payment?.status !== PAYMENT_STATUS.PAID) throw fail(409, "Only a confirmed paid booking can be refunded");
    if (!data.showtime) throw fail(409, "Showtime is unavailable for refund evaluation");
    if (data.checkedIn) throw fail(409, "Checked-in tickets cannot be refunded through the normal flow");
    const cutoffAt = new Date(data.showtime.startAt).getTime() - REFUND_CUTOFF_MINUTES * 60_000;
    if (now.getTime() >= cutoffAt) throw fail(409, `Refund requests close ${REFUND_CUTOFF_MINUTES} minutes before showtime`);
    if (await repository.findByBookingId(bookingId, REFUND_REQUEST_TYPE.CUSTOMER_REQUEST)) throw fail(409, "A refund request already exists for this booking", REFUND_ERROR.ALREADY_REQUESTED);

    const fulfillmentSnapshot = !data.order ? "NONE" : data.order.pickupStatus === "FULFILLED" ? "FULFILLED" : "NOT_FULFILLED";
    const discount = data.booking.discountAmount ?? 0;
    const ticketAmount = data.booking.subtotal - discount;
    const fullFoodAmount = data.order?.totalAmount ?? 0;
    if (![data.booking.subtotal, discount, ticketAmount, fullFoodAmount, data.payment.amount].every(n => Number.isSafeInteger(n) && n >= 0) ||
        ticketAmount + fullFoodAmount !== data.payment.amount ||
        (discount > 0 && !data.booking.voucherSnapshot)) throw fail(409, "Booking/payment amounts require review before refund");
    const concessionAmount = fulfillmentSnapshot === "NOT_FULFILLED" ? (data.order?.totalAmount ?? 0) : 0;
    const refundAmount = ticketAmount + concessionAmount;
    const created = await repository.create({
      bookingId: data.booking._id, paymentId: data.payment._id,
      requestType: REFUND_REQUEST_TYPE.CUSTOMER_REQUEST,
      customerAccountId, reason, status: REFUND_STATUS.REQUESTED,
      ticketAmount, concessionAmount, refundAmount, paymentAmount: data.payment.amount,
      currency: "VND", paymentMethod: data.payment.method, fulfillmentSnapshot,
      policySnapshot: { cutoffMinutes: REFUND_CUTOFF_MINUTES, showtimeStartAt: data.showtime.startAt, requestedAt: now, checkedIn: false },
      idempotencyKey: `refund:${id(data.payment._id)}:${refundAmount}`, requestedAt: now,
    });
    return serialize(created);
  },
  async listMine(customerAccountId) { return { items: (await repository.listForCustomer(customerAccountId)).map(serialize) }; },
  async listManager() { return { items: (await repository.listForManager()).map(serialize) }; },
  async confirmCash({ refundId, managerId }) {
    const existing = await repository.findById(refundId);
    if (!existing) throw fail(404, "Refund request not found", REFUND_ERROR.NOT_FOUND);
    if (existing.paymentMethod !== "CASH") throw fail(409, "Only cash refunds can be confirmed manually", REFUND_ERROR.INVALID_STATE);
    if (existing.status === REFUND_STATUS.REFUNDED) return serialize(existing);
    const claimed = await repository.claimForProcessing(refundId, managerId, clock());
    if (!claimed) throw fail(409, "Cash refund is not ready for confirmation", REFUND_ERROR.INVALID_STATE);
    try {
      return serialize(await repository.finalize(claimed, {
        provider: "MANUAL_CASH", reference: `CASH-${id(claimed._id)}`, amount: claimed.refundAmount,
        manuallySettled: true,
      }, clock()));
    } catch (error) {
      await repository.markFailed(refundId, error?.message || "Manual cash confirmation failed", clock());
      throw fail(409, "Cash refund could not be confirmed; the request can be retried", REFUND_ERROR.INVALID_STATE);
    }
  },
  async processShowtimeCancellationRefunds(refunds, managerId) {
    const outcomes = [];
    for (const refund of refunds) {
      if (refund.status === REFUND_STATUS.REFUNDED || refund.status === REFUND_STATUS.REJECTED) {
        outcomes.push(serialize(refund));
        continue;
      }
      if (refund.paymentMethod === "CASH") { outcomes.push(serialize(refund)); continue; }
      if (refund.status === REFUND_STATUS.PROCESSING) { outcomes.push(serialize(refund)); continue; }
      try { outcomes.push(await this.process({ refundId: id(refund._id), managerId })); }
      catch { outcomes.push(serialize(await repository.findById(refund._id))); }
    }
    return outcomes;
  },
  async reject({ refundId, managerId, reason }) {
    const current = await repository.findById(refundId);
    if (current?.requestType === REFUND_REQUEST_TYPE.SHOWTIME_CANCELLATION) throw fail(409, "Showtime cancellation refunds cannot be rejected", REFUND_ERROR.INVALID_STATE);
    const updated = await repository.reject(refundId, managerId, reason, clock());
    if (!updated) throw fail(409, "Only a requested refund can be rejected", REFUND_ERROR.INVALID_STATE);
    return serialize(updated);
  },
  async process({ refundId, managerId }) {
    const existing = await repository.findById(refundId);
    if (!existing) throw fail(404, "Refund request not found", REFUND_ERROR.NOT_FOUND);
    if (existing.status === REFUND_STATUS.REFUNDED) return serialize(existing);
    if (existing.paymentMethod === "CASH") throw fail(409, "Cash refunds require manager confirmation after the external payment", REFUND_ERROR.INVALID_STATE);
    const claimed = await repository.claimForProcessing(refundId, managerId, clock());
    if (!claimed) throw fail(409, "Refund is not ready for processing", REFUND_ERROR.INVALID_STATE);
    try {
      const providerResult = await provider.refund({ idempotencyKey: claimed.idempotencyKey, amount: claimed.refundAmount, method: claimed.paymentMethod, paymentId: id(claimed.paymentId) });
      return serialize(await repository.finalize(claimed, providerResult, clock()));
    } catch (error) {
      await repository.markFailed(refundId, error?.message || "Mock refund failed", clock());
      throw fail(502, "Refund provider failed; the request can be retried", REFUND_ERROR.INVALID_STATE);
    }
  },
});
