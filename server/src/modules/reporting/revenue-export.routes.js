import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { exportRevenueReport, getRevenueReport, getRevenueReportOptions } from "./revenue-export.controller.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filters = {
  fromDate: date,
  toDate: date,
  movieId: z.string().optional(),
  category: z.enum(["ALL", "TICKETS", "CONCESSIONS"]).default("ALL"),
};
const querySchema = z.strictObject({
  ...filters,
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const exportSchema = z.strictObject({
  ...filters,
  format: z.enum(["xlsx", "pdf"]),
});

const router = Router();
router.use(requireAuth, requirePermission("report.view"), requireRole("MANAGER"));
router.get("/options", validate(z.strictObject({}), { source: "query", code: "INVALID_QUERY" }), getRevenueReportOptions);
router.get("/revenue", validate(querySchema, { source: "query", code: "INVALID_QUERY" }), getRevenueReport);
router.get("/revenue/export", requirePermission("report.export"), validate(exportSchema, { source: "query", code: "INVALID_QUERY" }), exportRevenueReport);

export default router;
