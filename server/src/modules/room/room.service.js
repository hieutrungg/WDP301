import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { getBranchSummariesByIds } from "../branch/branch.service.js";
import { countFuturePublishedShowtimesForLayout } from "./room-dependency.repository.js";
import { ROOM_ERROR } from "./room.constants.js";
import {
  countRooms,
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

const roomNotFoundError = () => new AppError(404, "Room not found", [], ROOM_ERROR.NOT_FOUND);

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

const serializeRoom = (room, branch) => ({
  id: room._id.toString(),
  branch: branch ?? { id: room.branchId?.toString() ?? null, branchName: null, status: null },
  roomName: room.roomName,
  roomType: room.roomType ?? null,
  status: room.status ?? null,
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

export const listRooms = async ({ branchId, q, page, limit }) => {
  const filter = {};
  if (branchId) filter.branchId = new mongoose.Types.ObjectId(branchId);
  if (q) filter.roomName = new RegExp(escapeRegex(q), "i");

  const [rooms, total] = await Promise.all([
    findRooms({ filter, skip: (page - 1) * limit, limit }),
    countRooms(filter),
  ]);

  const branchIds = [...new Set(rooms.map(({ branchId: id }) => id?.toString()).filter(Boolean))];
  const branches = await getBranchSummariesByIds(branchIds);

  return {
    items: rooms.map((room) => ({
      ...serializeRoom(room, branches.get(room.branchId?.toString())),
      hasLayout: room.seatCount > 0,
      layoutUpdatedAt: room.seatLayout?.updatedAt ?? null,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getSeatLayout = async (roomId) => toSeatLayoutDetail(await requireRoom(roomId));

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
