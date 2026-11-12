import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCounterOrderDraft,
  readCounterOrderDraft,
  writeCounterOrderDraft,
} from "../src/features/counter-pos/utils/counterOrderDraft.js";

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const draft = {
  accountId: "staff-1",
  movieId: "movie-1",
  showtimeId: "showtime-1",
  date: "2026-11-10",
  selectedIds: ["seat-a1"],
  selectionDeadline: Date.now() + 600000,
  foodItems: [{ itemType: "CONCESSION", itemId: "food-1", quantity: 2 }],
  hold: null,
  foodContext: null,
};

test("counter order drafts are scoped to the signed-in Staff account", () => {
  const target = storage();
  writeCounterOrderDraft(target, draft);
  assert.deepEqual(readCounterOrderDraft(target, "staff-1"), draft);
  assert.equal(readCounterOrderDraft(target, "staff-2"), null);
});

test("invalid or empty counter orders are not resumable", () => {
  const target = storage();
  writeCounterOrderDraft(target, { ...draft, selectedIds: [] });
  assert.equal(readCounterOrderDraft(target, "staff-1"), null);
});

test("counter order drafts require the original seat-selection deadline", () => {
  const target = storage();
  writeCounterOrderDraft(target, { ...draft, selectionDeadline: undefined });
  assert.equal(readCounterOrderDraft(target, "staff-1"), null);
});

test("clearing a counter order removes the resumable draft", () => {
  const target = storage();
  writeCounterOrderDraft(target, draft);
  clearCounterOrderDraft(target, "staff-1");
  assert.equal(readCounterOrderDraft(target, "staff-1"), null);
});
