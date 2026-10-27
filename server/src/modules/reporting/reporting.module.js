import { paymentService } from "../payment/payment.module.js";
import { refundService } from "../refund/refund.module.js";
import { createRevenueReportService } from "./revenue-report.service.js";
import { dashboardService } from "./dashboard.service.js";
import { createRevenueExportService } from "./revenue-export.service.js";
import { revenueExportRepository } from "./revenue-export.repository.js";

export const revenueReportService = createRevenueReportService({
  paymentReadPort: paymentService,
  refundReadPort: refundService,
});

export const revenueExportService = createRevenueExportService({ repository: revenueExportRepository });

export { dashboardService };
