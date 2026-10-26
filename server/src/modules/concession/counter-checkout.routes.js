import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { createCounterConcessionOrderSchema, counterConcessionOrderParamsSchema } from "./counter-checkout.validation.js";

export const createCounterConcessionCheckoutRouter = (service) => {
  const router = Router();
  router.use(requireAuth, requirePermission("booking.create"), requireRole("STAFF"));
  router.post(
    "/orders",
    validate(createCounterConcessionOrderSchema, { code: "INVALID_COUNTER_CONCESSION_ORDER" }),
    async (req, res, next) => {
      try {
        const data = await service.createOrder({ ...req.body, staffId: req.auth.accountId });
        res.status(data.idempotent ? 200 : 201).json({ success: true, data });
      } catch (error) { next(error); }
    },
  );
  router.post(
    "/orders/:orderId/confirm-qr",
    validate(counterConcessionOrderParamsSchema, { source: "params", code: "INVALID_COUNTER_CONCESSION_ORDER" }),
    async (req, res, next) => {
      try {
        res.json({ success: true, data: await service.confirmQr({ staffId: req.auth.accountId, orderId: req.validated.params.orderId }) });
      } catch (error) { next(error); }
    },
  );
  return router;
};
