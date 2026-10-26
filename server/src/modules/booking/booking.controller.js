export const createBookingController = (service) => ({
  cancel: async (req, res, next) => {
    try {
      const data = await service.cancelPendingCheckout({ bookingId: req.params.bookingId, ownerId: req.auth.accountId });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  },
  createPending: async (req, res, next) => {
    try {
      const data = await service.createPendingBookingFromHold({
        ...req.body,
        ownerId: req.auth.accountId,
      });
      res.status(data.idempotent ? 200 : 201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
});
