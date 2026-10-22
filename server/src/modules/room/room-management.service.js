import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { getBranchSummariesByIds } from "../branch/branch.service.js";
import {
  countFuturePublishedShowtimesByRoomIds,
  countFuturePublishedShowtimesForRoom,
  countShowtimesForRoom,
} from "./room-dependency.repository.js";
import { ROOM_MANAGEMENT_ERROR, ROOM_STATUS } from "./room.constants.js";
import {
  aggregateRoomTotals,
  deleteRoomById,
  findRoomById,
  findRoomByName,
  findRoomIds,
  insertRoom,
  setRoomStatus,
  updateRoomIdentity,
} from "./room.repository.js";
import { normalizeRoomStatus, roomNotFoundError, serializeRoom } from "./room.service.js";
import { resolveLayoutGrid, summarizeSeats } from "./seat-layout.js";

// A-24: only a branch in this state can receive new rooms.
const ACTIVE_BRANCH_STATUS = "ACTIVE";

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const nameTakenError = () =>
  new AppError(
    409,
    "A room with this name already exists in this branch",
    [{ field: "roomName", message: "A room with this name already exists in this branch" }],
    ROOM_MANAGEMENT_ERROR.NAME_TAKEN,
  );

const futureShowtimesError = (count, action) =>
  new AppError(
    409,
    `This room still has ${count} upcoming published showtime(s). Cancel or reschedule them before ${action}.`,
    [],
    ROOM_MANAGEMENT_ERROR.HAS_FUTURE_SHOWTIMES,
  );

const requireRoom = async (roomId) => {
  const room = await findRoomById(roomId);
  if (!room) throw roomNotFoundError();
  return room;
};

const assertNameAvailable = async (branchId, roomName, excludeId) => {
  if (await findRoomByName(branchId, roomName, { excludeId })) throw nameTakenError();
};

// The unique index is the real guard: two concurrent requests can both pass the pre-check.
const rethrowDuplicateName = (error) => {
  if (error?.code === 11000) throw nameTakenError();
  throw error;
};

const toRoomDetail = async (room) => {
  const grid = resolveLayoutGrid(room);
  const seatSummary = summarizeSeats(grid.seats, grid.rowLabels.length, grid.columnCount);
  const [branches, upcomingShowtimeCount, showtimeCount] = await Promise.all([
    getBranchSummariesByIds(room.branchId ? [room.branchId] : []),
    countFuturePublishedShowtimesForRoom(room._id),
    countShowtimesForRoom(room._id),
  ]);

  return {
    ...serializeRoom(room, branches.get(room.branchId?.toString())),
    hasLayout: seatSummary.seatCount > 0,
    layoutUpdatedAt: room.seatLayout?.updatedAt ?? null,
    seatCounts: {
      standardCount: seatSummary.standardCount,
      vipCount: seatSummary.vipCount,
      doubleLuxuryCount: seatSummary.doubleLuxuryCount,
      accessibleCount: seatSummary.accessibleCount,
      disabledCount: seatSummary.disabledCount,
    },
    upcomingShowtimeCount,
    showtimeCount,
    // A room that never had a showtime can be deleted; anything else is retired via INACTIVE.
    canDelete: showtimeCount === 0,
    createdAt: room.createdAt ?? null,
    updatedAt: room.updatedAt ?? null,
  };
};

export const getRoom = async (roomId) => toRoomDetail(await requireRoom(roomId));

export const getRoomSummary = async ({ branchId } = {}) => {
  const filter = branchId ? { branchId: toObjectId(branchId) } : {};
  const [[facets], roomIds] = await Promise.all([aggregateRoomTotals(filter), findRoomIds(filter)]);
  const upcomingByRoom = await countFuturePublishedShowtimesByRoomIds(roomIds);

  const statusCounts = { ACTIVE: 0, MAINTENANCE: 0, INACTIVE: 0, unspecified: 0 };
  for (const { _id, count } of facets.byStatus) {
    const status = normalizeRoomStatus(_id);
    statusCounts[status && status in statusCounts ? status : "unspecified"] += count;
  }

  return {
    totalRooms: facets.totals[0]?.rooms ?? 0,
    totalSeats: facets.totals[0]?.seats ?? 0,
    active: statusCounts.ACTIVE,
    maintenance: statusCounts.MAINTENANCE,
    inactive: statusCounts.INACTIVE,
    unspecified: statusCounts.unspecified,
    withoutLayout: facets.withoutLayout[0]?.count ?? 0,
    roomsWithUpcomingShowtimes: upcomingByRoom.size,
    upcomingShowtimes: [...upcomingByRoom.values()].reduce((sum, count) => sum + count, 0),
    roomTypes: facets.byType
      .filter(({ _id }) => _id)
      .map(({ _id, count }) => ({ roomType: _id, count }))
      .sort((a, b) => b.count - a.count || a.roomType.localeCompare(b.roomType)),
  };
};

