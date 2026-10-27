import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { BOOKING_STATUS } from "../src/modules/booking/booking.constants.js";
import { createMockPaymentGateway } from "../src/modules/payment/mock-payment-gateway.js";
import {
  PAYMENT_ATTEMPT_STATUS,
  PAYMENT_ERROR_CODE,
  PAYMENT_METHODS,
  PAYMENT_RECONCILIATION_REASON,
  PAYMENT_STATUS,
} from "../src/modules/payment/payment.constants.js";
import { createPaymentController } from "../src/modules/payment/payment.controller.js";
import { createPaymentGatewayRouter } from "../src/modules/payment/payment-gateway-router.js";
import { createPaymentRouter } from "../src/modules/payment/payment.routes.js";
import {
  createPayosGateway,
  signWebhookData,
} from "../src/modules/payment/payos-gateway.js";
import { createInMemoryHarness } from "./helpers/payment-harness.js";

const CREDENTIALS = {
  clientId: "test-client",
  apiKey: "test-api-key",
  checksumKey: "test-checksum-key",
  baseUrl: "https://payos.test",
};

const hmac = (text) => createHmac("sha256", CREDENTIALS.checksumKey).update(text).digest("hex");

// In-memory stand-in for the payOS merchant API, reached through the real adapter via fetch.
const createFakePayos = () => {
  const links = new Map();
  const calls = [];
  const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  let nextOrderCode = 1793000000000001;

  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, pathname, headers: init.headers, body });
    if (init.method === "POST" && pathname === "/v2/payment-requests") {
      links.set(body.orderCode, { amount: body.amount, amountPaid: 0, status: "PENDING", transactions: [] });
      return reply({
        code: "00",
        desc: "success",
        data: {
          bin: "970422",
          accountNumber: "VQRQ0001",
          accountName: "F CINEMA",
          amount: body.amount,
          description: body.description,
          orderCode: body.orderCode,
          paymentLinkId: `link-${body.orderCode}`,
          status: "PENDING",
          checkoutUrl: `https://pay.payos.vn/web/link-${body.orderCode}`,
          qrCode: `00020101021238570010A000000727${body.orderCode}5303704540${body.amount}5802VN6304ABCD`,
        },
      });
    }
    const match = pathname.match(/^\/v2\/payment-requests\/(\d+)(\/cancel)?$/);
    const link = match && links.get(Number(match[1]));
    if (!link) return reply({ code: "101", desc: "Payment link not found", data: null }, 404);
    if (match[2]) {
      if (link.status === "PAID") return reply({ code: "101", desc: "Already paid", data: null }, 400);
      link.status = "CANCELLED";
    }
    return reply({ code: "00", desc: "success", data: { orderCode: Number(match[1]), ...link } });
  };

  return {
    calls,
    links,
    fetchImpl,
    orderCodeFactory: () => nextOrderCode++,
    pay(orderCode, amountPaid = links.get(orderCode).amount) {
      Object.assign(links.get(orderCode), {
        status: "PAID",
        amountPaid,
        transactions: [{ reference: `FT${orderCode}`, amount: amountPaid, transactionDateTime: "2026-10-22 14:05:00" }],
      });
    },
    setStatus(orderCode, status) {
      links.get(orderCode).status = status;
    },
    statusCalls: () => calls.filter((call) => call.method === "GET").length,
    cancelCalls: () => calls.filter((call) => call.pathname.endsWith("/cancel")).map((call) => call.pathname),
  };
};

const createPayosHarness = (options = {}) => {
  const payos = createFakePayos();
  const gateway = createPaymentGatewayRouter({
    mock: createMockPaymentGateway(),
    payos: createPayosGateway({ ...CREDENTIALS, fetchImpl: payos.fetchImpl, orderCodeFactory: payos.orderCodeFactory }),
  });
  const harness = createInMemoryHarness({ gateway, clientUrl: () => "http://localhost:5173/", ...options });
  return { ...harness, payos, gateway };
};

const startBankTransfer = async (harness, key = "bank") => {
  const booking = await harness.bookingService.createPendingBookingFromHold({
    holdId: harness.holdId,
    ownerId: harness.ownerId,
    requestKey: `req-${key}`,
  });
  const initiated = await harness.paymentService.initiatePayment({
    bookingId: booking.bookingId,
    ownerId: harness.ownerId,
    method: PAYMENT_METHODS.BANK_TRANSFER,
    idempotencyKey: `idem-${key}-0001`,
  });
  return { booking, initiated };
};

