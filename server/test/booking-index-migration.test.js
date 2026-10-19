import assert from "node:assert/strict";
import { test } from "node:test";
import { BOOKING_INDEXES } from "../src/modules/booking/booking.indexes.js";
import { ensureBooking009Indexes } from "../src/migrations/20261017-booking-009-indexes.js";

const fixture = (indexes = [], listError) => {
  const writes = [];
  const database = {
    collection(name) {
      assert.equal(name, "bookings");
      return {
        listIndexes() {
          return { async toArray() { if (listError) throw listError; return indexes; } };
        },
        async createIndex(fields, options) {
          writes.push({ fields, options });
          indexes.push({ key: fields, ...options });
          return options.name;
        },
      };
    },
  };
  return { database, writes };
};

test("Booking migration retains an equivalent uniq_booking_code and creates missing indexes", async () => {
  const { database, writes } = fixture([
    { key: { bookingCode: 1 }, name: "uniq_booking_code", unique: true, v: 2 },
  ]);
  const names = await ensureBooking009Indexes(database);
  assert.equal(names[0], "uniq_booking_code");
  assert.deepEqual(writes, BOOKING_INDEXES.slice(1));
  await ensureBooking009Indexes(database);
  assert.equal(writes.length, 4, "A rerun must reuse every index without writes");
});

test("Booking migration also accepts the bootstrap bookingCode_1 name", async () => {
  const { database, writes } = fixture(BOOKING_INDEXES.map(({ fields, options }) => ({ key: fields, ...options })));
  assert.deepEqual(await ensureBooking009Indexes(database), BOOKING_INDEXES.map(({ options }) => options.name));
  assert.equal(writes.length, 0);
});

test("Booking migration retains Atlas full unique indexes without changing their scope", async () => {
  const indexes = BOOKING_INDEXES.map(({ fields, options }) => {
    const stored = { key: fields, ...options };
    delete stored.partialFilterExpression;
    if (fields.bookingCode) stored.name = "uniq_booking_code";
    return stored;
  });
  const { database, writes } = fixture(indexes);
  assert.deepEqual(await ensureBooking009Indexes(database), indexes.map(({ name }) => name));
  assert.equal(writes.length, 0);
  assert.ok(indexes.every((index) => !index.partialFilterExpression));
});

test("Booking migration refuses incompatible uniqueness, partial, sparse, collation or key before writes", async () => {
  for (const index of [
    { key: { bookingCode: 1 }, name: "uniq_booking_code" },
    { key: { bookingCode: 1 }, name: "uniq_booking_code", unique: true, sparse: true },
    { key: { bookingCode: 1 }, name: "uniq_booking_code", unique: true, partialFilterExpression: { status: "CONFIRMED" } },
    { key: { bookingCode: 1 }, name: "uniq_booking_code", unique: true, collation: { locale: "en" } },
    { key: { unrelated: 1 }, name: "uniq_booking_hold", unique: true },
    { key: { holdId: 1 }, name: "uniq_booking_hold", unique: true, partialFilterExpression: { status: "CONFIRMED" } },
    { key: { holdId: 1 }, name: "uniq_booking_hold" },
    { key: { requestKey: 1, customerAccountId: 1 }, name: "uniq_booking_customer_request", unique: true },
  ]) {
    const { database, writes } = fixture([index]);
    await assert.rejects(ensureBooking009Indexes(database), /Incompatible Booking index/);
    assert.equal(writes.length, 0);
  }
});

test("Booking migration creates indexes for an absent collection", async () => {
  const { database, writes } = fixture([], { code: 26 });
  await ensureBooking009Indexes(database);
  assert.deepEqual(writes, BOOKING_INDEXES);
});

test("Booking migration propagates inspection failures without writing", async () => {
  const failure = new Error("not authorized to list indexes");
  const { database, writes } = fixture([], failure);
  await assert.rejects(ensureBooking009Indexes(database), (error) => error === failure);
  assert.equal(writes.length, 0);
});
