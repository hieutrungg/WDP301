import {
  findAccountIdsByText,
  findAccountSummaries,
  findActiveAccountsByRole,
  findActiveAccountWithRole,
} from "./staff-shift.accounts.js";
import { BRANCH_STATUS } from "../branch/branch.constants.js";
import { getBranchSummariesByIds } from "../branch/branch.service.js";
import { AppError } from "../../utils/AppError.js";
import {
  DASHBOARD_UPCOMING_LIMIT,
  EMPLOYEE_LOOKUP_LIMIT,
  EMPLOYEE_ROLE,
  SHIFT_HISTORY_TYPE,
  SHIFT_MAX_HOURS,
  SHIFT_STATUS,
  SHIFT_STORED_STATUS,
  STAFF_SHIFT_ERROR,
  STATION_LOOKUP_LIMIT,
} from "./staff-shift.constants.js";
import { canApprove, canCancel, deriveStatus, localDateOf, localDateRangeToUtc } from "./staff-shift.policy.js";
import {
  approveShiftIfCompleted,
  cancelShiftIfOpen,
  createShift as insertShift,
  findDistinctStations,
  findOverlappingShift,
  findShiftById,
  findShiftsForDashboard,
  findShiftsInRange,
} from "./staff-shift.repository.js";

const HOUR_MS = 60 * 60 * 1000;

const buildMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

// Shifts are branch-scoped: a Manager only sees and changes the branch they work at. The branch
// comes from the authenticated account's employee profile, never from the request, so it cannot
// be spoofed (the same rule Inventory uses). This is not general branch-scoped authorization.
const requireBranchId = (account) => {
  const branchId = account?.employeeProfile?.branchId;

  if (!branchId) {
    throw new AppError(
      403,
      "Your account is not assigned to a branch",
      [],
      STAFF_SHIFT_ERROR.BRANCH_NOT_ASSIGNED,
    );
  }

  return branchId.toString();
};

// The branch must exist; only assigning a new shift also needs it to be ACTIVE.
const requireBranch = async (branchId, { mustBeActive = false } = {}) => {
  const branch = (await getBranchSummariesByIds([branchId])).get(branchId.toString());

  if (!branch) {
    throw new AppError(404, "Branch not found", [], STAFF_SHIFT_ERROR.BRANCH_NOT_FOUND);
  }

  if (mustBeActive && branch.status !== BRANCH_STATUS.ACTIVE) {
    throw new AppError(409, "This branch is not active", [], STAFF_SHIFT_ERROR.BRANCH_INACTIVE);
  }

  return branch;
};

// A shift of another branch is reported as not found so its existence is not revealed.
const loadBranchShift = async (branchId, shiftId) => {
  const shift = await findShiftById(shiftId);

  if (!shift || shift.branchId.toString() !== branchId) {
    throw new AppError(404, "Shift not found", [], STAFF_SHIFT_ERROR.SHIFT_NOT_FOUND);
  }

  return shift;
};

const accountIdsOf = (shifts) =>
  shifts.flatMap(({ employeeAccountId, createdBy, cancelledBy, approvedBy }) =>
    [employeeAccountId, createdBy, cancelledBy, approvedBy].filter(Boolean),
  );

const actor = (summaries, accountId) =>
  accountId ? (summaries.get(accountId.toString()) ?? { id: accountId.toString() }) : null;

const serializeShift = (shift, summaries, now) => {
  const status = deriveStatus(shift, now);

  return {
    id: shift._id.toString(),
    branchId: shift.branchId.toString(),
    employee: actor(summaries, shift.employeeAccountId),
    station: shift.station ?? null,
    startTime: shift.startTime,
    endTime: shift.endTime,
    status,
    canCancel: canCancel(status),
    canApprove: canApprove(status),
    createdAt: shift.createdAt ?? null,
    createdBy: actor(summaries, shift.createdBy),
    approval: shift.approvedAt
      ? { approvedAt: shift.approvedAt, approvedBy: actor(summaries, shift.approvedBy), note: shift.approvalNote ?? null }
      : null,
    cancellation: shift.cancelledAt
      ? { cancelledAt: shift.cancelledAt, cancelledBy: actor(summaries, shift.cancelledBy) }
      : null,
  };
};

