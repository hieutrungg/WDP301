import { Router } from "express";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { AppError } from "../../utils/AppError.js";
import { PAYMENT_ERROR_CODE, PAYMENT_METHOD } from "./payment.constants.js";
import {
  bookingPaymentParamsSchema,
  cancelPaymentAttemptSchema,
  confirmCounterCashSchema,
  initiatePaymentSchema,
  paymentAttemptParamsSchema,
  simulatePaymentNotificationSchema,
} from "./payment.validation.js";

export const requireNonProductionSimulationGate = (
  getNodeEnv = () => process.env.NODE_ENV ?? env.nodeEnv,
) => (req, _res, next) => {
  if (String(getNodeEnv()).toLowerCase() === "production") {
    return next(
      new AppError(
        404,
        "Mock payment simulation endpoint is disabled in production",
        [],
        PAYMENT_ERROR_CODE.MOCK_SIMULATION_DISABLED,
      ),
    );
  }
  return next();
};

// Cash is a counter-only capability. Keep the shared initiation route for the
// common Payment lifecycle, but enforce the staff boundary before validation
// and before the service can create a CASH attempt.
export const requireCounterCashActor = (req, res, next) => {
  if (req.body?.method !== PAYMENT_METHOD.CASH) return next();

  return requirePermission("booking.create")(req, res, (permissionError) => {
    if (permissionError) return next(permissionError);
    return requireRole("STAFF")(req, res, next);
  });
};

export const createPaymentRouter = (
  controller,
  { getNodeEnv } = {},
) => {
  const router = Router();

  // Public: payOS calls this server-to-server. The checksum signature is the authentication;
  // settlement is then re-checked against the payOS API before any state changes.
  if (controller.payosWebhook) {
    router.post("/providers/payos/webhook", controller.payosWebhook);
  }

  router.use(requireAuth);

  router.get("/me/bookings", controller.listMyBookings);

  if (controller.confirmCounterCash) {
    router.post(
      "/:paymentId/attempts/:attemptId/cash-confirm",
      requirePermission("booking.create"),
      requireRole("STAFF"),
      validate(paymentAttemptParamsSchema, {
        source: "params",
        code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
      }),
      validate(confirmCounterCashSchema, {
        code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
      }),
      controller.confirmCounterCash,
    );
  }

  router.post(
    "/",
    requireCounterCashActor,
    validate(initiatePaymentSchema, { code: PAYMENT_ERROR_CODE.INVALID_PAYMENT }),
    controller.initiate,
  );

  router.get(
    "/bookings/:bookingId",
    validate(bookingPaymentParamsSchema, {
      source: "params",
      code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
    }),
    controller.getByBooking,
  );

  router.post(
    "/:paymentId/attempts/:attemptId/cancel",
    validate(paymentAttemptParamsSchema, {
      source: "params",
      code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
    }),
    validate(cancelPaymentAttemptSchema, {
      code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
    }),
    controller.cancelAttempt,
  );

  // Owner asks the server to check a bank-transfer attempt with payOS (polling from C14/C15).
  if (controller.verifyProviderAttempt) {
    router.post(
      "/:paymentId/attempts/:attemptId/verify",
      validate(paymentAttemptParamsSchema, {
        source: "params",
        code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
      }),
      controller.verifyProviderAttempt,
    );
  }

  router.post(
    "/:paymentId/attempts/:attemptId/simulate",
    requireNonProductionSimulationGate(getNodeEnv),
    validate(paymentAttemptParamsSchema, {
      source: "params",
      code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
    }),
    validate(simulatePaymentNotificationSchema, {
      code: PAYMENT_ERROR_CODE.INVALID_PAYMENT,
    }),
    controller.simulateNotification,
  );

  return router;
};
