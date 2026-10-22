import { z } from "zod";
import {
  POSITION_TYPES,
  ROOM_PAGE_LIMIT_DEFAULT,
  ROOM_PAGE_LIMIT_MAX,
  ROOM_SORT_FIELDS,
  ROOM_STATUSES,
  ROOM_TYPE_PATTERN,
  SEAT_LAYOUT_LIMITS,
  SEAT_STATUSES,
  SEAT_TYPES,
} from "./room.constants.js";
import { validateLayoutMatrix } from "./seat-layout.js";

const { MAX_ROWS, MAX_COLUMNS, ROW_LABEL_PATTERN } = SEAT_LAYOUT_LIMITS;

const objectIdField = (label) =>
  z.string().regex(/^[a-f\d]{24}$/i, `${label} must be a valid ObjectId`);

export const roomIdParamsSchema = z.object({
  roomId: objectIdField("Room id"),
});

const collapseSpaces = (value) => value.replace(/\s+/g, " ");

const searchTextField = z
  .string()
  .trim()
  .max(100, "Search text is too long")
  .optional()
  .transform((value) => value || undefined);

const roomNameField = z
  .string({ error: "Room name is required" })
  .trim()
  .min(1, "Room name is required")
  .max(60, "Room name is too long")
  .transform(collapseSpaces);

// Room type is a free label (the schema doc only gives examples: 2D, 3D, IMAX), stored upper-case.
const roomTypeField = z
  .string({ error: "Room type is required" })
  .trim()
  .transform((value) => collapseSpaces(value).toUpperCase())
  .refine((value) => ROOM_TYPE_PATTERN.test(value), "Room type must be 1-30 letters, digits or spaces");

const statusField = z.enum(ROOM_STATUSES, { error: "Status must be ACTIVE, MAINTENANCE or INACTIVE" });

export const listRoomsQuerySchema = z.strictObject({
  branchId: objectIdField("Branch id").optional(),
  q: searchTextField,
  status: statusField.optional(),
  roomType: z
    .string()
    .trim()
    .max(30, "Room type is too long")
    .optional()
    .transform((value) => (value ? collapseSpaces(value).toUpperCase() : undefined)),
  sort: z.enum(ROOM_SORT_FIELDS).optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(ROOM_PAGE_LIMIT_MAX).default(ROOM_PAGE_LIMIT_DEFAULT),
});

export const roomSummaryQuerySchema = z.strictObject({
  branchId: objectIdField("Branch id").optional(),
});

export const createRoomSchema = z.object({
  branchId: objectIdField("Branch id"),
  roomName: roomNameField,
  roomType: roomTypeField,
  status: statusField.optional().default("ACTIVE"),
});

// The branch is fixed at creation and capacity comes from the seat map, so neither can be sent.
// Status changes go through PATCH /:roomId/status so the showtime guard always runs.
export const updateRoomSchema = z
  .strictObject({
    roomName: roomNameField.optional(),
    roomType: roomTypeField.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export const changeRoomStatusSchema = z.strictObject({
  status: statusField,
});

const rowLabelField = z
  .string({ error: "Row label must be text" })
  .trim()
  .toUpperCase()
  .regex(ROW_LABEL_PATTERN, "Row label must be 1-3 letters or digits");

// Client-calculated values such as capacity, seat numbers or IDs are not part of the contract;
// unknown keys are stripped and everything derived is recalculated on the server (R-15).
const positionSchema = z.object({
  rowIndex: z
    .number({ error: "Row index must be a number" })
    .int("Row index must be a whole number")
    .min(0, "Row index cannot be negative"),
  columnNumber: z
    .number({ error: "Column number must be a number" })
    .int("Column number must be a whole number")
    .min(1, "Column number starts at 1"),
  positionType: z.enum(POSITION_TYPES, { error: "Position type must be SEAT or AISLE" }),
  seatType: z.enum(SEAT_TYPES, { error: "Seat type must be STANDARD, VIP or DOUBLE_LUXURY" }).optional(),
  status: z.enum(SEAT_STATUSES, { error: "Seat status must be ENABLED or DISABLED" }).optional(),
  isAccessible: z.boolean({ error: "isAccessible must be true or false" }).optional().default(false),
});

const layoutFields = {
  rowLabels: z
    .array(rowLabelField, { error: "Row labels are required" })
    .min(1, "A layout needs at least one row")
    .max(MAX_ROWS, `A layout can have at most ${MAX_ROWS} rows`),
  columnCount: z
    .number({ error: "Column count is required" })
    .int("Column count must be a whole number")
    .min(1, "A layout needs at least one column")
    .max(MAX_COLUMNS, `A layout can have at most ${MAX_COLUMNS} columns`),
  positions: z
    .array(positionSchema, { error: "Positions are required" })
    .min(1, "Positions are required")
    .max(MAX_ROWS * MAX_COLUMNS, "Too many positions"),
};

const withMatrixRules = (schema) =>
  schema.superRefine((layout, context) => {
    for (const issue of validateLayoutMatrix(layout)) {
      context.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
  });

export const createSeatLayoutSchema = withMatrixRules(z.object(layoutFields));

// R-17: the editor sends the version it loaded, so a concurrent save is detected, not overwritten.
export const updateSeatLayoutSchema = withMatrixRules(
  z.object({
    ...layoutFields,
    expectedLayoutVersion: z
      .number({ error: "expectedLayoutVersion is required" })
      .int()
      .min(0, "expectedLayoutVersion cannot be negative"),
  }),
);
