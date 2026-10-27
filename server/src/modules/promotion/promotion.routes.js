import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  objectId,
  createPromotionSchema,
  updatePromotionSchema,
  createVoucherSchema,
  updateVoucherSchema,
  listSchema,
} from "./promotion.validation.js";
import { createPromotionController } from "./promotion.controller.js";
import { promotionService } from "./promotion.service.js";

export function createPromotionRouter(service = promotionService) {
  const router = Router();
  const c = createPromotionController(service);
  const body = (schema) => validate(schema, { code: "INVALID_PROMOTION" });
  const params = (name) =>
    validate(z.object({ [name]: objectId }).strict(), {
      source: "params",
      code: name === "voucherId" ? "INVALID_VOUCHER" : "INVALID_PROMOTION",
    });
  const query = validate(listSchema, {
    source: "query",
    code: "INVALID_PROMOTION",
  });
  router.use(["/promotions", "/vouchers"], requireAuth, requireRole("MANAGER"));
  router.get("/promotions", query, c.list);
  router.post("/promotions", body(createPromotionSchema), c.create);
  router.get("/promotions/:promotionId", params("promotionId"), c.get);
  router.patch(
    "/promotions/:promotionId",
    params("promotionId"),
    body(updatePromotionSchema),
    c.update,
  );
  router.get(
    "/promotions/:promotionId/vouchers",
    params("promotionId"),
    validate(listSchema.omit({ q: true, status: true }), {
      source: "query",
      code: "INVALID_VOUCHER",
    }),
    c.listVouchers,
  );
  router.post(
    "/promotions/:promotionId/vouchers",
    params("promotionId"),
    validate(createVoucherSchema, { code: "INVALID_VOUCHER" }),
    c.createVoucher,
  );
  router.patch(
    "/vouchers/:voucherId",
    params("voucherId"),
    validate(updateVoucherSchema, { code: "INVALID_VOUCHER" }),
    c.updateVoucher,
  );
  return router;
}
export const promotionRoutes = createPromotionRouter();
