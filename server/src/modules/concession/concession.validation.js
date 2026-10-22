import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId")
  .transform((value) => value.toLowerCase());
// Start from a scalar string so repeated pagination queries cannot be coerced from arrays.
const positiveInteger = (max) =>
  z
    .string()
    .regex(/^[1-9]\d*$/, "Must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));
const pagination = {
  page: positiveInteger(Math.floor(Number.MAX_SAFE_INTEGER / 100)).default(1),
  limit: positiveInteger(100).default(20),
};

export const categoriesQuery = z.strictObject(pagination);
export const concessionsQuery = z.strictObject({
  branchId: objectId,
  categoryId: objectId.optional(),
  ...pagination,
});
export const combosQuery = z.strictObject({
  branchId: objectId,
  ...pagination,
});
export const detailQuery = z.strictObject({ branchId: objectId });
export const concessionParams = z.strictObject({ concessionId: objectId });
export const comboParams = z.strictObject({ comboId: objectId });
