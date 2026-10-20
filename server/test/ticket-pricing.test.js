import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { buildTicketPricePlanSeeds } from "../src/seeds/seed-ticket-price-plans.js";
import { createTicketPricingService, pricePlanCodeForShowtime, TicketPricingUnavailableError } from "../src/modules/ticket-pricing/ticket-pricing.service.js";
import { createShowtimePublisher, createShowtimeRescheduler } from "../src/modules/showtime/showtime.service.js";
import { createSeatAvailabilityService } from "../src/modules/booking/seat-availability.service.js";
import { createSeatHoldRepository, SeatClaimConflictError, ShowtimeSeatInitializationConflictError } from "../src/modules/booking/seat-hold.repository.js";

const id = () => new mongoose.Types.ObjectId();
const query = (value) => ({
  session() { return this; }, select() { return this; }, lean() { return this; }, async exec() { return value; },
});
const plans = () => buildTicketPricePlanSeeds().map((plan) => ({ ...plan, _id: id() }));
const pricingService = (documents = plans()) => createTicketPricingService({
  findPlan: async (filter) => documents.find((plan) => Object.entries(filter).every(([key, value]) => plan[key] === value)),
});

test("pricing uses the showtime's Vietnam weekday including UTC midnight boundaries", () => {
  for (const [date, expected] of [
    ["2026-10-21T10:00:00Z", "ADULT_2D_WEEKDAY"], // Wednesday
    ["2026-10-22T16:59:59Z", "ADULT_2D_WEEKDAY"], // Thursday 23:59 VN
    ["2026-10-22T17:00:00Z", "ADULT_2D_WEEKEND"], // Friday 00:00 VN
    ["2026-10-25T16:59:59Z", "ADULT_2D_WEEKEND"],
    ["2026-10-25T17:00:00Z", "ADULT_2D_WEEKDAY"], // Monday 00:00 VN
  ]) assert.equal(pricePlanCodeForShowtime(date), expected);
  assert.throws(() => pricePlanCodeForShowtime("invalid"), TicketPricingUnavailableError);
});

test("pricing selects the approved v1 and returns the complete pair price once", async () => {
  const documents = plans();
  const service = pricingService(documents);
  const weekday = await service.resolveForShowtime({ startAt: "2026-10-21T10:00:00Z", roomType: "STANDARD" });
  const weekend = await service.resolveForShowtime({ startAt: "2026-10-23T10:00:00Z", roomType: "2D" });
  assert.equal(weekday.ticketPricePlanId, documents[0]._id);
  assert.deepEqual(weekday.seatTypePrices, { STANDARD: 105000, VIP: 110500, DOUBLE_LUXURY: 236000 });
  assert.equal(weekend.seatTypePrices.DOUBLE_LUXURY, 276000);
  weekday.seatTypePrices.STANDARD = 1;
  assert.equal(documents[0].seatTypePrices.STANDARD, 105000, "Returned value must not mutate the stored plan");
});

test("pricing fails closed for missing, retired, incomplete or invalid plans and unsupported formats", async () => {
  const input = { startAt: "2026-10-21T10:00:00Z", roomType: "STANDARD" };
  await assert.rejects(pricingService([]).resolveForShowtime(input), TicketPricingUnavailableError);
  for (const changes of [
    { status: "RETIRED" }, { currency: "USD" }, { version: 2 },
    { seatTypePrices: { STANDARD: 105000, VIP: 110500 } },
    { seatTypePrices: { STANDARD: 1.5, VIP: 110500, DOUBLE_LUXURY: 236000 } },
    { seatTypePrices: { STANDARD: -1, VIP: 110500, DOUBLE_LUXURY: 236000 } },
  ]) {
    const documents = plans();
    Object.assign(documents[0], changes);
    await assert.rejects(pricingService(documents).resolveForShowtime(input), TicketPricingUnavailableError);
  }
  await assert.rejects(pricingService().resolveForShowtime({ ...input, roomType: "IMAX" }), TicketPricingUnavailableError);
});

