import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { createBookingService } from "../src/modules/booking/booking.service.js";

const fixture = () => {
  const now = new Date("2026-10-24T05:00:00Z");
  const booking = {
    _id: new mongoose.Types.ObjectId(),
    paymentId: new mongoose.Types.ObjectId(),
    holdId: new mongoose.Types.ObjectId(),
    customerAccountId: new mongoose.Types.ObjectId(),
    expiresAt: new Date(now.getTime() + 60000),
    status: "PENDING_PAYMENT",
    seatIds: [],
  };
  const calls = [];
  const session = { id: "transaction" };
  const repository = {
    withTransaction: async (work) => work(session),
    findById: async () => booking,
    markConfirmed: async (command, actualSession) => {
      calls.push("confirm");
      assert.equal(actualSession, session);
      return {
        ...booking,
        status: "CONFIRMED",
        confirmedAt: command.confirmedAt,
      };
    },
    markExpired: async (command, actualSession) => {
      calls.push("expire");
      assert.equal(actualSession, session);
      return { ...booking, status: "EXPIRED", expiredAt: command.expiredAt };
    },
  };
  const seatHoldPort = {
    getLiveHoldForBooking: async () => null,
    consumeHoldForBooking: async (command) => {
      calls.push("consume");
      assert.equal(command.session, session);
      return { outcome: "CONSUMED" };
    },
    expireHoldForBooking: async (command) => {
      calls.push("release");
      assert.equal(command.session, session);
      return { status: "EXPIRED" };
    },
  };
  const service = () =>
    createBookingService({ repository, seatHoldPort, clock: () => now });
  return {
    booking,
    now,
    calls,
    repository,
    seatHoldPort,
    service,
    command: {
      bookingId: booking._id,
      paymentId: booking.paymentId,
      verifiedAt: now,
    },
  };
};

test("BOOK-010 confirms only after the hold port succeeds and persistence returns CONFIRMED", async () => {
  const f = fixture();
  assert.equal(
    (await f.service().confirmBookingAfterVerifiedPayment(f.command)).booking
      .status,
    "CONFIRMED",
  );
  assert.deepEqual(f.calls, ["consume", "confirm"]);
  f.repository.markConfirmed = async () => null;
  await assert.rejects(
    f.service().confirmBookingAfterVerifiedPayment(f.command),
    { code: "BOOKING_HOLD_NOT_AVAILABLE" },
  );
});
test("BOOK-010 missing transaction/hold adapters and invalid verification input never write", async () => {
  for (const invalid of ["transaction", "consume", "payment", "time"]) {
    const f = fixture();
    if (invalid === "transaction") f.repository.withTransaction = undefined;
    if (invalid === "consume") f.seatHoldPort.consumeHoldForBooking = undefined;
    if (invalid === "payment") f.command.paymentId = undefined;
    if (invalid === "time") f.command.verifiedAt = "invalid";
    await assert.rejects(
      f.service().confirmBookingAfterVerifiedPayment(f.command),
      TypeError,
    );
    assert.deepEqual(f.calls, []);
  }
});
test("BOOK-010 terminal states are monotonic and duplicate success cannot bind another Payment", async () => {
  const f = fixture();
  f.booking.status = "CONFIRMED";
  assert.equal(
    (await f.service().confirmBookingAfterVerifiedPayment(f.command)).outcome,
    "ALREADY_CONFIRMED",
  );
  await assert.rejects(
    f
      .service()
      .confirmBookingAfterVerifiedPayment({
        ...f.command,
        paymentId: new mongoose.Types.ObjectId(),
      }),
    { code: "BOOKING_HOLD_NOT_AVAILABLE" },
  );
  f.booking.status = "EXPIRED";
  assert.equal(
    (await f.service().confirmBookingAfterVerifiedPayment(f.command)).outcome,
    "EXPIRED_REVIEW_REQUIRED",
  );
  f.booking.status = "UNKNOWN";
  await assert.rejects(
    f.service().confirmBookingAfterVerifiedPayment(f.command),
    { code: "BOOKING_HOLD_NOT_AVAILABLE" },
  );
  assert.deepEqual(f.calls, []);
});
test("BOOK-010 exactly expired success releases through the owner port before persisting EXPIRED", async () => {
  const f = fixture();
  f.command.verifiedAt = f.booking.expiresAt;
  assert.equal(
    (await f.service().confirmBookingAfterVerifiedPayment(f.command)).outcome,
    "EXPIRED_REVIEW_REQUIRED",
  );
  assert.deepEqual(f.calls, ["release", "expire"]);
});
test("BOOK-010 does not fabricate expiry or expire a consumed hold", async () => {
  const f = fixture();
  f.now.setTime(f.booking.expiresAt.getTime());
  f.repository.markExpired = async () => null;
  await assert.rejects(
    f
      .service()
      .getCustomerBookingDetails({
        bookingId: f.booking._id,
        ownerId: f.booking.customerAccountId,
      }),
    { code: "BOOKING_HOLD_NOT_AVAILABLE" },
  );
  f.seatHoldPort.expireHoldForBooking = async () => ({ status: "CONSUMED" });
  await assert.rejects(
    f
      .service()
      .getCustomerBookingDetails({
        bookingId: f.booking._id,
        ownerId: f.booking.customerAccountId,
      }),
    { code: "BOOKING_HOLD_NOT_AVAILABLE" },
  );
});
