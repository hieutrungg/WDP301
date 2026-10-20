import { deterministicObjectId, summarizeBulkWrite } from "./seed-utils.js";
import { MVP_SEAT_TYPE_PRICES_VND } from "../modules/showtime/showtime.pricing.js";

// Development seed data uses the same seed-first defaults as new Showtime publication.
export const DEVELOPMENT_SEAT_PRICE_VND = MVP_SEAT_TYPE_PRICES_VND;

const priceForSeat = (seat) => DEVELOPMENT_SEAT_PRICE_VND[seat.type] ?? null;

const futurePublishedShowtimeFilter = (now) => ({
  status: "PUBLISHED",
  $or: [
    { startAt: { $gt: now } },
    { startAt: { $exists: false }, startTime: { $gt: now } },
  ],
});

const resolveLayout = async (database, showtime) => {
  const room = await database.collection("rooms").findOne({ _id: showtime.roomId });
  if (!room) throw new Error(`Room ${showtime.roomId} for showtime ${showtime._id} was not found`);

  const layoutVersion = Number.isSafeInteger(showtime.roomLayoutVersion)
    ? showtime.roomLayoutVersion
    : room.layoutVersion;
  if (!Number.isSafeInteger(layoutVersion) || layoutVersion < 1) {
    throw new Error(`Showtime ${showtime._id} does not resolve to a versioned room layout`);
  }

  if (layoutVersion === room.layoutVersion) {
    return { layoutVersion, seats: room.seats ?? [], needsBackfill: !showtime.roomLayoutVersion };
  }

  const snapshot = await database.collection("room_layout_versions").findOne({
    roomId: showtime.roomId,
    layoutVersion,
  });
  if (!snapshot) {
    throw new Error(
      `Layout version ${layoutVersion} for showtime ${showtime._id} was not found`,
    );
  }
  return { layoutVersion, seats: snapshot.seats ?? [], needsBackfill: false };
};

export const seedSeatHoldDemoData = async (database, now = new Date()) => {
  const showtimes = await database
    .collection("showtimes")
    .find(futurePublishedShowtimeFilter(now))
    .toArray();

  let layoutVersionsBackfilled = 0;
  let seatResult = { matched: 0, modified: 0, upserted: 0 };

  for (const showtime of showtimes) {
    const layout = await resolveLayout(database, showtime);
    if (layout.seats.length === 0) {
      throw new Error(`Showtime ${showtime._id} has an empty room layout`);
    }

    if (layout.needsBackfill) {
      await database.collection("showtimes").updateOne(
        { _id: showtime._id, roomLayoutVersion: { $exists: false } },
        { $set: { roomLayoutVersion: layout.layoutVersion, updatedAt: now } },
      );
      layoutVersionsBackfilled += 1;
    }

    const operations = layout.seats.map((seat) => {
      const unitPrice = priceForSeat(seat);
      if (!Number.isSafeInteger(unitPrice)) {
        throw new Error(`No development price fixture exists for seat type ${seat.type}`);
      }

      return {
        updateOne: {
          filter: { showtimeId: showtime._id, seatId: seat._id },
          update: {
            $set: {
              roomLayoutVersion: layout.layoutVersion,
              updatedAt: now,
            },
            // Re-running the seed never resets HELD/SOLD runtime state.
            $setOnInsert: {
              _id: deterministicObjectId(`showtime-seat:${showtime._id}:${seat._id}`),
              showtimeId: showtime._id,
              seatId: seat._id,
              state: seat.status === "ENABLED" ? "AVAILABLE" : "UNAVAILABLE",
              priceSnapshot: unitPrice,
              createdAt: now,
            },
          },
          upsert: true,
        },
      };
    });

    const result = summarizeBulkWrite(
      await database.collection("showtime_seats").bulkWrite(operations, { ordered: true }),
    );
    seatResult = {
      matched: seatResult.matched + result.matched,
      modified: seatResult.modified + result.modified,
      upserted: seatResult.upserted + result.upserted,
    };
  }

  return {
    showtimes: showtimes.length,
    layoutVersionsBackfilled,
    showtimeSeats: seatResult,
  };
};

