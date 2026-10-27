import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { TICKET_ERROR } from "./ticket.constants.js";
import { bookingTicketsParamsSchema, ticketParamsSchema } from "./ticket.validation.js";

// Read-only customer routes. Authorization is ownership (BR-36): the Booking read port returns
// 404/403 for a missing or foreign Booking, and a foreign ticket returns 403 TICKET_FORBIDDEN.
export const createTicketRouter = (controller) => {
  const router = Router();

  router.use(requireAuth);

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
