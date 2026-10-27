import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const bookingTicketsParamsSchema = z.object({ bookingId: objectId });

export const ticketParamsSchema = z.object({ ticketId: objectId });
