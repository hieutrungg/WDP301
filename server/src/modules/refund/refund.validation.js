import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");
export const requestRefundSchema = z.strictObject({
  bookingId: objectId,
  reason: z.string().trim().min(5).max(500),
});
export const refundParamsSchema = z.strictObject({ refundId: objectId });
export const rejectRefundSchema = z.strictObject({ reason: z.string().trim().min(5).max(500) });
