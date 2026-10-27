import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import {
  requireRole,
  requirePermission,
} from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  objectId,
  quoteVoucherSchema,
  applyVoucherSchema,
  removeVoucherSchema,
} from "../promotion/promotion.validation.js";

export function createBookingVoucherRouter(service) {
  const router = Router();
  router.use(
    requireAuth,
    requirePermission("booking.create"),
    requireRole("CUSTOMER"),
  );
  const params = validate(z.object({ bookingId: objectId }).strict(), {
    source: "params",
    code: "INVALID_VOUCHER",
  });
  const handle = (method) => async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: await service[method]({
          ...req.body,
          bookingId: req.params.bookingId,
          ownerId: req.auth.accountId,
        }),
      });
    } catch (e) {
      next(e);
    }
  };
  router.post(
    "/:bookingId/voucher/quote",
    params,
    validate(quoteVoucherSchema, { code: "INVALID_VOUCHER" }),
    handle("quoteVoucher"),
  );
  router.put(
    "/:bookingId/voucher",
    params,
    validate(applyVoucherSchema, { code: "INVALID_VOUCHER" }),
    handle("applyVoucher"),
  );
  router.delete(
    "/:bookingId/voucher",
    params,
    validate(removeVoucherSchema, { code: "INVALID_VOUCHER" }),
    handle("removeVoucher"),
  );
  return router;
}
