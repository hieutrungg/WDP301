// UC39/UC40. Stock status is derived from quantity and the item's minimum stock threshold; it is
// never persisted.
export const STOCK_STATUS = Object.freeze({
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
});

export const STOCK_STATUSES = Object.values(STOCK_STATUS);

export const CONCESSION_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const CONCESSION_STATUSES = Object.values(CONCESSION_STATUS);

export const STOCK_TRANSACTION_TYPE = Object.freeze({
  IMPORT: "IMPORT",
  SALE: "SALE",
  ADJUSTMENT: "ADJUSTMENT",
  WASTE: "WASTE",
});

export const STOCK_TRANSACTION_TYPES = Object.values(STOCK_TRANSACTION_TYPE);

// Applied when an inventory row is created by the first stock-in, and when an item has no row yet.
export const DEFAULT_MIN_THRESHOLD = 10;
export const DEFAULT_UNIT = "unit";

export const STOCK_LIST_LIMIT_DEFAULT = 10;
export const STOCK_LIST_LIMIT_MAX = 50;
export const STOCK_IN_MAX_LINES = 50;
export const STOCK_IN_MAX_QUANTITY = 100000;
export const STOCK_IN_NOTE_MAX_LENGTH = 500;
// Tolerated difference between the client clock and the server when checking `receivedAt`.
export const RECEIVED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;

// Staff and Manager may view stock levels (screen authorization matrix); only Staff receives goods.
export const INVENTORY_PERMISSION = Object.freeze({
  VIEW: "inventory.view",
  STOCK_IN: "inventory.stock_in",
});

export const INVENTORY_ERROR = Object.freeze({
  INVALID_QUERY: "INVALID_QUERY",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  BRANCH_NOT_ASSIGNED: "BRANCH_NOT_ASSIGNED",
  CONCESSION_NOT_FOUND: "CONCESSION_NOT_FOUND",
  CONCESSION_INACTIVE: "CONCESSION_INACTIVE",
  SUPPLIER_NOT_FOUND: "SUPPLIER_NOT_FOUND",
  STOCK_UPDATE_FAILED: "STOCK_UPDATE_FAILED",
});