test("seat initialization supplies immutable per-seat prices including disabled and double seats", async () => {
  const seats = ["STANDARD", "VIP", "DOUBLE_LUXURY"].map((type, index) => ({ _id: id(), type, status: index === 1 ? "DISABLED" : "ENABLED" }));
  let stored;
  const service = createSeatAvailabilityService({
    roomLayoutReader: { getLayoutVersion: async () => ({ seats }) },
    repository: { initializeShowtimeSeats: async (input) => { stored = input.seats; return stored; } },
  });
  const input = { showtimeId: id(), roomId: id(), roomLayoutVersion: 1, pricesBySeatType: buildTicketPricePlanSeeds()[0].seatTypePrices };
  await service.initializeForPublishedShowtime(input);
  assert.deepEqual(stored.map(({ priceSnapshot }) => priceSnapshot), [105000, 110500, 236000]);
  assert.equal(stored[1].state, "UNAVAILABLE");
  stored = null;
  await assert.rejects(service.initializeForPublishedShowtime({ ...input, pricesBySeatType: { STANDARD: 105000 } }), (error) => error.code === "PRICE_QUOTE_FAILED");
  assert.equal(stored, null);
});

const publisherFixture = () => {
  const calls = [];
  const roomId = id();
  const movieId = id();
  const room = { id: String(roomId), roomName: "Room 1", roomType: "STANDARD", status: "ACTIVE", branch: { id: String(id()), status: "ACTIVE", branchName: "Test" } };
  let draft;
  const dependencies = {
    getMovie: async () => ({ duration: 120 }),
    getRoomLayout: async () => ({ room, layout: { layoutVersion: 1, summary: { operationalSeatCapacity: 3 } } }),
    findConflict: async () => null,
    resolvePricePlan: (startAt, roomType) => pricingService().resolveForShowtime({ startAt, roomType }),
    createDraft: async (input) => { calls.push("draft"); draft = { _id: id(), ...input }; return draft; },
    initializeSeats: async (input) => {
      calls.push("prices");
      assert.equal(String(input.showtimeId), String(draft._id));
      assert.equal(input.pricesBySeatType.STANDARD, 105000);
    },
    publish: async () => { calls.push("publish"); return { ...draft, status: "PUBLISHED" }; },
    discardSeats: async () => calls.push("discard"),
    deleteDraft: async () => calls.push("delete draft"),
  };
  return { calls, dependencies, input: { roomId: String(roomId), movieId: String(movieId), startAt: "2026-10-21T10:00:00Z" } };
};

test("Showtime publishes only after all seat snapshots are persisted and stores its plan reference", async () => {
  const fixture = publisherFixture();
  const create = fixture.dependencies.createDraft;
  fixture.dependencies.createDraft = async (input) => {
    assert.ok(input.ticketPricePlanId instanceof mongoose.Types.ObjectId);
    return create(input);
  };
  const result = await createShowtimePublisher(fixture.dependencies)(fixture.input, new Date("2026-10-20T00:00:00Z"));
  assert.equal(result.status, "PUBLISHED");
  assert.deepEqual(fixture.calls, ["draft", "prices", "publish"]);
});

test("Showtime does not create a draft without prices or publish on failed initialization", async () => {
  const fixture = publisherFixture();
  fixture.dependencies.resolvePricePlan = async () => { throw new TicketPricingUnavailableError("missing prices"); };
  await assert.rejects(createShowtimePublisher(fixture.dependencies)(fixture.input, new Date("2026-10-20T00:00:00Z")), /missing prices/);
  assert.deepEqual(fixture.calls, []);
  fixture.dependencies.resolvePricePlan = (startAt, roomType) => pricingService().resolveForShowtime({ startAt, roomType });
  fixture.dependencies.initializeSeats = async () => { throw new Error("snapshot transaction failed"); };
  await assert.rejects(createShowtimePublisher(fixture.dependencies)(fixture.input, new Date("2026-10-20T00:00:00Z")), /snapshot transaction failed/);
  assert.deepEqual(fixture.calls, ["draft", "discard", "delete draft"]);
});

