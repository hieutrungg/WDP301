import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { refundParamsSchema, rejectRefundSchema, requestRefundSchema } from "./refund.validation.js";

export const createRefundRouter = (controller) => {
  const router = Router();
  router.use(requireAuth);
  router.get("/me", requirePermission("refund.request"), requireRole("CUSTOMER"), controller.listMine);
  router.post("/", requirePermission("refund.request"), requireRole("CUSTOMER"), validate(requestRefundSchema), controller.request);
  router.get("/manager", requirePermission("refund.manage"), requireRole("MANAGER"), controller.listManager);
  for (const [path, handler] of [["approve", controller.approve], ["retry", controller.retry]]) {
    router.post(`/:refundId/${path}`, requirePermission("refund.manage"), requireRole("MANAGER"), validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), handler);
  }
  router.post("/:refundId/confirm-cash", requirePermission("refund.manage"), requireRole("MANAGER"), validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), controller.confirmCash);
  router.post("/:refundId/reject", requirePermission("refund.manage"), requireRole("MANAGER"), validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), validate(rejectRefundSchema), controller.reject);
  return router;
};
