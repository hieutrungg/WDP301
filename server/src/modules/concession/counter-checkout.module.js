import {
  paymentGateway,
  paymentRepository,
} from "../payment/payment.module.js";
import { env } from "../../config/env.js";
import { createCounterConcessionCheckoutRouter } from "./counter-checkout.routes.js";
import { createCounterConcessionCheckoutService } from "./counter-checkout.service.js";

export const counterConcessionCheckoutService =
  createCounterConcessionCheckoutService({
    paymentRepository,
    gateway: paymentGateway,
    clientUrl: () => env.clientUrl,
  });
export const counterConcessionCheckoutRoutes =
  createCounterConcessionCheckoutRouter(counterConcessionCheckoutService);