test("rescheduling a linked unsold Showtime passes new prices and time update through the same session", async () => {
  const session = { id: "repricing transaction" };
  const showtimeId = id();
  const showtime = { movieId: id(), roomId: id(), roomLayoutVersion: 1, ticketPricePlanId: id() };
  let updates = 0;
  const reschedule = createShowtimeRescheduler({
    assertEditable: async () => showtime,
    getMovie: async () => ({ duration: 120 }),
    getRoomLayout: async () => ({ room: { roomType: "STANDARD" } }),
    findConflict: async () => null,
    resolvePricePlan: (startAt, roomType) => pricingService().resolveForShowtime({ startAt, roomType }),
    reprice: async (input) => {
      assert.equal(input.seatTypePrices.STANDARD, 125000);
      assert.equal(updates, 0);
      return input.commit(session);
    },
    updateTime: async (input) => {
      updates += 1;
      assert.equal(input.session, session);
      assert.ok(input.ticketPricePlanId);
      return { _id: showtimeId, ...input, status: "PUBLISHED" };
    },
  });
  const result = await reschedule({ showtimeId: String(showtimeId), startAt: "2026-10-23T10:00:00Z" }, new Date("2026-10-20T00:00:00Z"));
  assert.equal(updates, 1);
  assert.equal(result.startAt, "2026-10-23T10:00:00.000Z");
});

test("repository persists initialization prices and rejects an attempt to overwrite a snapshot", async () => {
  const showtimeId = id();
  const seatId = id();
  const rows = [];
  const session = { withTransaction: async (work) => work(), endSession: async () => {} };
  const repository = createSeatHoldRepository({
    connection: { startSession: async () => session },
    showtimeSeatModel: {
      find: () => query(rows),
      bulkWrite: async (operations) => {
        for (const { updateOne } of operations) rows.push(updateOne.update.$setOnInsert);
      },
    },
  });
  const input = { showtimeId, roomLayoutVersion: 1, seats: [{ seatId, state: "AVAILABLE", priceSnapshot: 105000 }] };
  await repository.initializeShowtimeSeats(input);
  await repository.initializeShowtimeSeats(input);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].priceSnapshot, 105000);
  await assert.rejects(repository.initializeShowtimeSeats({ ...input, seats: [{ seatId, state: "AVAILABLE", priceSnapshot: 125000 }] }), ShowtimeSeatInitializationConflictError);
  assert.equal(rows[0].priceSnapshot, 105000);
});

test("hold acquisition rejects a stale quote rather than replacing the published price", async () => {
  let filter;
  const session = { withTransaction: async (work) => work(), endSession: async () => {} };
  const repository = createSeatHoldRepository({
    connection: { startSession: async () => session },
    seatHoldModel: { findOne: () => query(null) },
    showtimeSeatModel: {
      find: () => query([]),
      updateOne: async (input) => { filter = input; return { matchedCount: 0 }; },
      create: async () => { throw Object.assign(new Error("seat already exists with a different price"), { code: 11000 }); },
    },
  });
  const seatId = id();
  await assert.rejects(repository.acquire({
    ownerId: id(), checkoutKey: "stale-price-hold", showtimeId: id(), roomLayoutVersion: 1,
    seatIds: [seatId], heldAt: new Date(), expiresAt: new Date(Date.now() + 600000),
    priceSnapshot: { currency: "VND", lines: [{ seatId, unitPrice: 105000 }], totalAmount: 105000 },
  }), SeatClaimConflictError);
  assert.equal(filter.priceSnapshot, 105000);
});

test("repricing repository refuses any Booking, active hold, held or sold seat before price writes", async () => {
  for (const state of ["BOOKING", "HOLD", "HELD", "SOLD"]) {
    let writes = 0;
    let commits = 0;
    const seatId = id();
    const session = { withTransaction: async (work) => work(), endSession: async () => {} };
    const repository = createSeatHoldRepository({
      connection: { startSession: async () => session },
      bookingModel: { exists: () => query(state === "BOOKING" ? { _id: id() } : null) },
      seatHoldModel: { exists: () => query(state === "HOLD" ? { _id: id() } : null) },
      showtimeSeatModel: {
        find: (filter) => query(filter.state === "HELD" ? [] : [{ seatId, roomLayoutVersion: 1, state: ["HELD", "SOLD"].includes(state) ? state : "AVAILABLE" }]),
        bulkWrite: async () => { writes += 1; },
      },
    });
    await assert.rejects(repository.repriceUnclaimedShowtime({
      showtimeId: id(), roomLayoutVersion: 1, seats: [{ seatId, priceSnapshot: 125000 }], now: new Date(),
      commit: async () => { commits += 1; },
    }), SeatClaimConflictError);
    assert.equal(writes, 0);
    assert.equal(commits, 0);
  }
});
