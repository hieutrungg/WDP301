import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import {
  BOOKING_CONFIRMATION_OUTCOME,
  BOOKING_STATUS,
} from "../src/modules/booking/booking.constants.js";
import { createBookingService } from "../src/modules/booking/booking.service.js";
import {
  PAYMENT_ATTEMPT_STATUS,
  PAYMENT_ACCEPTED_METHOD_VALUES,
  PAYMENT_ERROR_CODE,
  PAYMENT_METHOD_VALUES,
  PAYMENT_METHODS,
  PAYMENT_RECONCILIATION_REASON,
  PAYMENT_STATUS,
} from "../src/modules/payment/payment.constants.js";
import { createPaymentController } from "../src/modules/payment/payment.controller.js";
import { PAYMENT_INDEXES } from "../src/modules/payment/payment.indexes.js";
import { Payment } from "../src/modules/payment/payment.model.js";
import { createPaymentRouter } from "../src/modules/payment/payment.routes.js";
import { createPaymentService } from "../src/modules/payment/payment.service.js";

const objectId = () => new mongoose.Types.ObjectId().toString();

const createInMemoryHarness = ({
  initialNow = new Date("2026-10-22T07:00:00.000Z"),
} = {}) => {
  let currentNow = new Date(initialNow);
  const ownerId = objectId();
  const otherOwnerId = objectId();
  const holdId = objectId();
  const showtimeId = objectId();
  const roomId = objectId();
  const seatIds = [objectId(), objectId()];
  const expiresAt = new Date(currentNow.getTime() + 10 * 60 * 1000);

  const holds = new Map();
  const bookings = new Map();
  const payments = new Map();
  let holdConsumedCount = 0;
  let holdExpiredCount = 0;

  holds.set(holdId, {
    _id: new mongoose.Types.ObjectId(holdId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    showtimeId: new mongoose.Types.ObjectId(showtimeId),
    seatIds: seatIds.map((id) => new mongoose.Types.ObjectId(id)),
    status: "ACTIVE",
    expiresAt,
    priceSnapshot: {
      quoteId: "QUOTE-PAY-001",
      currency: "VND",
      lines: [
        { seatId: seatIds[0], unitPrice: 95000 },
        { seatId: seatIds[1], unitPrice: 95000 },
      ],
      totalAmount: 190000,
    },
  });

  const bookingRepository = {
    async withTransaction(work) {
      return work({ id: "tx-booking" });
    },
    async findByCustomerRequestKey(customerAccountId, requestKey) {
      for (const booking of bookings.values()) {
        if (
          String(booking.customerAccountId) === String(customerAccountId) &&
          booking.requestKey === requestKey
        ) {
          return booking;
        }
      }
      return null;
    },
    async findByHoldId(targetHoldId) {
      for (const booking of bookings.values()) {
        if (String(booking.holdId) === String(targetHoldId)) {
          return booking;
        }
      }
      return null;
    },
    async findById(targetBookingId) {
      return bookings.get(String(targetBookingId)) ?? null;
    },
    async findByCustomerAccountId(customerAccountId) {
      return [...bookings.values()].filter(
        (b) => String(b.customerAccountId) === String(customerAccountId),
      );
    },
    async findByPayableReference(payableReference) {
      for (const booking of bookings.values()) {
        if (booking.payableReference === payableReference) {
          return booking;
        }
      }
      return null;
    },
    async createPending(doc) {
      const stored = {
        ...doc,
        _id: doc._id ?? new mongoose.Types.ObjectId(),
      };
      bookings.set(String(stored._id), stored);
      return stored;
    },
    async markConfirmed({ bookingId, paymentId, confirmedAt }) {
      const existing = bookings.get(String(bookingId));
      if (!existing) return null;
      const updated = {
        ...existing,
        status: BOOKING_STATUS.CONFIRMED,
        paymentId,
        confirmedAt,
      };
      bookings.set(String(bookingId), updated);
      return updated;
    },
    async markExpired({ bookingId, expiredAt }) {
      const existing = bookings.get(String(bookingId));
      if (!existing) return null;
      const updated = {
        ...existing,
        status: BOOKING_STATUS.EXPIRED,
        expiredAt,
      };
      bookings.set(String(bookingId), updated);
      return updated;
    },
  };

  const seatHoldPort = {
    async getLiveHoldForBooking({ holdId: requestedHoldId }) {
      return holds.get(String(requestedHoldId)) ?? null;
    },
    async consumeHoldForBooking({ holdId: requestedHoldId, verifiedAt }) {
      const hold = holds.get(String(requestedHoldId));
      if (!hold) return { outcome: "EXPIRED" };
      if (new Date(hold.expiresAt).getTime() <= new Date(verifiedAt).getTime()) {
        hold.status = "EXPIRED";
        holdExpiredCount += 1;
        return { outcome: "EXPIRED" };
      }
      hold.status = "CONSUMED";
      holdConsumedCount += 1;
      return { outcome: "CONSUMED", hold };
    },
    async expireHoldForBooking({ holdId: requestedHoldId }) {
      const hold = holds.get(String(requestedHoldId));
      if (hold && hold.status !== "CONSUMED") {
        hold.status = "EXPIRED";
        holdExpiredCount += 1;
      }
    },
  };

  const showtimeReader = {
    async getBookableShowtime() {
      return {
        showtimeId,
        roomId,
        roomLayoutVersion: 1,
        movieTitle: "Dune: Part Two",
        cinemaName: "F-Cinema Landmark 81",
        roomName: "IMAX Hall 04",
        format: "IMAX 3D",
        startAt: new Date("2026-10-24T12:30:00.000Z").toISOString(),
      };
    },
  };

  const roomLayoutReader = {
    async getLayoutVersion() {
      return {
        roomId,
        layoutVersion: 1,
        seats: [
          { _id: seatIds[0], row: "G", number: 12, type: "VIP" },
          { _id: seatIds[1], row: "G", number: 13, type: "VIP" },
        ],
      };
    },
  };

  const paymentRepository = {
    async findById(paymentId) {
      return payments.get(String(paymentId)) ?? null;
    },
    async findByBookingId(bookingId) {
      for (const payment of payments.values()) {
        if (String(payment.bookingId) === String(bookingId)) {
          return payment;
        }
      }
      return null;
    },
    async findByAttemptIdempotencyKey(idempotencyKey) {
      for (const payment of payments.values()) {
        if (
          (payment.attempts || []).some(
            (attempt) => attempt.idempotencyKey === idempotencyKey,
          )
        ) {
          return payment;
        }
      }
      return null;
    },
    async create(payload) {
      const _id = new mongoose.Types.ObjectId();
      const doc = {
        ...payload,
        _id,
        createdAt: new Date(currentNow),
        updatedAt: new Date(currentNow),
      };
      payments.set(String(_id), doc);
      return doc;
    },
    async saveState(paymentId, updateFields) {
      const existing = payments.get(String(paymentId));
      if (!existing) return null;
      const updated = {
        ...existing,
        ...updateFields,
        updatedAt: new Date(currentNow),
      };
      payments.set(String(paymentId), updated);
      return updated;
    },
  };

  const bookingService = createBookingService({
    repository: bookingRepository,
    seatHoldPort,
    showtimeReader,
    roomLayoutReader,
    clock: () => new Date(currentNow),
  });

  const paymentService = createPaymentService({
    paymentRepository,
    bookingService,
    now: () => new Date(currentNow),
  });

  const advanceTimeMs = (ms) => {
    currentNow = new Date(currentNow.getTime() + ms);
  };

  return {
    ownerId,
    otherOwnerId,
    holdId,
    showtimeId,
    seatIds,
    holds,
    bookings,
    payments,
    bookingService,
    paymentService,
    advanceTimeMs,
    getStats: () => ({
      holdConsumedCount,
      holdExpiredCount,
      paymentCount: payments.size,
    }),
  };
};

test("Payment model and index definitions satisfy Payment aggregate and validator contract", () => {
  assert.equal(Payment.schema.options.autoIndex, false);
  assert.deepEqual(
    Payment.schema.path("status").enumValues,
    Object.values(PAYMENT_STATUS),
  );
  assert.deepEqual(
    Payment.schema.path("method").enumValues,
    PAYMENT_ACCEPTED_METHOD_VALUES,
  );
  assert.equal(PAYMENT_INDEXES.length, 5);
  assert.equal(PAYMENT_INDEXES[0].options.name, "uniq_payment_order");
  assert.equal(PAYMENT_INDEXES[0].options.unique, true);
  assert.equal(PAYMENT_INDEXES[1].options.name, "uniq_payment_booking");
  assert.equal(PAYMENT_INDEXES[1].options.unique, true);
});

test("1 & 2. Valid PENDING_PAYMENT booking creates Payment aggregate and idempotent retry returns same attempt", async () => {
  const harness = createInMemoryHarness();
  const createdBooking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: "req-booking-001",
  });

  const first = await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.MOMO_WALLET,
    idempotencyKey: "idem-payment-001",
    contactDetails: {
      fullName: "Nguyen Van A",
      email: "a@example.com",
      phone: "0901234567",
    },
  });

  assert.equal(first.idempotent, false);
  assert.equal(first.payment.status, PAYMENT_STATUS.PENDING);
  assert.equal(first.payment.amount, 190000);
  assert.equal(first.payment.currency, "VND");
  assert.equal(first.payment.attemptCount, 1);
  assert.equal(first.activeAttempt.status, PAYMENT_ATTEMPT_STATUS.PENDING);
  assert.equal(first.activeAttempt.method, PAYMENT_METHODS.MOMO_WALLET);
  assert.match(first.activeAttempt.qrPayload, /^FCINEMA-MOCK:\/\/payment\//);

  const duplicate = await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.MOMO_WALLET,
    idempotencyKey: "idem-payment-001",
  });

  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.payment.paymentId, first.payment.paymentId);
  assert.equal(duplicate.activeAttempt.attemptId, first.activeAttempt.attemptId);
  assert.equal(duplicate.payment.attemptCount, 1);
  assert.equal(harness.getStats().paymentCount, 1);
});