const serializeShifts = async (shifts, now) => {
  const summaries = await findAccountSummaries(accountIdsOf(shifts));
  return shifts.map((shift) => serializeShift(shift, summaries, now));
};

// Chronological record of what was done to the shift (UC38 step 4 event grid, without attendance).
const buildHistory = (row) =>
  [
    row.createdAt && { type: SHIFT_HISTORY_TYPE.CREATED, at: row.createdAt, by: row.createdBy },
    row.cancellation && {
      type: SHIFT_HISTORY_TYPE.CANCELLED,
      at: row.cancellation.cancelledAt,
      by: row.cancellation.cancelledBy,
    },
    row.approval && {
      type: SHIFT_HISTORY_TYPE.APPROVED,
      at: row.approval.approvedAt,
      by: row.approval.approvedBy,
      note: row.approval.note,
    },
  ]
    .filter(Boolean)
    .sort((left, right) => new Date(left.at) - new Date(right.at));

// UC38 steps 3-4. The status is derived, so the date range is read from the database and the
// status filter runs here; the range cap keeps that set small.
export const listShifts = async (
  account,
  { q, date, dateFrom, dateTo, status, station, page, limit },
  now = new Date(),
) => {
  const branchId = requireBranchId(account);
  await requireBranch(branchId);
  const first = date ?? dateFrom ?? localDateOf(now);
  const { from, to } = localDateRangeToUtc(first, date ?? dateTo ?? first);

  let employeeIds;
  if (q) {
    employeeIds = await findAccountIdsByText(q);
    if (employeeIds.length === 0) return { items: [], meta: buildMeta(page, limit, 0) };
  }

  const shifts = await findShiftsInRange(branchId, { from, to, employeeIds, station });
  const rows = (await serializeShifts(shifts, now)).filter((row) => !status || row.status === status);

  const offset = (page - 1) * limit;
  return { items: rows.slice(offset, offset + limit), meta: buildMeta(page, limit, rows.length) };
};

// UC38 steps 1-2: live statistics and the shifts being worked right now.
export const getDashboard = async (account, now = new Date()) => {
  const branchId = requireBranchId(account);
  const branch = await requireBranch(branchId);
  const today = localDateOf(now);
  const { from, to } = localDateRangeToUtc(today, today);

  const rows = await serializeShifts(await findShiftsForDashboard(branchId, { from, to, activeAfter: now }), now);
  const countOf = (status) => rows.filter((row) => row.status === status).length;
  const inProgress = rows.filter((row) => row.status === SHIFT_STATUS.IN_PROGRESS);

  const stationCounts = new Map();
  for (const row of inProgress) {
    const station = row.station ?? "Unassigned";
    stationCounts.set(station, (stationCounts.get(station) ?? 0) + 1);
  }

  return {
    branch,
    date: today,
    generatedAt: now,
    totals: {
      shifts: rows.length,
      scheduled: countOf(SHIFT_STATUS.SCHEDULED),
      inProgress: inProgress.length,
      completed: countOf(SHIFT_STATUS.COMPLETED),
      approved: countOf(SHIFT_STATUS.APPROVED),
      cancelled: countOf(SHIFT_STATUS.CANCELLED),
    },
    stations: [...stationCounts].map(([station, count]) => ({ station, inProgress: count })),
    inProgress,
    upcoming: rows.filter((row) => row.status === SHIFT_STATUS.SCHEDULED).slice(0, DASHBOARD_UPCOMING_LIMIT),
  };
};

export const getShift = async (account, shiftId, now = new Date()) => {
  const shift = await loadBranchShift(requireBranchId(account), shiftId);
  const [row] = await serializeShifts([shift], now);
  return { ...row, history: buildHistory(row) };
};

