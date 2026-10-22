import { bookingService } from "../booking/booking.module.js";
import { createMockPaymentGateway } from "./mock-payment-gateway.js";
import { createPaymentController } from "./payment.controller.js";
import { paymentRepository } from "./payment.repository.js";
import { createPaymentRouter } from "./payment.routes.js";
import { createPaymentService } from "./payment.service.js";

const mockPaymentGateway = createMockPaymentGateway();

const paymentService = createPaymentService({
  paymentRepository,
  bookingService,
  gateway: mockPaymentGateway,
});

const paymentController = createPaymentController(paymentService);
const paymentRoutes = createPaymentRouter(paymentController);

export {
  mockPaymentGateway,
  paymentController,
  paymentRepository,
  paymentRoutes,
  paymentService,
};
