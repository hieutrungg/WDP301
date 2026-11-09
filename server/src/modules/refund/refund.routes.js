import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { requireAssignedBranch } from "../../middlewares/assignedBranchMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { refundParamsSchema, rejectRefundSchema, requestRefundSchema } from "./refund.validation.js";

export const createRefundRouter = (controller) => {
  const router = Router();
  router.use(requireAuth);
  router.get("/me", requirePermission("refund.request"), requireRole("CUSTOMER"), controller.listMine);
  router.post("/", requirePermission("refund.request"), requireRole("CUSTOMER"), validate(requestRefundSchema), controller.request);
  const managerScope = [requirePermission("refund.manage"), requireRole("MANAGER"), requireAssignedBranch];
  router.get("/manager", ...managerScope, controller.listManager);
  for (const [path, handler] of [["approve", controller.approve], ["retry", controller.retry]]) {
    router.post(`/:refundId/${path}`, ...managerScope, validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), handler);
  }
  router.post("/:refundId/confirm-cash", ...managerScope, validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), controller.confirmCash);
  router.post("/:refundId/reject", ...managerScope, validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), validate(rejectRefundSchema), controller.reject);
  return router;
};
