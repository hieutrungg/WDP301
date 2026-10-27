import { bookingService } from "../booking/booking.module.js";
import { createTicketController } from "./ticket.controller.js";
import { ticketRepository } from "./ticket.repository.js";
import { createTicketRouter } from "./ticket.routes.js";
import { createTicketService } from "./ticket.service.js";

// Booking read contract consumed by Ticket: owner-scoped details including resolved seat labels
// and the Showtime projection used for the issuance snapshot.
const bookingReader = {
  getBookingDetails: ({ bookingId, ownerId }) =>
    bookingService.getCustomerBookingDetails({ bookingId, ownerId }),
};

export const ticketService = createTicketService({ ticketRepository, bookingReader });

export const ticketRoutes = createTicketRouter(createTicketController(ticketService));
