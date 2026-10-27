import assert from "node:assert/strict";
import { test } from "node:test";
import {
  discountForTickets,
  percentageBasisPoints,
} from "../src/modules/promotion/promotion.policy.js";
import {
  createPromotionSchema,
  createVoucherSchema,
  applyVoucherSchema,
} from "../src/modules/promotion/promotion.validation.js";
import {
  validPromotion,
  validVoucher,
  indexMatches,
} from "../src/modules/promotion/promotion.storage.js";
import { createRefundService } from "../src/modules/refund/refund.service.js";
import { assertVoucherBookingSnapshot } from "../src/modules/booking/booking-voucher.service.js";
import { createPaymentService } from "../src/modules/payment/payment.service.js";

test("Payment idempotent replay rejects a stored amount inconsistent with frozen Booking", async () => {
  const booking = {
    _id: "b",
    customerAccountId: "c",
    totalAmount: 1000,
    pricingVersion: 1,
  };
  const service = createPaymentService({
    bookingService: {
      getBookingForPayment: async () => booking,
      lockPricingForPayment: async () => booking,
    },
    paymentRepository: {
      findByAttemptIdempotencyKey: async () => ({
        bookingId: "b",
        amount: 900,
        pricingVersion: 1,
        attempts: [{ idempotencyKey: "retry", method: "MOMO_WALLET" }],
      }),
    },
  });
  await assert.rejects(
    service.initiatePayment({
      bookingId: "b",
      ownerId: "c",
      method: "MOMO_WALLET",
      idempotencyKey: "retry",
    }),
    { code: "PAYMENT_AMOUNT_MISMATCH" },
  );
});

test("untraceable legacy discounts and altered snapshots fail closed before Payment/confirmation", () => {
  assert.doesNotThrow(() =>
    assertVoucherBookingSnapshot({ discountAmount: 0 }),
  );
  for (const invalid of [
    { discountAmount: 100 },
    { voucherId: "legacy" },
    {
      subtotal: 1000,
      discountAmount: 100,
      totalAmount: 900,
      voucherId: "a",
      voucherSnapshot: {
        voucherId: "a",
        reservationId: "000000000000000000000001",
        discountValue: 10,
        discountAmount: 99,
      },
    },
  ]) {
    assert.throws(() => assertVoucherBookingSnapshot(invalid), {
      code: "VOUCHER_STORAGE_NOT_READY",
    });
  }
});

test("percentage precision, max 20, floor once on ticket aggregate, safe arithmetic", () => {
  for (const bad of [
    0,
    -1,
    20.01,
    10.001,
    10.000000000001,
    NaN,
    Infinity,
    "10",
  ])
    assert.throws(() => percentageBasisPoints(bad));
  assert.equal(percentageBasisPoints(19.99), 1999);
  assert.equal(discountForTickets(200005, 10), 20000);
  assert.equal(discountForTickets(100005, 20), 20001);
  assert.equal(
    discountForTickets(Number.MAX_SAFE_INTEGER, 20),
    Number(BigInt(Number.MAX_SAFE_INTEGER) / 5n),
  );
  assert.throws(() => discountForTickets(0.5, 10));
});
test("strict contracts reject custom conditions, money, fixed amounts, missing quota, invalid dates", () => {
  const p = {
    name: "Weekend",
    discountValue: 10,
    status: "ACTIVE",
    startDate: "2026-10-27T00:00:00Z",
    endDate: "2026-10-28T00:00:00Z",
  };
  assert.equal(createPromotionSchema.safeParse(p).success, true);
  for (const extra of [
    { discountType: "FIXED" },
    { minimumSpend: 200000 },
    { branchId: "a" },
    { discountValue: 21 },
    { endDate: p.startDate },
  ])
    assert.equal(
      createPromotionSchema.safeParse({ ...p, ...extra }).success,
      false,
    );
  assert.deepEqual(
    createVoucherSchema.parse({
      code: " summer10 ",
      usageLimit: null,
      status: "ACTIVE",
    }).code,
    "SUMMER10",
  );
  assert.equal(
    createVoucherSchema.safeParse({ code: "SUMMER10", status: "ACTIVE" })
      .success,
    false,
  );
  assert.equal(
    applyVoucherSchema.safeParse({
      code: "SUMMER10",
      requestKey: "k",
      expectedPricingVersion: 0,
      discountAmount: 5,
    }).success,
    false,
  );
});
test("legacy data and weakened unique indexes fail validation", () => {
  assert.equal(validPromotion({ name: "legacy", discountValue: 10 }), false);
  assert.equal(validVoucher({ code: "abc" }), false);
  assert.equal(
    indexMatches(
      { key: { code: 1 }, unique: true, sparse: true },
      { code: 1 },
      { unique: true },
    ),
    false,
  );
  assert.equal(
    indexMatches(
      {
        key: { bookingId: 1 },
        unique: true,
        partialFilterExpression: { blocking: true },
      },
      { bookingId: 1 },
      { unique: true, partialFilterExpression: { blocking: true } },
    ),
    true,
  );
});
test("refund returns net paid tickets plus unfulfilled food and rejects untraceable discounts", async () => {
  const now = new Date();
  for (const fulfilled of [false, true]) {
    const data = {
      booking: {
        _id: "b",
        customerAccountId: "c",
        status: "CONFIRMED",
        subtotal: 200005,
        discountAmount: 20000,
        voucherSnapshot: { code: "TEN" },
      },
      payment: { _id: "p", status: "PAID", amount: 260005 },
      order: {
        totalAmount: 80000,
        pickupStatus: fulfilled ? "FULFILLED" : "AWAITING_PICKUP",
      },
      showtime: { startAt: new Date(+now + 7200000) },
      checkedIn: false,
    };
    const repository = {
      loadEligibility: async () => data,
      findByBookingId: async () => null,
      create: async (input) => ({ ...input, _id: "r" }),
    };
    const service = createRefundService({
      repository,
      provider: {},
      clock: () => now,
    });
    const refund = await service.request({
      bookingId: "b",
      customerAccountId: "c",
      reason: "Cannot attend",
    });
    assert.equal(refund.ticketAmount, 180005);
    assert.equal(refund.refundAmount, fulfilled ? 180005 : 260005);
    delete data.booking.voucherSnapshot;
    await assert.rejects(
      service.request({ bookingId: "b", customerAccountId: "c" }),
      /require review/,
    );
  }
});
