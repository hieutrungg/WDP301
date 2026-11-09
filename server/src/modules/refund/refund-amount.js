import { AppError } from "../../utils/AppError.js";
import { REFUND_ERROR } from "./refund.constants.js";

export function calculateRefundAmounts(booking, payment, order) {
  const fulfillmentSnapshot = !order
    ? "NONE"
    : order.pickupStatus === "FULFILLED"
      ? "FULFILLED"
      : "NOT_FULFILLED";
  const discount = booking.discountAmount ?? 0;
  const ticketAmount = booking.subtotal - discount;
  const fullFoodAmount = order?.totalAmount ?? 0;
  if (
    ![
      booking.subtotal,
      discount,
      ticketAmount,
      fullFoodAmount,
      payment.amount,
    ].every((value) => Number.isSafeInteger(value) && value >= 0) ||
    ticketAmount + fullFoodAmount !== payment.amount ||
    (discount > 0 && !booking.voucherSnapshot)
  ) {
    throw new AppError(
      409,
      "Booking/payment amounts require review before refund",
      [],
      REFUND_ERROR.NOT_ELIGIBLE,
    );
  }
  const concessionAmount =
    fulfillmentSnapshot === "NOT_FULFILLED" ? fullFoodAmount : 0;
  return {
    ticketAmount,
    concessionAmount,
    refundAmount: ticketAmount + concessionAmount,
    fulfillmentSnapshot,
  };
}
