import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { BOOKING_STATUS } from "../src/modules/booking/booking.constants.js";
import { createBookingController } from "../src/modules/booking/booking.controller.js";
import { BOOKING_INDEXES } from "../src/modules/booking/booking.indexes.js";
import { Booking } from "../src/modules/booking/booking.model.js";
import { createBookingService } from "../src/modules/booking/booking.service.js";
import { createPendingBookingSchema } from "../src/modules/booking/booking.validation.js";
import { ensureBooking009Indexes } from "../src/migrations/20261017-booking-009-indexes.js";

const objectId = () => new mongoose.Types.ObjectId().toString();

const makeFixture = () => {
  const ownerId = objectId();
  const holdId = objectId();
  const showtimeId = objectId();
  const seatIds = [objectId(), objectId()];
  const now = new Date("2026-10-15T05:00:00.000Z");
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const session = { id: "booking-transaction" };
  const calls = { transactions: 0 };
  const stored = [];
  const hold = {
    _id: holdId,
    ownerId,
    showtimeId,
    seatIds,
    status: "ACTIVE",
    expiresAt,
    priceSnapshot: {
      quoteId: "quote-001",
      currency: "VND",
      lines: seatIds.map((seatId, index) => ({
        seatId,
        unitPrice: 90000 + index * 10000,
      })),
      totalAmount: 190000,
    },
  };
  const repository = {
    async withTransaction(work) {
      calls.transactions += 1;
      return work(session);
    },
    async findByCustomerRequestKey(customerAccountId, requestKey) {
      return (
        stored.find(
          (booking) =>
            booking.customerAccountId.toString() ===
              customerAccountId.toString() && booking.requestKey === requestKey,
        ) ?? null
      );
    },
    async findByHoldId(requestedHoldId) {
      return (
        stored.find(
          (booking) => booking.holdId.toString() === requestedHoldId.toString(),
        ) ?? null
      );
    },
    async createPending(input) {
      stored.push(input);
      return input;
    },
  };
  const seatHoldPort = {
    async getLiveHoldForBooking(command) {
      assert.equal(command.holdId, holdId);
      assert.equal(command.ownerId, ownerId);
      assert.equal(command.session, session);
      assert.equal(command.now.getTime(), now.getTime());
      return hold;
    },
  };
  const service = createBookingService({
    repository,
    seatHoldPort,
    clock: () => new Date(now),
    idFactory: () => new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
    bookingCodeFactory: () => "FC-BOOKING-001",
    payableReferenceFactory: () => "PAY-BOOKING-001",
  });

  return {
    calls,
    expiresAt,
    hold,
    holdId,
    now,
    ownerId,
    repository,
    seatHoldPort,
    seatIds,
    service,
    stored,
  };
};

test("Booking model stores the approved lifecycle and per-seat price snapshots", () => {
  assert.equal(Booking.schema.options.autoIndex, false);
  assert.deepEqual(
    Booking.schema.path("status").enumValues,
    Object.values(BOOKING_STATUS),
  );
  assert.equal(
    Booking.schema.path("status").defaultValue,
    BOOKING_STATUS.PENDING_PAYMENT,
  );
  assert.deepEqual(Booking.schema.path("channel").enumValues, [
    "ONLINE",
    "COUNTER",
  ]);
  assert.equal(Booking.schema.path("channel").defaultValue, "ONLINE");
  assert.equal(Booking.schema.path("createdByStaffId").options.ref, "Account");
  const indexes = new Map(
    Booking.schema
      .indexes()
      .map(([fields, options]) => [options.name, { fields, options }]),
  );
  assert.deepEqual(
    indexes.get("uniq_booking_hold").options.partialFilterExpression,
    {
      holdId: { $type: "objectId" },
    },
  );
  assert.deepEqual(
    indexes.get("uniq_booking_customer_request").options
      .partialFilterExpression,
    {
      requestKey: { $type: "string" },
    },
  );
});