const verify = (harness, initiated, force = true) =>
  harness.paymentService.verifyProviderAttempt({
    paymentId: initiated.payment.paymentId,
    attemptId: initiated.activeAttempt.attemptId,
    ownerId: harness.ownerId,
    force,
  });

test("payOS adapter signs the payment request exactly as payOS specifies and maps the VietQR response", async () => {
  const payos = createFakePayos();
  const gateway = createPayosGateway({ ...CREDENTIALS, fetchImpl: payos.fetchImpl, orderCodeFactory: () => 1793000000123456 });
  const expiresAt = new Date("2026-10-22T07:10:00.000Z");

  const instruction = await gateway.createAttemptInstruction({
    method: "BANK_TRANSFER",
    amount: 190000,
    expiresAt,
    returnUrl: "http://localhost:5173/bookings/b1/confirmation",
    cancelUrl: "http://localhost:5173/booking/s1/checkout",
  });

  const [call] = payos.calls;
  assert.equal(call.method, "POST");
  assert.equal(call.pathname, "/v2/payment-requests");
  assert.equal(call.headers["x-client-id"], "test-client");
  assert.equal(call.headers["x-api-key"], "test-api-key");
  assert.equal(call.body.description, "FC0123456");
  assert.ok(call.body.description.length <= 9);
  assert.equal(call.body.expiredAt, Math.floor(expiresAt.getTime() / 1000));
  assert.equal(
    call.body.signature,
    hmac(
      "amount=190000&cancelUrl=http://localhost:5173/booking/s1/checkout&description=FC0123456&orderCode=1793000000123456&returnUrl=http://localhost:5173/bookings/b1/confirmation",
    ),
  );

  assert.equal(instruction.provider, "PAYOS");
  assert.equal(instruction.isDemo, false);
  assert.equal(instruction.providerOrderCode, 1793000000123456);
  assert.equal(instruction.gatewayTransactionRef, "PAYOS-1793000000123456");
  assert.match(instruction.qrPayload, /^000201/);
  assert.deepEqual(instruction.bankAccount, { bin: "970422", accountNumber: "VQRQ0001", accountName: "F CINEMA" });
  assert.equal(instruction.transferContent, "FC0123456");
  assert.match(instruction.checkoutUrl, /^https:\/\/pay\.payos\.vn\//);
});

test("payOS adapter fails closed on provider errors, unreachable API and amount mismatch", async () => {
  const failing = (impl) => createPayosGateway({ ...CREDENTIALS, fetchImpl: impl });
  const input = { method: "BANK_TRANSFER", amount: 1000, expiresAt: new Date(), returnUrl: "r", cancelUrl: "c" };
  const isProviderError = (error) => error.statusCode === 502 && error.code === PAYMENT_ERROR_CODE.PAYMENT_PROVIDER_ERROR;

  await assert.rejects(
    failing(async () => ({ ok: true, status: 200, json: async () => ({ code: "20", desc: "Invalid signature", data: null }) })).createAttemptInstruction(input),
    isProviderError,
  );
  await assert.rejects(
    failing(async () => { throw new Error("ECONNREFUSED"); }).createAttemptInstruction(input),
    isProviderError,
  );
  await assert.rejects(
    failing(async () => ({ ok: true, status: 200, json: async () => ({ code: "00", data: { amount: 999, qrCode: "000201" } }) })).createAttemptInstruction(input),
    isProviderError,
  );
  assert.throws(() => createPayosGateway({ clientId: "x" }), TypeError);
});

test("payOS webhook signature is verified over key-sorted data and rejects any tampering", () => {
  const gateway = createPayosGateway(CREDENTIALS);
  const data = {
    orderCode: 1793000000000001,
    amount: 190000,
    description: "FC0000001",
    accountNumber: "VQRQ0001",
    reference: "FT123",
    transactionDateTime: "2026-10-22 14:05:00",
    currency: "VND",
    paymentLinkId: "link-1",
    code: "00",
    desc: "success",
    counterAccountBankId: null,
    counterAccountName: undefined,
  };
  const expected = hmac(
    "accountNumber=VQRQ0001&amount=190000&code=00&counterAccountBankId=&counterAccountName=&currency=VND&desc=success&description=FC0000001&orderCode=1793000000000001&paymentLinkId=link-1&reference=FT123&transactionDateTime=2026-10-22 14:05:00",
  );
  assert.equal(signWebhookData(CREDENTIALS.checksumKey, data), expected);
  assert.deepEqual(gateway.verifyWebhook({ code: "00", data, signature: expected }), data);

  const rejects = (body) =>
    assert.throws(() => gateway.verifyWebhook(body), (error) => error.statusCode === 400 && error.code === PAYMENT_ERROR_CODE.INVALID_PROVIDER_SIGNATURE);
  rejects({ data: { ...data, amount: 1 }, signature: expected });
  rejects({ data, signature: "0".repeat(64) });
  rejects({ data, signature: undefined });
  rejects({ signature: expected });
});

test("gateway router keeps the mock offline and refuses unpayable bank transfers in production", async () => {
  const input = { attemptId: "ATT-1", attemptNumber: 1, payableReference: "PAY-1", amount: 1000, expiresAt: new Date() };
  const dev = createPaymentGatewayRouter({ isProduction: () => false });
  const devBank = await dev.createAttemptInstruction({ ...input, method: "BANK_TRANSFER" });
  assert.equal(devBank.provider, "INTERNAL_MOCK_GATEWAY");
  assert.equal(dev.hasPayos, false);

  const prod = createPaymentGatewayRouter({ isProduction: () => true });
  await assert.rejects(
    prod.createAttemptInstruction({ ...input, method: "BANK_TRANSFER" }),
    (error) => error.statusCode === 503 && error.code === PAYMENT_ERROR_CODE.PAYMENT_PROVIDER_UNAVAILABLE,
  );
  const prodMock = await prod.createAttemptInstruction({ ...input, method: "MOMO_WALLET" });
  assert.equal(prodMock.provider, "INTERNAL_MOCK_GATEWAY");
  assert.throws(() => prod.verifyProviderWebhook({}), (error) => error.statusCode === 503);
});

test("bank transfer creates a payOS attempt whose redirects return to C15 and C14", async () => {
  const harness = createPayosHarness();
  const { booking, initiated } = await startBankTransfer(harness);

  assert.equal(initiated.activeAttempt.provider, "PAYOS");
  assert.equal(initiated.activeAttempt.status, PAYMENT_ATTEMPT_STATUS.PENDING);
  assert.match(initiated.activeAttempt.qrPayload, /^000201/);
  const [create] = harness.payos.calls;
  assert.equal(create.body.amount, 190000);
  assert.equal(create.body.returnUrl, `http://localhost:5173/bookings/${booking.bookingId}/confirmation`);
  assert.equal(create.body.cancelUrl, `http://localhost:5173/booking/${harness.showtimeId}/checkout`);
  const stored = harness.payments.get(initiated.payment.paymentId);
  assert.equal(stored.attempts[0].providerOrderCode, create.body.orderCode);
});

test("verification settles only after payOS reports PAID, issues tickets once and is throttled while pending", async () => {
  const harness = createPayosHarness();
  const { booking, initiated } = await startBankTransfer(harness, "verify");
  const orderCode = initiated.activeAttempt.instruction.providerOrderCode;

  const pending = await verify(harness, initiated, false);
  assert.equal(pending.providerStatus, "PENDING");
  assert.equal(pending.payment.status, PAYMENT_STATUS.PENDING);
  assert.equal(harness.ticketRepository.tickets.size, 0);
  // A second poll inside the throttle window does not call payOS again.
  await verify(harness, initiated, false);
  assert.equal(harness.payos.statusCalls(), 1);

  harness.payos.pay(orderCode);
  const paid = await verify(harness, initiated);
  assert.equal(paid.providerStatus, "PAID");
  assert.equal(paid.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(paid.booking.status, BOOKING_STATUS.CONFIRMED);
  assert.equal(harness.ticketRepository.tickets.size, 2);
  const stored = harness.payments.get(initiated.payment.paymentId);
  assert.equal(stored.gatewayResponse.providerSettlement.amountPaid, 190000);
  assert.equal(stored.gatewayResponse.providerSettlement.transactions[0].reference, `FT${orderCode}`);

  // Settled attempts are not re-checked and never issue more tickets.
  const callsBefore = harness.payos.statusCalls();
  const again = await verify(harness, initiated);
  assert.equal(again.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(harness.payos.statusCalls(), callsBefore);
  assert.equal(harness.ticketRepository.tickets.size, 2);
  assert.equal(harness.getStats().holdConsumedCount, 1);

  const details = await harness.paymentService.getBookingPaymentDetails({ bookingId: booking.bookingId, ownerId: harness.ownerId });
  assert.equal(details.ticketIssuance.status, "ISSUED");
});

test("an underpaid transfer is never settled and a cancelled payOS link fails the attempt", async () => {
  const harness = createPayosHarness();
  const { initiated } = await startBankTransfer(harness, "underpaid");
  harness.payos.pay(initiated.activeAttempt.instruction.providerOrderCode, 100000);
  const underpaid = await verify(harness, initiated);
  assert.equal(underpaid.payment.status, PAYMENT_STATUS.PENDING);
  assert.equal(harness.ticketRepository.tickets.size, 0);

  const second = createPayosHarness();
  const started = await startBankTransfer(second, "cancelled");
  second.payos.setStatus(started.initiated.activeAttempt.instruction.providerOrderCode, "CANCELLED");
  const cancelled = await verify(second, started.initiated);
  assert.equal(cancelled.activeAttempt.status, PAYMENT_ATTEMPT_STATUS.FAILED);
  assert.equal(cancelled.activeAttempt.failureReason, "PAYOS_LINK_CANCELLED");
  assert.equal(cancelled.booking.status, BOOKING_STATUS.PENDING_PAYMENT);
});

test("demo simulation still settles a bank-transfer attempt and closes the real payOS link", async () => {
  const harness = createPayosHarness();
  const { initiated } = await startBankTransfer(harness, "simulate");
  const orderCode = initiated.activeAttempt.instruction.providerOrderCode;

  const settled = await harness.paymentService.handlePaymentNotification({
    paymentId: initiated.payment.paymentId,
    attemptId: initiated.activeAttempt.attemptId,
    outcome: "SUCCESS",
    notificationKey: "ui-confirm",
    actorOwnerId: harness.ownerId,
    simulated: true,
  });
  assert.equal(settled.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(harness.ticketRepository.tickets.size, 2);
  assert.deepEqual(harness.payos.cancelCalls(), [`/v2/payment-requests/${orderCode}/cancel`]);
  assert.equal(harness.payos.links.get(orderCode).status, "CANCELLED");
  assert.equal(harness.payments.get(initiated.payment.paymentId).gatewayResponse.simulatedSettlement, true);
});

test("money received on a cancelled or superseded link is never lost", async () => {
  // Customer cancels in the UI but had already transferred: payOS PAID reopens and confirms.
  const harness = createPayosHarness();
  const { initiated } = await startBankTransfer(harness, "reopen");
  const orderCode = initiated.activeAttempt.instruction.providerOrderCode;
  harness.payos.pay(orderCode);
  const cancelled = await harness.paymentService.cancelPaymentAttempt({
    paymentId: initiated.payment.paymentId,
    attemptId: initiated.activeAttempt.attemptId,
    ownerId: harness.ownerId,
  });
  assert.equal(cancelled.activeAttempt.status, PAYMENT_ATTEMPT_STATUS.CANCELLED);
  const reopened = await verify(harness, initiated);
  assert.equal(reopened.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(reopened.booking.status, BOOKING_STATUS.CONFIRMED);
  assert.equal(harness.ticketRepository.tickets.size, 2);

  // A second link paid after another attempt settled is flagged for refund, booking unchanged.
  const dup = createPayosHarness();
  const first = await startBankTransfer(dup, "dup");
  const firstCode = first.initiated.activeAttempt.instruction.providerOrderCode;
  const secondAttempt = await dup.paymentService.initiatePayment({
    bookingId: first.booking.bookingId,
    ownerId: dup.ownerId,
    method: PAYMENT_METHODS.BANK_TRANSFER,
    idempotencyKey: "idem-dup-0002",
  });
  assert.deepEqual(dup.payos.cancelCalls(), [`/v2/payment-requests/${firstCode}/cancel`]);
  dup.payos.pay(secondAttempt.activeAttempt.instruction.providerOrderCode);
  await verify(dup, secondAttempt);
  dup.payos.links.get(firstCode).status = "PAID";
  dup.payos.links.get(firstCode).amountPaid = 190000;
  const duplicate = await verify(dup, first.initiated);
  assert.equal(duplicate.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(duplicate.payment.reconciliationReason, PAYMENT_RECONCILIATION_REASON.DUPLICATE_PROVIDER_PAYMENT);
  assert.equal(duplicate.payment.settlementAttemptId, secondAttempt.activeAttempt.attemptId);
  assert.equal(dup.ticketRepository.tickets.size, 2);
});

test("a transfer that completes after the seat hold expired goes to review and issues no ticket", async () => {
  const harness = createPayosHarness();
  const { initiated } = await startBankTransfer(harness, "late");
  harness.advanceTimeMs(11 * 60 * 1000);
  harness.payos.pay(initiated.activeAttempt.instruction.providerOrderCode);
  const late = await verify(harness, initiated);
  assert.equal(late.payment.status, PAYMENT_STATUS.REVIEW_REQUIRED);
  assert.equal(late.booking.status, BOOKING_STATUS.EXPIRED);
  assert.equal(harness.ticketRepository.tickets.size, 0);
});

test("C15 details settle a paid transfer on return from payOS, and the webhook settles via the same check", async () => {
  const harness = createPayosHarness();
  const { booking, initiated } = await startBankTransfer(harness, "return");
  harness.payos.pay(initiated.activeAttempt.instruction.providerOrderCode);
  const details = await harness.paymentService.getBookingPaymentDetails({ bookingId: booking.bookingId, ownerId: harness.ownerId });
  assert.equal(details.payment.status, PAYMENT_STATUS.PAID);
  assert.equal(details.booking.status, BOOKING_STATUS.CONFIRMED);
  assert.equal(details.ticketIssuance.ticketCount, 2);

  const hook = createPayosHarness();
  const started = await startBankTransfer(hook, "webhook");
  const orderCode = started.initiated.activeAttempt.instruction.providerOrderCode;
  hook.payos.pay(orderCode);
  const data = { orderCode, amount: 190000, code: "00", desc: "success", reference: `FT${orderCode}` };
  const signed = { code: "00", success: true, data, signature: signWebhookData(CREDENTIALS.checksumKey, data) };
  const result = await hook.paymentService.handlePayosWebhook(signed);
  assert.deepEqual(result, { acknowledged: true, matched: true, paymentStatus: PAYMENT_STATUS.PAID });
  assert.equal(hook.ticketRepository.tickets.size, 2);

  const unknown = { orderCode: 123, amount: 1000, code: "00" };
  assert.deepEqual(
    await hook.paymentService.handlePayosWebhook({ data: unknown, signature: signWebhookData(CREDENTIALS.checksumKey, unknown) }),
    { acknowledged: true, matched: false },
  );
});

test("HTTP: verify is owner-only behind auth, the webhook is public but signature-checked", async (t) => {
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "payos-route-test-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  const harness = createPayosHarness();
  const { initiated } = await startBankTransfer(harness, "http");
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api/payments", createPaymentRouter(createPaymentController(harness.paymentService)));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/payments`;
  const post = async (path, { accountId, body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accountId ? { Cookie: `accessToken=${jwt.sign({ sub: accountId }, process.env.JWT_ACCESS_SECRET)}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const verifyPath = `/${initiated.payment.paymentId}/attempts/${initiated.activeAttempt.attemptId}/verify`;

  assert.equal((await post(verifyPath)).status, 401);
  const foreign = await post(verifyPath, { accountId: harness.otherOwnerId });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.body.code, PAYMENT_ERROR_CODE.PAYMENT_FORBIDDEN);
  const owned = await post(verifyPath, { accountId: harness.ownerId });
  assert.equal(owned.status, 200);
  assert.equal(owned.body.data.providerStatus, "PENDING");

  const forged = await post("/providers/payos/webhook", { body: { data: { orderCode: 1 }, signature: "bad" } });
  assert.equal(forged.status, 400);
  assert.equal(forged.body.code, PAYMENT_ERROR_CODE.INVALID_PROVIDER_SIGNATURE);
});
