import { z } from "zod";
import {
  BRANCH_PAGE_LIMIT_DEFAULT,
  BRANCH_PAGE_LIMIT_MAX,
  BRANCH_SORT_FIELDS,
  BRANCH_STATUSES,
} from "./branch.constants.js";

const collapseSpaces = (value) => value.replace(/\s+/g, " ");
const blankToNull = (value) => (typeof value === "string" && value.trim() === "" ? null : value);

const branchNameField = z
  .string({ error: "Branch name is required" })
  .trim()
  .min(2, "Branch name must be at least 2 characters")
  .max(120, "Branch name is too long")
  .transform(collapseSpaces);

const addressField = z
  .string({ error: "Address is required" })
  .trim()
  .min(5, "Address must be at least 5 characters")
  .max(300, "Address is too long")
  .transform(collapseSpaces);

// Optional contact fields: an empty string or null clears the stored value.
const optionalEmailField = z.preprocess(
  blankToNull,
  z
    .string({ error: "Email must be text" })
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254, "Email is too long")
    .nullable(),
);

const optionalHotlineField = z.preprocess(
  blankToNull,
  z
    .string({ error: "Hotline must be text" })
    .trim()
    .transform((value) => value.replace(/[\s.()-]/g, ""))
    .refine((value) => /^\+?\d{4,15}$/.test(value), "Enter a valid hotline number (4-15 digits)")
    .nullable(),
);

const statusField = z.enum(BRANCH_STATUSES, { error: "Status must be ACTIVE or INACTIVE" });

export const branchIdParamsSchema = z.object({
  branchId: z.string().regex(/^[a-f\d]{24}$/i, "Branch id must be a valid ObjectId"),
});

export const listBranchesQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .max(100, "Search text is too long")
    .optional()
    .transform((value) => value || undefined),
  status: statusField.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(BRANCH_PAGE_LIMIT_MAX).default(BRANCH_PAGE_LIMIT_DEFAULT),
  sort: z.enum(BRANCH_SORT_FIELDS).default("branchName"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const publicCinemasQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .max(100, "Search text is too long")
    .optional()
    .transform((value) => value || undefined),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(BRANCH_PAGE_LIMIT_MAX).default(20),
});

export const createBranchSchema = z.object({
  branchName: branchNameField,
  address: addressField,
  email: optionalEmailField.optional(),
  hotline: optionalHotlineField.optional(),
  status: statusField.optional().default("ACTIVE"),
});

// Status is changed only through PATCH /:branchId/status so the A-24 guard always runs.
export const updateBranchSchema = z
  .object({
    branchName: branchNameField.optional(),
    address: addressField.optional(),
    email: optionalEmailField.optional(),
    hotline: optionalHotlineField.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export const changeBranchStatusSchema = z.object({
  status: statusField,
});
