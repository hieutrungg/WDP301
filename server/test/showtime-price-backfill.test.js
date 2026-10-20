import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { backfillShowtimePrices } from "../src/migrations/20261020-backfill-showtime-prices.js";
import { buildTicketPricePlanSeeds } from "../src/seeds/seed-ticket-price-plans.js";
import { configureMongoDns } from "../src/config/mongo-dns.js";

const id = () => new mongoose.Types.ObjectId();
const now = new Date("2026-10-20T00:00:00Z");
const same = (left, right) => left instanceof Date && right instanceof Date
  ? left.getTime() === right.getTime() : String(left) === String(right);
const matches = (document, filter) => Object.entries(filter).every(([key, value]) => {
  if (key.startsWith("$")) return true;
  if (value === null) return document[key] == null;
  if (value && Object.hasOwn(value, "$exists")) return Object.hasOwn(document, key) === value.$exists;
  return same(document[key], value);
});

const fixture = () => {
  const branchId = id(); const roomId = id(); const movieId = id(); const showtimeId = id();
  const seats = ["STANDARD", "VIP", "DOUBLE_LUXURY"].map((type) => ({ _id: id(), type, status: "ENABLED" }));
  const data = {
    branches: [{ _id: branchId, status: "ACTIVE" }], movies: [{ _id: movieId, status: "PUBLISHED" }],
    rooms: [{ _id: roomId, branchId, status: "ACTIVE", roomType: "STANDARD", layoutVersion: 1, seats }],
    showtimes: [{ _id: showtimeId, movieId, roomId, status: "PUBLISHED", roomLayoutVersion: 1, startAt: new Date("2026-10-21T10:00:00Z") }],
    showtime_seats: seats.map((seat) => ({ _id: id(), showtimeId, seatId: seat._id, roomLayoutVersion: 1, state: "AVAILABLE" })),
    ticket_price_plans: buildTicketPricePlanSeeds().map((plan) => ({ _id: id(), ...plan })),
    bookings: [], seat_holds: [], tickets: [], room_layout_versions: [],
  };
  const writes = [];
  const state = { failSeatMatch: false, failShowtimeMatch: false };
  const session = {
    async withTransaction(work) {
      const before = Object.fromEntries(Object.entries(data).map(([name, docs]) => [name, docs.map((doc) => ({ ...doc }))]));
      try { return await work(); }
      catch (error) {
        for (const [name, docs] of Object.entries(before)) data[name].splice(0, data[name].length, ...docs);
        throw error;
      }
    },
    async endSession() {},
  };
  const database = {
    databaseName: "pricing_backfill_test",
    collection(name) {
      assert.ok(Object.hasOwn(data, name), `Unexpected collection access: ${name}`);
      return {
        async findOne(filter) { return data[name].find((doc) => matches(doc, filter)) ?? null; },
        find(filter) { return { sort() { return this; }, async toArray() { return data[name].filter((doc) => matches(doc, filter)); } }; },
        async bulkWrite(operations, options) {
          assert.equal(name, "showtime_seats"); assert.equal(options.session, session);
          writes.push({ name, operations });
          let matchedCount = 0;
          for (const { updateOne } of operations) {
            const doc = data[name].find((row) => matches(row, updateOne.filter));
            if (doc) { Object.assign(doc, updateOne.update.$set); matchedCount += 1; }
          }
          return { matchedCount: state.failSeatMatch ? 0 : matchedCount };
        },
        async updateOne(filter, update, options) {
          assert.equal(name, "showtimes"); assert.equal(options.session, session);
          writes.push({ name, update });
          const doc = state.failShowtimeMatch ? null : data[name].find((row) => matches(row, filter));
          if (doc) Object.assign(doc, update.$set);
          return { matchedCount: doc ? 1 : 0 };
        },
      };
    },
  };
  const options = { showtimeIds: [String(showtimeId)], clock: () => now, startSession: async () => session };
  return { database, data, writes, state, options };
};

test("backfill previews real eligibility without writes and only fills missing prices on explicit apply", async () => {
  const f = fixture();
  const preview = await backfillShowtimePrices(f.database, f.options);
  assert.equal(preview.results[0].action, "READY");
  assert.equal(preview.results[0].missingPrices, 3);
  assert.equal(f.writes.length, 0);
  const report = await backfillShowtimePrices(f.database, { ...f.options, apply: true });
  assert.equal(report.results[0].action, "UPDATED");
  assert.deepEqual(f.data.showtime_seats.map(({ priceSnapshot }) => priceSnapshot), [105000, 110500, 236000]);
  assert.equal(String(f.data.showtimes[0].ticketPricePlanId), String(f.data.ticket_price_plans[0]._id));
  const writeCount = f.writes.length;
  const rerun = await backfillShowtimePrices(f.database, { ...f.options, apply: true });
  assert.equal(rerun.results[0].reason, "ALREADY_LINKED");
  assert.equal(f.writes.length, writeCount);
});

