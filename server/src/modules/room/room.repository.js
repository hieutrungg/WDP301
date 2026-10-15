import { RoomLayoutVersion } from "./room-layout-version.model.js";
import { Room } from "./room.model.js";

const ROOM_SUMMARY_PROJECTION = {
  branchId: 1,
  roomName: 1,
  roomType: 1,
  capacity: 1,
  status: 1,
  layoutVersion: 1,
  "seatLayout.updatedAt": 1,
  seatCount: { $size: { $ifNull: ["$seats", []] } },
};

export const findRooms = ({ filter, skip, limit }) =>
  Room.aggregate([
    { $match: filter },
    { $sort: { branchId: 1, roomName: 1, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: ROOM_SUMMARY_PROJECTION },
  ]).exec();

export const countRooms = (filter) => Room.countDocuments(filter).exec();

export const findRoomById = (roomId) => Room.findById(roomId).lean().exec();

export const findLayoutSnapshot = (roomId, layoutVersion) =>
  RoomLayoutVersion.findOne({ roomId, layoutVersion }).lean().exec();

// Snapshot writes are idempotent: the content of a given version never changes, so a retry or a
// later failed room update leaves a correct snapshot behind rather than a partial one.
export const saveLayoutSnapshot = ({ roomId, layoutVersion, ...snapshot }) =>
  RoomLayoutVersion.updateOne(
    { roomId, layoutVersion },
    { $setOnInsert: { roomId, layoutVersion, ...snapshot } },
    { upsert: true },
  ).exec();

/**
 * Compare-and-set on `layoutVersion`: the layout is replaced only if nobody saved a newer
 * version since the caller read it. `null` matches rooms stored without a version field.
 */
export const replaceRoomLayout = (roomId, expectedVersion, layout) =>
  Room.findOneAndUpdate(
    { _id: roomId, layoutVersion: expectedVersion },
    { $set: layout },
    { returnDocument: "after", runValidators: true },
  )
    .lean()
    .exec();