test("BOOK-009 migration creates the same backward-compatible indexes as the model", async () => {
  const calls = [];
  const database = {
    collection(name) {
      assert.equal(name, "bookings");
      return {
        listIndexes() {
          return {
            async toArray() {
              return [];
            },
          };
        },
        async createIndex(fields, options) {
          calls.push({ fields, options });
          return options.name;
        },
      };
    },
  };

  const created = await ensureBooking009Indexes(database);
  assert.deepEqual(calls, BOOKING_INDEXES);
  assert.deepEqual(
    created,
    BOOKING_INDEXES.map(({ options }) => options.name),
  );
});

test("BOOK-009 input accepts only a valid hold and idempotency key", () => {
  const parsed = createPendingBookingSchema.parse({
    holdId: objectId(),
    requestKey: "booking-request-valid",
    ownerId: objectId(),
  });

  assert.equal("ownerId" in parsed, false);
  assert.equal(
    createPendingBookingSchema.safeParse({
      holdId: "invalid",
      requestKey: "short",
    }).success,
    false,
  );
});

test("BOOK-009 creates a PENDING_PAYMENT booking from a live owner hold", async () => {
  const fixture = makeFixture();
  const result = await fixture.service.createPendingBookingFromHold({
    holdId: fixture.holdId,
    ownerId: fixture.ownerId,
    requestKey: "booking-request-001",
  });

  assert.deepEqual(result, {
    bookingId: "507f1f77bcf86cd799439011",
    status: BOOKING_STATUS.PENDING_PAYMENT,
    payableReference: "PAY-BOOKING-001",
    expiresAt: fixture.expiresAt.toISOString(),
    amount: 190000,
    ticketAmount: 190000,
    discountAmount: 0,
    concessionAmount: 0,
    pricingVersion: 0,
    pricingLocked: false,
    voucher: null,
    currency: "VND",
    idempotent: false,
  });
  assert.equal(fixture.stored[0].subtotal, 190000);
  assert.equal(fixture.stored[0].discountAmount, 0);
  assert.deepEqual(
    fixture.stored[0].seatLines.map(({ unitPrice }) => unitPrice),
    [90000, 100000],
  );
  assert.equal(fixture.stored[0].priceQuoteReference, "quote-001");
  assert.equal(fixture.calls.transactions, 1);
});

test("an identical booking request returns the existing pending booking", async () => {
  const fixture = makeFixture();
  const command = {
    holdId: fixture.holdId,
    ownerId: fixture.ownerId,
    requestKey: "booking-request-002",
  };
  const first = await fixture.service.createPendingBookingFromHold(command);
  const second = await fixture.service.createPendingBookingFromHold(command);

  assert.equal(second.bookingId, first.bookingId);
  assert.equal(second.idempotent, true);
  assert.equal(fixture.stored.length, 1);
});

test("reusing a booking request key for another hold is rejected", async () => {
  const fixture = makeFixture();
  await fixture.service.createPendingBookingFromHold({
    holdId: fixture.holdId,
    ownerId: fixture.ownerId,
    requestKey: "booking-request-003",
  });

  await assert.rejects(
    fixture.service.createPendingBookingFromHold({
      holdId: objectId(),
      ownerId: fixture.ownerId,
      requestKey: "booking-request-003",
    }),
    (error) =>
      error.statusCode === 409 && error.code === "BOOKING_REQUEST_KEY_REUSED",
  );
});

test("concurrent request-key reuse for a different hold returns the same 409 as a sequential reuse", async () => {
  const fixture = makeFixture();
  fixture.repository.createPending = async (input) => {
    // Another transaction won the unique customer/requestKey index after our initial lookup.
    fixture.stored.push({ ...input, holdId: new mongoose.Types.ObjectId() });
    throw Object.assign(new Error("duplicate request key"), { code: 11000 });
  };
  await assert.rejects(
    fixture.service.createPendingBookingFromHold({
      holdId: fixture.holdId,
      ownerId: fixture.ownerId,
      requestKey: "concurrent-booking-key",
    }),
    (error) =>
      error.statusCode === 409 && error.code === "BOOKING_REQUEST_KEY_REUSED",
  );
});

