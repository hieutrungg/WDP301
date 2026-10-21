import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  approveShift,
  cancelShift,
  createShift,
  getDashboard,
  getShift,
  listEmployees,
  listShifts,
  listStations,
} from "./staff-shift.controller.js";
import { STAFF_SHIFT_ERROR, STAFF_SHIFT_PERMISSION } from "./staff-shift.constants.js";
import {
  approveShiftSchema,
  createShiftSchema,
  listEmployeesQuerySchema,
  listShiftsQuerySchema,
  noQuerySchema,
  shiftIdParamsSchema,
} from "./staff-shift.validation.js";

const router = Router();

// Default-deny. UC38's actor is the Manager; ADMIN holds every permission, so the role is checked
// as well. Reads use the existing `shift.view`, changes the existing `shift.manage`. The branch
// comes from the Manager's employee profile (like Inventory); it is never a request field.
const canView = [requirePermission(STAFF_SHIFT_PERMISSION.VIEW), requireRole("MANAGER")];
const canManage = [requirePermission(STAFF_SHIFT_PERMISSION.MANAGE), requireRole("MANAGER")];

const validateShiftId = validate(shiftIdParamsSchema, {
  source: "params",
  code: STAFF_SHIFT_ERROR.INVALID_SHIFT_ID,
});
const validateQuery = (schema) => validate(schema, { source: "query", code: STAFF_SHIFT_ERROR.INVALID_QUERY });
const validateBody = (schema) => validate(schema, { code: STAFF_SHIFT_ERROR.VALIDATION_FAILED });

router.use(requireAuth);

router.get("/dashboard", ...canView, validateQuery(noQuerySchema), getDashboard);
router.get("/stations", ...canView, validateQuery(noQuerySchema), listStations);
router.get("/employees", ...canManage, validateQuery(listEmployeesQuerySchema), listEmployees);
router.get("/", ...canView, validateQuery(listShiftsQuerySchema), listShifts);
router.post("/", ...canManage, validateBody(createShiftSchema), createShift);
router.get("/:shiftId", ...canView, validateShiftId, getShift);
router.post("/:shiftId/cancel", ...canManage, validateShiftId, cancelShift);
router.post("/:shiftId/approve", ...canManage, validateShiftId, validateBody(approveShiftSchema), approveShift);

export default router;
