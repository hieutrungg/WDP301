import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { BRANCH_ERROR } from "./branch.constants.js";
import {
  changeBranchStatus,
  createBranch,
  getBranch,
  getBranchSummary,
  listBranches,
  updateBranch,
} from "./branch.controller.js";
import {
  branchIdParamsSchema,
  changeBranchStatusSchema,
  createBranchSchema,
  listBranchesQuerySchema,
  updateBranchSchema,
} from "./branch.validation.js";

const router = Router();

const validateBranchId = validate(branchIdParamsSchema, {
  source: "params",
  code: BRANCH_ERROR.INVALID_BRANCH_ID,
});
const validateBody = (schema) => validate(schema, { code: BRANCH_ERROR.VALIDATION_FAILED });

// Management surface: default-deny on the global grant. Branch-scoped RBAC is not approved yet.
router.use(requireAuth, requirePermission("branch.manage"));

router.get(
  "/",
  validate(listBranchesQuerySchema, { source: "query", code: BRANCH_ERROR.INVALID_QUERY }),
  listBranches,
);
router.get("/summary", getBranchSummary);
router.post("/", validateBody(createBranchSchema), createBranch);
router.get("/:branchId", validateBranchId, getBranch);
router.patch("/:branchId", validateBranchId, validateBody(updateBranchSchema), updateBranch);
router.patch(
  "/:branchId/status",
  validateBranchId,
  validateBody(changeBranchStatusSchema),
  changeBranchStatus,
);

export default router;
