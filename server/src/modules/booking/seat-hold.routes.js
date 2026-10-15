import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  acquireSeatHoldSchema,
  seatHoldIdParamsSchema,
} from "./seat-hold.validation.js";

export const createSeatHoldRouter = (controller) => {
  const router = Router();
  router.use(requireAuth);
  router.post(
    "/",
    validate(acquireSeatHoldSchema, { code: "INVALID_SEAT_HOLD" }),
    controller.acquire,
  );
  router.delete(
    "/:holdId",
    validate(seatHoldIdParamsSchema, { source: "params", code: "INVALID_HOLD_ID" }),
    controller.release,
  );
  return router;
};

