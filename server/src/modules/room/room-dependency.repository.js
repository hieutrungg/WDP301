import mongoose from "mongoose";

// Temporary read port for the Showtime facts UC41 needs (the published-showtime lock). The
// Showtime module has no exported read contract yet, so this reads its collection directly and
// must be replaced by that contract once it exists.
const collection = (name) => mongoose.connection.db.collection(name);

/**
 * Counts PUBLISHED showtimes that start in the future and are linked to the given layout version.
 * A showtime without `roomLayoutVersion` (created before A-28 snapshots) is treated as linked to
 * the current version, so the lock fails closed instead of open.
 */
export const countFuturePublishedShowtimesForLayout = (roomId, layoutVersion, now = new Date()) =>
  collection("showtimes").countDocuments({
    roomId,
    status: "PUBLISHED",
    $and: [
      // A-15/A-27 name the field `startAt`, while the DB bootstrap validator still declares
      // `startTime`. Match both until the Showtime owner settles it.
      { $or: [{ startAt: { $gt: now } }, { startTime: { $gt: now } }] },
      { $or: [{ roomLayoutVersion: layoutVersion }, { roomLayoutVersion: { $exists: false } }] },
    ],
  });

// ROOM-001 reads. Same temporary port as above: counts are over every layout version, because a
// room's identity (type, availability) matters to a showtime regardless of the layout it uses.
const futurePublishedFilter = (now) => ({
  status: "PUBLISHED",
  // See countFuturePublishedShowtimesForLayout: both spellings are matched so the guard fails closed.
  $or: [{ startAt: { $gt: now } }, { startTime: { $gt: now } }],
});

export const countFuturePublishedShowtimesForRoom = (roomId, now = new Date()) =>
  collection("showtimes").countDocuments({ roomId, ...futurePublishedFilter(now) });

/** Every showtime that ever referenced the room, whatever its status or date. */
export const countShowtimesForRoom = (roomId) => collection("showtimes").countDocuments({ roomId });

export const countFuturePublishedShowtimesByRoomIds = async (roomIds, now = new Date()) => {
  if (roomIds.length === 0) return new Map();

  const rows = await collection("showtimes")
    .aggregate([
      { $match: { roomId: { $in: roomIds }, ...futurePublishedFilter(now) } },
      { $group: { _id: "$roomId", count: { $sum: 1 } } },
    ])
    .toArray();

  return new Map(rows.map(({ _id, count }) => [_id.toString(), count]));
};
