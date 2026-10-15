import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import {
  DEFAULT_SEAT_HOLD_DURATION_MS,
  SEAT_HOLD_STATUS,
  SHOWTIME_SEAT_STATE,
} from "../src/modules/booking/seat-hold.constants.js";
import {
  createSeatAvailabilityService,
  projectAvailability,
} from "../src/modules/booking/seat-availability.service.js";
import { createSeatHoldController } from "../src/modules/booking/seat-hold.controller.js";
import { SeatHold } from "../src/modules/booking/seat-hold.model.js";
import { createSeatHoldService } from "../src/modules/booking/seat-hold.service.js";
import { ShowtimeSeat } from "../src/modules/booking/showtime-seat.model.js";

const objectId = () => new mongoose.Types.ObjectId().toString();

const makeFixture = () => {
  const ownerId = objectId();
  const showtimeId = objectId();
  const roomId = objectId();
  const seatIds = [objectId(), objectId()];
  const now = new Date("2026-10-15T03:00:00.000Z");
  const calls = { acquire: 0, quote: 0 };
  const stored = new Map();

  const repository = {
    async findByOwnerAndCheckoutKey(owner, key) {
      return stored.get(`${owner}:${key}`) ?? null;
    },
    async acquire(input) {
      calls.acquire += 1;
      const hold = { _id: new mongoose.Types.ObjectId(), status: SEAT_HOLD_STATUS.ACTIVE, ...input };
      stored.set(`${input.ownerId}:${input.checkoutKey}`, hold);
      return { hold, created: true };
    },
    async release() {
      throw new Error("not used");
    },
  };
  const showtimeReader = {
    async getBookableShowtime(id) {
      return id === showtimeId ? { showtimeId, roomId, roomLayoutVersion: 3 } : null;
    },
  };
  const roomLayoutReader = {
    async getLayoutVersion() {
      return { seats: seatIds.map((seatId) => ({ seatId, status: "ENABLED" })) };
    },
  };
  const priceQuoter = {
    async quote(_showtimeId, requestedSeatIds) {
      calls.quote += 1;
      return {
        currency: "VND",
        lines: requestedSeatIds.map((seatId) => ({ seatId, unitPrice: 90000 })),
        totalAmount: requestedSeatIds.length * 90000,
      };
    },
  };
  const service = createSeatHoldService({
    repository,
    showtimeReader,
    roomLayoutReader,
    priceQuoter,
    clock: () => new Date(now),
  });

  return { calls, now, ownerId, repository, seatIds, service, showtimeId, stored };
};

test("SeatHold models own showtime-scoped state and required unique indexes", () => {
  assert.equal(SeatHold.collection.name, "seat_holds");
  assert.equal(ShowtimeSeat.collection.name, "showtime_seats");
  assert.deepEqual(SeatHold.schema.path("status").enumValues, Object.values(SEAT_HOLD_STATUS));
  assert.deepEqual(ShowtimeSeat.schema.path("state").enumValues, Object.values(SHOWTIME_SEAT_STATE));

  const showtimeSeatIndex = ShowtimeSeat.schema
    .indexes()
    .find(([, options]) => options.name === "uniq_showtime_seat");
  assert.deepEqual(showtimeSeatIndex[0], { showtimeId: 1, seatId: 1 });
  assert.equal(showtimeSeatIndex[1].unique, true);
});

test("acquire creates one 10-minute hold with normalized seats and integer VND quote", async () => {
  const fixture = makeFixture();
  const result = await fixture.service.acquireSeatHold({
    ownerId: fixture.ownerId,
    checkoutKey: "checkout-001",
    showtimeId: fixture.showtimeId,
    seatIds: [...fixture.seatIds].reverse(),
  });

  assert.equal(result.status, SEAT_HOLD_STATUS.ACTIVE);
  assert.deepEqual(result.seatIds, [...fixture.seatIds].sort());
  assert.equal(
    new Date(result.expiresAt).getTime() - fixture.now.getTime(),
    DEFAULT_SEAT_HOLD_DURATION_MS,
  );
  assert.equal(result.priceQuote.totalAmount, 180000);
  assert.equal(fixture.calls.acquire, 1);
});

test("an identical checkout retry returns the same hold without extending expiry", async () => {
  const fixture = makeFixture();
  const command = {
    ownerId: fixture.ownerId,
    checkoutKey: "checkout-002",
    showtimeId: fixture.showtimeId,
    seatIds: fixture.seatIds,
  };
  const first = await fixture.service.acquireSeatHold(command);
  const second = await fixture.service.acquireSeatHold({ ...command, seatIds: [...command.seatIds].reverse() });

  assert.equal(second.holdId, first.holdId);
  assert.equal(second.expiresAt, first.expiresAt);
  assert.equal(second.idempotent, true);
  assert.equal(fixture.calls.acquire, 1);
  assert.equal(fixture.calls.quote, 1);
});

