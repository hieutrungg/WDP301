import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { AppError } from "../../utils/AppError.js";
import {
  createCounterConcessionOrderSchema,
  counterConcessionOrderParamsSchema,
} from "./counter-checkout.validation.js";

export const createCounterConcessionCheckoutRouter = (service) => {
  const router = Router();
  // Standalone concession sales are a Staff-only counter capability. Do not reuse
  // the ticket-booking permission: a walk-in food order has no Booking aggregate.
  router.use(requireAuth, requireRole("STAFF"));
  router.post(
    "/orders",
    validate(createCounterConcessionOrderSchema, {
      code: "INVALID_COUNTER_CONCESSION_ORDER",
    }),
    async (req, res, next) => {
      try {
        const data = await service.createOrder({
          ...req.body,
          staffId: req.auth.accountId,
        });
        res.status(data.idempotent ? 200 : 201).json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/orders/:orderId/simulate-payment",
    (req, res, next) =>
      process.env.NODE_ENV === "production"
        ? next(
            new AppError(
              404,
              "Mock payment simulation is disabled in production",
              [],
              "MOCK_SIMULATION_DISABLED",
            ),
          )
        : next(),
    validate(counterConcessionOrderParamsSchema, {
      source: "params",
      code: "INVALID_COUNTER_CONCESSION_ORDER",
    }),
    async (req, res, next) => {
      try {
        res.json({
          success: true,
          data: await service.confirmQr({
            staffId: req.auth.accountId,
            orderId: req.validated.params.orderId,
            simulated: true,
          }),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    "/orders/:orderId/confirm-qr",
    validate(counterConcessionOrderParamsSchema, {
      source: "params",
      code: "INVALID_COUNTER_CONCESSION_ORDER",
    }),
    async (req, res, next) => {
      try {
        res.json({
          success: true,
          data: await service.confirmQr({
            staffId: req.auth.accountId,
            orderId: req.validated.params.orderId,
          }),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
};
