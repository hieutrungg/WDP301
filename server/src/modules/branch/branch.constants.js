// A-24: CinemaBranch lifecycle. Public discovery only ever sees ACTIVE branches.
export const BRANCH_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const BRANCH_STATUSES = Object.values(BRANCH_STATUS);

// A-25: branchName is unique after normalization (trimmed, collapsed spaces, case-insensitive).
export const BRANCH_NAME_COLLATION = Object.freeze({ locale: "en", strength: 2 });

export const BRANCH_SORT_FIELDS = ["branchName", "status", "createdAt", "updatedAt"];
export const BRANCH_PAGE_LIMIT_DEFAULT = 10;
export const BRANCH_PAGE_LIMIT_MAX = 50;

export const BRANCH_ERROR = Object.freeze({
  INVALID_QUERY: "INVALID_QUERY",
  INVALID_BRANCH_ID: "INVALID_BRANCH_ID",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "BRANCH_NOT_FOUND",
  NAME_TAKEN: "BRANCH_NAME_TAKEN",
  HAS_FUTURE_SHOWTIMES: "BRANCH_HAS_FUTURE_SHOWTIMES",
  STATUS_CONFLICT: "BRANCH_STATUS_CONFLICT",
});
