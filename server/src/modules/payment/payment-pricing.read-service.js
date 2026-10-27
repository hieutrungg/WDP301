import { Payment } from "./payment.model.js";

export const paymentPricingReader = {
  async hasPaymentForBooking(bookingId, session) {
    return Boolean(
      await Payment.exists({ bookingId }).session(session ?? null),
    );
  },
};
