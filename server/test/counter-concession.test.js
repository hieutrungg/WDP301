import assert from "node:assert/strict";
import test from "node:test";
import { ConcessionOrder } from "../src/modules/concession/order.model.js";
import { createCounterConcessionOrderSchema } from "../src/modules/concession/counter-checkout.validation.js";
import { StockReservation } from "../src/modules/inventory/stock-reservation.model.js";
import { Payment } from "../src/modules/payment/payment.model.js";
import { PAYMENT_INDEXES } from "../src/modules/payment/payment.indexes.js";
import { runMigration } from "../src/migrations/20261027-counter-concession-pos.js";

const id = "507f1f77bcf86cd799439011";

test("counter concession request accepts cash/QR and rejects client price totals", () => {
  assert.equal(createCounterConcessionOrderSchema.safeParse({
    branchId: id,
    items: [{ itemType: "CONCESSION", itemId: id, quantity: 2 }],
    method: "CASH",
    idempotencyKey: "counter-sale-001",
    tenderedAmount: 100_000,
  }).success, true);
  assert.equal(createCounterConcessionOrderSchema.safeParse({
    branchId: id,
    items: [{ itemType: "COMBO", itemId: id, quantity: 1 }],
    method: "VNPAY_QR",
    idempotencyKey: "counter-sale-002",
    totalAmount: 1,
  }).success, false);
});

test("order-first persistence keeps booking optional and adds one payment per order", () => {
  assert.equal(Boolean(ConcessionOrder.schema.path("bookingId").isRequired), false);
  assert.equal(Boolean(ConcessionOrder.schema.path("customerAccountId").isRequired), false);
  assert.deepEqual(ConcessionOrder.schema.path("type").enumValues, ["ONLINE", "COUNTER"]);
  assert.equal(Boolean(StockReservation.schema.path("bookingId").isRequired), false);
  assert.equal(Boolean(Payment.schema.path("bookingId").isRequired), false);
  assert.equal(PAYMENT_INDEXES.some(({ options }) => options.name === "uniq_payment_order"), true);
});

test("a new standalone Payment accepts the nullable refund fields", async () => {
  const payment = new Payment({
    orderId: id,
    payableReference: "FD-TEST-001",
    customerAccountId: id,
    gatewayTransactionId: "CASH-TEST-001",
    method: "CASH",
    amount: 94_000,
    currency: "VND",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    attempts: [],
  });
  await payment.validate();
  assert.equal(payment.refundedAmount, null);
});

test("counter concession migration is dry-run by default", async () => {
  await runMigration(["--db", "counter_concession_test"]);
});
