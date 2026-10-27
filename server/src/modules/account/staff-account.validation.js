import { z } from "zod";
import {
  invalidFormatMessage,
  maxLengthMessage,
  objectIdField,
  objectIdList,
  optionalText,
  requiredText,
} from "../../utils/srsMessages.js";
import {
  STAFF_MESSAGE,
  STAFF_PAGE_LIMIT_DEFAULT,
  STAFF_PAGE_LIMIT_MAX,
  STAFF_POSITION_MAX_LENGTH,
  STAFF_SORT_FIELDS,
  STAFF_STATUSES,
} from "./account.constants.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fullNameField = requiredText("Full name", { min: 2, max: 100 }).transform((value) =>
  value.replace(/\s+/g, " "),
);

const emailField = requiredText("Email", { max: 254 })
  .toLowerCase()
  .refine((value) => emailPattern.test(value), { message: invalidFormatMessage("Email") });

// Same identity rules as self-registration (auth.validation.js), with SRS 5.3 wording.
const usernameField = requiredText("Username", { min: 3, max: 30 }).refine(
  (value) => /^[A-Za-z0-9_]+$/.test(value),
  { message: invalidFormatMessage("Username") },
);

const phoneField = requiredText("Phone number", { max: 20 })
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .refine((value) => /^(?:\+84|0)\d{9,10}$/.test(value), {
    message: invalidFormatMessage("Phone number"),
  });

const branchIdField = z.preprocess(
  (value) => (value === "" ? null : value),
  objectIdField("Branch").nullable(),
);

const positionField = optionalText("Position", { max: STAFF_POSITION_MAX_LENGTH });

// BR-27 / UC35 7c / UC37 6a: at least one role.
const roleIdsField = z
  .array(objectIdField("Role"), { error: STAFF_MESSAGE.ROLE_REQUIRED })
  .min(1, STAFF_MESSAGE.ROLE_REQUIRED)
  .max(20, maxLengthMessage(20))
  .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]);

const directPermissionIdsField = objectIdList("Permission");

export const accountIdParamsSchema = z.object({ accountId: objectIdField("Account id") });

export const listStaffQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .max(100, maxLengthMessage(100))
    .optional()
    .transform((value) => value || undefined),
  status: z.enum(STAFF_STATUSES).optional(),
  roleId: objectIdField("Role").optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(STAFF_PAGE_LIMIT_MAX).default(STAFF_PAGE_LIMIT_DEFAULT),
  sort: z.enum(STAFF_SORT_FIELDS).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// UC35. No password field: credentials are set by the staff member (STAFF_MESSAGE / email).
export const createStaffSchema = z.strictObject({
  fullName: fullNameField,
  email: emailField,
  username: usernameField,
  phone: phoneField,
  roleIds: roleIdsField,
  directPermissionIds: directPermissionIdsField.default([]),
  branchId: branchIdField.optional(),
  position: positionField.optional(),
});

// UC36. Username is the sign-in identifier and stays fixed; roles have their own endpoint (UC37).
export const updateStaffSchema = z
  .strictObject({
    fullName: fullNameField.optional(),
    email: emailField.optional(),
    phone: phoneField.optional(),
    branchId: branchIdField.optional(),
    position: positionField.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update.",
  });

export const changeStaffStatusSchema = z.strictObject({
  status: z.enum(STAFF_STATUSES, { error: invalidFormatMessage("Status") }),
});

// UC37. Omitting `directPermissionIds` keeps the current direct grants (A-05).
export const assignStaffAccessSchema = z.strictObject({
  roleIds: roleIdsField,
  directPermissionIds: directPermissionIdsField.optional(),
});
