import assert from "node:assert/strict";
import { test } from "node:test";
import { localDateOf, localDateRangeToUtc } from "../src/utils/local-date.js";

test("the local date flips at midnight in Ho Chi Minh (UTC+7), not at UTC midnight", () => {
  assert.equal(localDateOf(new Date("2026-10-19T16:59:59.000Z")), "2026-10-19");
  assert.equal(localDateOf(new Date("2026-10-19T17:00:00.000Z")), "2026-10-20");
});

test("a local date range is a half-open UTC range that covers whole local days", () => {
  const { from, to } = localDateRangeToUtc("2026-10-20", "2026-10-21");

  assert.equal(from.toISOString(), "2026-10-19T17:00:00.000Z");
  assert.equal(to.toISOString(), "2026-10-21T17:00:00.000Z");
});

test("a single local day spans exactly 24 hours", () => {
  const { from, to } = localDateRangeToUtc("2026-10-20", "2026-10-20");

  assert.equal(to.getTime() - from.getTime(), 24 * 60 * 60 * 1000);
});
