import { Booking } from "./booking.model.js";
import { BOOKING_STATUS } from "./booking.constants.js";
import { isEndedShowtimeForReview } from "../showtime/review-showtime.service.js";
import { hasPaidBookingForReview } from "../payment/review-payment.service.js";
import { hasUnsettledRefundForReview } from "../refund/review-refund.service.js";

export const createReviewEligibilityService = ({
  bookings = Booking,
  endedShowtime = isEndedShowtimeForReview,
  paidBooking = hasPaidBookingForReview,
  unsettledRefund = hasUnsettledRefundForReview,
} = {}) => ({
  async canReview({ accountId, movieId, now, session, lock = false }) {
    // Iterate all candidates, never use the history UI's 50-record page as eligibility evidence.
    const cursor = bookings.find({ customerAccountId: accountId, status: BOOKING_STATUS.CONFIRMED, refundedAt: null })
      .select({ _id: 1, paymentId: 1, showtimeId: 1 }).sort({ _id: 1 }).session(session ?? null).lean().cursor();
    try {
      for await (const booking of cursor) {
        if (!booking.paymentId || !booking.showtimeId) continue;
        if (!await endedShowtime({ showtimeId: booking.showtimeId, movieId, now, session })) continue;
        if (await unsettledRefund({ bookingId: booking._id, session })) continue;
        if (await paidBooking({ paymentId: booking.paymentId, bookingId: booking._id, accountId, session, lock })) return true;
      }
      return false;
    } finally { await cursor.close(); }
  },
});

export const reviewEligibilityService = createReviewEligibilityService();
