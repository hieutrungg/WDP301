export const createPaymentController = (service) => ({
  initiate: async (req, res, next) => {
    try {
      const data = await service.initiatePayment({
        ...req.body,
        ownerId: req.auth.accountId,
      });
      res.status(data.idempotent ? 200 : 201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  getByBooking: async (req, res, next) => {
    try {
      const { bookingId } = req.validated?.params ?? req.params;
      const data = await service.getBookingPaymentDetails({
        bookingId,
        ownerId: req.auth.accountId,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  cancelAttempt: async (req, res, next) => {
    try {
      const { paymentId, attemptId } = req.validated?.params ?? req.params;
      const data = await service.cancelPaymentAttempt({
        paymentId,
        attemptId,
        ownerId: req.auth.accountId,
        reason: req.body?.reason,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  simulateNotification: async (req, res, next) => {
    try {
      const { paymentId, attemptId } = req.validated?.params ?? req.params;
      const data = await service.handlePaymentNotification({
        paymentId,
        attemptId,
        outcome: req.body?.outcome ?? "SUCCESS",
        notificationKey: req.body?.notificationKey,
        failureReason: req.body?.failureReason,
        actorOwnerId: req.auth.accountId,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
});
