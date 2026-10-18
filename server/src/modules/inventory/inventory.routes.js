import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  getStockSummary,
  listCategories,
  listStockInHistory,
  listStockLevels,
  listSuppliers,
  stockIn,
} from "./inventory.controller.js";
import { INVENTORY_ERROR, INVENTORY_PERMISSION } from "./inventory.constants.js";
import {
  listReceiptsQuerySchema,
  listStockLevelsQuerySchema,
  stockInSchema,
} from "./inventory.validation.js";

const router = Router();

// Default-deny. ADMIN holds every permission, but the screen authorization matrix gives these
// screens to Staff and Manager only, so the role is checked as well.
const canView = [requirePermission(INVENTORY_PERMISSION.VIEW), requireRole("STAFF", "MANAGER")];
// UC40's actor is Staff.
const canStockIn = [requirePermission(INVENTORY_PERMISSION.STOCK_IN), requireRole("STAFF")];

router.use(requireAuth);

router.get(
  "/stock-levels",
  ...canView,
  validate(listStockLevelsQuerySchema, { source: "query", code: INVENTORY_ERROR.INVALID_QUERY }),
  listStockLevels,
);
router.get("/stock-levels/summary", ...canView, getStockSummary);
router.get("/categories", ...canView, listCategories);
router.get("/suppliers", ...canView, listSuppliers);
router.get(
  "/stock-in",
  ...canView,
  validate(listReceiptsQuerySchema, { source: "query", code: INVENTORY_ERROR.INVALID_QUERY }),
  listStockInHistory,
);
router.post(
  "/stock-in",
  ...canStockIn,
  validate(stockInSchema, { code: INVENTORY_ERROR.VALIDATION_FAILED }),
  stockIn,
);

export default router;
