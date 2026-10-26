import { mockPaymentGateway, paymentRepository } from "../payment/payment.module.js";
import { createCounterConcessionCheckoutRouter } from "./counter-checkout.routes.js";
import { createCounterConcessionCheckoutService } from "./counter-checkout.service.js";

export const counterConcessionCheckoutService = createCounterConcessionCheckoutService({
  paymentRepository,
  gateway: mockPaymentGateway,
});
export const counterConcessionCheckoutRoutes = createCounterConcessionCheckoutRouter(counterConcessionCheckoutService);