export const createRoom = async ({ branchId, roomName, roomType, status }) => {
  const branch = (await getBranchSummariesByIds([branchId])).get(branchId.toLowerCase());

  if (!branch) {
    throw new AppError(
      400,
      "The selected branch does not exist",
      [{ field: "branchId", message: "The selected branch does not exist" }],
      ROOM_MANAGEMENT_ERROR.BRANCH_INVALID,
    );
  }
  if (branch.status !== ACTIVE_BRANCH_STATUS) {
    throw new AppError(
      409,
      "Rooms can only be added to an active branch",
      [{ field: "branchId", message: "Rooms can only be added to an active branch" }],
      ROOM_MANAGEMENT_ERROR.BRANCH_INACTIVE,
    );
  }

  const branchObjectId = toObjectId(branchId);
  await assertNameAvailable(branchObjectId, roomName);

  try {
    // Capacity and seats stay empty: they are owned by the seat map (UC41), not by this form.
    const room = await insertRoom({
      branchId: branchObjectId,
      roomName,
      roomType,
      status,
      capacity: 0,
      layoutVersion: 0,
      seats: [],
    });
    return await toRoomDetail(room);
  } catch (error) {
    return rethrowDuplicateName(error);
  }
};

export const updateRoom = async (roomId, changes) => {
  const current = await requireRoom(roomId);
  const set = {};

  if (changes.roomName !== undefined && changes.roomName !== current.roomName) {
    await assertNameAvailable(current.branchId, changes.roomName, current._id);
    set.roomName = changes.roomName;
  }

  if (changes.roomType !== undefined && changes.roomType !== current.roomType) {
    // The room type decides which price policy a showtime can use, so it is frozen while
    // customers can still book an upcoming session in this room.
    const upcomingShowtimeCount = await countFuturePublishedShowtimesForRoom(current._id);
    if (upcomingShowtimeCount > 0) {
      throw futureShowtimesError(upcomingShowtimeCount, "changing its type");
    }
    set.roomType = changes.roomType;
  }

  if (Object.keys(set).length === 0) return toRoomDetail(current);

  try {
    const updated = await updateRoomIdentity(current._id, set);
    if (!updated) throw roomNotFoundError();
    return await toRoomDetail(updated);
  } catch (error) {
    return rethrowDuplicateName(error);
  }
};

export const changeRoomStatus = async (roomId, status) => {
  const room = await requireRoom(roomId);

  // Compared with the stored value on purpose: setting a legacy `AVAILABLE` room to ACTIVE
  // rewrites it to the canonical spelling.
  if (room.status === status) return toRoomDetail(room);

  // Customers can book published sessions, so a room cannot leave service underneath them
  // (same rule as a branch going INACTIVE, A-24).
  if (status !== ROOM_STATUS.ACTIVE) {
    const upcomingShowtimeCount = await countFuturePublishedShowtimesForRoom(room._id);
    if (upcomingShowtimeCount > 0) {
      throw futureShowtimesError(upcomingShowtimeCount, `setting the room to ${status.toLowerCase()}`);
    }
  }

  const result = await setRoomStatus(room._id, room.status, status);
  if (result.matchedCount !== 1) {
    throw new AppError(
      409,
      "Room status changed while you were editing. Refresh and try again.",
      [],
      ROOM_MANAGEMENT_ERROR.STATUS_CONFLICT,
    );
  }

  return getRoom(room._id);
};

export const deleteRoom = async (roomId) => {
  const room = await requireRoom(roomId);

  // Rooms that ever hosted a showtime keep their history (bookings, tickets and payments reach a
  // room through its showtimes), so they are retired with INACTIVE instead of deleted.
  const showtimeCount = await countShowtimesForRoom(room._id);
  if (showtimeCount > 0) {
    throw new AppError(
      409,
      `This room is linked to ${showtimeCount} showtime(s) and keeps their history, so it cannot be deleted. Set it to inactive instead.`,
      [],
      ROOM_MANAGEMENT_ERROR.HAS_SHOWTIME_HISTORY,
    );
  }

  if (!(await deleteRoomById(room._id))) throw roomNotFoundError();

  return { id: room._id.toString() };
};
