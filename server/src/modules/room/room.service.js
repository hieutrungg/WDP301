import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { getBranchSummariesByIds } from "../branch/branch.service.js";
import {
  countFuturePublishedShowtimesByRoomIds,
  countFuturePublishedShowtimesForLayout,
} from "./room-dependency.repository.js";
import {
  LEGACY_ROOM_ACTIVE_STATUS,
  ROOM_ACTIVE_STATUS_VALUES,
  ROOM_ERROR,
  ROOM_STATUS,
} from "./room.constants.js";
import {
  countRooms,
  findLayoutSnapshot,
  findRoomById,
  findRooms,
  replaceRoomLayout,
  saveLayoutSnapshot,
} from "./room.repository.js";
import {
  buildSeats,
  isSameLayout,
  resolveLayoutGrid,
  roomHasLayout,
  summarizeSeats,
  toPositions,
} from "./seat-layout.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const roomNotFoundError = () => new AppError(404, "Room not found", [], ROOM_ERROR.NOT_FOUND);

// `AVAILABLE` is the pre-ROOM-001 spelling of ACTIVE; clients only ever see ACTIVE.
export const normalizeRoomStatus = (status) =>
  status === LEGACY_ROOM_ACTIVE_STATUS ? ROOM_STATUS.ACTIVE : (status ?? null);

const versionConflictError = () =>
  new AppError(
    409,
    "This seat map was changed by someone else while you were editing. Reload it and apply your changes again.",
    [],
    ROOM_ERROR.SEAT_LAYOUT_VERSION_CONFLICT,
  );

const requireRoom = async (roomId) => {
  const room = await findRoomById(roomId);
  if (!room) throw roomNotFoundError();
  return room;
};

export const serializeRoom = (room, branch) => ({
  id: room._id.toString(),
  branch: branch ?? { id: room.branchId?.toString() ?? null, branchName: null, status: null },
  roomName: room.roomName,
  roomType: room.roomType ?? null,
  status: normalizeRoomStatus(room.status),
  capacity: room.capacity ?? 0,
  layoutVersion: room.layoutVersion ?? 0,
});

const serializeLayout = (room) => {
  const grid = resolveLayoutGrid(room);

  return {
    layoutVersion: room.layoutVersion ?? 0,
    rowLabels: grid.rowLabels,
    columnCount: grid.columnCount,
    positions: toPositions(grid),
    summary: summarizeSeats(grid.seats, grid.rowLabels.length, grid.columnCount),
    updatedAt: room.seatLayout?.updatedAt ?? room.updatedAt ?? null,
    updatedBy: room.seatLayout?.updatedBy?.toString() ?? null,
  };
};

// UC41 alternative flow / R-08: the layout the room currently serves is locked while any
// published future showtime is linked to it.
const getEditability = async (room) => {
  if (!roomHasLayout(room)) return { locked: false, protectedShowtimeCount: 0 };

  const protectedShowtimeCount = await countFuturePublishedShowtimesForLayout(
    room._id,
    room.layoutVersion ?? 0,
  );
  return { locked: protectedShowtimeCount > 0, protectedShowtimeCount };
};

const toSeatLayoutDetail = async (room) => {
  const [branches, editability] = await Promise.all([
    getBranchSummariesByIds(room.branchId ? [room.branchId] : []),
    getEditability(room),
  ]);

  return {
    room: serializeRoom(room, branches.get(room.branchId?.toString())),
    layout: roomHasLayout(room) ? serializeLayout(room) : null,
    editability,
  };
};

const buildLayoutUpdate = ({ rowLabels, columnCount, seats }, layoutVersion, actorId) => ({
  layoutVersion,
  seats,
  capacity: summarizeSeats(seats, rowLabels.length, columnCount).operationalSeatCapacity,
  seatLayout: { rowLabels, columnCount, updatedBy: actorId, updatedAt: new Date() },
});

export const buildRoomFilter = ({ branchId, q, status, roomType }) => {
  const filter = {};
  if (branchId) filter.branchId = new mongoose.Types.ObjectId(branchId);
  if (q) filter.roomName = new RegExp(escapeRegex(q), "i");
  if (status === ROOM_STATUS.ACTIVE) filter.status = { $in: ROOM_ACTIVE_STATUS_VALUES };
  else if (status) filter.status = status;
  if (roomType) filter.roomType = new RegExp(`^${escapeRegex(roomType)}$`, "i");
  return filter;
};

// Without an explicit sort the list keeps the order the seat map room picker relies on.
const buildRoomSort = (sort, order) => {
  if (!sort) return { branchId: 1, roomName: 1, _id: 1 };
  const direction = order === "desc" ? -1 : 1;
  return { [sort]: direction, ...(sort === "roomName" ? { branchId: 1 } : {}), _id: direction };
};

// Seat counts a room card needs. Counts only include ENABLED seats, like the layout summary.
export const serializeSeatCounts = (room) => {
  const enabledTotal = room.standardCount + room.vipCount + room.doubleLuxuryCount;

  return {
    standardCount: room.standardCount,
    vipCount: room.vipCount,
    doubleLuxuryCount: room.doubleLuxuryCount,
    accessibleCount: room.accessibleCount,
    disabledCount: Math.max(room.seatCount - enabledTotal, 0),
  };
};

