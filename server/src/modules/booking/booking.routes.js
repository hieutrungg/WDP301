import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { cancelCheckoutParamsSchema, createPendingBookingSchema } from "./booking.validation.js";

export const createBookingRouter = (controller) => {
  const router = Router();

  router.use(requireAuth);

  router.post(
    "/",
    requirePermission("booking.create"),
    validate(createPendingBookingSchema, { code: "INVALID_BOOKING" }),
    (req, res, next) => req.body.concessionSelection ? requireRole("CUSTOMER", "STAFF")(req, res, next) : next(),
    controller.createPending,
  );

  router.post("/:bookingId/cancel-checkout", requirePermission("booking.create"), requireRole("CUSTOMER"),
    validate(cancelCheckoutParamsSchema, { source: "params", code: "INVALID_BOOKING" }),
    validate(z.object({}).strict(), { code: "INVALID_BOOKING" }), controller.cancel);

  return router;
};