export const listStations = async (account) => {
  const branchId = requireBranchId(account);
  await requireBranch(branchId);
  const stations = (await findDistinctStations(branchId)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return stations.slice(0, STATION_LOOKUP_LIMIT);
};

// Picker for the assign form: ACTIVE accounts with the STAFF role who work at the Manager's branch.
export const listEmployees = (account, { q }) =>
  findActiveAccountsByRole(EMPLOYEE_ROLE, { branchId: requireBranchId(account), q, limit: EMPLOYEE_LOOKUP_LIMIT });

// Manager assigns a shift in their own branch. Not attendance: it only plans who works where and when.
export const createShift = async (account, { employeeAccountId, station, startTime, endTime }, now = new Date()) => {
  const branchId = requireBranchId(account);
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start <= now) {
    throw new AppError(409, "A shift must start in the future", [], STAFF_SHIFT_ERROR.SHIFT_IN_THE_PAST);
  }

  if (end - start > SHIFT_MAX_HOURS * HOUR_MS) {
    throw new AppError(
      409,
      `A shift can last at most ${SHIFT_MAX_HOURS} hours`,
      [],
      STAFF_SHIFT_ERROR.SHIFT_TOO_LONG,
    );
  }

  await requireBranch(branchId, { mustBeActive: true });

  if (!(await findActiveAccountWithRole(employeeAccountId, EMPLOYEE_ROLE, branchId))) {
    throw new AppError(404, "Employee not found", [], STAFF_SHIFT_ERROR.EMPLOYEE_NOT_FOUND);
  }

  // Not atomic: Mongo cannot enforce interval overlap with an index, so two simultaneous
  // assignments for the same employee could both pass. Acceptable for a Manager-only action.
  if (await findOverlappingShift(employeeAccountId, start, end)) {
    throw new AppError(409, "The employee already has a shift in this period", [], STAFF_SHIFT_ERROR.SHIFT_OVERLAP);
  }

  const shift = await insertShift({
    branchId,
    employeeAccountId,
    station,
    startTime: start,
    endTime: end,
    status: SHIFT_STORED_STATUS.SCHEDULED,
    createdBy: account.id,
  });

  return (await serializeShifts([shift], now))[0];
};

const refuseCancel = (shift, now) => {
  const status = deriveStatus(shift, now);

  if (status === SHIFT_STATUS.CANCELLED) {
    throw new AppError(409, "This shift is already cancelled", [], STAFF_SHIFT_ERROR.SHIFT_ALREADY_CANCELLED);
  }

  throw new AppError(
    409,
    "Only a shift that has not started can be cancelled",
    [],
    STAFF_SHIFT_ERROR.SHIFT_NOT_CANCELLABLE,
  );
};

// A shift is cancelled, never deleted, so its history is kept.
export const cancelShift = async (account, shiftId, now = new Date()) => {
  const branchId = requireBranchId(account);
  const shift = await loadBranchShift(branchId, shiftId);
  if (!canCancel(deriveStatus(shift, now))) refuseCancel(shift, now);

  const updated = await cancelShiftIfOpen(shift._id, { cancelledBy: account.id, cancelledAt: now });
  // Lost a race with another change: report the shift's current state.
  if (!updated) refuseCancel(await loadBranchShift(branchId, shiftId), now);

  return (await serializeShifts([updated], now))[0];
};

const refuseApprove = (shift, now) => {
  const status = deriveStatus(shift, now);

  if (status === SHIFT_STATUS.APPROVED) {
    throw new AppError(409, "This shift has already been approved", [], STAFF_SHIFT_ERROR.SHIFT_ALREADY_APPROVED);
  }

  throw new AppError(
    409,
    "Only a shift that has finished can be approved",
    [],
    STAFF_SHIFT_ERROR.SHIFT_NOT_APPROVABLE,
  );
};

// UC38 step 5 and postcondition: the Manager approves a finished shift once. The approver and time
// are stored on the shift.
export const approveShift = async (account, shiftId, { note }, now = new Date()) => {
  const branchId = requireBranchId(account);
  const shift = await loadBranchShift(branchId, shiftId);
  if (!canApprove(deriveStatus(shift, now))) refuseApprove(shift, now);

  const updated = await approveShiftIfCompleted(shift._id, {
    approvedBy: account.id,
    approvedAt: now,
    approvalNote: note,
  });
  if (!updated) refuseApprove(await loadBranchShift(branchId, shiftId), now);

  return (await serializeShifts([updated], now))[0];
};
