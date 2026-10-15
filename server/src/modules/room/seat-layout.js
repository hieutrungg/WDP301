import mongoose from "mongoose";
import { POSITION_TYPE, SEAT_STATUS, SEAT_TYPE } from "./room.constants.js";

// Pure UC41 layout rules shared by validation and the service. Nothing here touches the DB.

const MAX_REPORTED_ISSUES = 25;

const seatKey = (row, number) => `${row}:${number}`;

/**
 * R-11/R-12/R-13/R-14: checks that `positions` covers every cell of the grid exactly once and
 * that each cell has one consistent primary state. Returns zod-style issues ({ path, message }).
 */
export const validateLayoutMatrix = ({ rowLabels, columnCount, positions }) => {
  const issues = [];
  const report = (path, message) => {
    if (issues.length < MAX_REPORTED_ISSUES) issues.push({ path, message });
  };

  const seenLabels = new Map();
  rowLabels.forEach((label, index) => {
    if (seenLabels.has(label)) {
      report(["rowLabels", index], `Row label "${label}" is used more than once`);
    } else {
      seenLabels.set(label, index);
    }
  });

  const rowCount = rowLabels.length;
  const seenCells = new Set();
  let seatCount = 0;

  positions.forEach((position, index) => {
    const { rowIndex, columnNumber, positionType, seatType, isAccessible, status } = position;
    const path = ["positions", index];

    if (rowIndex >= rowCount) {
      report([...path, "rowIndex"], `Row index ${rowIndex} is outside the ${rowCount}-row grid`);
      return;
    }
    if (columnNumber > columnCount) {
      report(
        [...path, "columnNumber"],
        `Column ${columnNumber} is outside the ${columnCount}-column grid`,
      );
      return;
    }

    const cell = `${rowIndex}:${columnNumber}`;
    if (seenCells.has(cell)) {
      report(path, `Row ${rowLabels[rowIndex]}, column ${columnNumber} is listed more than once`);
      return;
    }
    seenCells.add(cell);

    if (positionType === POSITION_TYPE.SEAT) {
      seatCount += 1;
      if (!seatType) report([...path, "seatType"], "A seat position needs a seat type");
      return;
    }

    // Aisle/blank space is never a seat, so it cannot carry seat attributes.
    if (seatType) report([...path, "seatType"], "An aisle position cannot have a seat type");
    if (isAccessible) report([...path, "isAccessible"], "Only a seat can be marked accessible");
    if (status && status !== SEAT_STATUS.ENABLED) {
      report([...path, "status"], "Only a seat can be disabled");
    }
  });

  const expectedCells = rowCount * columnCount;
  if (seenCells.size < expectedCells && issues.length === 0) {
    report(
      ["positions"],
      `Every cell of the ${rowCount} x ${columnCount} grid must be provided ` +
        `(${expectedCells - seenCells.size} missing)`,
    );
  }

  if (seatCount === 0 && positions.length > 0) {
    report(["positions"], "A layout needs at least one seat");
  }

  return issues;
};

/**
 * Converts a validated matrix into physical seat definitions, ordered by row then column.
 * Seat numbers run 1..n from left to right within each row and skip aisles. A seat keeps its
 * previous `_id` when the same row label + number existed before.
 */
export const buildSeats = ({ rowLabels, positions }, previousSeats = []) => {
  const previousIds = new Map(previousSeats.map((seat) => [seatKey(seat.row, seat.number), seat._id]));

  const seatPositions = positions
    .filter(({ positionType }) => positionType === POSITION_TYPE.SEAT)
    .sort((a, b) => a.rowIndex - b.rowIndex || a.columnNumber - b.columnNumber);

  const nextNumberByRow = new Map();

  return seatPositions.map(({ rowIndex, columnNumber, seatType, isAccessible, status }) => {
    const row = rowLabels[rowIndex];
    const number = (nextNumberByRow.get(row) ?? 0) + 1;
    nextNumberByRow.set(row, number);

    return {
      _id: previousIds.get(seatKey(row, number)) ?? new mongoose.Types.ObjectId(),
      row,
      number,
      column: columnNumber,
      type: seatType,
      status: status ?? SEAT_STATUS.ENABLED,
      isAccessible: Boolean(isAccessible),
    };
  });
};

