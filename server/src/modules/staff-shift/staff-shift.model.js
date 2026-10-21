import mongoose from "mongoose";
import { SHIFT_NOTE_MAX_LENGTH, SHIFT_STATION_MAX_LENGTH } from "./staff-shift.constants.js";
import { applyIndexes } from "./staff-shift.indexes.js";

const accountRef = { type: mongoose.Schema.Types.ObjectId, ref: "Account" };

// Planned shift. The collection predates UC38 with `employeeAccountId, branchId, startTime,
// endTime, station, status`; UC38 adds the audit fields below (all optional, so older documents
// stay valid). `station` is the work position.
const staffShiftSchema = new mongoose.Schema(
  {
    employeeAccountId: { ...accountRef, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    station: { type: String, trim: true, maxlength: SHIFT_STATION_MAX_LENGTH },
    status: { type: String, trim: true },
    createdBy: accountRef,
    cancelledBy: accountRef,
    cancelledAt: Date,
    approvedBy: accountRef,
    approvedAt: Date,
    approvalNote: { type: String, trim: true, maxlength: SHIFT_NOTE_MAX_LENGTH },
  },
  { collection: "staff_shifts", timestamps: true, versionKey: false },
);

applyIndexes(staffShiftSchema, "staff_shifts");

export const StaffShift = mongoose.model("StaffShift", staffShiftSchema);