test("reusing a checkout key with different seats is rejected before mutation", async () => {
  const fixture = makeFixture();
  const command = {
    ownerId: fixture.ownerId,
    checkoutKey: "checkout-003",
    showtimeId: fixture.showtimeId,
    seatIds: fixture.seatIds,
  };
  await fixture.service.acquireSeatHold(command);

  await assert.rejects(
    fixture.service.acquireSeatHold({ ...command, seatIds: [fixture.seatIds[0]] }),
    (error) => error.statusCode === 409 && error.code === "IDEMPOTENCY_KEY_REUSED",
  );
  assert.equal(fixture.calls.acquire, 1);
});

test("a seat outside the immutable layout is rejected before pricing and persistence", async () => {
  const fixture = makeFixture();
  await assert.rejects(
    fixture.service.acquireSeatHold({
      ownerId: fixture.ownerId,
      checkoutKey: "checkout-004",
      showtimeId: fixture.showtimeId,
      seatIds: [objectId()],
    }),
    (error) => error.statusCode === 409 && error.code === "SEAT_NOT_IN_LAYOUT",
  );
  assert.equal(fixture.calls.quote, 0);
  assert.equal(fixture.calls.acquire, 0);
});

test("duplicate seat ids are rejected instead of being silently collapsed", async () => {
  const fixture = makeFixture();
  await assert.rejects(
    fixture.service.acquireSeatHold({
      ownerId: fixture.ownerId,
      checkoutKey: "checkout-005",
      showtimeId: fixture.showtimeId,
      seatIds: [fixture.seatIds[0], fixture.seatIds[0]],
    }),
    (error) => error.statusCode === 400 && error.code === "INVALID_SEAT_IDS",
  );
  assert.equal(fixture.calls.quote, 0);
  assert.equal(fixture.calls.acquire, 0);
});

test("release is idempotent and preserves a terminal result", async () => {
  const fixture = makeFixture();
  const holdId = objectId();
  const terminal = {
    _id: new mongoose.Types.ObjectId(holdId),
    status: SEAT_HOLD_STATUS.RELEASED,
    expiresAt: new Date(fixture.now.getTime() + DEFAULT_SEAT_HOLD_DURATION_MS),
    releasedAt: fixture.now,
  };
  fixture.repository.release = async () => ({ outcome: "FINAL", hold: terminal });

  const result = await fixture.service.releaseSeatHold({ holdId, ownerId: fixture.ownerId });
  assert.equal(result.status, SEAT_HOLD_STATUS.RELEASED);
  assert.equal(result.alreadyFinal, true);
});

test("showtime-seat initialization snapshots every physical seat and is idempotent", async () => {
  const showtimeId = objectId();
  const roomId = objectId();
  const enabledSeatId = objectId();
  const disabledSeatId = objectId();
  const calls = [];
  const service = createSeatAvailabilityService({
    repository: {
      async initializeShowtimeSeats(command) {
        calls.push(command);
        return command.seats;
      },
    },
    roomLayoutReader: {
      async getLayoutVersion(requestedRoomId, version) {
        assert.equal(requestedRoomId, roomId);
        assert.equal(version, 4);
        return {
          seats: [
            { _id: enabledSeatId, status: "ENABLED" },
            { _id: disabledSeatId, status: "DISABLED" },
          ],
        };
      },
    },
  });

  const result = await service.initializeForPublishedShowtime({
    showtimeId,
    roomId,
    roomLayoutVersion: 4,
  });

  assert.deepEqual(result, { showtimeId, roomLayoutVersion: 4, seatCount: 2 });
  assert.equal(calls.length, 1);
  assert.deepEqual(
    calls[0].seats.map(({ seatId, state }) => ({ seatId: seatId.toString(), state })),
    [
      { seatId: enabledSeatId, state: SHOWTIME_SEAT_STATE.AVAILABLE },
      { seatId: disabledSeatId, state: SHOWTIME_SEAT_STATE.UNAVAILABLE },
    ],
  );
});

