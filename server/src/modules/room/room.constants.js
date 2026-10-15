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