test("3. Reusing idempotency key with different payment method or booking is rejected with 409", async () => {
  const harness = createInMemoryHarness();
  const createdBooking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: "req-booking-002",
  });

  await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.MOMO_WALLET,
    idempotencyKey: "idem-conflict-key",
  });

  await assert.rejects(
    () =>
      harness.paymentService.initiatePayment({
        bookingId: createdBooking.bookingId,
        ownerId: harness.ownerId,
        method: PAYMENT_METHODS.VNPAY_QR,
        idempotencyKey: "idem-conflict-key",
      }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(
        error.code,
        PAYMENT_ERROR_CODE.PAYMENT_IDEMPOTENCY_KEY_REUSED,
      );
      return true;
    },
  );
});

test("4 & 5. Multiple payment attempts and retry after failed attempt settle cleanly on the same Payment aggregate", async () => {
  const harness = createInMemoryHarness();
  const createdBooking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: "req-booking-003",
  });

  const attempt1 = await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.MOMO_WALLET,
    idempotencyKey: "idem-attempt-1",
  });

  const failedResult = await harness.paymentService.handlePaymentNotification({
    paymentId: attempt1.payment.paymentId,
    attemptId: attempt1.activeAttempt.attemptId,
    outcome: "FAILED",
    notificationKey: "notif-fail-1",
    failureReason: "INSUFFICIENT_WALLET_BALANCE",
    actorOwnerId: harness.ownerId,
  });

  assert.equal(failedResult.payment.status, PAYMENT_STATUS.FAILED);
  assert.equal(
    failedResult.activeAttempt.status,
    PAYMENT_ATTEMPT_STATUS.FAILED,
  );
  assert.equal(failedResult.booking.status, BOOKING_STATUS.PENDING_PAYMENT);

  const attempt2 = await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.VNPAY_QR,
    idempotencyKey: "idem-attempt-2",
  });

  assert.equal(attempt2.payment.paymentId, attempt1.payment.paymentId);
  assert.equal(attempt2.payment.attemptCount, 2);
  assert.equal(attempt2.activeAttempt.attemptNumber, 2);
  assert.equal(attempt2.activeAttempt.method, PAYMENT_METHODS.VNPAY_QR);

  const settled = await harness.paymentService.handlePaymentNotification({
    paymentId: attempt2.payment.paymentId,
    attemptId: attempt2.activeAttempt.attemptId,
    outcome: "SUCCESS",
    notificationKey: "notif-success-2",
    actorOwnerId: harness.ownerId,
  });

  assert.equal(settled.outcome, BOOKING_CONFIRMATION_OUTCOME.CONFIRMED);
  assert.equal(settled.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(
    settled.payment.settlementAttemptId,
    attempt2.activeAttempt.attemptId,
  );
  assert.equal(settled.booking.status, BOOKING_STATUS.CONFIRMED);
  assert.equal(harness.getStats().holdConsumedCount, 1);
  assert.equal(harness.getStats().paymentCount, 1);
});

