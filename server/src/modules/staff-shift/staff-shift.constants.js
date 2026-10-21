// CMS_UC38 minimal shift scope: the shift itself (lifecycle, work position, approver). No attendance:
// clock-in/clock-out, breaks and terminal punches are NOT recorded or derived here.
// Everything marked PROPOSED fills a gap the use case leaves open and needs team review; see
// docs/REQUIREMENTS_STATUS.md.

// PROPOSED: what is persisted in `staff_shifts.status`. Documents written before UC38 may hold other
// text; anything that is not APPROVED or CANCELLED is read as SCHEDULED.
export const SHIFT_STORED_STATUS = Object.freeze({
  SCHEDULED: "SCHEDULED",
  APPROVED: "APPROVED",
  CANCELLED: "CANCELLED",
});

// PROPOSED: what the API shows. IN_PROGRESS and COMPLETED are derived from the planned time window
// and the clock, never stored, so no job is needed to move a shift between them. They say nothing
// about whether the employee actually turned up.
export const SHIFT_STATUS = Object.freeze({
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  APPROVED: "APPROVED",
  CANCELLED: "CANCELLED",
});

export const SHIFT_STATUSES = Object.values(SHIFT_STATUS);

// Work position: a free-text name (UC38 says its examples such as "Box Office Station 2" are not a
// fixed list), 1-100 characters.
export const SHIFT_STATION_MAX_LENGTH = 100;
export const SHIFT_NOTE_MAX_LENGTH = 500;
// PROPOSED: a shift is at most this long.
export const SHIFT_MAX_HOURS = 12;

export const SHIFT_HISTORY_TYPE = Object.freeze({
  CREATED: "CREATED",
  CANCELLED: "CANCELLED",
  APPROVED: "APPROVED",
});

// The employee of a shift is an ACTIVE account holding this role (the role field decides who is
// staff; no separate employee profile is used).
export const EMPLOYEE_ROLE = "STAFF";

// Asia/Ho_Chi_Minh has no DST. A shift belongs to the local date of its `startTime`, so an overnight
// shift is listed on the day it starts.
export const TIME_ZONE = "Asia/Ho_Chi_Minh";
export const TIME_ZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

export const SHIFT_LIST_LIMIT_DEFAULT = 10;
export const SHIFT_LIST_LIMIT_MAX = 50;
// A date range keeps the in-service filtering (status is derived) bounded.
export const SHIFT_MAX_RANGE_DAYS = 31;
export const DASHBOARD_UPCOMING_LIMIT = 5;
export const EMPLOYEE_LOOKUP_LIMIT = 20;
export const STATION_LOOKUP_LIMIT = 50;

// Existing permissions from the base seed (docs/ref/seedDataRegister.js): reads need shift.view,
// changes need shift.manage. UC38's actor is the Manager.
export const STAFF_SHIFT_PERMISSION = Object.freeze({
  VIEW: "shift.view",
  MANAGE: "shift.manage",
});

export const STAFF_SHIFT_ERROR = Object.freeze({
  INVALID_QUERY: "INVALID_QUERY",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_SHIFT_ID: "INVALID_SHIFT_ID",
  BRANCH_NOT_ASSIGNED: "BRANCH_NOT_ASSIGNED",
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  BRANCH_INACTIVE: "BRANCH_INACTIVE",
  EMPLOYEE_NOT_FOUND: "EMPLOYEE_NOT_FOUND",
  SHIFT_NOT_FOUND: "SHIFT_NOT_FOUND",
  SHIFT_IN_THE_PAST: "SHIFT_IN_THE_PAST",
  SHIFT_TOO_LONG: "SHIFT_TOO_LONG",
  SHIFT_OVERLAP: "SHIFT_OVERLAP",
  SHIFT_NOT_CANCELLABLE: "SHIFT_NOT_CANCELLABLE",
  SHIFT_ALREADY_CANCELLED: "SHIFT_ALREADY_CANCELLED",
  SHIFT_NOT_APPROVABLE: "SHIFT_NOT_APPROVABLE",
  SHIFT_ALREADY_APPROVED: "SHIFT_ALREADY_APPROVED",
});
