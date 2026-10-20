import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { SeatHold } from "../src/modules/booking/seat-hold.model.js";
import { ShowtimeSeat } from "../src/modules/booking/showtime-seat.model.js";
import { Booking } from "../src/modules/booking/booking.model.js";
import { Showtime } from "../src/modules/showtime/showtime.model.js";
import { createSeatHoldRepository, SeatClaimConflictError } from "../src/modules/booking/seat-hold.repository.js";

const testUri = process.env.MONGODB_TEST_URI?.trim();

test("MongoDB repricing rolls back time and price together and excludes a concurrent stale-price hold", {
  skip: !testUri && "MONGODB_TEST_URI is not configured; pricing transactions were not verified on MongoDB",
}, async () => {
  assert.match(testUri.split("?")[0].split("/").at(-1), /test/i, "Use a dedicated test URI");
  const databaseName = `pricing_tx_test_${randomUUID().replaceAll("-", "")}`;
  const connection = mongoose.createConnection();
  try {
    configureMongoDns();
    await connection.openUri(testUri, { dbName: databaseName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    assert.ok((await connection.db.admin().command({ hello: 1 })).setName, "Pricing transactions need a replica set");
    const Holds = connection.model("SeatHold", SeatHold.schema.clone());
    const Seats = connection.model("ShowtimeSeat", ShowtimeSeat.schema.clone());
    const Bookings = connection.model("Booking", Booking.schema.clone());
    const Showtimes = connection.model("Showtime", Showtime.schema.clone());
    for (const model of [Holds, Seats, Bookings, Showtimes]) {
      await model.createCollection();
      await model.createIndexes();
    }
    const repository = createSeatHoldRepository({ connection, seatHoldModel: Holds, showtimeSeatModel: Seats, bookingModel: Bookings });
    const seatId = new mongoose.Types.ObjectId();
    const planId = new mongoose.Types.ObjectId();
    const showtime = await Showtimes.create({
      movieId: new mongoose.Types.ObjectId(), roomId: new mongoose.Types.ObjectId(), roomLayoutVersion: 1,
      startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 93600000),
      status: "PUBLISHED", ticketPricePlanId: planId,
    });
    await repository.initializeShowtimeSeats({
      showtimeId: showtime._id, roomLayoutVersion: 1,
      seats: [{ seatId, state: "AVAILABLE", priceSnapshot: 105000 }],
    });
    const targetStart = new Date(showtime.startAt.getTime() + 86400000);
    const newPlanId = new mongoose.Types.ObjectId();
    const command = {
      showtimeId: showtime._id, roomLayoutVersion: 1, now: new Date(),
      seats: [{ seatId, priceSnapshot: 125000 }],
    };
    const updateTime = (session) => Showtimes.findOneAndUpdate({ _id: showtime._id }, {
      $set: { startAt: targetStart, ticketPricePlanId: newPlanId },
    }, { session, new: true }).lean().exec();
    await assert.rejects(repository.repriceUnclaimedShowtime({ ...command, commit: async (session) => {
      await updateTime(session);
      throw new Error("abort publication update");
    } }), /abort publication update/);
    assert.equal((await Seats.findOne({ showtimeId: showtime._id }).lean()).priceSnapshot, 105000);
    assert.equal((await Showtimes.findById(showtime._id).lean()).startAt.getTime(), showtime.startAt.getTime());

    await repository.repriceUnclaimedShowtime({ ...command, commit: updateTime });
    assert.equal((await Seats.findOne({ showtimeId: showtime._id }).lean()).priceSnapshot, 125000);
    assert.equal(String((await Showtimes.findById(showtime._id).lean()).ticketPricePlanId), String(newPlanId));
    const makeHold = (price, checkoutKey) => ({
      ownerId: new mongoose.Types.ObjectId(), checkoutKey, commandHash: checkoutKey,
      showtimeId: showtime._id, roomLayoutVersion: 1, seatIds: [seatId],
      heldAt: new Date(), expiresAt: new Date(Date.now() + 600000),
      priceSnapshot: { currency: "VND", lines: [{ seatId, unitPrice: price }], totalAmount: price },
    });
    await assert.rejects(repository.acquire(makeHold(105000, "stale-quote")), SeatClaimConflictError);
    assert.equal(await Holds.countDocuments(), 0);

    const results = await Promise.allSettled([
      repository.acquire(makeHold(125000, "race-quote")),
      repository.repriceUnclaimedShowtime({
        ...command, seats: [{ seatId, priceSnapshot: 105000 }],
        commit: (session) => Showtimes.findOneAndUpdate({ _id: showtime._id }, {
          $set: { startAt: showtime.startAt, ticketPricePlanId: planId },
        }, { session, new: true }).lean().exec(),
      }),
    ]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.ok(results.find(({ status }) => status === "rejected").reason instanceof SeatClaimConflictError);
    const row = await Seats.findOne({ showtimeId: showtime._id }).lean();
    if (results[0].status === "fulfilled") {
      assert.equal(row.state, "HELD");
      assert.equal(row.priceSnapshot, 125000);
      await assert.rejects(repository.repriceUnclaimedShowtime({ ...command, commit: updateTime }), SeatClaimConflictError);
    } else {
      assert.equal(row.state, "AVAILABLE");
      assert.equal(row.priceSnapshot, 105000);
    }
  } finally {
    try {
      if (connection.readyState === 1) {
        assert.equal(connection.db.databaseName, databaseName);
        await connection.db.dropDatabase();
      }
    } finally { await connection.close(); }
  }
});
