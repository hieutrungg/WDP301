import { createRefundController } from "./refund.controller.js";
import { mockRefundProvider } from "./mock-refund-provider.js";
import { refundRepository } from "./refund.repository.js";
import { createRefundRouter } from "./refund.routes.js";
import { createRefundService } from "./refund.service.js";

export const refundService = createRefundService({ repository: refundRepository, provider: mockRefundProvider });
export const refundRoutes = createRefundRouter(createRefundController(refundService));
