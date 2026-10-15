import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId");

export const acquireSeatHoldSchema = z.object({
  showtimeId: objectId,
  seatIds: z
    .array(objectId)
    .min(1, "Select at least one seat")
    .refine((seatIds) => new Set(seatIds).size === seatIds.length, "Seat ids must be unique"),
  checkoutKey: z.string().trim().min(8).max(200),
});

export const seatHoldIdParamsSchema = z.object({ holdId: objectId });

export const showtimeIdParamsSchema = z.object({ showtimeId: objectId });

