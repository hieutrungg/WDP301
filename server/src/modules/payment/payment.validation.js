import { z } from "zod";
import {
  PAYMENT_METHOD_VALUES,
  PAYMENT_SIMULATION_OUTCOME_VALUES,
} from "./payment.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

export const initiatePaymentSchema = z.object({
  bookingId: objectId,
  method: z.enum(PAYMENT_METHOD_VALUES),
  idempotencyKey: z.string().trim().min(8).max(120),
  amount: z.number().int().nonnegative().optional(),
  contactDetails: z
    .object({
      fullName: z.string().trim().max(120).optional(),
      email: z.string().trim().max(160).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .optional(),
});

export const bookingPaymentParamsSchema = z.object({
  bookingId: objectId,
});

export const paymentAttemptParamsSchema = z.object({
  paymentId: objectId,
  attemptId: z.string().trim().min(4).max(120),
});

export const cancelPaymentAttemptSchema = z.object({
  reason: z.string().trim().min(1).max(200).optional(),
});

export const simulatePaymentNotificationSchema = z.object({
  outcome: z.enum(PAYMENT_SIMULATION_OUTCOME_VALUES).default("SUCCESS"),
  notificationKey: z.string().trim().min(4).max(120).optional(),
  failureReason: z.string().trim().min(1).max(200).optional(),
});
