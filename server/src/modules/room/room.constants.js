// UC41 seat classifications. The source names the third tier "Double Luxury"; one configured
// position is one operational seat (the source does not say it seats two people).
export const SEAT_TYPE = Object.freeze({
  STANDARD: "STANDARD",
  VIP: "VIP",
  DOUBLE_LUXURY: "DOUBLE_LUXURY",
});

export const SEAT_TYPES = Object.values(SEAT_TYPE);

// Physical/layout state only (PROJECT_CONVENTIONS §8). Booking availability belongs to
// Showtime + Seat and is never stored on the Room.
export const SEAT_STATUS = Object.freeze({
  ENABLED: "ENABLED",
  DISABLED: "DISABLED",
});

export const SEAT_STATUSES = Object.values(SEAT_STATUS);

// A matrix cell is either a seat or blank aisle space. Accessibility is a flag on a seat, not a
// third primary state, so it never adds capacity.
export const POSITION_TYPE = Object.freeze({
  SEAT: "SEAT",
  AISLE: "AISLE",
});

export const POSITION_TYPES = Object.values(POSITION_TYPE);

export const SEAT_LAYOUT_LIMITS = Object.freeze({
  MAX_ROWS: 30,
  MAX_COLUMNS: 40,
  ROW_LABEL_PATTERN: /^[A-Z0-9]{1,3}$/,
});

export const ROOM_PAGE_LIMIT_DEFAULT = 50;
export const ROOM_PAGE_LIMIT_MAX = 200;

export const ROOM_ERROR = Object.freeze({
  INVALID_QUERY: "INVALID_QUERY",
  INVALID_ROOM_ID: "INVALID_ROOM_ID",
  NOT_FOUND: "ROOM_NOT_FOUND",
  INVALID_SEAT_LAYOUT: "INVALID_SEAT_LAYOUT",
  SEAT_LAYOUT_NOT_FOUND: "SEAT_LAYOUT_NOT_FOUND",
  SEAT_LAYOUT_ALREADY_EXISTS: "SEAT_LAYOUT_ALREADY_EXISTS",
  SEAT_LAYOUT_IN_USE: "SEAT_LAYOUT_IN_USE",
  SEAT_LAYOUT_VERSION_CONFLICT: "SEAT_LAYOUT_VERSION_CONFLICT",
});

// ROOM-001 (PROPOSED): Room lifecycle. `AVAILABLE` is the pre-ROOM-001 spelling of ACTIVE that the
// schema doc and Showtime still accept; it is read as ACTIVE and never written. MAINTENANCE and
// INACTIVE are not schedulable: Showtime only accepts ACTIVE/AVAILABLE rooms, so adding them is
// additive for that consumer.
export const ROOM_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  INACTIVE: "INACTIVE",
});

export const ROOM_STATUSES = Object.values(ROOM_STATUS);
export const LEGACY_ROOM_ACTIVE_STATUS = "AVAILABLE";
export const ROOM_ACTIVE_STATUS_VALUES = [ROOM_STATUS.ACTIVE, LEGACY_ROOM_ACTIVE_STATUS];

// Room names are unique per branch after normalization (trimmed, collapsed spaces, case-insensitive).
export const ROOM_NAME_COLLATION = Object.freeze({ locale: "en", strength: 2 });

// List ordering only: "Room 2" sorts before "Room 10". Not used by the unique index.
export const ROOM_SORT_COLLATION = Object.freeze({ locale: "en", strength: 2, numericOrdering: true });

export const ROOM_SORT_FIELDS = ["roomName", "capacity", "status", "updatedAt"];
export const ROOM_TYPE_PATTERN = /^[A-Z0-9][A-Z0-9 _.+-]{0,29}$/;

export const ROOM_MANAGEMENT_ERROR = Object.freeze({
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NAME_TAKEN: "ROOM_NAME_TAKEN",
  BRANCH_INVALID: "ROOM_BRANCH_INVALID",
  BRANCH_INACTIVE: "ROOM_BRANCH_INACTIVE",
  HAS_FUTURE_SHOWTIMES: "ROOM_HAS_FUTURE_SHOWTIMES",
  HAS_SHOWTIME_HISTORY: "ROOM_HAS_SHOWTIME_HISTORY",
  STATUS_CONFLICT: "ROOM_STATUS_CONFLICT",
});
