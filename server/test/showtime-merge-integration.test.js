import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { ShowtimeSeat } from "../src/modules/booking/showtime-seat.model.js";
import { createSeatAvailabilityService } from "../src/modules/booking/seat-availability.service.js";
import { getPublicShowtimeById, listShowtimes, listManagerShowtimes } from "../src/modules/showtime/showtime.service.js";

test("merged availability keeps both sold-out summary reads and transactional repricing", async () => {
  const showtimeId = new mongoose.Types.ObjectId();
  let reads = 0;
  const service = createSeatAvailabilityService({
    repository: {
      summarizeAvailabilityByShowtime: async (ids) => {
        reads += 1;
        assert.deepEqual(ids, [showtimeId]);
        return [{ _id: showtimeId, totalSeatCount: 40, availableSeatCount: 0 }];
      },
    },
  });
  assert.equal(typeof service.repriceUnclaimedShowtime, "function");
  assert.equal((await service.getAvailabilitySummary([])).size, 0);
  assert.equal(reads, 0);
  assert.deepEqual((await service.getAvailabilitySummary([String(showtimeId)])).get(String(showtimeId)), {
    totalSeatCount: 40, availableSeatCount: 0,
  });
});

test("new price input preserves the upstream name and rejects an incomplete snapshot before writing", async () => {
  const seatId = new mongoose.Types.ObjectId();
  let writes = 0;
  const service = createSeatAvailabilityService({
    roomLayoutReader: { getLayoutVersion: async () => ({ seats: [{ _id: seatId, type: "VIP", status: "ENABLED" }] }) },
    repository: { initializeShowtimeSeats: async ({ seats }) => { writes += 1; assert.equal(seats[0].priceSnapshot, 110500); return seats; } },
  });
  const input = { showtimeId: new mongoose.Types.ObjectId(), roomId: new mongoose.Types.ObjectId(), roomLayoutVersion: 1 };
  await assert.rejects(service.initializeForPublishedShowtime({ ...input, pricesBySeatType: { STANDARD: 105000 } }), { code: "PRICE_QUOTE_FAILED" });
  assert.equal(writes, 0);
  await service.initializeForPublishedShowtime({ ...input, pricesBySeatType: { VIP: 110500 } });
  assert.equal(writes, 1);
});

test("public list/detail and Manager schedule/history retain derived states after the pricing merge", async (t) => {
  const now = new Date("2026-10-20T00:00:00Z");
  const showtimeId = new mongoose.Types.ObjectId();
  let status = "PUBLISHED";
  let availableSeatCount = 0;
  let startAt = new Date("2026-10-21T10:00:00Z");
  let endAt = new Date("2026-10-21T12:00:00Z");
  const item = () => ({
    _id: showtimeId, movieId: new mongoose.Types.ObjectId(), roomId: new mongoose.Types.ObjectId(),
    roomLayoutVersion: 1, status, startAt, endAt,
    movie: { id: new mongoose.Types.ObjectId(), title: "Merge test" },
    cinema: { id: new mongoose.Types.ObjectId(), branchName: "Test" },
    room: { id: new mongoose.Types.ObjectId(), roomName: "Room 1" },
  });
  const originalDb = mongoose.connection.db;
  t.mock.method(ShowtimeSeat, "aggregate", () => ({ exec: async () => [{ _id: showtimeId, totalSeatCount: 40, availableSeatCount }] }));
  // Stub only the persistence boundary; run the actual repository and service projections.
  mongoose.connection.db = {
    collection: (name) => {
      assert.equal(name, "showtimes");
      return { aggregate: (pipeline) => ({ toArray: async () => pipeline.some((stage) => stage.$facet)
        ? [{ items: [item()], total: [{ count: 1 }] }] : [item()] }) };
    },
  };
  try {
    assert.equal((await listShowtimes({ page: 1, limit: 20 }, now)).data[0].displayStatus, "SOLD_OUT");
    assert.equal((await getPublicShowtimeById(String(showtimeId), now)).displayStatus, "SOLD_OUT");
    availableSeatCount = 1;
    assert.equal((await listManagerShowtimes({ view: "upcoming", page: 1, limit: 20 }, now)).data[0].displayStatus, "UPCOMING");
    status = "CANCELLED";
    assert.equal((await listManagerShowtimes({ view: "history", page: 1, limit: 20 }, now)).data[0].displayStatus, "CANCELLED");
    status = "PUBLISHED";
    startAt = new Date("2026-10-19T10:00:00Z");
    endAt = new Date("2026-10-19T12:00:00Z");
    assert.equal((await listManagerShowtimes({ view: "history", page: 1, limit: 20 }, now)).data[0].displayStatus, "ENDED");
  } finally { mongoose.connection.db = originalDb; }
});
