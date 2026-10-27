import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { getManagerDashboard } from "./dashboard.controller.js";
import { z } from "zod";

const router = Router();
const querySchema = z.strictObject({ period: z.enum(["TODAY", "WTD", "QTD"]).default("TODAY") });

router.use(requireAuth, requirePermission("analytics.view"), requireRole("MANAGER"));
router.get("/dashboard", validate(querySchema, { source: "query", code: "INVALID_QUERY" }), getManagerDashboard);

export default router;
