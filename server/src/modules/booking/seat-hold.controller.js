export const createSeatHoldController = (service) => ({
  acquire: async (req, res, next) => {
    try {
      const data = await service.acquireSeatHold({
        ...req.body,
        ownerId: req.auth.accountId,
      });
      res.status(data.idempotent ? 200 : 201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  release: async (req, res, next) => {
    try {
      const data = await service.releaseSeatHold({
        holdId: req.validated.params.holdId,
        ownerId: req.auth.accountId,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
});

