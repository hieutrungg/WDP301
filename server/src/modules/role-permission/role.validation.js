import { z } from "zod";
import {
  invalidFormatMessage,
  objectIdField,
  objectIdList,
  optionalText,
  requiredText,
} from "../../utils/srsMessages.js";
import {
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_KINDS,
  ROLE_NAME_MAX_LENGTH,
  ROLE_PAGE_LIMIT_DEFAULT,
  ROLE_PAGE_LIMIT_MAX,
  ROLE_SORT_FIELDS,
} from "./role.constants.js";

const roleNameField = requiredText("Role name", { min: 2, max: ROLE_NAME_MAX_LENGTH })
  .transform((value) => value.replace(/\s+/g, " "))
  .refine((value) => /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(value), {
    message: invalidFormatMessage("Role name"),
  });

const descriptionField = optionalText("Description", { max: ROLE_DESCRIPTION_MAX_LENGTH });
const permissionIdsField = objectIdList("Permission");
const confirmField = z.boolean({ error: "Confirmation must be true or false." }).optional().default(false);

export const roleIdParamsSchema = z.object({ roleId: objectIdField("Role id") });

export const listRolesQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .max(100, "Exceed max length of 100.")
    .optional()
    .transform((value) => value || undefined),
  kind: z.enum(ROLE_KINDS).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(ROLE_PAGE_LIMIT_MAX).default(ROLE_PAGE_LIMIT_DEFAULT),
  sort: z.enum(ROLE_SORT_FIELDS).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

// UC45. `confirmNoPermissions` records the CR-05 confirmation for a role with no access rights.
export const createRoleSchema = z.strictObject({
  name: roleNameField,
  description: descriptionField.optional(),
  permissionIds: permissionIdsField.default([]),
  confirmNoPermissions: confirmField,
});

// UC46. `confirmAffectedAccounts` acknowledges that active accounts holding the role are affected.
export const updateRoleSchema = z
  .strictObject({
    name: roleNameField.optional(),
    description: descriptionField.optional(),
    permissionIds: permissionIdsField.optional(),
    confirmNoPermissions: confirmField,
    confirmAffectedAccounts: confirmField,
  })
  .refine(
    (data) => ["name", "description", "permissionIds"].some((field) => data[field] !== undefined),
    { message: "Provide at least one field to update." },
  );

// UC47: replaces the role's permission set with the selection.
export const assignRolePermissionsSchema = z.strictObject({
  permissionIds: permissionIdsField,
  confirmNoPermissions: confirmField,
  confirmAffectedAccounts: confirmField,
});
