import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { SEAT_HOLD_STATUS } from "../src/modules/booking/seat-hold.constants.js";
import { SeatHold } from "../src/modules/booking/seat-hold.model.js";
import {
  createSeatHoldRepository,
  SeatClaimConflictError,
} from "../src/modules/booking/seat-hold.repository.js";
import { ShowtimeSeat } from "../src/modules/booking/showtime-seat.model.js";

const testUri = process.env.MONGODB_TEST_URI?.trim();

const requireSafeTestDatabase = (uri) => {
  const path = uri.split("?")[0];
  const databaseName = path.slice(path.lastIndexOf("/") + 1);
  assert.match(databaseName, /test/i, "MONGODB_TEST_URI database name must contain 'test'");
};

const holdInput = ({ ownerId, showtimeId, seatIds, checkoutKey, heldAt, durationMs = 600000 }) => ({
  ownerId,
  checkoutKey,
  commandHash: `${checkoutKey}-hash`,
  showtimeId,
  roomLayoutVersion: 1,
  seatIds,
  heldAt,
  expiresAt: new Date(heldAt.getTime() + durationMs),
  priceSnapshot: {
    currency: "VND",
    lines: seatIds.map((seatId) => ({ seatId, unitPrice: 100000 })),
    totalAmount: seatIds.length * 100000,
  },
});

test(
  "SeatHold repository enforces race, rollback and expiry invariants on a replica set",
  { skip: !testUri },
  async () => {
    requireSafeTestDatabase(testUri);
    await mongoose.connect(testUri);

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName, "MONGODB_TEST_URI must point to a replica set");
    await Promise.all([SeatHold.syncIndexes(), ShowtimeSeat.syncIndexes()]);

    const repository = createSeatHoldRepository();
    const showtimeIds = [];

    try {
      const raceShowtimeId = new mongoose.Types.ObjectId();
      const raceSeatId = new mongoose.Types.ObjectId();
      showtimeIds.push(raceShowtimeId);
      const now = new Date();
      const attempts = Array.from({ length: 20 }, (_, index) =>
        repository.acquire(
          holdInput({
            ownerId: new mongoose.Types.ObjectId(),
            showtimeId: raceShowtimeId,
            seatIds: [raceSeatId],
            checkoutKey: `race-${index}`,
            heldAt: now,
          }),
        ),
      );
      const results = await Promise.allSettled(attempts);
      assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
      assert.ok(
        results
          .filter(({ status }) => status === "rejected")
          .every(({ reason }) => reason instanceof SeatClaimConflictError),
      );

      const rollbackShowtimeId = new mongoose.Types.ObjectId();
      const rollbackSeats = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
      showtimeIds.push(rollbackShowtimeId);
      const invalid = holdInput({
        ownerId: new mongoose.Types.ObjectId(),
        showtimeId: rollbackShowtimeId,
        seatIds: rollbackSeats,
        checkoutKey: "rollback",
        heldAt: now,
      });
      invalid.priceSnapshot.lines[1].unitPrice = -1;
      await assert.rejects(repository.acquire(invalid));
      assert.equal(await ShowtimeSeat.countDocuments({ showtimeId: rollbackShowtimeId }), 0);
      assert.equal(await SeatHold.countDocuments({ showtimeId: rollbackShowtimeId }), 0);

      const expiryShowtimeId = new mongoose.Types.ObjectId();
      const expirySeatId = new mongoose.Types.ObjectId();
      showtimeIds.push(expiryShowtimeId);
      const expiredAt = new Date(now.getTime() - 120000);
      const first = await repository.acquire(
        holdInput({
          ownerId: new mongoose.Types.ObjectId(),
          showtimeId: expiryShowtimeId,
          seatIds: [expirySeatId],
          checkoutKey: "expired-owner",
          heldAt: expiredAt,
          durationMs: 60000,
        }),
      );
      const second = await repository.acquire(
        holdInput({
          ownerId: new mongoose.Types.ObjectId(),
          showtimeId: expiryShowtimeId,
          seatIds: [expirySeatId],
          checkoutKey: "new-owner",
          heldAt: now,
        }),
      );
      assert.notEqual(first.hold._id.toString(), second.hold._id.toString());
      const expiredHold = await SeatHold.findById(first.hold._id).lean().exec();
      assert.equal(expiredHold.status, SEAT_HOLD_STATUS.EXPIRED);
    } finally {
      await ShowtimeSeat.deleteMany({ showtimeId: { $in: showtimeIds } });
      await SeatHold.deleteMany({ showtimeId: { $in: showtimeIds } });
      await mongoose.disconnect();
    }
  },
);
