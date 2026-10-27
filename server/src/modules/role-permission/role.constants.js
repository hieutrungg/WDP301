// System roles come from docs/ref/seedDataRegister.js. Their names are identifiers (requireRole,
// role redirect) and can never be renamed. ADMIN always keeps every permission and is not
// editable at all, so an Admin cannot lock every Admin out (owner decision 2026-10-27).
export const SYSTEM_ROLE = Object.freeze({
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
  CUSTOMER: "CUSTOMER",
});

export const SYSTEM_ROLE_NAMES = Object.freeze(Object.values(SYSTEM_ROLE));
export const LOCKED_ROLE_NAMES = Object.freeze([SYSTEM_ROLE.ADMIN]);
// CUSTOMER is the self-registration role; it is never assigned from staff management.
export const NON_STAFF_ROLE_NAMES = Object.freeze([SYSTEM_ROLE.CUSTOMER]);

export const ROLE_NAME_MAX_LENGTH = 50;
export const ROLE_DESCRIPTION_MAX_LENGTH = 200;
export const ROLE_PAGE_LIMIT_DEFAULT = 10;
export const ROLE_PAGE_LIMIT_MAX = 50;
export const ROLE_SORT_FIELDS = Object.freeze(["name", "createdAt", "updatedAt"]);
export const ROLE_KINDS = Object.freeze(["system", "custom"]);

export const ROLE_ERROR = Object.freeze({
  VALIDATION_FAILED: "ROLE_VALIDATION_FAILED",
  INVALID_QUERY: "ROLE_INVALID_QUERY",
  INVALID_ROLE_ID: "INVALID_ROLE_ID",
  ROLE_NOT_FOUND: "ROLE_NOT_FOUND",
  ROLE_NAME_TAKEN: "ROLE_NAME_TAKEN",
  SYSTEM_ROLE_LOCKED: "SYSTEM_ROLE_LOCKED",
  SYSTEM_ROLE_NAME_LOCKED: "SYSTEM_ROLE_NAME_LOCKED",
  PERMISSION_INVALID: "PERMISSION_INVALID",
  // CR-05 confirmations. The UI asks first; the API refuses the write until it is confirmed.
  EMPTY_PERMISSIONS_CONFIRMATION_REQUIRED: "ROLE_EMPTY_PERMISSIONS_CONFIRMATION_REQUIRED",
  AFFECTED_ACCOUNTS_CONFIRMATION_REQUIRED: "ROLE_AFFECTED_ACCOUNTS_CONFIRMATION_REQUIRED",
});

// SRS 5.3 application messages used by role management.
export const ROLE_MESSAGE = Object.freeze({
  CREATED: "Role created successfully.", // MSG35
  SAVED: "Saved successfully.", // MSG28
  PERMISSIONS_ASSIGNED: "Permissions assigned successfully.", // MSG36
  NO_PERMISSIONS_WARNING:
    "This role will have no access rights. Confirm to save it without any permission.",
});
