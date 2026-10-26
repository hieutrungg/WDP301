import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import {
  requirePermission,
  requireRole,
} from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { concessionQuoteSchema } from "./checkout.validation.js";

export const createConcessionCheckoutRouter = (service) => {
  const router = Router();
  router.post(
    "/quote",
    requireAuth,
    requirePermission("booking.create"),
    requireRole("CUSTOMER"),
    validate(concessionQuoteSchema, { code: "INVALID_CONCESSION_SELECTION" }),
    async (req, res, next) => {
      try {
        res.json({
          success: true,
          data: await service.quote({
            ...req.body,
            ownerId: req.auth.accountId,
          }),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
};
