import { z } from "zod";
import {
  SHIFT_LIST_LIMIT_DEFAULT,
  SHIFT_LIST_LIMIT_MAX,
  SHIFT_MAX_RANGE_DAYS,
  SHIFT_NOTE_MAX_LENGTH,
  SHIFT_STATION_MAX_LENGTH,
  SHIFT_STATUSES,
} from "./staff-shift.constants.js";

const blankToUndefined = (value) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const DAY_MS = 24 * 60 * 60 * 1000;

const objectId = (label) =>
  z.string({ error: `${label} is required` }).regex(/^[a-f\d]{24}$/i, `${label} must be a valid id`);

const isRealDate = (value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

// Local calendar date (Asia/Ho_Chi_Minh), e.g. 2026-10-20.
const dateField = (label) =>
  z.preprocess(
    blankToUndefined,
    z
      .string({ error: `${label} must be a date` })
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must use the YYYY-MM-DD format`)
      .refine(isRealDate, `${label} is not a valid date`)
      .optional(),
  );

const pageField = z.coerce.number().int().min(1).max(10000).default(1);
const limitField = z.coerce.number().int().min(1).max(SHIFT_LIST_LIMIT_MAX).default(SHIFT_LIST_LIMIT_DEFAULT);

// The branch is never a request field: it comes from the Manager's employee profile.
export const noQuerySchema = z.strictObject({});

// The dashboard follows the date the Manager is looking at (default: today).
export const dashboardQuerySchema = z.strictObject({ date: dateField("Date") });

export const listShiftsQuerySchema = z
  .strictObject({
    q: z.preprocess(blankToUndefined, z.string().trim().max(100, "Search text is too long").optional()),
    station: z.preprocess(
      blankToUndefined,
      z.string().trim().max(SHIFT_STATION_MAX_LENGTH, "Position is too long").optional(),
    ),
    date: dateField("Date"),
    dateFrom: dateField("Start date"),
    dateTo: dateField("End date"),
    status: z.preprocess(
      blankToUndefined,
      z
        .enum(SHIFT_STATUSES, {
          error: "Status must be SCHEDULED, IN_PROGRESS, COMPLETED, APPROVED or CANCELLED",
        })
        .optional(),
    ),
    // Every shift awaiting approval across all dates, oldest first.
    pending: z.preprocess(
      blankToUndefined,
      z.enum(["true"], { error: "Pending must be true" }).transform(() => true).optional(),
    ),
    page: pageField,
    limit: limitField,
  })
  .superRefine((query, context) => {
    if (query.pending) {
      for (const field of ["date", "dateFrom", "dateTo", "status"]) {
        if (query[field]) {
          context.addIssue({ code: "custom", path: [field], message: `Pending cannot be combined with ${field}` });
        }
      }
      return;
    }

    if (query.date && (query.dateFrom || query.dateTo)) {
      context.addIssue({ code: "custom", path: ["date"], message: "Use either date or dateFrom/dateTo" });
      return;
    }

    if (query.dateTo && !query.dateFrom) {
      context.addIssue({ code: "custom", path: ["dateFrom"], message: "Start date is required with an end date" });
      return;
    }

    if (query.dateFrom && query.dateTo) {
      const days = (Date.parse(query.dateTo) - Date.parse(query.dateFrom)) / DAY_MS;

      if (days < 0) {
        context.addIssue({ code: "custom", path: ["dateTo"], message: "End date must not be before start date" });
      } else if (days + 1 > SHIFT_MAX_RANGE_DAYS) {
        context.addIssue({
          code: "custom",
          path: ["dateTo"],
          message: `The date range can cover at most ${SHIFT_MAX_RANGE_DAYS} days`,
        });
      }
    }
  });

export const listEmployeesQuerySchema = z.strictObject({
  q: z.preprocess(blankToUndefined, z.string().trim().max(100, "Search text is too long").optional()),
});

export const shiftIdParamsSchema = z.object({
  shiftId: objectId("Shift"),
});

const isoDateTime = (label) =>
  z.iso.datetime({ offset: true, error: `${label} must be a valid date and time` });

// Whether the shift lies in the future and how long it lasts depend on the clock and on policy
// constants, so the service checks those and reports stable error codes.
export const createShiftSchema = z
  .strictObject({
    employeeAccountId: objectId("Employee"),
    station: z
      .string({ error: "Position is required" })
      .trim()
      .min(1, "Position is required")
      .max(SHIFT_STATION_MAX_LENGTH, `Position must not exceed ${SHIFT_STATION_MAX_LENGTH} characters`),
    startTime: isoDateTime("Start time"),
    endTime: isoDateTime("End time"),
  })
  .refine(({ startTime, endTime }) => Date.parse(endTime) > Date.parse(startTime), {
    path: ["endTime"],
    message: "End time must be after start time",
  });

export const approveShiftSchema = z.strictObject({
  note: z.preprocess(
    blankToUndefined,
    z.string().trim().max(SHIFT_NOTE_MAX_LENGTH, "Note is too long").optional(),
  ),
});
