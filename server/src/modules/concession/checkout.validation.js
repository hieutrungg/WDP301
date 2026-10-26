import { z } from "zod";
const id = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .transform((value) => value.toLowerCase());
export const concessionItemsSchema = z
  .array(
    z
      .object({
        itemType: z.enum(["CONCESSION", "COMBO"]),
        itemId: id,
        quantity: z.number().int().min(1).max(100),
      })
      .strict(),
  )
  .max(50)
  .refine(
    (items) =>
      new Set(items.map((item) => `${item.itemType}:${item.itemId}`)).size ===
      items.length,
    "Duplicate items",
  );
export const concessionQuoteSchema = z
  .object({ holdId: id, items: concessionItemsSchema })
  .strict();
export const concessionSelectionSchema = z
  .object({
    quoteReference: z.string().regex(/^[a-f0-9]{64}$/),
    items: concessionItemsSchema.refine(
      (items) => items.length > 0,
      "Select at least one item",
    ),
  })
  .strict();
