import { z } from "zod";
import { percentageBasisPoints } from "./promotion.policy.js";

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ID");
export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9_-]{3,40}$/,
    "Use 3–40 letters, numbers, underscores or hyphens",
  );
const status = z.enum(["ACTIVE", "INACTIVE"]);
const percentage = z.number().refine((value) => {
  try {
    percentageBasisPoints(value);
    return true;
  } catch {
    return false;
  }
}, "Enter 0 < percentage <= 20, with up to two decimals");
const date = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const fields = {
  name: z.string().trim().min(1).max(150),
  discountValue: percentage,
  startDate: date,
  endDate: date,
  status,
};
export const createPromotionSchema = z
  .object(fields)
  .strict()
  .refine((v) => v.startDate < v.endDate, {
    path: ["endDate"],
    message: "End must be after start",
  });
export const updatePromotionSchema = z
  .object({
    ...Object.fromEntries(
      Object.entries(fields).map(([key, schema]) => [key, schema.optional()]),
    ),
    expectedVersion: z.number().int().nonnegative().safe(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Provide a change");
const usageLimit = z.number().int().positive().safe().nullable();
export const createVoucherSchema = z
  .object({ code: codeSchema, usageLimit, status })
  .strict();
export const updateVoucherSchema = z
  .object({
    usageLimit: usageLimit.optional(),
    status: status.optional(),
    expectedVersion: z.number().int().nonnegative().safe(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Provide a change");
export const listSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(150).optional(),
    status: status.optional(),
  })
  .strict();
export const quoteVoucherSchema = z.object({ code: codeSchema }).strict();
const command = {
  requestKey: z.string().min(1).max(100),
  expectedPricingVersion: z.number().int().nonnegative().safe(),
};
export const applyVoucherSchema = z
  .object({ ...command, code: codeSchema })
  .strict();
export const removeVoucherSchema = z.object(command).strict();
