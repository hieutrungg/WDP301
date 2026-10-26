import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { refundParamsSchema, rejectRefundSchema, requestRefundSchema } from "./refund.validation.js";

export const createRefundRouter = (controller) => {
  const router = Router();
  router.use(requireAuth);
  router.get("/me", requireRole("CUSTOMER"), controller.listMine);
  router.post("/", requireRole("CUSTOMER"), validate(requestRefundSchema), controller.request);
  router.get("/manager", requireRole("MANAGER"), controller.listManager);
  for (const [path, handler] of [["approve", controller.approve], ["retry", controller.retry]]) {
    router.post(`/:refundId/${path}`, requireRole("MANAGER"), validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), handler);
  }
  router.post("/:refundId/reject", requireRole("MANAGER"), validate(refundParamsSchema, { source: "params", code: "INVALID_REFUND_ID" }), validate(rejectRefundSchema), controller.reject);
  return router;
};