test("6, 7 & 8. Single settlement guarantee: duplicate notifications and concurrent success requests never double-settle", async () => {
  const harness = createInMemoryHarness();
  const createdBooking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: "req-booking-004",
  });

  const initiated = await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.CREDIT_DEBIT_CARD,
    idempotencyKey: "idem-concurrent-1",
  });

  const [first, second] = await Promise.all([
    harness.paymentService.handlePaymentNotification({
      paymentId: initiated.payment.paymentId,
      attemptId: initiated.activeAttempt.attemptId,
      outcome: "SUCCESS",
      notificationKey: "notif-concurrent-a",
      actorOwnerId: harness.ownerId,
    }),
    harness.paymentService.handlePaymentNotification({
      paymentId: initiated.payment.paymentId,
      attemptId: initiated.activeAttempt.attemptId,
      outcome: "SUCCESS",
      notificationKey: "notif-concurrent-b",
      actorOwnerId: harness.ownerId,
    }),
  ]);

  assert.equal(first.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(second.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(
    first.payment.settlementAttemptId,
    initiated.activeAttempt.attemptId,
  );
  assert.equal(
    second.payment.settlementAttemptId,
    initiated.activeAttempt.attemptId,
  );
  assert.equal(
    [first.duplicateNotification, second.duplicateNotification].includes(true),
    true,
  );
  assert.equal(harness.getStats().holdConsumedCount, 1);

  const duplicateSameKey =
    await harness.paymentService.handlePaymentNotification({
      paymentId: initiated.payment.paymentId,
      attemptId: initiated.activeAttempt.attemptId,
      outcome: "SUCCESS",
      notificationKey: "notif-concurrent-a",
      actorOwnerId: harness.ownerId,
    });

  assert.equal(duplicateSameKey.idempotent, true);
  assert.equal(duplicateSameKey.duplicateNotification, true);
  assert.equal(harness.getStats().holdConsumedCount, 1);
});