export const listRooms = async ({ branchId, q, status, roomType, sort, order, page, limit }) => {
  const filter = buildRoomFilter({ branchId, q, status, roomType });

  const [rooms, total] = await Promise.all([
    findRooms({ filter, sort: buildRoomSort(sort, order), skip: (page - 1) * limit, limit }),
    countRooms(filter),
  ]);

  const branchIds = [...new Set(rooms.map(({ branchId: id }) => id?.toString()).filter(Boolean))];
  const [branches, upcomingCounts] = await Promise.all([
    getBranchSummariesByIds(branchIds),
    countFuturePublishedShowtimesByRoomIds(rooms.map(({ _id }) => _id)),
  ]);

  return {
    items: rooms.map((room) => ({
      ...serializeRoom(room, branches.get(room.branchId?.toString())),
      hasLayout: room.seatCount > 0,
      layoutUpdatedAt: room.seatLayout?.updatedAt ?? null,
      seatCounts: serializeSeatCounts(room),
      upcomingShowtimeCount: upcomingCounts.get(room._id.toString()) ?? 0,
      createdAt: room.createdAt ?? null,
      updatedAt: room.updatedAt ?? null,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getSeatLayout = async (roomId) => toSeatLayoutDetail(await requireRoom(roomId));

// Exported Room read contract for Booking. It resolves the exact layout version snapshotted by
// a Showtime and never exposes a mutable current layout in place of a missing historical one.
export const getLayoutVersionForBooking = async (roomId, layoutVersion) => {
  const room = await findRoomById(roomId);
  if (!room) return null;

  if ((room.layoutVersion ?? 0) === layoutVersion) {
    return { roomId: room._id, roomLayoutVersion: layoutVersion, seats: room.seats ?? [] };
  }

  const snapshot = await findLayoutSnapshot(roomId, layoutVersion);
  if (!snapshot) return null;
  return { roomId: snapshot.roomId, roomLayoutVersion: layoutVersion, seats: snapshot.seats ?? [] };
};

export const createSeatLayout = async (roomId, input, actorId) => {
  const room = await requireRoom(roomId);

  if (roomHasLayout(room)) {
    throw new AppError(
      409,
      "This room already has a seat map. Load it and save your changes as an update.",
      [],
      ROOM_ERROR.SEAT_LAYOUT_ALREADY_EXISTS,
    );
  }

  const next = { rowLabels: input.rowLabels, columnCount: input.columnCount, seats: buildSeats(input) };
  const updated = await replaceRoomLayout(
    room._id,
    room.layoutVersion ?? null,
    buildLayoutUpdate(next, (room.layoutVersion ?? 0) + 1, actorId),
  );

  // Lost the race against a concurrent first save: that save created the layout.
  if (!updated) {
    throw new AppError(
      409,
      "A seat map was created for this room while you were editing. Reload it and apply your changes again.",
      [],
      ROOM_ERROR.SEAT_LAYOUT_ALREADY_EXISTS,
    );
  }

  return { ...(await toSeatLayoutDetail(updated)), changed: true };
};

export const updateSeatLayout = async (roomId, input, actorId) => {
  const room = await requireRoom(roomId);

  if (!roomHasLayout(room)) {
    throw new AppError(
      404,
      "This room has no seat map yet. Create one first.",
      [],
      ROOM_ERROR.SEAT_LAYOUT_NOT_FOUND,
    );
  }

  const currentVersion = room.layoutVersion ?? 0;
  if (input.expectedLayoutVersion !== currentVersion) throw versionConflictError();

  const current = resolveLayoutGrid(room);
  const next = {
    rowLabels: input.rowLabels,
    columnCount: input.columnCount,
    seats: buildSeats(input, current.seats),
  };

  // R-20: saving an unchanged layout is a no-op and does not mint a new version.
  if (isSameLayout(current, next)) {
    return { ...(await toSeatLayoutDetail(room)), changed: false };
  }

  // R-08/R-17: re-checked here at save time, not only when the editor loaded.
  const protectedShowtimeCount = await countFuturePublishedShowtimesForLayout(room._id, currentVersion);
  if (protectedShowtimeCount > 0) {
    throw new AppError(
      409,
      `Layout version ${currentVersion} is used by ${protectedShowtimeCount} upcoming published ` +
        "showtime(s), so its grid cannot be changed. Structural changes are possible once no " +
        "published future showtime is linked to it.",
      [],
      ROOM_ERROR.SEAT_LAYOUT_IN_USE,
    );
  }

  // A-14/R-18: keep the superseded version so showtimes and bookings created against it keep
  // resolving the same seats. The snapshot goes first; it is immutable per version, so if the
  // compare-and-set below loses a race the snapshot is still correct.
  const currentSummary = summarizeSeats(current.seats, current.rowLabels.length, current.columnCount);
  await saveLayoutSnapshot({
    roomId: room._id,
    layoutVersion: currentVersion,
    rowLabels: current.rowLabels,
    columnCount: current.columnCount,
    seats: current.seats,
    capacity: currentSummary.operationalSeatCapacity,
    authoredBy: room.seatLayout?.updatedBy,
    authoredAt: room.seatLayout?.updatedAt ?? room.updatedAt,
    supersededAt: new Date(),
    supersededBy: actorId,
  });

  const updated = await replaceRoomLayout(
    room._id,
    room.layoutVersion ?? null,
    buildLayoutUpdate(next, currentVersion + 1, actorId),
  );
  if (!updated) throw versionConflictError();

  return { ...(await toSeatLayoutDetail(updated)), changed: true };
};
