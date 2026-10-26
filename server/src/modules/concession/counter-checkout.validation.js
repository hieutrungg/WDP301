import { z } from "zod";
import { concessionItemsSchema } from "./checkout.validation.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const createCounterConcessionOrderSchema = z
  .object({
    branchId: objectId,
    items: concessionItemsSchema.refine((items) => items.length > 0, "Select at least one item"),
    method: z.enum(["CASH", "VNPAY_QR"]),
    idempotencyKey: z.string().trim().min(8).max(120),
    tenderedAmount: z.number().int().nonnegative().optional(),
  })
  .strict();

export const counterConcessionOrderParamsSchema = z.object({ orderId: objectId });
