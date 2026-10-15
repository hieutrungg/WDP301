export const createSeatAvailabilityController = (service) => ({
  get: async (req, res, next) => {
    try {
      const data = await service.getSeatAvailability({
        showtimeId: req.validated.params.showtimeId,
        ownerId: req.auth?.accountId,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
});

