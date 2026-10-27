import { env } from "../../config/env.js";
import { bookingService } from "../booking/booking.module.js";
import { createMockPaymentGateway } from "./mock-payment-gateway.js";
import { createPaymentGatewayRouter } from "./payment-gateway-router.js";
import { createPaymentController } from "./payment.controller.js";
import { paymentRepository } from "./payment.repository.js";
import { createPaymentRouter } from "./payment.routes.js";
import { createPaymentService } from "./payment.service.js";
import { createPayosGateway } from "./payos-gateway.js";
import { ticketService } from "../ticket/ticket.module.js";

const mockPaymentGateway = createMockPaymentGateway();

// BANK_TRANSFER goes to payOS when PAYOS_* credentials are set; other methods stay on the mock.
const payosConfig = env.payos;
const paymentGateway = createPaymentGatewayRouter({
  mock: mockPaymentGateway,
  payos: payosConfig ? createPayosGateway(payosConfig) : null,
});

const paymentService = createPaymentService({
  paymentRepository,
  bookingService,
  gateway: paymentGateway,
  clientUrl: () => env.clientUrl,
  ticketPort: {
    issueTicketsForConfirmedBooking: (command) =>
      ticketService.issueTicketsForConfirmedBooking(command),
    listTicketsForBooking: (query) => ticketService.listTicketsForBooking(query),
  },
});

const paymentController = createPaymentController(paymentService);
const paymentRoutes = createPaymentRouter(paymentController);

export {
  mockPaymentGateway,
  paymentController,
  paymentGateway,
  paymentRepository,
  paymentRoutes,
  paymentService,
};
