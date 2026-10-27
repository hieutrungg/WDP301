export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
});

// Statuses an Admin can set on a staff account (UC36). BR-28: DISABLED cannot sign in.
export const STAFF_STATUSES = Object.freeze([ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.DISABLED]);

export const STAFF_PAGE_LIMIT_DEFAULT = 10;
export const STAFF_PAGE_LIMIT_MAX = 50;
export const STAFF_SORT_FIELDS = Object.freeze(["createdAt", "username", "fullName", "email", "status"]);
export const STAFF_POSITION_MAX_LENGTH = 60;

export const STAFF_ERROR = Object.freeze({
  VALIDATION_FAILED: "STAFF_VALIDATION_FAILED",
  INVALID_QUERY: "STAFF_INVALID_QUERY",
  INVALID_ACCOUNT_ID: "INVALID_ACCOUNT_ID",
  STAFF_ACCOUNT_NOT_FOUND: "STAFF_ACCOUNT_NOT_FOUND",
  DUPLICATE_ACCOUNT: "DUPLICATE_ACCOUNT",
  ROLE_REQUIRED: "STAFF_ROLE_REQUIRED",
  ROLE_INVALID: "STAFF_ROLE_INVALID",
  PERMISSION_INVALID: "PERMISSION_INVALID",
  BRANCH_INVALID: "STAFF_BRANCH_INVALID",
  CANNOT_DISABLE_SELF: "CANNOT_DISABLE_SELF",
  CANNOT_REMOVE_OWN_ADMIN_ROLE: "CANNOT_REMOVE_OWN_ADMIN_ROLE",
  STATUS_NOT_CHANGEABLE: "STAFF_STATUS_NOT_CHANGEABLE",
});

// SRS 5.3 application messages used by staff account management.
export const STAFF_MESSAGE = Object.freeze({
  CREATED: "Staff account created successfully.", // MSG35
  SAVED: "Saved successfully.", // MSG28
  PERMISSIONS_ASSIGNED: "Permissions assigned successfully.", // MSG36
  EMAIL_TAKEN: "This email is already registered.", // MSG06
  USERNAME_TAKEN: "This username is already registered.",
  PHONE_TAKEN: "This phone number is already registered.",
  ROLE_REQUIRED: "At least one role is required.",
});
