export const createTicketController = (service) => ({
  // TICKET-101. The branch always comes from the signed-in employee profile, never the request.
  checkIn: async (req, res, next) => {
    try {
      const data = await service.checkInTicket({
        ticketCode: req.body.ticketCode,
        staffAccountId: req.auth.accountId,
        staffBranchId: req.auth.account?.employeeProfile?.branchId ?? null,
      });
      res.status(200).json({ success: true, message: "Ticket checked in successfully.", data });
    } catch (error) {
      next(error);
    }
  },

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
