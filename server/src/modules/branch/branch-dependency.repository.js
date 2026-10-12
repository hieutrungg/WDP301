import mongoose from "mongoose";

// Temporary read port for Room and Showtime facts the Branch module needs (room counts and the
// A-24 disable guard). Those modules have no exported read contract yet, so this reads their
// collections directly and must be replaced by their service contracts once they exist.
const collection = (name) => mongoose.connection.db.collection(name);

export const countRoomsByBranchIds = async (branchIds) => {
  if (branchIds.length === 0) return new Map();

  const rows = await collection("rooms")
    .aggregate([
      { $match: { branchId: { $in: branchIds } } },
      { $group: { _id: "$branchId", count: { $sum: 1 } } },
    ])
    .toArray();

  return new Map(rows.map(({ _id, count }) => [_id.toString(), count]));
};

export const countAllRooms = () => collection("rooms").countDocuments({});

export const countFuturePublishedShowtimes = async (branchId, now = new Date()) => {
  const roomIds = await collection("rooms").distinct("_id", { branchId });
  if (roomIds.length === 0) return 0;

  return collection("showtimes").countDocuments({
    roomId: { $in: roomIds },
    status: "PUBLISHED",
    // A-15/A-27 name the field `startAt`, while the DB bootstrap validator still declares
    // `startTime`. Match both until the Showtime owner settles it so the guard never fails open.
    $or: [{ startAt: { $gt: now } }, { startTime: { $gt: now } }],
  });
};
