import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { TICKET_ERROR } from "./ticket.constants.js";
import {
  bookingTicketsParamsSchema,
  checkInTicketSchema,
  ticketParamsSchema,
} from "./ticket.validation.js";

// Read-only customer routes. Authorization is ownership (BR-36): the Booking read port returns
// 404/403 for a missing or foreign Booking, and a foreign ticket returns 403 TICKET_FORBIDDEN.
export const createTicketRouter = (controller) => {
  const router = Router();

  router.use(requireAuth);

  // TICKET-101: Staff (or a Manager on the floor) check a ticket in by its code. ticket.validate
  // is granted to STAFF and MANAGER in the seed; the role is checked as well.
  if (controller.checkIn) {
    router.post(
      "/check-in",
      requirePermission("ticket.validate"),
      requireRole("STAFF", "MANAGER"),
      validate(checkInTicketSchema, { code: TICKET_ERROR.CHECK_IN_VALIDATION_FAILED }),
      controller.checkIn,
    );
  }

  router.get(
    "/bookings/:bookingId",
    validate(bookingTicketsParamsSchema, {
      source: "params",
      code: TICKET_ERROR.INVALID_TICKET_ID,
    }),
    controller.listByBooking,
  );

  router.get(
    "/:ticketId",
    validate(ticketParamsSchema, {
      source: "params",
      code: TICKET_ERROR.INVALID_TICKET_ID,
    }),
    controller.getById,
  );

  return router;
};
