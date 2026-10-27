import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import accountRoutes from "./modules/account/account.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import branchRoutes from "./modules/branch/branch.routes.js";
import cinemaRoutes from "./modules/branch/cinema.routes.js";
import movieRoutes from "./modules/movie/movie.routes.js";
import showtimeRoutes from "./modules/showtime/showtime.routes.js";
import roomRoutes from "./modules/room/room.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import concessionRoutes from "./modules/concession/concession.routes.js";
import staffShiftRoutes from "./modules/staff-shift/staff-shift.routes.js";
import {
  bookingRoutes,
  concessionCheckoutRoutes,
  seatAvailabilityRoutes,
  seatHoldRoutes,
} from "./modules/booking/booking.module.js";
import { paymentRoutes } from "./modules/payment/payment.module.js";
import { refundRoutes } from "./modules/refund/refund.module.js";
import reportingRoutes from "./modules/reporting/reporting.routes.js";
import revenueExportRoutes from "./modules/reporting/revenue-export.routes.js";
import { ticketRoutes } from "./modules/ticket/ticket.module.js";
import { counterConcessionCheckoutRoutes } from "./modules/concession/counter-checkout.module.js";
import { notFound } from "./middlewares/notFoundMiddleware.js";
import { errorHandler } from "./middlewares/errorMiddleware.js";
import { env } from "./config/env.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/cinemas", cinemaRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api", showtimeRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/showtimes/:showtimeId/seats", seatAvailabilityRoutes);
app.use("/api/seat-holds", seatHoldRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api", concessionRoutes);
app.use("/api/staff-shifts", staffShiftRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/concession-checkout", concessionCheckoutRoutes);
app.use("/api/counter-concessions", counterConcessionCheckoutRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/refunds", refundRoutes);
app.use("/api/analytics", reportingRoutes);
app.use("/api/reports", revenueExportRoutes);
app.use("/api/tickets", ticketRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