test("9 & 10. Expired booking rejects new payment attempts, and late payment success after expiry transitions Payment to REVIEW_REQUIRED without confirming booking or issuing tickets", async () => {
  const harness = createInMemoryHarness();
  const createdBooking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: "req-booking-late-001",
  });

  const initiated = await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.ZALOPAY_APPLE_PAY,
    idempotencyKey: "idem-late-payment-1",
  });

  // Advance clock past the 10-minute booking and seat-hold expiration window
  harness.advanceTimeMs(11 * 60 * 1000);

  const lateResult = await harness.paymentService.handlePaymentNotification({
    paymentId: initiated.payment.paymentId,
    attemptId: initiated.activeAttempt.attemptId,
    outcome: "SUCCESS",
    notificationKey: "notif-late-success-1",
    actorOwnerId: harness.ownerId,
  });

  assert.equal(
    lateResult.outcome,
    BOOKING_CONFIRMATION_OUTCOME.EXPIRED_REVIEW_REQUIRED,
  );
  assert.equal(lateResult.booking.status, BOOKING_STATUS.EXPIRED);
  assert.equal(lateResult.payment.status, PAYMENT_STATUS.REVIEW_REQUIRED);
  assert.equal(
    lateResult.payment.reconciliationReason,
    PAYMENT_RECONCILIATION_REASON.LATE_PAYMENT_AFTER_EXPIRY,
  );
  assert.equal(
    lateResult.activeAttempt.status,
    PAYMENT_ATTEMPT_STATUS.LATE_SUCCEEDED,
  );
  assert.equal(harness.getStats().holdConsumedCount, 0);
  assert.equal(harness.getStats().holdExpiredCount >= 1, true);

  const details = await harness.paymentService.getBookingPaymentDetails({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
  });
  assert.equal(details.booking.status, BOOKING_STATUS.EXPIRED);
  assert.equal(details.payment.status, PAYMENT_STATUS.REVIEW_REQUIRED);
  assert.equal(details.ticketIssuance.eligible, false);
  assert.equal(details.ticketIssuance.status, "NOT_ISSUED");

  await assert.rejects(
    () =>
      harness.paymentService.initiatePayment({
        bookingId: createdBooking.bookingId,
        ownerId: harness.ownerId,
        method: PAYMENT_METHODS.MOMO_WALLET,
        idempotencyKey: "idem-after-late-expiry",
      }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, PAYMENT_ERROR_CODE.BOOKING_ALREADY_EXPIRED);
      return true;
    },
  );
});

