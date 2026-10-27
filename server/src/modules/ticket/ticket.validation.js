import { z } from "zod";
import { TICKET_CODE_PATTERN } from "./ticket.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const bookingTicketsParamsSchema = z.object({ bookingId: objectId });

export const ticketParamsSchema = z.object({ ticketId: objectId });

// TICKET-101: Staff type or paste the ticket code (no camera scan). Case and spaces are ignored.
export const checkInTicketSchema = z.strictObject({
  ticketCode: z
    .string({ error: "The Ticket code field is required." })
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .refine((value) => value.length > 0, { message: "The Ticket code field is required.", abort: true })
    .refine((value) => TICKET_CODE_PATTERN.test(value), { message: "The Ticket code format is invalid." }),
});
