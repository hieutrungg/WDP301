import { createRefundController } from "./refund.controller.js";
import { mockRefundProvider } from "./mock-refund-provider.js";
import { refundRepository } from "./refund.repository.js";
import { createRefundRouter } from "./refund.routes.js";
import { createRefundService } from "./refund.service.js";
import { withTicketCheckInStatus } from "../ticket/ticket-refund.adapter.js";
import { ticketService } from "../ticket/ticket.module.js";

export const refundService = createRefundService({
  // TICKET-101: checked-in state comes from the Ticket module (was hard-coded false).
  repository: withTicketCheckInStatus(refundRepository, ticketService),
  provider: mockRefundProvider,
});
export const refundRoutes = createRefundRouter(createRefundController(refundService));
