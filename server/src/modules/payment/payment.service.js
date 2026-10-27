import crypto from "node:crypto";
import { AppError } from "../../utils/AppError.js";
import {
  BOOKING_CONFIRMATION_OUTCOME,
  BOOKING_STATUS,
} from "../booking/booking.constants.js";
import {
  PAYMENT_ATTEMPT_STATUS,
  PAYMENT_CURRENCY,
  PAYMENT_ERROR_CODE,
  PAYMENT_ACCEPTED_METHOD_VALUES,
  PAYMENT_MESSAGE,
  PAYMENT_PROVIDER,
  PAYMENT_RECONCILIATION_REASON,
  PAYMENT_SIMULATION_OUTCOME,
  PAYMENT_STATUS,
} from "./payment.constants.js";
import { createMockPaymentGateway } from "./mock-payment-gateway.js";
import { PAYOS_LINK_STATUS } from "./payos-gateway.js";
import { summarizeTicketIssuance } from "../ticket/ticket.service.js";

const paymentError = (status, message, code) =>
  new AppError(status, message, [], code);

const buildAttemptId = (now = new Date()) =>
  `ATT-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;

const sanitizeContactDetails = (contactDetails) => {
  if (!contactDetails || typeof contactDetails !== "object") {
    return null;
  }

  return {
    fullName: String(contactDetails.fullName || "").trim().slice(0, 120),
    email: String(contactDetails.email || "").trim().slice(0, 160),
    phone: String(contactDetails.phone || "").trim().slice(0, 40),
  };
};

const toAttemptDto = (attempt) => {
  if (!attempt) {
    return null;
  }

  return {
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    idempotencyKey: attempt.idempotencyKey,
    provider: attempt.provider,
    method: attempt.method,
    amount: attempt.amount,
    currency: attempt.currency || PAYMENT_CURRENCY,
    status: attempt.status,
    gatewayTransactionRef: attempt.gatewayTransactionRef,
    qrPayload: attempt.qrPayload,
    instruction: attempt.instruction || null,
    failureReason: attempt.failureReason || null,
    createdAt: attempt.createdAt,
    completedAt: attempt.completedAt || null,
    expiresAt: attempt.expiresAt,
  };
};

const toPaymentDto = (payment) => {
  if (!payment) {
    return null;
  }

  const attempts = (payment.attempts || []).map(toAttemptDto);

  return {
    paymentId: String(payment._id),
    bookingId: String(payment.bookingId),
    payableReference: payment.payableReference,
    customerAccountId: String(payment.customerAccountId),
    amount: payment.amount,
    currency: payment.currency || PAYMENT_CURRENCY,
    method: payment.method,
    status: payment.status,
    settlementAttemptId: payment.settlementAttemptId || null,
    settlementReference: payment.settlementReference || null,
    reconciliationReason: payment.reconciliationReason || null,
    paidAt: payment.paidAt || null,
    expiresAt: payment.expiresAt || null,
    contactDetails: payment.gatewayResponse?.contactDetails || null,
    attempts,
    attemptCount: attempts.length,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
};

const toBookingSummary = (booking) => {
  if (!booking) {
    return null;
  }

  const seatIds = (booking.seatIds || []).map(String);
  const totalAmount = booking.totalAmount ?? booking.amount ?? 0;

  return {
    bookingId: String(booking._id || booking.bookingId),
    bookingCode: booking.bookingCode || null,
    holdId: String(booking.holdId),
    showtimeId: String(booking.showtimeId),
    customerAccountId: String(booking.customerAccountId),
    seatIds,
    seatCount: booking.seatCount ?? seatIds.length,
    seatLines: booking.seatLines || [],
    seats: booking.seats || [],
    subtotal: booking.subtotal ?? totalAmount,
    ...(booking.concessionAmount !== undefined ? { ticketAmount: booking.subtotal, concessionAmount: booking.concessionAmount } : {}),
    discountAmount: booking.discountAmount ?? 0,
    amount: totalAmount,
    totalAmount,
    currency: booking.currency || PAYMENT_CURRENCY,
    priceQuoteReference: booking.priceQuoteReference || null,
    payableReference: booking.payableReference,
    status: booking.status,
    bookingTime: booking.bookingTime || null,
    expiresAt: booking.expiresAt,
    confirmedAt: booking.confirmedAt || null,
    expiredAt: booking.expiredAt || null,
  };
};

const pickLatestAttempt = (payment) => {
  const attempts = payment?.attempts || [];
  if (attempts.length === 0) {
    return null;
  }

  return attempts[attempts.length - 1];
};

const isConfirmedAndPaid = (booking, payment) =>
  booking?.status === BOOKING_STATUS.CONFIRMED &&
  payment?.status === PAYMENT_STATUS.PAID;

// `ticketPort` is the Ticket module contract (TICKET-001). Tickets are issued only after the PAID
// settlement is persisted (A-23); every call is idempotent per booking seat.
export const createPaymentService = ({
  paymentRepository,
  bookingService,
  gateway = createMockPaymentGateway(),
  ticketPort = null,
  now = () => new Date(),
  clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173",
  providerCheckIntervalMs = 2000,
}) => {
  const isProviderAttempt = (attempt) => attempt?.provider === PAYMENT_PROVIDER.PAYOS;

  // A provider link that can no longer settle locally (superseded, cancelled, simulated) is
  // cancelled at payOS too, so the customer cannot pay it later. Best effort: payOS may already
  // have expired or paid it, and that must not fail the local transition.
  const releaseProviderAttempt = async (attempt, reason) => {
    if (!isProviderAttempt(attempt) || typeof gateway.cancelAttempt !== "function") return;
    try {
      await gateway.cancelAttempt(attempt, reason);
    } catch (error) {
      console.error(`payOS link ${attempt.providerOrderCode} not cancelled:`, error.message);
    }
  };

  const lastProviderCheck = new Map();

  // Payment is already settled when this runs, so an issuance failure must not turn the verified
  // payment into an error. The next read of the booking retries through resolveTicketIssuance.
  const issueTicketsAfterSettlement = async (payment) => {
    if (!ticketPort || payment?.status !== PAYMENT_STATUS.PAID) return;
    try {
      await ticketPort.issueTicketsForConfirmedBooking({
        bookingId: payment.bookingId,
        ownerId: payment.customerAccountId,
        paymentId: payment._id,
      });
    } catch (error) {
      console.error(
        `Ticket issuance deferred for booking ${String(payment.bookingId)}:`,
        error.message,
      );
    }
  };

  const resolveTicketIssuance = async (booking, payment) => {
    const eligible = isConfirmedAndPaid(booking, payment);
    if (!eligible || !ticketPort) {
      return summarizeTicketIssuance({ isConfirmedAndPaid: eligible, tickets: [] });
    }
    let tickets = await ticketPort.listTicketsForBooking({ bookingId: booking.bookingId });
    const seatCount = (booking.seatIds ?? []).length;
    if (tickets.length < seatCount) {
      await issueTicketsAfterSettlement(payment);
      tickets = await ticketPort.listTicketsForBooking({ bookingId: booking.bookingId });
    }
    return summarizeTicketIssuance({ isConfirmedAndPaid: true, tickets });
  };
  const paymentLocks = new Map();

  const withPaymentLock = async (lockKey, fn) => {
    const key = String(lockKey);
    const previous = paymentLocks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    paymentLocks.set(key, chained);

    try {
      await previous;
      return await fn();
    } finally {
      release();
      if (paymentLocks.get(key) === chained) {
        paymentLocks.delete(key);
      }
    }
  };

  const ensurePaymentOwnership = (payment, ownerId) => {
    if (!payment) {
      throw paymentError(
        404,
        "Payment not found",
        PAYMENT_ERROR_CODE.PAYMENT_NOT_FOUND,
      );
    }

    if (
      ownerId &&
      String(payment.customerAccountId) !== String(ownerId)
    ) {
      throw paymentError(
        403,
        "Payment belongs to another customer",
        PAYMENT_ERROR_CODE.PAYMENT_FORBIDDEN,
      );
    }
  };

  return {
    getSuccessfulRevenueTotals: ({ fromAt, toAt, session } = {}) =>
      paymentRepository.aggregateSuccessfulRevenue({ fromAt, toAt, session }),
    initiatePayment: async ({
      bookingId,
      ownerId,
      method,
      idempotencyKey,
      amount,
      contactDetails,
    }) => {
      if (!PAYMENT_ACCEPTED_METHOD_VALUES.includes(method)) {
        throw paymentError(
          400,
          "Unsupported payment method",
          PAYMENT_ERROR_CODE.INVALID_PAYMENT,
        );
      }

      const booking = await bookingService.getBookingForPayment({
        bookingId,
        ownerId,
      });

      if (
        amount !== undefined &&
        amount !== null &&
        Number(amount) !== Number(booking.totalAmount)
      ) {
        throw paymentError(
          400,
          "Submitted payment amount does not match authoritative booking total amount",
          PAYMENT_ERROR_CODE.PAYMENT_AMOUNT_MISMATCH,
        );
      }

      return withPaymentLock(booking._id, async () => {
        const currentNow = now();

        const existingByKey =
          await paymentRepository.findByAttemptIdempotencyKey(idempotencyKey);
        if (existingByKey) {
          if (String(existingByKey.bookingId) !== String(booking._id)) {
            throw paymentError(
              409,
              "Idempotency key was already used for a different booking",
              PAYMENT_ERROR_CODE.PAYMENT_IDEMPOTENCY_KEY_REUSED,
            );
          }

          const matchedAttempt = (existingByKey.attempts || []).find(
            (item) => item.idempotencyKey === idempotencyKey,
          );

          if (!matchedAttempt || matchedAttempt.method !== method) {
            throw paymentError(
              409,
              "Idempotency key was already used with different payment parameters",
              PAYMENT_ERROR_CODE.PAYMENT_IDEMPOTENCY_KEY_REUSED,
            );
          }

          return {
            idempotent: true,
            booking: toBookingSummary(booking),
            payment: toPaymentDto(existingByKey),
            activeAttempt: toAttemptDto(matchedAttempt),
          };
        }

        let payment = await paymentRepository.findByBookingId(booking._id);

        if (
          payment?.status === PAYMENT_STATUS.PAID ||
          booking.status === BOOKING_STATUS.CONFIRMED
        ) {
          throw paymentError(
            409,
            "Booking payment has already been settled",
            PAYMENT_ERROR_CODE.PAYMENT_ALREADY_SETTLED,
          );
        }

        if (payment?.status === PAYMENT_STATUS.REVIEW_REQUIRED) {
          throw paymentError(
            409,
            "Payment is under late-settlement reconciliation and cannot start a new attempt",
            PAYMENT_ERROR_CODE.BOOKING_ALREADY_EXPIRED,
          );
        }

        const isBookingExpired =
          booking.status === BOOKING_STATUS.EXPIRED ||
          booking.status === BOOKING_STATUS.CANCELLED ||
          new Date(booking.expiresAt).getTime() <= currentNow.getTime();

        if (isBookingExpired) {
          if (payment && payment.status === PAYMENT_STATUS.PENDING) {
            const expiredAttempts = (payment.attempts || []).map((item) =>
              item.status === PAYMENT_ATTEMPT_STATUS.PENDING
                ? {
                    ...item,
                    status: PAYMENT_ATTEMPT_STATUS.EXPIRED,
                    completedAt: currentNow,
                    failureReason: "BOOKING_EXPIRED",
                  }
                : item,
            );
            await paymentRepository.saveState(payment._id, {
              status: PAYMENT_STATUS.EXPIRED,
              attempts: expiredAttempts,
            });
          }

          // UC30 A1 (hold expired before payment): code unchanged, SRS MSG14 as display text.
          throw paymentError(
            409,
            PAYMENT_MESSAGE.MSG14_SEAT_HOLD_EXPIRED,
            PAYMENT_ERROR_CODE.BOOKING_ALREADY_EXPIRED,
          );
        }

        const sanitizedContact = sanitizeContactDetails(contactDetails);

        if (!payment) {
          payment = await paymentRepository.create({
            bookingId: booking._id,
            payableReference: booking.payableReference,
            customerAccountId: booking.customerAccountId,
            method,
            amount: booking.totalAmount,
            currency: PAYMENT_CURRENCY,
            status: PAYMENT_STATUS.PENDING,
            settlementAttemptId: null,
            settlementReference: null,
            reconciliationReason: null,
            gatewayTransactionId: `PAY-${booking.payableReference}`,
            paidAt: null,
            expiresAt: booking.expiresAt,
            gatewayResponse: {
              provider: "INTERNAL_MOCK_GATEWAY",
              contactDetails: sanitizedContact,
            },
            attempts: [],
            processedNotificationKeys: [],
          });
        }

        const priorAttempts = (payment.attempts || []).map((item) =>
          item.status === PAYMENT_ATTEMPT_STATUS.PENDING
            ? {
                ...item,
                status: PAYMENT_ATTEMPT_STATUS.CANCELLED,
                completedAt: currentNow,
                failureReason: "SUPERSEDED_BY_NEW_ATTEMPT",
              }
            : item,
        );

        const attemptId = buildAttemptId(currentNow);
        const attemptNumber = priorAttempts.length + 1;
        const baseUrl = String(clientUrl()).replace(/\/+$/, "");
        const instruction = await gateway.createAttemptInstruction({
          paymentId: payment._id,
          attemptId,
          payableReference: booking.payableReference,
          method,
          amount: booking.totalAmount,
          currency: PAYMENT_CURRENCY,
          expiresAt: booking.expiresAt,
          // payOS redirects: success lands on C15 (which re-verifies), cancel back on C14.
          returnUrl: `${baseUrl}/bookings/${String(booking._id)}/confirmation`,
          cancelUrl: `${baseUrl}/booking/${String(booking.showtimeId)}/checkout`,
        });

        const newAttempt = {
          attemptId,
          attemptNumber,
          idempotencyKey,
          provider: instruction.provider,
          method,
          amount: booking.totalAmount,
          currency: PAYMENT_CURRENCY,
          status: PAYMENT_ATTEMPT_STATUS.PENDING,
          gatewayTransactionRef: instruction.gatewayTransactionRef,
          ...(instruction.providerOrderCode
            ? { providerOrderCode: instruction.providerOrderCode }
            : {}),
          qrPayload: instruction.qrPayload,
          instruction,
          failureReason: null,
          notificationKey: null,
          createdAt: currentNow,
          completedAt: null,
          expiresAt: booking.expiresAt,
        };

        const nextAttempts = [...priorAttempts, newAttempt];
        const updatedPayment = await paymentRepository.saveState(payment._id, {
          method,
          status: PAYMENT_STATUS.PENDING,
          gatewayTransactionId: instruction.gatewayTransactionRef,
          gatewayResponse: {
            ...(payment.gatewayResponse || {}),
            provider: instruction.provider,
            latestAttemptId: attemptId,
            contactDetails:
              sanitizedContact || payment.gatewayResponse?.contactDetails || null,
          },
          attempts: nextAttempts,
        });

        const superseded = (payment.attempts || []).filter(
          (item) => item.status === PAYMENT_ATTEMPT_STATUS.PENDING,
        );
        for (const item of superseded) {
          await releaseProviderAttempt(item, "SUPERSEDED_BY_NEW_ATTEMPT");
        }

        return {
          idempotent: false,
          booking: toBookingSummary(booking),
          payment: toPaymentDto(updatedPayment),
          activeAttempt: toAttemptDto(newAttempt),
        };
      });
    },

    cancelPaymentAttempt: async ({ paymentId, attemptId, ownerId, reason }) => {
      const initialPayment = await paymentRepository.findById(paymentId);
      ensurePaymentOwnership(initialPayment, ownerId);

      return withPaymentLock(initialPayment.bookingId, async () => {
        const currentNow = now();
        const payment = await paymentRepository.findById(paymentId);
        ensurePaymentOwnership(payment, ownerId);

        const attemptIndex = (payment.attempts || []).findIndex(
          (item) => item.attemptId === attemptId,
        );
        if (attemptIndex === -1) {
          throw paymentError(
            404,
            "Payment attempt not found",
            PAYMENT_ERROR_CODE.PAYMENT_ATTEMPT_NOT_FOUND,
          );
        }

        const attempt = payment.attempts[attemptIndex];
        if (attempt.status === PAYMENT_ATTEMPT_STATUS.CANCELLED) {
          return {
            idempotent: true,
            payment: toPaymentDto(payment),
            activeAttempt: toAttemptDto(attempt),
          };
        }

        if (
          payment.status === PAYMENT_STATUS.PAID ||
          attempt.status !== PAYMENT_ATTEMPT_STATUS.PENDING
        ) {
          throw paymentError(
            409,
            "Only a pending payment attempt can be cancelled",
            PAYMENT_ERROR_CODE.PAYMENT_ATTEMPT_NOT_PENDING,
          );
        }

        const updatedAttempt = {
          ...attempt,
          status: PAYMENT_ATTEMPT_STATUS.CANCELLED,
          completedAt: currentNow,
          failureReason: reason || "USER_CANCELLED",
        };
        const updatedAttempts = [...payment.attempts];
        updatedAttempts[attemptIndex] = updatedAttempt;

        const updatedPayment = await paymentRepository.saveState(payment._id, {
          status: PAYMENT_STATUS.PENDING,
          attempts: updatedAttempts,
        });
        await releaseProviderAttempt(attempt, updatedAttempt.failureReason);

        return {
          idempotent: false,
          payment: toPaymentDto(updatedPayment),
          activeAttempt: toAttemptDto(updatedAttempt),
        };
      });
    },

    handlePaymentNotification: (command) => handlePaymentNotification(command),
    verifyProviderAttempt: (command) => verifyProviderAttempt(command),
    getBookingPaymentDetails: (query) => getBookingPaymentDetails(query),
    listCustomerBookingPayments: (query) => listCustomerBookingPayments(query),

    // payOS webhook: the signature proves origin; settlement still goes through the same
    // provider status check so webhook and polling share one path.
    handlePayosWebhook: async (body) => {
      const data = gateway.verifyProviderWebhook(body);
      const orderCode = Number(data.orderCode);
      const payment = Number.isSafeInteger(orderCode)
        ? await paymentRepository.findByProviderOrderCode?.(orderCode)
        : null;
      // payOS sends a test event when the webhook URL is registered; acknowledge unknown codes.
      if (!payment) return { acknowledged: true, matched: false };
      const attempt = payment.attempts.find((item) => item.providerOrderCode === orderCode);
      const result = await verifyProviderAttempt({
        paymentId: payment._id,
        attemptId: attempt.attemptId,
        force: true,
      });
      return { acknowledged: true, matched: true, paymentStatus: result.payment?.status ?? null };
    },
  };

  async function verifyProviderAttempt({ paymentId, attemptId, ownerId, force = false }) {
    const payment = await paymentRepository.findById(paymentId);
    ensurePaymentOwnership(payment, ownerId);
    const attempt = (payment.attempts || []).find((item) => item.attemptId === attemptId);
    if (!attempt) {
      throw paymentError(404, "Payment attempt not found", PAYMENT_ERROR_CODE.PAYMENT_ATTEMPT_NOT_FOUND);
    }
    if (!isProviderAttempt(attempt)) {
      throw paymentError(409, "This payment attempt is not handled by payOS", PAYMENT_ERROR_CODE.INVALID_PAYMENT);
    }

    const current = async (providerStatus) => ({
      providerStatus,
      booking: toBookingSummary(
        await bookingService.getBookingForPayment({
          bookingId: payment.bookingId,
          ownerId: payment.customerAccountId,
        }),
      ),
      payment: toPaymentDto(payment),
      activeAttempt: toAttemptDto(attempt),
    });

    // Settled by this attempt already: nothing to ask payOS.
    if (attempt.status === PAYMENT_ATTEMPT_STATUS.SUCCEEDED || attempt.status === PAYMENT_ATTEMPT_STATUS.LATE_SUCCEEDED) {
      return current(null);
    }
    // Polling guard so a tight client loop cannot hammer the provider.
    const lastCheck = lastProviderCheck.get(attemptId) ?? 0;
    if (!force && now().getTime() - lastCheck < providerCheckIntervalMs) {
      return current(null);
    }
    lastProviderCheck.set(attemptId, now().getTime());

    const status = await gateway.getAttemptStatus(attempt);
    const orderCode = attempt.providerOrderCode;

    if (status.status === PAYOS_LINK_STATUS.PAID) {
      if (status.amountPaid < attempt.amount) {
        // Never settle less than the authoritative booking amount; leave it for reconciliation.
        console.error(`payOS order ${orderCode} paid ${status.amountPaid}, expected ${attempt.amount}`);
        return current(status.status);
      }
      const result = await handlePaymentNotification({
        paymentId: payment._id,
        attemptId,
        outcome: PAYMENT_SIMULATION_OUTCOME.SUCCESS,
        notificationKey: `payos:${orderCode}:PAID`,
        providerVerified: true,
        providerEvidence: {
          provider: PAYMENT_PROVIDER.PAYOS,
          orderCode,
          amountPaid: status.amountPaid,
          transactions: status.transactions,
          verifiedAt: now().toISOString(),
        },
      });
      return { ...result, providerStatus: status.status };
    }

    if (attempt.status === PAYMENT_ATTEMPT_STATUS.PENDING) {
      if (status.status === PAYOS_LINK_STATUS.CANCELLED) {
        const result = await handlePaymentNotification({
          paymentId: payment._id,
          attemptId,
          outcome: PAYMENT_SIMULATION_OUTCOME.FAILED,
          notificationKey: `payos:${orderCode}:CANCELLED`,
          failureReason: "PAYOS_LINK_CANCELLED",
        });
        return { ...result, providerStatus: status.status };
      }
      if (status.status === PAYOS_LINK_STATUS.EXPIRED) {
        const result = await handlePaymentNotification({
          paymentId: payment._id,
          attemptId,
          outcome: PAYMENT_SIMULATION_OUTCOME.EXPIRED,
          notificationKey: `payos:${orderCode}:EXPIRED`,
          failureReason: "PAYOS_LINK_EXPIRED",
        });
        return { ...result, providerStatus: status.status };
      }
    }

    // PENDING / PROCESSING: still waiting for the bank transfer.
    return current(status.status);
  }

  async function handlePaymentNotification({
    paymentId,
    attemptId,
    outcome,
    notificationKey,
    failureReason,
    actorOwnerId,
    requiredMethod,
    tenderedAmount,
    simulated = false,
    providerVerified = false,
    providerEvidence = null,
  }) {
    const initialPayment = await paymentRepository.findById(paymentId);
    ensurePaymentOwnership(initialPayment, actorOwnerId);

    return withPaymentLock(initialPayment.bookingId, async () => {
      const currentNow = now();
      const payment = await paymentRepository.findById(paymentId);
      ensurePaymentOwnership(payment, actorOwnerId);

      const attemptIndex = (payment.attempts || []).findIndex(
        (item) => item.attemptId === attemptId,
      );
      if (attemptIndex === -1) {
        throw paymentError(
          404,
          "Payment attempt not found",
          PAYMENT_ERROR_CODE.PAYMENT_ATTEMPT_NOT_FOUND,
        );
      }

      const attempt = payment.attempts[attemptIndex];
      if (requiredMethod && attempt.method !== requiredMethod) {
        throw paymentError(409, "This payment attempt is not a counter cash payment", PAYMENT_ERROR_CODE.INVALID_PAYMENT);
      }
      if (requiredMethod === "CASH" && (!Number.isSafeInteger(tenderedAmount) || tenderedAmount < payment.amount)) {
        throw paymentError(400, "Cash received is less than the amount due", PAYMENT_ERROR_CODE.PAYMENT_AMOUNT_MISMATCH);
      }
      const effectiveNotificationKey =
        notificationKey || `${attemptId}:${outcome}`;

      const resolveCurrentBooking = async () =>
        bookingService.getBookingForPayment({
          bookingId: payment.bookingId,
          ownerId: payment.customerAccountId,
        });

      if (
        (payment.processedNotificationKeys || []).includes(
          effectiveNotificationKey,
        )
      ) {
        // A replayed callback creates no new tickets; it only completes an interrupted issuance.
        await issueTicketsAfterSettlement(payment);
        const currentBooking = await resolveCurrentBooking();
        const currentOutcome =
          payment.status === PAYMENT_STATUS.PAID
            ? BOOKING_CONFIRMATION_OUTCOME.CONFIRMED
            : payment.status === PAYMENT_STATUS.REVIEW_REQUIRED
              ? BOOKING_CONFIRMATION_OUTCOME.EXPIRED_REVIEW_REQUIRED
              : outcome;

        return {
          idempotent: true,
          duplicateNotification: true,
          outcome: currentOutcome,
          booking: toBookingSummary(currentBooking),
          payment: toPaymentDto(payment),
          activeAttempt: toAttemptDto(attempt),
        };
      }

      if (outcome === PAYMENT_SIMULATION_OUTCOME.SUCCESS) {
        if (payment.status === PAYMENT_STATUS.PAID) {
          const currentBooking = await resolveCurrentBooking();
          const nextKeys = Array.from(
            new Set([
              ...(payment.processedNotificationKeys || []),
              effectiveNotificationKey,
            ]),
          );
          // Real money arrived on a second provider link after another attempt already settled:
          // keep the booking as is and flag the extra transfer for manual refund.
          const isDuplicateProviderPayment =
            providerVerified && payment.settlementAttemptId !== attempt.attemptId;
          const savedPayment = await paymentRepository.saveState(payment._id, {
            processedNotificationKeys: nextKeys,
            ...(isDuplicateProviderPayment
              ? {
                  reconciliationReason:
                    PAYMENT_RECONCILIATION_REASON.DUPLICATE_PROVIDER_PAYMENT,
                  gatewayResponse: {
                    ...(payment.gatewayResponse || {}),
                    duplicateProviderPayments: [
                      ...(payment.gatewayResponse?.duplicateProviderPayments || []),
                      { attemptId, ...providerEvidence },
                    ],
                  },
                }
              : {}),
          });
          await issueTicketsAfterSettlement(savedPayment);

          return {
            idempotent: true,
            duplicateNotification: true,
            alreadySettled: payment.settlementAttemptId !== attempt.attemptId,
            outcome: BOOKING_CONFIRMATION_OUTCOME.CONFIRMED,
            booking: toBookingSummary(currentBooking),
            payment: toPaymentDto(savedPayment),
            activeAttempt: toAttemptDto(
              (savedPayment.attempts || []).find(
                (item) => item.attemptId === attemptId,
              ),
            ),
          };
        }

        if (
          payment.status === PAYMENT_STATUS.REVIEW_REQUIRED &&
          attempt.status === PAYMENT_ATTEMPT_STATUS.LATE_SUCCEEDED
        ) {
          const currentBooking = await resolveCurrentBooking();
          return {
            idempotent: true,
            duplicateNotification: true,
            outcome: BOOKING_CONFIRMATION_OUTCOME.EXPIRED_REVIEW_REQUIRED,
            booking: toBookingSummary(currentBooking),
            payment: toPaymentDto(payment),
            activeAttempt: toAttemptDto(attempt),
          };
        }

        // A payOS-verified transfer is money already received, so it may settle an attempt that
        // was locally cancelled, superseded or expired; the Booking port still decides between
        // confirmation and late-payment review.
        const reopenable =
          providerVerified &&
          [
            PAYMENT_ATTEMPT_STATUS.CANCELLED,
            PAYMENT_ATTEMPT_STATUS.FAILED,
            PAYMENT_ATTEMPT_STATUS.EXPIRED,
          ].includes(attempt.status);
        if (attempt.status !== PAYMENT_ATTEMPT_STATUS.PENDING && !reopenable) {
          throw paymentError(
            409,
            "Only a pending payment attempt can be settled",
            PAYMENT_ERROR_CODE.PAYMENT_ATTEMPT_NOT_PENDING,
          );
        }

        const confirmation =
          await bookingService.confirmBookingAfterVerifiedPayment({
            bookingId: payment.bookingId,
            paymentId: payment._id,
            verifiedAt: currentNow,
          });

        const nextKeys = Array.from(
          new Set([
            ...(payment.processedNotificationKeys || []),
            effectiveNotificationKey,
          ]),
        );

        if (
          confirmation.outcome === BOOKING_CONFIRMATION_OUTCOME.CONFIRMED ||
          confirmation.outcome ===
            BOOKING_CONFIRMATION_OUTCOME.ALREADY_CONFIRMED
        ) {
          const updatedAttempt = {
            ...attempt,
            status: PAYMENT_ATTEMPT_STATUS.SUCCEEDED,
            completedAt: currentNow,
            notificationKey: effectiveNotificationKey,
            failureReason: null,
          };

          const updatedAttempts = payment.attempts.map((item, idx) => {
            if (idx === attemptIndex) {
              return updatedAttempt;
            }
            if (item.status === PAYMENT_ATTEMPT_STATUS.PENDING) {
              return {
                ...item,
                status: PAYMENT_ATTEMPT_STATUS.CANCELLED,
                completedAt: currentNow,
                failureReason: "SETTLED_BY_ANOTHER_ATTEMPT",
              };
            }
            return item;
          });

          const updatedPayment = await paymentRepository.saveState(
            payment._id,
            {
              status: PAYMENT_STATUS.PAID,
              method: attempt.method,
              paidAt: currentNow,
              settlementAttemptId: attempt.attemptId,
              settlementReference: attempt.gatewayTransactionRef,
              reconciliationReason: null,
              gatewayTransactionId: attempt.gatewayTransactionRef,
              gatewayResponse: {
                ...(payment.gatewayResponse || {}),
                settledAttemptId: attempt.attemptId,
                settlementReference: attempt.gatewayTransactionRef,
                settledAt: currentNow.toISOString(),
                ...(providerEvidence ? { providerSettlement: providerEvidence } : {}),
                ...(simulated ? { simulatedSettlement: true } : {}),
              },
              attempts: updatedAttempts,
              processedNotificationKeys: nextKeys,
            },
          );
          await issueTicketsAfterSettlement(updatedPayment);
          // A demo "simulate success" on a payOS attempt closes the real link so it cannot be
          // paid afterwards. Other pending links of this payment are closed too.
          if (simulated) await releaseProviderAttempt(attempt, "SETTLED_BY_SIMULATION");
          for (const item of payment.attempts) {
            if (item.attemptId !== attempt.attemptId && item.status === PAYMENT_ATTEMPT_STATUS.PENDING) {
              await releaseProviderAttempt(item, "SETTLED_BY_ANOTHER_ATTEMPT");
            }
          }

          return {
            idempotent: Boolean(
              confirmation.outcome ===
                BOOKING_CONFIRMATION_OUTCOME.ALREADY_CONFIRMED,
            ),
            duplicateNotification: false,
            outcome: BOOKING_CONFIRMATION_OUTCOME.CONFIRMED,
            booking: toBookingSummary(confirmation.booking),
            payment: toPaymentDto(updatedPayment),
            activeAttempt: toAttemptDto(updatedAttempt),
          };
        }

        const lateAttempt = {
          ...attempt,
          status: PAYMENT_ATTEMPT_STATUS.LATE_SUCCEEDED,
          completedAt: currentNow,
          notificationKey: effectiveNotificationKey,
          failureReason:
            PAYMENT_RECONCILIATION_REASON.LATE_PAYMENT_AFTER_EXPIRY,
        };

        const updatedAttempts = [...payment.attempts];
        updatedAttempts[attemptIndex] = lateAttempt;

        const updatedPayment = await paymentRepository.saveState(payment._id, {
          status: PAYMENT_STATUS.REVIEW_REQUIRED,
          method: attempt.method,
          paidAt: currentNow,
          settlementAttemptId: attempt.attemptId,
          settlementReference: attempt.gatewayTransactionRef,
          reconciliationReason:
            PAYMENT_RECONCILIATION_REASON.LATE_PAYMENT_AFTER_EXPIRY,
          gatewayTransactionId: attempt.gatewayTransactionRef,
          gatewayResponse: {
            ...(payment.gatewayResponse || {}),
            lateSettlementAttemptId: attempt.attemptId,
            reconciliationReason:
              PAYMENT_RECONCILIATION_REASON.LATE_PAYMENT_AFTER_EXPIRY,
            lateSettledAt: currentNow.toISOString(),
            ...(providerEvidence ? { providerSettlement: providerEvidence } : {}),
          },
          attempts: updatedAttempts,
          processedNotificationKeys: nextKeys,
        });

        return {
          idempotent: false,
          duplicateNotification: false,
          outcome: BOOKING_CONFIRMATION_OUTCOME.EXPIRED_REVIEW_REQUIRED,
          booking: toBookingSummary(confirmation.booking),
          payment: toPaymentDto(updatedPayment),
          activeAttempt: toAttemptDto(lateAttempt),
        };
      }

      if (outcome === PAYMENT_SIMULATION_OUTCOME.FAILED) {
        const currentBooking = await resolveCurrentBooking();

        if (payment.status === PAYMENT_STATUS.PAID) {
          return {
            idempotent: true,
            duplicateNotification: true,
            outcome: BOOKING_CONFIRMATION_OUTCOME.CONFIRMED,
            booking: toBookingSummary(currentBooking),
            payment: toPaymentDto(payment),
            activeAttempt: toAttemptDto(attempt),
          };
        }

        if (attempt.status === PAYMENT_ATTEMPT_STATUS.FAILED) {
          return {
            idempotent: true,
            duplicateNotification: true,
            outcome: PAYMENT_SIMULATION_OUTCOME.FAILED,
            booking: toBookingSummary(currentBooking),
            payment: toPaymentDto(payment),
            activeAttempt: toAttemptDto(attempt),
          };
        }

        if (attempt.status !== PAYMENT_ATTEMPT_STATUS.PENDING) {
          throw paymentError(
            409,
            "Only a pending payment attempt can transition to failed",
            PAYMENT_ERROR_CODE.PAYMENT_ATTEMPT_NOT_PENDING,
          );
        }

        const isBookingExpired =
          currentBooking.status === BOOKING_STATUS.EXPIRED ||
          new Date(currentBooking.expiresAt).getTime() <=
            currentNow.getTime();

        const failedAttempt = {
          ...attempt,
          status: PAYMENT_ATTEMPT_STATUS.FAILED,
          completedAt: currentNow,
          notificationKey: effectiveNotificationKey,
          failureReason: failureReason || "MOCK_PAYMENT_DECLINED",
        };
        const updatedAttempts = [...payment.attempts];
        updatedAttempts[attemptIndex] = failedAttempt;

        const nextKeys = Array.from(
          new Set([
            ...(payment.processedNotificationKeys || []),
            effectiveNotificationKey,
          ]),
        );

        const updatedPayment = await paymentRepository.saveState(payment._id, {
          status: isBookingExpired
            ? PAYMENT_STATUS.EXPIRED
            : PAYMENT_STATUS.FAILED,
          attempts: updatedAttempts,
          processedNotificationKeys: nextKeys,
        });
        if (simulated) await releaseProviderAttempt(attempt, "FAILED_BY_SIMULATION");

        return {
          idempotent: false,
          duplicateNotification: false,
          outcome: PAYMENT_SIMULATION_OUTCOME.FAILED,
          booking: toBookingSummary(currentBooking),
          payment: toPaymentDto(updatedPayment),
          activeAttempt: toAttemptDto(failedAttempt),
        };
      }

      if (outcome === PAYMENT_SIMULATION_OUTCOME.EXPIRED) {
        const currentBooking = await resolveCurrentBooking();
        const expiredAttempt = {
          ...attempt,
          status: PAYMENT_ATTEMPT_STATUS.EXPIRED,
          completedAt: currentNow,
          notificationKey: effectiveNotificationKey,
          failureReason: failureReason || "PAYMENT_ATTEMPT_EXPIRED",
        };
        const updatedAttempts = [...payment.attempts];
        updatedAttempts[attemptIndex] = expiredAttempt;

        const nextKeys = Array.from(
          new Set([
            ...(payment.processedNotificationKeys || []),
            effectiveNotificationKey,
          ]),
        );

        const updatedPayment = await paymentRepository.saveState(payment._id, {
          status: PAYMENT_STATUS.EXPIRED,
          attempts: updatedAttempts,
          processedNotificationKeys: nextKeys,
        });

        return {
          idempotent: false,
          duplicateNotification: false,
          outcome: PAYMENT_SIMULATION_OUTCOME.EXPIRED,
          booking: toBookingSummary(currentBooking),
          payment: toPaymentDto(updatedPayment),
          activeAttempt: toAttemptDto(expiredAttempt),
        };
      }

      throw paymentError(
        400,
        "Unsupported payment notification outcome",
        PAYMENT_ERROR_CODE.INVALID_PAYMENT,
      );
    });
  }

  async function getBookingPaymentDetails({ bookingId, ownerId }) {
    const currentNow = now();
    let details = await bookingService.getCustomerBookingDetails({
      bookingId,
      ownerId,
    });

    let payment = await paymentRepository.findByBookingId(
      details.booking.bookingId,
    );

    // Returning from the payOS page lands on C15: ask payOS before rendering, so a completed
    // bank transfer settles here even without a webhook (local development).
    const pendingProviderAttempt = (payment?.attempts || []).find(
      (item) => isProviderAttempt(item) && item.status === PAYMENT_ATTEMPT_STATUS.PENDING,
    );
    if (pendingProviderAttempt && payment.status !== PAYMENT_STATUS.PAID) {
      try {
        await verifyProviderAttempt({
          paymentId: payment._id,
          attemptId: pendingProviderAttempt.attemptId,
          ownerId,
        });
      } catch (error) {
        console.error(`payOS check for booking ${bookingId} failed:`, error.message);
      }
      details = await bookingService.getCustomerBookingDetails({ bookingId, ownerId });
      payment = await paymentRepository.findByBookingId(details.booking.bookingId);
    }

    const isBookingExpiredByClock =
      details.booking.status === BOOKING_STATUS.EXPIRED ||
      (details.booking.status === BOOKING_STATUS.PENDING_PAYMENT &&
      new Date(details.booking.expiresAt).getTime() <= currentNow.getTime());

    if (
      isBookingExpiredByClock &&
      payment &&
      payment.status !== PAYMENT_STATUS.PAID &&
      payment.status !== PAYMENT_STATUS.REVIEW_REQUIRED
    ) {
      const updatedAttempts = (payment.attempts || []).map((item) =>
        item.status === PAYMENT_ATTEMPT_STATUS.PENDING
          ? {
              ...item,
              status: PAYMENT_ATTEMPT_STATUS.EXPIRED,
              completedAt: currentNow,
              failureReason: "BOOKING_EXPIRED",
            }
          : item,
      );
      payment = await paymentRepository.saveState(payment._id, {
        status: PAYMENT_STATUS.EXPIRED,
        attempts: updatedAttempts,
      }, { status: payment.status, updatedAt: payment.updatedAt }) ?? await paymentRepository.findByBookingId(details.booking.bookingId);
    }

    const effectiveBooking = isBookingExpiredByClock
      ? {
          ...details.booking,
          status: BOOKING_STATUS.EXPIRED,
        }
      : details.booking;

    const latestAttempt = pickLatestAttempt(payment);

    return {
      ...details,
      booking: effectiveBooking,
      seats: effectiveBooking.seats || [],
      payment: toPaymentDto(payment),
      activeAttempt: toAttemptDto(latestAttempt),
      ticketIssuance: await resolveTicketIssuance(effectiveBooking, payment),
    };
  }

  async function listCustomerBookingPayments({ ownerId, limit = 50 }) {
    if (!bookingService.listCustomerBookings) {
      return {
        items: [],
        summary: {
          totalBookings: 0,
          confirmedTicketsCount: 0,
          pendingCount: 0,
          expiredOrReviewCount: 0,
        },
      };
    }

    const currentNow = now();
    const bookingDetailsList = await bookingService.listCustomerBookings({
      ownerId,
      limit,
    });

    const items = [];
    for (const detail of bookingDetailsList) {
      let payment = await paymentRepository.findByBookingId(
        detail.booking.bookingId,
      );

      const isBookingExpired =
        detail.booking.status === BOOKING_STATUS.EXPIRED ||
        (detail.booking.status === BOOKING_STATUS.PENDING_PAYMENT &&
          new Date(detail.booking.expiresAt).getTime() <=
            currentNow.getTime());

      if (
        isBookingExpired &&
        payment &&
        payment.status !== PAYMENT_STATUS.PAID &&
        payment.status !== PAYMENT_STATUS.REVIEW_REQUIRED &&
        payment.status !== PAYMENT_STATUS.EXPIRED
      ) {
        const updatedAttempts = (payment.attempts || []).map((item) =>
          item.status === PAYMENT_ATTEMPT_STATUS.PENDING
            ? {
                ...item,
                status: PAYMENT_ATTEMPT_STATUS.EXPIRED,
                completedAt: currentNow,
                failureReason: "BOOKING_EXPIRED",
              }
            : item,
        );
        payment = await paymentRepository.saveState(payment._id, {
          status: PAYMENT_STATUS.EXPIRED,
          attempts: updatedAttempts,
        }, { status: payment.status, updatedAt: payment.updatedAt }) ?? await paymentRepository.findByBookingId(detail.booking.bookingId);
      }

      const latestAttempt = pickLatestAttempt(payment);
      items.push({
        ...detail,
        booking: detail.booking,
        seats: detail.booking.seats || [],
        payment: toPaymentDto(payment),
        activeAttempt: toAttemptDto(latestAttempt),
        ticketIssuance: await resolveTicketIssuance(detail.booking, payment),
      });
    }

    const confirmedTicketsCount = items.filter(
      (item) =>
        item.booking.status === BOOKING_STATUS.CONFIRMED &&
        item.payment?.status === PAYMENT_STATUS.PAID,
    ).length;

    const pendingCount = items.filter(
      (item) => item.booking.status === BOOKING_STATUS.PENDING_PAYMENT,
    ).length;

    const expiredOrReviewCount = items.filter(
      (item) =>
        item.booking.status === BOOKING_STATUS.EXPIRED ||
        item.payment?.status === PAYMENT_STATUS.REVIEW_REQUIRED,
    ).length;

    return {
      items,
      summary: {
        totalBookings: items.length,
        confirmedTicketsCount,
        pendingCount,
        expiredOrReviewCount,
      },
    };
  }
};
