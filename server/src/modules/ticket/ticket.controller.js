export const createTicketController = (service) => ({
  listByBooking: async (req, res, next) => {
    try {
      const { bookingId } = req.validated?.params ?? req.params;
      const data = await service.getTicketsForOwner({
        bookingId,
        ownerId: req.auth.accountId,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { ticketId } = req.validated?.params ?? req.params;
      const data = await service.getTicketForOwner({
        ticketId,
        ownerId: req.auth.accountId,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
});
