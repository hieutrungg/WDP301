import { SHIFT_STORED_STATUS } from "./staff-shift.constants.js";
import { StaffShift } from "./staff-shift.model.js";

// Shifts that are neither approved nor cancelled, including documents written before UC38.
const OPEN_STATUS = { $nin: [SHIFT_STORED_STATUS.APPROVED, SHIFT_STORED_STATUS.CANCELLED] };

export const findShiftsInRange = (branchId, { from, to, employeeIds, station }) =>
  StaffShift.find({
    branchId,
    startTime: { $gte: from, $lt: to },
    ...(employeeIds ? { employeeAccountId: { $in: employeeIds } } : {}),
    ...(station ? { station } : {}),
  })
    .sort({ startTime: -1, _id: 1 })
    .lean();

// Dashboard: shifts that start in the local day. When `activeAfter` is given (the viewed day is today)
// it also includes overnight shifts that began earlier and have not ended yet.
export const findShiftsForDashboard = (branchId, { from, to, activeAfter }) =>
  StaffShift.find({
    branchId,
    $or: [
      { startTime: { $gte: from, $lt: to } },
      ...(activeAfter ? [{ startTime: { $lt: from }, endTime: { $gt: activeAfter } }] : []),
    ],
  })
    .sort({ startTime: 1, _id: 1 })
    .lean();

// Finished shifts nobody approved yet, across ALL dates: stored status still open and the planned
// end has passed (the same rule as the derived COMPLETED status).
const awaitingApprovalFilter = (branchId, now, { employeeIds, station } = {}) => ({
  branchId,
  status: OPEN_STATUS,
  endTime: { $lte: now },
  ...(employeeIds ? { employeeAccountId: { $in: employeeIds } } : {}),
  ...(station ? { station } : {}),
});

export const countAwaitingApproval = (branchId, now, filters) =>
  StaffShift.countDocuments(awaitingApprovalFilter(branchId, now, filters));

// Oldest first, so the longest-waiting shift is reviewed first.
export const findAwaitingApproval = (branchId, now, { skip, limit, ...filters }) =>
  StaffShift.find(awaitingApprovalFilter(branchId, now, filters))
    .sort({ startTime: 1, _id: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

export const findShiftById = (shiftId) => StaffShift.findById(shiftId).lean();

export const findDistinctStations = (branchId) => StaffShift.distinct("station", { branchId });

// An existing, not cancelled shift of the same employee whose window intersects [start, end).
export const findOverlappingShift = (employeeAccountId, start, end) =>
  StaffShift.findOne({
    employeeAccountId,
    status: { $ne: SHIFT_STORED_STATUS.CANCELLED },
    startTime: { $lt: end },
    endTime: { $gt: start },
  }).lean();

export const createShift = async (shift) => (await StaffShift.create(shift)).toObject();

// Compare-and-set: only an open shift that has not started can be cancelled. Returns null when the
// shift changed in the meantime; the caller reloads it to report why.
export const cancelShiftIfOpen = (shiftId, { cancelledBy, cancelledAt }) =>
  StaffShift.findOneAndUpdate(
    { _id: shiftId, status: OPEN_STATUS, startTime: { $gt: cancelledAt } },
    { $set: { status: SHIFT_STORED_STATUS.CANCELLED, cancelledBy, cancelledAt } },
    { returnDocument: "after" },
  ).lean();

// Compare-and-set: only an open shift whose window has ended can be approved, exactly once.
export const approveShiftIfCompleted = (shiftId, { approvedBy, approvedAt, approvalNote }) =>
  StaffShift.findOneAndUpdate(
    { _id: shiftId, status: OPEN_STATUS, endTime: { $lte: approvedAt } },
    {
      $set: {
        status: SHIFT_STORED_STATUS.APPROVED,
        approvedBy,
        approvedAt,
        ...(approvalNote ? { approvalNote } : {}),
      },
    },
    { returnDocument: "after" },
  ).lean();
