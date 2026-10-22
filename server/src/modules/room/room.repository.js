import { RoomLayoutVersion } from "./room-layout-version.model.js";
import {
  ROOM_NAME_COLLATION,
  ROOM_SORT_COLLATION,
  SEAT_STATUS,
  SEAT_TYPE,
} from "./room.constants.js";
import { Room } from "./room.model.js";

const seatsOf = { $ifNull: ["$seats", []] };

// Same definition as summarizeSeats: only ENABLED seats count towards a type's total.
const countEnabledSeats = (extraCondition) => ({
  $size: {
    $filter: {
      input: seatsOf,
      cond: { $and: [{ $ne: ["$$this.status", SEAT_STATUS.DISABLED] }, ...(extraCondition ? [extraCondition] : [])] },
    },
  },
});

const ROOM_SUMMARY_PROJECTION = {
  branchId: 1,
  roomName: 1,
  roomType: 1,
  capacity: 1,
  status: 1,
  layoutVersion: 1,
  createdAt: 1,
  updatedAt: 1,
  "seatLayout.updatedAt": 1,
  seatCount: { $size: seatsOf },
  standardCount: countEnabledSeats({ $eq: ["$$this.type", SEAT_TYPE.STANDARD] }),
  vipCount: countEnabledSeats({ $eq: ["$$this.type", SEAT_TYPE.VIP] }),
  doubleLuxuryCount: countEnabledSeats({ $eq: ["$$this.type", SEAT_TYPE.DOUBLE_LUXURY] }),
  accessibleCount: countEnabledSeats({ $eq: ["$$this.isAccessible", true] }),
};

export const findRooms = ({ filter, sort, skip, limit }) =>
  Room.aggregate([
    { $match: filter },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    { $project: ROOM_SUMMARY_PROJECTION },
  ])
    .collation(ROOM_SORT_COLLATION)
    .exec();

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

export const findRoomIds = (filter) => Room.distinct("_id", filter).exec();

export const aggregateRoomTotals = (filter) =>
  Room.aggregate([
    { $match: filter },
    {
      $facet: {
        totals: [{ $group: { _id: null, rooms: { $sum: 1 }, seats: { $sum: { $ifNull: ["$capacity", 0] } } } }],
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byType: [{ $group: { _id: { $toUpper: { $ifNull: ["$roomType", ""] } }, count: { $sum: 1 } } }],
        withoutLayout: [
          { $match: { $expr: { $eq: [{ $size: seatsOf }, 0] } } },
          { $count: "count" },
        ],
      },
    },
  ]).exec();

// Uses the same collation as the unique index, so "room 01" matches "Room 01".
export const findRoomByName = (branchId, roomName, { excludeId } = {}) =>
  Room.findOne({ branchId, roomName, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    .collation(ROOM_NAME_COLLATION)
    .lean()
    .exec();

export const insertRoom = async (room) => (await Room.create(room)).toObject();

export const updateRoomIdentity = (roomId, set) =>
  Room.findByIdAndUpdate(roomId, { $set: set }, { returnDocument: "after", runValidators: true })
    .lean()
    .exec();

// Compare-and-set: only flips the status the caller observed. A missing status matches null.
export const setRoomStatus = (roomId, fromStatus, toStatus) =>
  Room.updateOne({ _id: roomId, status: fromStatus ?? null }, { $set: { status: toStatus } }).exec();

export const deleteRoomById = async (roomId) => {
  const { deletedCount } = await Room.deleteOne({ _id: roomId }).exec();
  // Superseded layout snapshots only exist to serve showtimes, and a deletable room has none.
  if (deletedCount === 1) await RoomLayoutVersion.deleteMany({ roomId }).exec();
  return deletedCount === 1;
};
