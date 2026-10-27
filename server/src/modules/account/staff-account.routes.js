import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { SYSTEM_ROLE } from "../role-permission/role.constants.js";
import { STAFF_ERROR } from "./account.constants.js";
import {
  assignStaffAccess,
  changeStaffStatus,
  createStaffAccount,
  getStaffAccount,
  getStaffFormOptions,
  listStaffAccounts,
  updateStaffAccount,
} from "./staff-account.controller.js";
import {
  accountIdParamsSchema,
  assignStaffAccessSchema,
  changeStaffStatusSchema,
  createStaffSchema,
  listStaffQuerySchema,
  updateStaffSchema,
} from "./staff-account.validation.js";

const router = Router();

const validateAccountId = validate(accountIdParamsSchema, {
  source: "params",
  code: STAFF_ERROR.INVALID_ACCOUNT_ID,
});
const validateBody = (schema) => validate(schema, { code: STAFF_ERROR.VALIDATION_FAILED });

// BR-26: only Admins manage staff accounts and assign roles. MANAGER holds staff.manage in the
// seed, so the Admin-only account.manage grant and the ADMIN role are both required.
router.use(requireAuth, requirePermission("account.manage"), requireRole(SYSTEM_ROLE.ADMIN));

router.get(
  "/",
  validate(listStaffQuerySchema, { source: "query", code: STAFF_ERROR.INVALID_QUERY }),
  listStaffAccounts,
);
router.get("/options", getStaffFormOptions);
router.post("/", validateBody(createStaffSchema), createStaffAccount);
router.get("/:accountId", validateAccountId, getStaffAccount);
router.patch("/:accountId", validateAccountId, validateBody(updateStaffSchema), updateStaffAccount);
router.patch(
  "/:accountId/status",
  validateAccountId,
  validateBody(changeStaffStatusSchema),
  changeStaffStatus,
);
// UC37 also needs the permission-assignment grant.
router.put(
  "/:accountId/access",
  requirePermission("permission.assign"),
  validateAccountId,
  validateBody(assignStaffAccessSchema),
  assignStaffAccess,
);

export default router;
