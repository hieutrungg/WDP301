import { RefundRequest } from "./refund.model.js";
import { REFUND_STATUS } from "./refund.constants.js";

// A pending/failed refund cannot be used as evidence that the paid booking is stable.
// Rejected requests have no pending settlement; completed refunds fail Payment/Booking checks too.
export const hasUnsettledRefundForReview = async ({ bookingId, session }) => Boolean(
  await RefundRequest.exists({ bookingId, status: { $ne: REFUND_STATUS.REJECTED } }).session(session ?? null),
);