// R-06/R-15 and UC41 §7: capacity is derived from enabled seats only. Accessibility overlaps
// the seat-type counts, so it is reported but never added to capacity.
export const summarizeSeats = (seats, rowCount, columnCount) => {
  const enabled = seats.filter(({ status }) => status !== SEAT_STATUS.DISABLED);
  const countType = (type) => enabled.filter((seat) => seat.type === type).length;
  const totalPositions = rowCount * columnCount;

  return {
    rowCount,
    columnCount,
    totalPositions,
    seatCount: seats.length,
    aisleCount: Math.max(totalPositions - seats.length, 0),
    standardCount: countType(SEAT_TYPE.STANDARD),
    vipCount: countType(SEAT_TYPE.VIP),
    doubleLuxuryCount: countType(SEAT_TYPE.DOUBLE_LUXURY),
    accessibleCount: enabled.filter(({ isAccessible }) => isAccessible).length,
    disabledCount: seats.length - enabled.length,
    operationalSeatCapacity: enabled.length,
  };
};

export const roomHasLayout = (room) =>
  (room.seats?.length ?? 0) > 0 || (room.seatLayout?.rowLabels?.length ?? 0) > 0;

/**
 * Returns the grid for a stored room. Rooms seeded before UC41 have seats but no grid metadata;
 * their grid is derived from row order and seat numbers so they open in the builder unchanged.
 */
export const resolveLayoutGrid = (room) => {
  const seats = (room.seats ?? []).map((seat) => ({
    ...seat,
    column: seat.column ?? seat.number,
    isAccessible: Boolean(seat.isAccessible),
    status: seat.status ?? SEAT_STATUS.ENABLED,
  }));

  const storedLabels = room.seatLayout?.rowLabels;
  const rowLabels = storedLabels?.length ? [...storedLabels] : [...new Set(seats.map(({ row }) => row))];
  const widestColumn = seats.reduce((max, { column }) => Math.max(max, column), 0);
  const columnCount = Math.max(room.seatLayout?.columnCount ?? 0, widestColumn);

  return { rowLabels, columnCount, seats };
};

// Full matrix in deterministic display order: row order, then column order.
export const toPositions = ({ rowLabels, columnCount, seats }) => {
  const seatsByCell = new Map(seats.map((seat) => [`${seat.row}:${seat.column}`, seat]));
  const positions = [];

  rowLabels.forEach((rowLabel, rowIndex) => {
    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      const seat = seatsByCell.get(`${rowLabel}:${columnNumber}`);

      positions.push(
        seat
          ? {
              rowIndex,
              rowLabel,
              columnNumber,
              positionType: POSITION_TYPE.SEAT,
              seatId: seat._id.toString(),
              seatNumber: seat.number,
              seatType: seat.type,
              status: seat.status,
              isAccessible: seat.isAccessible,
            }
          : {
              rowIndex,
              rowLabel,
              columnNumber,
              positionType: POSITION_TYPE.AISLE,
              isAccessible: false,
            },
      );
    }
  });

  return positions;
};

const layoutFingerprint = ({ rowLabels, columnCount, seats }) =>
  JSON.stringify({
    rowLabels,
    columnCount,
    seats: seats
      .map(({ row, column, type, status, isAccessible }) => [
        row,
        column,
        type,
        status ?? SEAT_STATUS.ENABLED,
        Boolean(isAccessible),
      ])
      .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1)),
  });

// R-20: an unchanged save must not create a new layout version.
export const isSameLayout = (current, next) => layoutFingerprint(current) === layoutFingerprint(next);
