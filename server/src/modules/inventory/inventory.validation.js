import { z } from "zod";
import {
  STOCK_IN_MAX_LINES,
  STOCK_IN_MAX_QUANTITY,
  STOCK_IN_NOTE_MAX_LENGTH,
  STOCK_LIST_LIMIT_DEFAULT,
  STOCK_LIST_LIMIT_MAX,
  STOCK_STATUSES,
} from "./inventory.constants.js";

const blankToUndefined = (value) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const objectId = (label) =>
  z.string({ error: `${label} is required` }).regex(/^[a-f\d]{24}$/i, `${label} must be a valid id`);

const pageField = z.coerce.number().int().min(1).max(10000).default(1);
const limitField = z.coerce
  .number()
  .int()
  .min(1)
  .max(STOCK_LIST_LIMIT_MAX)
  .default(STOCK_LIST_LIMIT_DEFAULT);

export const listStockLevelsQuerySchema = z.strictObject({
  q: z.preprocess(blankToUndefined, z.string().trim().max(100, "Search text is too long").optional()),
  categoryId: z.preprocess(blankToUndefined, objectId("Category").optional()),
  status: z.preprocess(
    blankToUndefined,
    z.enum(STOCK_STATUSES, { error: "Status must be IN_STOCK, LOW_STOCK or OUT_OF_STOCK" }).optional(),
  ),
  page: pageField,
  limit: limitField,
});

export const listReceiptsQuerySchema = z.strictObject({
  page: pageField,
  limit: limitField,
});

const quantityField = z
  .number({ error: "Quantity is required" })
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be greater than 0")
  .max(STOCK_IN_MAX_QUANTITY, `Quantity must not exceed ${STOCK_IN_MAX_QUANTITY}`);

const stockInLineSchema = z.strictObject({
  concessionId: objectId("Item"),
  quantity: quantityField,
});

// BR-49: every received quantity must be greater than zero. Whether `receivedAt` lies in the
// future depends on the clock, so the service checks it.
export const stockInSchema = z.strictObject({
  items: z
    .array(stockInLineSchema, { error: "Select at least one item" })
    .min(1, "Select at least one item")
    .max(STOCK_IN_MAX_LINES, `A receipt can hold at most ${STOCK_IN_MAX_LINES} items`)
    .refine(
      (items) => new Set(items.map(({ concessionId }) => concessionId.toLowerCase())).size === items.length,
      "Each item can appear only once in a receipt",
    ),
  supplierId: z.preprocess((value) => blankToUndefined(value) ?? undefined, objectId("Supplier").nullish()),
  receivedAt: z.preprocess(
    blankToUndefined,
    z.iso.datetime({ offset: true, error: "Received date must be a valid date and time" }).optional(),
  ),
  note: z.preprocess(
    blankToUndefined,
    z.string().trim().max(STOCK_IN_NOTE_MAX_LENGTH, "Note is too long").optional(),
  ),
});
