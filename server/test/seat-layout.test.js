import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import {
  buildSeats,
  isSameLayout,
  resolveLayoutGrid,
  summarizeSeats,
  toPositions,
  validateLayoutMatrix,
} from "../src/modules/room/seat-layout.js";

// rows: array of strings, one char per cell: S=standard V=vip D=double luxury .=aisle
// a=accessible standard x=disabled standard
const CELL = {
  S: { positionType: "SEAT", seatType: "STANDARD" },
  V: { positionType: "SEAT", seatType: "VIP" },
  D: { positionType: "SEAT", seatType: "DOUBLE_LUXURY" },
  a: { positionType: "SEAT", seatType: "STANDARD", isAccessible: true },
  x: { positionType: "SEAT", seatType: "STANDARD", status: "DISABLED" },
  ".": { positionType: "AISLE" },
};

const matrix = (rowLabels, rows) => ({
  rowLabels,
  columnCount: rows[0].length,
  positions: rows.flatMap((cells, rowIndex) =>
    [...cells].map((cell, index) => ({
      rowIndex,
      columnNumber: index + 1,
      isAccessible: false,
      ...CELL[cell],
    })),
  ),
});

test("validateLayoutMatrix accepts a complete, consistent matrix", () => {
  assert.deepEqual(validateLayoutMatrix(matrix(["A", "B"], ["SS.VV", "DD.aa"])), []);
});

test("validateLayoutMatrix rejects missing, duplicate and out-of-range coordinates", () => {
  const layout = matrix(["A", "B"], ["SSS", "SSS"]);

  const missing = { ...layout, positions: layout.positions.slice(1) };
  assert.match(validateLayoutMatrix(missing)[0].message, /1 missing/);

  const duplicate = { ...layout, positions: [...layout.positions.slice(1), layout.positions[1]] };
  assert.match(validateLayoutMatrix(duplicate)[0].message, /more than once/);

  const outOfRange = {
    ...layout,
    positions: [...layout.positions.slice(1), { ...layout.positions[0], columnNumber: 4 }],
  };
  assert.deepEqual(validateLayoutMatrix(outOfRange)[0].path, ["positions", 5, "columnNumber"]);
});

test("validateLayoutMatrix enforces one primary state per cell", () => {
  const layout = matrix(["A"], ["S.S"]);
  layout.positions[1] = { ...layout.positions[1], seatType: "VIP", isAccessible: true, status: "DISABLED" };
  layout.positions[0] = { ...layout.positions[0], seatType: undefined };

  const fields = validateLayoutMatrix(layout).map(({ path }) => path.at(-1));
  assert.deepEqual(fields.sort(), ["isAccessible", "seatType", "seatType", "status"]);
});

test("validateLayoutMatrix rejects duplicate row labels and seatless layouts", () => {
  const messages = validateLayoutMatrix(matrix(["A", "A"], ["..", ".."])).map(({ message }) => message);
  assert.ok(messages.some((message) => /used more than once/.test(message)));
  assert.ok(messages.some((message) => /at least one seat/.test(message)));
});

test("buildSeats numbers seats left to right per row, skipping aisles", () => {
  const seats = buildSeats(matrix(["A", "B"], ["SS.VV", ".D.D."]));

  assert.deepEqual(
    seats.map(({ row, number, column, type }) => `${row}${number}@${column}:${type}`),
    ["A1@1:STANDARD", "A2@2:STANDARD", "A3@4:VIP", "A4@5:VIP", "B1@2:DOUBLE_LUXURY", "B2@4:DOUBLE_LUXURY"],
  );
  assert.ok(seats.every(({ status, isAccessible }) => status === "ENABLED" && isAccessible === false));
  assert.ok(seats.every((seat) => !("isBooked" in seat)));
});

test("buildSeats keeps seat ids for the same row label and number", () => {
  const previous = buildSeats(matrix(["A"], ["SSS"]));
  const next = buildSeats(matrix(["A"], ["VV.V"]), previous);

  assert.equal(next[0]._id.toString(), previous[0]._id.toString());
  assert.equal(next[1]._id.toString(), previous[1]._id.toString());
  assert.equal(next[2]._id.toString(), previous[2]._id.toString());
  assert.equal(next[2].column, 4);
});

test("summarizeSeats derives capacity from enabled seats only", () => {
  const layout = matrix(["A", "B"], ["SS.VV", "Da.xS"]);
  const summary = summarizeSeats(buildSeats(layout), 2, 5);

  assert.deepEqual(summary, {
    rowCount: 2,
    columnCount: 5,
    totalPositions: 10,
    seatCount: 8,
    aisleCount: 2,
    standardCount: 4,
    vipCount: 2,
    doubleLuxuryCount: 1,
    accessibleCount: 1,
    disabledCount: 1,
    operationalSeatCapacity: 7,
  });
  assert.equal(
    summary.standardCount + summary.vipCount + summary.doubleLuxuryCount,
    summary.operationalSeatCapacity,
  );
});

test("an accessible marker never inflates capacity", () => {
  const plain = summarizeSeats(buildSeats(matrix(["A"], ["SSS"])), 1, 3);
  const accessible = summarizeSeats(buildSeats(matrix(["A"], ["aSa"])), 1, 3);

  assert.equal(accessible.operationalSeatCapacity, plain.operationalSeatCapacity);
  assert.equal(accessible.accessibleCount, 2);
});

test("resolveLayoutGrid derives the grid of a room seeded before UC41", () => {
  const seats = ["A", "B"].flatMap((row) =>
    [1, 2, 3].map((number) => ({ _id: new mongoose.Types.ObjectId(), row, number, type: "STANDARD", status: "ENABLED" })),
  );
  const grid = resolveLayoutGrid({ seats });

  assert.deepEqual(grid.rowLabels, ["A", "B"]);
  assert.equal(grid.columnCount, 3);
  assert.ok(grid.seats.every(({ column, number }) => column === number));

  const positions = toPositions(grid);
  assert.equal(positions.length, 6);
  assert.deepEqual(
    positions.map(({ rowIndex, columnNumber }) => [rowIndex, columnNumber]),
    [[0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [1, 3]],
  );
});

test("toPositions fills cells without a seat as aisles", () => {
  const layout = matrix(["A"], ["S.V"]);
  const positions = toPositions({ rowLabels: ["A"], columnCount: 3, seats: buildSeats(layout) });

  assert.deepEqual(
    positions.map(({ positionType, seatNumber }) => `${positionType}:${seatNumber ?? "-"}`),
    ["SEAT:1", "AISLE:-", "SEAT:2"],
  );
});

test("isSameLayout ignores ids and ordering but detects structural changes", () => {
  const layout = matrix(["A", "B"], ["SS.V", "aaxS"]);
  const current = { rowLabels: layout.rowLabels, columnCount: 4, seats: buildSeats(layout) };
  const rebuilt = { rowLabels: layout.rowLabels, columnCount: 4, seats: buildSeats(layout).reverse() };

  assert.ok(isSameLayout(current, rebuilt));

  const relabelled = { ...rebuilt, rowLabels: ["A", "C"] };
  assert.ok(!isSameLayout(current, relabelled));

  const changed = matrix(["A", "B"], ["SS.V", "aSxS"]);
  assert.ok(!isSameLayout(current, { ...current, seats: buildSeats(changed) }));
});
