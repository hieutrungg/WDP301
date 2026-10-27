import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { ROLE_ERROR, SYSTEM_ROLE } from "./role.constants.js";
import {
  assignRolePermissions,
  createRole,
  getRole,
  listPermissions,
  listRoles,
  updateRole,
} from "./role.controller.js";
import {
  assignRolePermissionsSchema,
  createRoleSchema,
  listRolesQuerySchema,
  roleIdParamsSchema,
  updateRoleSchema,
} from "./role.validation.js";

const validateRoleId = validate(roleIdParamsSchema, {
  source: "params",
  code: ROLE_ERROR.INVALID_ROLE_ID,
});
const validateBody = (schema) => validate(schema, { code: ROLE_ERROR.VALIDATION_FAILED });
// BR-32: only Admins manage roles. The ADMIN role is checked as well as the grant, so a direct
// grant alone never opens role management.
const adminWith = (permission) => [requirePermission(permission), requireRole(SYSTEM_ROLE.ADMIN)];

const roleRouter = Router();
roleRouter.use(requireAuth);

roleRouter.get(
  "/",
  ...adminWith("role.view"),
  validate(listRolesQuerySchema, { source: "query", code: ROLE_ERROR.INVALID_QUERY }),
  listRoles,
);
roleRouter.post("/", ...adminWith("role.manage"), validateBody(createRoleSchema), createRole);
roleRouter.get("/:roleId", ...adminWith("role.view"), validateRoleId, getRole);
roleRouter.patch(
  "/:roleId",
  ...adminWith("role.manage"),
  validateRoleId,
  validateBody(updateRoleSchema),
  updateRole,
);
roleRouter.put(
  "/:roleId/permissions",
  ...adminWith("permission.assign"),
  validateRoleId,
  validateBody(assignRolePermissionsSchema),
  assignRolePermissions,
);

// Predefined permission catalog (BR-33). Read-only: permissions are seeded, never created here.
const permissionRouter = Router();
permissionRouter.get("/", requireAuth, ...adminWith("permission.view"), listPermissions);

export { permissionRouter as permissionRoutes, roleRouter as roleRoutes };
