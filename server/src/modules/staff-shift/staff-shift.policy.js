import { SHIFT_STATUS, SHIFT_STORED_STATUS, TIME_ZONE_OFFSET_MS } from "./staff-shift.constants.js";

// Pure rules for UC38 (PROPOSED, see staff-shift.constants.js). Nothing here touches the database
// or the clock: `now` is always passed in, so every case is unit-testable. No attendance is
// involved: status comes only from the stored status and the planned time window.

// Stored APPROVED/CANCELLED win. Anything else (including text written before UC38) is a
// scheduled shift whose state follows the clock.
export const deriveStatus = ({ status, startTime, endTime }, now) => {
  if (status === SHIFT_STORED_STATUS.CANCELLED) return SHIFT_STATUS.CANCELLED;
  if (status === SHIFT_STORED_STATUS.APPROVED) return SHIFT_STATUS.APPROVED;
  if (now < startTime) return SHIFT_STATUS.SCHEDULED;
  if (now < endTime) return SHIFT_STATUS.IN_PROGRESS;
  return SHIFT_STATUS.COMPLETED;
};

// A shift can be cancelled only before it starts.
export const canCancel = (displayStatus) => displayStatus === SHIFT_STATUS.SCHEDULED;

// A shift can be approved once its planned window has ended.
export const canApprove = (displayStatus) => displayStatus === SHIFT_STATUS.COMPLETED;

// --- Date handling (Asia/Ho_Chi_Minh, UTC+7, no DST) -------------------------------------------

export const localDateOf = (instant) => new Date(instant.getTime() + TIME_ZONE_OFFSET_MS).toISOString().slice(0, 10);

// Inclusive local dates -> half-open UTC range [from, to).
export const localDateRangeToUtc = (dateFrom, dateTo) => {
  const from = new Date(`${dateFrom}T00:00:00.000+07:00`);
  const to = new Date(new Date(`${dateTo}T00:00:00.000+07:00`).getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
};