test("availability merges layout, prices and current hold state using server time", async () => {
  const ownerId = objectId();
  const otherOwnerId = objectId();
  const showtimeId = objectId();
  const roomId = objectId();
  const availableSeatId = objectId();
  const ownHeldSeatId = objectId();
  const expiredSeatId = objectId();
  const soldSeatId = objectId();
  const disabledSeatId = objectId();
  const now = new Date("2026-10-15T04:00:00.000Z");
  const seats = [
    { _id: availableSeatId, row: "A", number: 1, type: "STANDARD", status: "ENABLED" },
    { _id: ownHeldSeatId, row: "A", number: 2, type: "STANDARD", status: "ENABLED" },
    { _id: expiredSeatId, row: "A", number: 3, type: "STANDARD", status: "ENABLED" },
    { _id: soldSeatId, row: "A", number: 4, type: "STANDARD", status: "ENABLED" },
    { _id: disabledSeatId, row: "A", number: 5, type: "STANDARD", status: "DISABLED" },
  ];
  const states = [
    { seatId: availableSeatId, state: SHOWTIME_SEAT_STATE.AVAILABLE },
    {
      seatId: ownHeldSeatId,
      state: SHOWTIME_SEAT_STATE.HELD,
      holdOwnerId: ownerId,
      holdExpiresAt: new Date(now.getTime() + 60000),
    },
    {
      seatId: expiredSeatId,
      state: SHOWTIME_SEAT_STATE.HELD,
      holdOwnerId: otherOwnerId,
      holdExpiresAt: new Date(now.getTime() - 1),
    },
    { seatId: soldSeatId, state: SHOWTIME_SEAT_STATE.SOLD },
    { seatId: disabledSeatId, state: SHOWTIME_SEAT_STATE.UNAVAILABLE },
  ];
  const service = createSeatAvailabilityService({
    repository: { async listByShowtime() { return states; } },
    showtimeReader: {
      async getBookableShowtime() { return { roomId, roomLayoutVersion: 2 }; },
    },
    roomLayoutReader: { async getLayoutVersion() { return { seats }; } },
    priceQuoter: {
      async quote(_showtimeId, seatIds) {
        return {
          currency: "VND",
          lines: seatIds.map((seatId) => ({ seatId, unitPrice: 100000 })),
          totalAmount: seatIds.length * 100000,
        };
      },
    },
    clock: () => new Date(now),
  });

  const result = await service.getSeatAvailability({ showtimeId, ownerId });
  assert.deepEqual(
    result.seats.map(({ availability }) => availability),
    ["AVAILABLE", "HELD_BY_CURRENT_OWNER", "AVAILABLE", "SOLD", "UNAVAILABLE"],
  );
  assert.equal(result.seats[1].holdExpiresAt, "2026-10-15T04:01:00.000Z");
  assert.equal(result.seats[2].holdExpiresAt, undefined);
  assert.equal(result.seats[0].price, 100000);
  assert.equal(result.generatedAt, now.toISOString());
});

test("availability fails closed when showtime-seat initialization is incomplete", async () => {
  const showtimeId = objectId();
  const roomId = objectId();
  const seatId = objectId();
  const service = createSeatAvailabilityService({
    repository: { async listByShowtime() { return []; } },
    showtimeReader: {
      async getBookableShowtime() { return { roomId, roomLayoutVersion: 1 }; },
    },
    roomLayoutReader: {
      async getLayoutVersion() {
        return { seats: [{ _id: seatId, status: "ENABLED" }] };
      },
    },
    priceQuoter: { async quote() { throw new Error("must not quote"); } },
  });

  await assert.rejects(
    service.getSeatAvailability({ showtimeId }),
    (error) => error.statusCode === 409 && error.code === "SHOWTIME_SEATS_NOT_INITIALIZED",
  );
});

test("availability does not reopen a malformed held seat without an expiry", async () => {
  const seatId = objectId();
  const now = new Date("2026-10-15T04:00:00.000Z");
  const projected = projectAvailability({
    seat: { _id: seatId, row: "A", number: 1, type: "STANDARD", status: "ENABLED" },
    state: { seatId, state: SHOWTIME_SEAT_STATE.HELD },
    now,
  });
  assert.equal(projected.availability, SHOWTIME_SEAT_STATE.HELD);
  assert.equal(projected.holdExpiresAt, undefined);
});

test("SeatHold HTTP controller derives owner from auth context", async () => {
  const ownerId = objectId();
  const holdId = objectId();
  const calls = [];
  const controller = createSeatHoldController({
    async acquireSeatHold(command) {
      calls.push(command);
      return { holdId, idempotent: false };
    },
    async releaseSeatHold() {
      throw new Error("not used");
    },
  });
  const response = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const request = {
    auth: { accountId: ownerId },
    body: { showtimeId: objectId(), seatIds: [objectId()], checkoutKey: "checkout-http" },
  };

  await controller.acquire(request, response, (error) => { throw error; });
  assert.equal(calls[0].ownerId, ownerId);
  assert.equal("ownerId" in request.body, false);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, { success: true, data: { holdId, idempotent: false } });
});

