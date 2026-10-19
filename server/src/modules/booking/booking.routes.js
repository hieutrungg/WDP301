import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { createPendingBookingSchema } from "./booking.validation.js";

export const createBookingRouter = (controller) => {
  const router = Router();

  router.use(requireAuth);

  router.post(
    "/",
    requirePermission("booking.create"),
    validate(createPendingBookingSchema, { code: "INVALID_BOOKING" }),
    controller.createPending,
  );

  return router;
};
