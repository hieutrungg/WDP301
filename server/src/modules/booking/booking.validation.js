import { z } from "zod";
import { concessionSelectionSchema } from "../concession/checkout.validation.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const createPendingBookingSchema = z.object({
  holdId: objectId,
  priceQuoteReference: z.string().trim().min(1).max(200).optional(),
  requestKey: z.string().trim().min(8).max(100),
  concessionSelection: concessionSelectionSchema.optional(),
});
export const cancelCheckoutParamsSchema = z.object({ bookingId: objectId });
