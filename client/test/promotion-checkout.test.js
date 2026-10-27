import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fromVietnamInput,
  toVietnamInput,
  validPercentage,
} from "../src/features/promotions/utils/promotionForm.js";
import { bookingMatchesHold } from "../src/features/booking/utils/checkoutSession.js";

test("promotion dates use Vietnam time regardless of machine timezone; percentage precision matches backend", () => {
  assert.equal(
    fromVietnamInput("2026-10-27T20:15"),
    "2026-10-27T13:15:00.000Z",
  );
  assert.equal(toVietnamInput("2026-10-27T13:15:00.000Z"), "2026-10-27T20:15");
  for (const bad of [0, -1, 20.01, 1.001, NaN])
    assert.equal(validPercentage(bad), false);
  assert.equal(validPercentage(19.99), true);
});
test("checkout replay accepts server voucher snapshots without changing seat price or food, rejects corrupted totals", () => {
  const hold = {
    holdId: "h",
    expiresAt: "2026-10-27T14:00:00Z",
    priceQuote: { totalAmount: 200005 },
  };
  const booking = {
    bookingId: "b",
    payableReference: "p",
    status: "PENDING_PAYMENT",
    currency: "VND",
    expiresAt: hold.expiresAt,
    ticketAmount: 200005,
    concessionAmount: 80000,
    amount: 260005,
    discountAmount: 20000,
    voucher: { code: "TEN" },
    concessionOrder: { totalAmount: 80000, branchId: "branch" },
  };
  const quote = {
    holdId: "h",
    currency: "VND",
    ticketAmount: 200005,
    concessionAmount: 80000,
    amount: 280005,
    branchId: "branch",
  };
  assert.equal(bookingMatchesHold(booking, hold, quote), true);
  assert.equal(
    bookingMatchesHold({ ...booking, amount: 280005 }, hold, quote),
    false,
  );
  assert.equal(
    bookingMatchesHold({ ...booking, voucher: null }, hold, quote),
    false,
  );
  assert.equal(
    bookingMatchesHold({ ...booking, concessionAmount: 60000 }, hold, quote),
    false,
  );
  assert.equal(
    bookingMatchesHold({ ...booking, discountAmount: -1 }, hold, quote),
    false,
  );
  assert.equal(
    bookingMatchesHold(
      { ...booking, amount: 180005, concessionAmount: 0 },
      hold,
    ),
    true,
  );
});
