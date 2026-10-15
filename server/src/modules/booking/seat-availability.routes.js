import { Router } from "express";
import { validate } from "../../middlewares/validateMiddleware.js";
import { showtimeIdParamsSchema } from "./seat-hold.validation.js";

export const createSeatAvailabilityRouter = (controller) => {
  const router = Router({ mergeParams: true });
  router.get(
    "/",
    validate(showtimeIdParamsSchema, { source: "params", code: "INVALID_SHOWTIME_ID" }),
    controller.get,
  );
  return router;
};

