import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const createPendingBookingSchema = z.object({
  holdId: objectId,
  priceQuoteReference: z.string().trim().min(1).max(200).optional(),
  requestKey: z.string().trim().min(8).max(100),
});