test("a duplicate-key race for the same hold recovers the winning booking", async () => {
  const fixture = makeFixture();
  fixture.repository.createPending = async (input) => {
    fixture.stored.push(input);
    throw Object.assign(new Error("duplicate hold"), { code: 11000 });
  };
  const result = await fixture.service.createPendingBookingFromHold({
    holdId: fixture.holdId,
    ownerId: fixture.ownerId,
    requestKey: "concurrent-same-hold",
  });
  assert.equal(result.idempotent, true);
  assert.equal(result.bookingId, fixture.stored[0]._id.toString());
});

test("an unrelated duplicate-key error is not reported as a request-key conflict", async () => {
  const fixture = makeFixture();
  const duplicate = Object.assign(new Error("duplicate booking code"), {
    code: 11000,
  });
  fixture.repository.createPending = async () => {
    throw duplicate;
  };
  await assert.rejects(
    fixture.service.createPendingBookingFromHold({
      holdId: fixture.holdId,
      ownerId: fixture.ownerId,
      requestKey: "unrelated-duplicate",
    }),
    (error) => error === duplicate,
  );
});

test("expired holds cannot create a pending booking", async () => {
  const fixture = makeFixture();
  fixture.hold.expiresAt = new Date(fixture.now.getTime() - 1);

  await assert.rejects(
    fixture.service.createPendingBookingFromHold({
      holdId: fixture.holdId,
      ownerId: fixture.ownerId,
      requestKey: "booking-request-004",
    }),
    (error) =>
      error.statusCode === 409 && error.code === "BOOKING_HOLD_EXPIRED",
  );
});

test("a malformed server-side price snapshot is rejected", async () => {
  const fixture = makeFixture();
  fixture.hold.priceSnapshot.totalAmount = 1;

  await assert.rejects(
    fixture.service.createPendingBookingFromHold({
      holdId: fixture.holdId,
      ownerId: fixture.ownerId,
      requestKey: "booking-request-005",
    }),
    (error) =>
      error.statusCode === 409 &&
      error.code === "INVALID_BOOKING_PRICE_SNAPSHOT",
  );
});

test("a stale client price quote reference is rejected", async () => {
  const fixture = makeFixture();

  await assert.rejects(
    fixture.service.createPendingBookingFromHold({
      holdId: fixture.holdId,
      ownerId: fixture.ownerId,
      priceQuoteReference: "quote-stale",
      requestKey: "booking-request-006",
    }),
    (error) =>
      error.statusCode === 409 &&
      error.code === "INVALID_BOOKING_PRICE_SNAPSHOT",
  );
});

test("Booking HTTP controller derives the customer from auth context", async () => {
  const ownerId = objectId();
  const holdId = objectId();
  const calls = [];
  const controller = createBookingController({
    async createPendingBookingFromHold(command) {
      calls.push(command);
      return { bookingId: objectId(), idempotent: false };
    },
  });
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const request = {
    auth: { accountId: ownerId },
    body: { holdId, requestKey: "booking-request-http", ownerId: objectId() },
  };

  await controller.createPending(request, response, (error) => {
    throw error;
  });
  assert.deepEqual(calls[0], {
    holdId,
    requestKey: "booking-request-http",
    ownerId,
    channel: "ONLINE",
  });
  assert.equal(response.statusCode, 201);
});

test("Booking HTTP controller records the authenticated Staff counter source", async () => {
  const staffId = objectId();
  const calls = [];
  const controller = createBookingController({
    async createPendingBookingFromHold(command) {
      calls.push(command);
      return { bookingId: objectId(), idempotent: false };
    },
  });
  const response = {
    status(code) {
      assert.equal(code, 201);
      return this;
    },
    json() {
      return this;
    },
  };

  await controller.createPending(
    {
      auth: {
        accountId: staffId,
        account: { roles: [{ name: "STAFF" }] },
      },
      body: { holdId: objectId(), requestKey: "counter-booking-http" },
    },
    response,
    (error) => {
      throw error;
    },
  );

  assert.equal(calls[0].ownerId, staffId);
  assert.equal(calls[0].channel, "COUNTER");
  assert.equal(calls[0].createdByStaffId, staffId);
});