test("11 & 12. Forged payment amount is rejected with 400 and unauthorized booking/payment access is rejected with 403", async () => {
  const harness = createInMemoryHarness();
  const createdBooking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: "req-booking-sec-001",
  });

  await assert.rejects(
    () =>
      harness.paymentService.initiatePayment({
        bookingId: createdBooking.bookingId,
        ownerId: harness.ownerId,
        method: PAYMENT_METHODS.MOMO_WALLET,
        idempotencyKey: "idem-forged-amount",
        amount: 1000,
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, PAYMENT_ERROR_CODE.PAYMENT_AMOUNT_MISMATCH);
      return true;
    },
  );

  await assert.rejects(
    () =>
      harness.paymentService.initiatePayment({
        bookingId: createdBooking.bookingId,
        ownerId: harness.otherOwnerId,
        method: PAYMENT_METHODS.MOMO_WALLET,
        idempotencyKey: "idem-wrong-owner",
      }),
    (error) => {
      assert.equal(error.statusCode, 403);
      return true;
    },
  );

  const initiated = await harness.paymentService.initiatePayment({
    bookingId: createdBooking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.MOMO_WALLET,
    idempotencyKey: "idem-valid-owner",
  });

  await assert.rejects(
    () =>
      harness.paymentService.handlePaymentNotification({
        paymentId: initiated.payment.paymentId,
        attemptId: initiated.activeAttempt.attemptId,
        outcome: "SUCCESS",
        actorOwnerId: harness.otherOwnerId,
      }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, PAYMENT_ERROR_CODE.PAYMENT_FORBIDDEN);
      return true;
    },
  );
});

test("13, 14, 15 & 16. HTTP routes support all 4 C14 payment methods, reloadable confirmation state, My Tickets history, and disable mock simulation when NODE_ENV=production", async (t) => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "payment-route-test-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  const harness = createInMemoryHarness();
  const createdBooking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: "req-booking-http-001",
  });

  let simulatedNodeEnv = "development";
  const app = express();
  app.use(express.json(), cookieParser());
  app.use(
    "/api/payments",
    createPaymentRouter(createPaymentController(harness.paymentService), {
      getNodeEnv: () => simulatedNodeEnv,
    }),
  );
  app.use(errorHandler);

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const token = jwt.sign(
    { sub: harness.ownerId },
    process.env.JWT_ACCESS_SECRET,
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/payments`;

  const request = async (path, { method = "GET", body } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: `accessToken=${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };

  let latestPaymentId = null;
  let latestAttemptId = null;

  for (const method of PAYMENT_METHOD_VALUES) {
    const res = await request("/", {
      method: "POST",
      body: {
        bookingId: createdBooking.bookingId,
        method,
        idempotencyKey: `idem-method-${method}`,
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.activeAttempt.method, method);
    assert.equal(res.body.data.activeAttempt.instruction.isDemo, true);
    latestPaymentId = res.body.data.payment.paymentId;
    latestAttemptId = res.body.data.activeAttempt.attemptId;
  }

  // Verify production gate blocks mock simulation endpoint
  simulatedNodeEnv = "production";
  const prodBlocked = await request(
    `/${latestPaymentId}/attempts/${latestAttemptId}/simulate`,
    {
      method: "POST",
      body: { outcome: "SUCCESS" },
    },
  );
  assert.equal(prodBlocked.status, 404);
  assert.equal(
    prodBlocked.body.code,
    PAYMENT_ERROR_CODE.MOCK_SIMULATION_DISABLED,
  );

  // Re-enable development environment and complete mock payment
  simulatedNodeEnv = "development";
  const simulated = await request(
    `/${latestPaymentId}/attempts/${latestAttemptId}/simulate`,
    {
      method: "POST",
      body: {
        outcome: "SUCCESS",
        notificationKey: "notif-http-final",
      },
    },
  );
  assert.equal(simulated.status, 200);
  assert.equal(simulated.body.data.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(simulated.body.data.booking.status, BOOKING_STATUS.CONFIRMED);

  // Reload confirmation details from backend
  const reloadRes = await request(`/bookings/${createdBooking.bookingId}`);
  assert.equal(reloadRes.status, 200);
  assert.equal(reloadRes.body.data.booking.status, BOOKING_STATUS.CONFIRMED);
  assert.equal(reloadRes.body.data.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(reloadRes.body.data.payment.attemptCount, 4);
  assert.equal(reloadRes.body.data.ticketIssuance.eligible, true);
  assert.equal(
    reloadRes.body.data.ticketIssuance.status,
    "PENDING_TICKET_MODULE",
  );
  assert.equal(reloadRes.body.data.seats.length, 2);
  assert.equal(reloadRes.body.data.seats[0].label, "G12");

  // List My Tickets & Booking History
  const myBookingsRes = await request("/me/bookings");
  assert.equal(myBookingsRes.status, 200);
  assert.equal(myBookingsRes.body.data.summary.totalBookings, 1);
  assert.equal(myBookingsRes.body.data.summary.confirmedTicketsCount, 1);
  assert.equal(myBookingsRes.body.data.items.length, 1);
  assert.equal(myBookingsRes.body.data.items[0].seats[0].label, "G12");
  assert.equal(
    myBookingsRes.body.data.items[0].ticketIssuance.isDemoPreview,
    true,
  );
});
