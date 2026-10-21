import assert from "node:assert/strict";
import { test } from "node:test";
import { SHIFT_STATUS, SHIFT_STORED_STATUS } from "../src/modules/staff-shift/staff-shift.constants.js";
import {
  canApprove,
  canCancel,
  deriveStatus,
  localDateOf,
  localDateRangeToUtc,
} from "../src/modules/staff-shift/staff-shift.policy.js";

const at = (time) => new Date(`2026-10-19T${time}:00.000Z`);
const window = { startTime: at("02:00"), endTime: at("10:00") };
const shift = (status = SHIFT_STORED_STATUS.SCHEDULED) => ({ ...window, status });

test("a scheduled shift follows its planned window: scheduled, in progress, completed", () => {
  assert.equal(deriveStatus(shift(), at("01:59")), SHIFT_STATUS.SCHEDULED);
  assert.equal(deriveStatus(shift(), at("02:00")), SHIFT_STATUS.IN_PROGRESS, "the start instant is in progress");
  assert.equal(deriveStatus(shift(), at("09:59")), SHIFT_STATUS.IN_PROGRESS);
  assert.equal(deriveStatus(shift(), at("10:00")), SHIFT_STATUS.COMPLETED, "the end instant is completed");
  assert.equal(deriveStatus(shift(), at("23:00")), SHIFT_STATUS.COMPLETED);
});

test("stored APPROVED and CANCELLED win over the clock", () => {
  for (const time of ["01:00", "05:00", "12:00"]) {
    assert.equal(deriveStatus(shift(SHIFT_STORED_STATUS.APPROVED), at(time)), SHIFT_STATUS.APPROVED);
    assert.equal(deriveStatus(shift(SHIFT_STORED_STATUS.CANCELLED), at(time)), SHIFT_STATUS.CANCELLED);
  }
});

test("documents written before UC38 (other or missing status text) are read as scheduled", () => {
  assert.equal(deriveStatus(shift("PLANNED"), at("01:00")), SHIFT_STATUS.SCHEDULED);
  assert.equal(deriveStatus(shift(undefined), at("05:00")), SHIFT_STATUS.IN_PROGRESS);
  assert.equal(deriveStatus(shift(null), at("11:00")), SHIFT_STATUS.COMPLETED);
});

test("only a shift that has not started can be cancelled", () => {
  assert.equal(canCancel(SHIFT_STATUS.SCHEDULED), true);
  for (const status of [SHIFT_STATUS.IN_PROGRESS, SHIFT_STATUS.COMPLETED, SHIFT_STATUS.APPROVED, SHIFT_STATUS.CANCELLED]) {
    assert.equal(canCancel(status), false, status);
  }
});

test("only a completed shift can be approved", () => {
  assert.equal(canApprove(SHIFT_STATUS.COMPLETED), true);
  for (const status of [SHIFT_STATUS.SCHEDULED, SHIFT_STATUS.IN_PROGRESS, SHIFT_STATUS.APPROVED, SHIFT_STATUS.CANCELLED]) {
    assert.equal(canApprove(status), false, status);
  }
});

test("local dates use Asia/Ho_Chi_Minh (UTC+7) and ranges are half-open", () => {
  assert.equal(localDateOf(new Date("2026-10-19T16:59:59.000Z")), "2026-10-19");
  assert.equal(localDateOf(new Date("2026-10-19T17:00:00.000Z")), "2026-10-20");

  const { from, to } = localDateRangeToUtc("2026-10-20", "2026-10-21");
  assert.equal(from.toISOString(), "2026-10-19T17:00:00.000Z");
  assert.equal(to.toISOString(), "2026-10-21T17:00:00.000Z");
});