test("backfill does not overwrite a matching existing price and uses the exact historical layout", async () => {
  const f = fixture();
  f.data.showtime_seats[0].priceSnapshot = 105000;
  const previousLayout = f.data.rooms[0].seats;
  f.data.rooms[0].layoutVersion = 2;
  f.data.rooms[0].seats = previousLayout.map((seat) => ({ ...seat, type: "VIP" }));
  f.data.room_layout_versions.push({ roomId: f.data.rooms[0]._id, layoutVersion: 1, seats: previousLayout });
  const report = await backfillShowtimePrices(f.database, { ...f.options, apply: true });
  assert.equal(report.results[0].missingPrices, 2);
  assert.equal(f.data.showtime_seats[0].priceSnapshot, 105000);
  const operation = f.writes[0].operations[0].updateOne;
  assert.equal(Object.hasOwn(operation.update.$set, "priceSnapshot"), false);
});

test("backfill skips all transaction history, invalid layouts, past sessions and existing different prices", async () => {
  const mutations = [
    (f) => f.data.bookings.push({ showtimeId: f.data.showtimes[0]._id }),
    (f) => f.data.seat_holds.push({ showtimeId: f.data.showtimes[0]._id, status: "EXPIRED" }),
    (f) => f.data.tickets.push({ showtimeId: f.data.showtimes[0]._id }),
    (f) => { f.data.showtime_seats[0].state = "HELD"; },
    (f) => { f.data.showtime_seats[0].state = "SOLD"; },
    (f) => { f.data.showtime_seats[0].priceSnapshot = 0; },
    (f) => { f.data.showtime_seats[0].priceSnapshot = 90000; },
    (f) => { f.data.showtime_seats[0].priceSnapshot = null; },
    (f) => { f.data.showtimes[0].startAt = new Date("2026-10-19T00:00:00Z"); },
    (f) => { f.data.showtime_seats.pop(); },
    (f) => { f.data.showtime_seats[0].roomLayoutVersion = 2; },
    (f) => { f.data.rooms[0].roomType = "IMAX"; },
    (f) => { f.data.ticket_price_plans[0].status = "RETIRED"; },
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f);
    const report = await backfillShowtimePrices(f.database, { ...f.options, apply: true });
    assert.equal(report.results[0].action, "SKIPPED");
    assert.equal(f.writes.length, 0);
  }
});

test("backfill reinspects after preview and aborts a concurrent seat or Showtime change", async () => {
  const f = fixture();
  await backfillShowtimePrices(f.database, f.options);
  f.data.bookings.push({ showtimeId: f.data.showtimes[0]._id });
  assert.equal((await backfillShowtimePrices(f.database, { ...f.options, apply: true })).results[0].reason, "HAS_BOOKINGS");
  assert.equal(f.writes.length, 0);
  for (const key of ["failSeatMatch", "failShowtimeMatch"]) {
    const race = fixture(); race.state[key] = true;
    const result = await backfillShowtimePrices(race.database, { ...race.options, apply: true });
    assert.equal(result.results[0].action, "SKIPPED");
    assert.equal(Object.hasOwn(race.data.showtimes[0], "ticketPricePlanId"), false);
    assert.ok(race.data.showtime_seats.every((row) => !Object.hasOwn(row, "priceSnapshot")));
  }
});

test("backfill refuses apply without an explicit target or transaction factory", async () => {
  const f = fixture();
  await assert.rejects(backfillShowtimePrices(f.database, { apply: true }), /explicit Showtime IDs/);
  await assert.rejects(backfillShowtimePrices(f.database, { apply: true, showtimeIds: f.options.showtimeIds }), /transaction session/);
  assert.equal(f.writes.length, 0);
});

const testUri = process.env.MONGODB_TEST_URI?.trim();
test("MongoDB backfill atomically sets the plan reference and absent prices and is idempotent", {
  skip: !testUri && "MONGODB_TEST_URI is not configured; no live test database was changed",
}, async () => {
  assert.match(testUri.split("?")[0].split("/").at(-1), /test/i);
  const databaseName = `pricing_backfill_test_${randomUUID().replaceAll("-", "")}`;
  const connection = mongoose.createConnection();
  try {
    configureMongoDns();
    await connection.openUri(testUri, { dbName: databaseName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    assert.ok((await connection.db.admin().command({ hello: 1 })).setName);
    const f = fixture();
    for (const [name, documents] of Object.entries(f.data)) {
      await connection.db.createCollection(name);
      if (documents.length) await connection.db.collection(name).insertMany(documents);
    }
    const options = { ...f.options, apply: true, startSession: () => connection.startSession() };
    assert.equal((await backfillShowtimePrices(connection.db, options)).results[0].action, "UPDATED");
    assert.deepEqual((await connection.db.collection("showtime_seats").find().toArray()).map(({ priceSnapshot }) => priceSnapshot), [105000, 110500, 236000]);
    assert.equal((await backfillShowtimePrices(connection.db, options)).results[0].reason, "ALREADY_LINKED");
  } finally {
    try {
      if (connection.readyState === 1) {
        assert.equal(connection.db.databaseName, databaseName);
        await connection.db.dropDatabase();
      }
    } finally { await connection.close(); }
  }
});
