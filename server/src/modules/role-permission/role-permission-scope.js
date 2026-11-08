import { SYSTEM_ROLE } from "./role.constants.js";

// Permission ceiling of each system role: the default grants from docs/ref/seedDataRegister.js.
// An Admin may remove permissions from a role (and give them back), but never grant one outside
// the ceiling, because routes also require the matching actor role and such a grant would not work.
// ADMIN has no ceiling (it always holds every permission and is locked).
export const ROLE_PERMISSION_SCOPE = Object.freeze({
  [SYSTEM_ROLE.CUSTOMER]: Object.freeze([
    "profile.view",
    "profile.update",
    "movie.view",
    "showtime.view",
    "booking.create",
    "booking.view_own",
    "concession.view",
    "payment.view",
    "promotion.view",
    "refund.request",
    "branch.view",
  ]),
  [SYSTEM_ROLE.STAFF]: Object.freeze([
    "profile.view",
    "profile.update",
    "movie.view",
    "showtime.view",
    "booking.view_all",
    "ticket.sell_counter",
    "ticket.validate",
    "concession.view",
    "payment.view",
    "promotion.view",
    "branch.view",
    "room.view",
    "inventory.view",
    "inventory.stock_in",
  ]),
  [SYSTEM_ROLE.MANAGER]: Object.freeze([
    "profile.view",
    "profile.update",
    "movie.view",
    "movie.create",
    "movie.update",
    "movie.archive",
    "showtime.view",
    "showtime.create",
    "showtime.update",
    "showtime.cancel",
    "booking.view_all",
    "ticket.sell_counter",
    "ticket.validate",
    "concession.view",
    "concession.manage",
    "payment.view",
    "promotion.view",
    "promotion.manage",
    "refund.manage",
    "analytics.view",
    "branch.view",
    "branch.manage",
    "room.view",
    "room.manage",
    "inventory.view",
    "inventory.manage",
    "staff.view",
    "staff.manage",
    "shift.view",
    "shift.manage",
    "report.view",
    "report.export",
  ]),
});

// A custom role is created on top of one of these and acts as it (requireRole, client areas).
export const ROLE_BASE_ROLES = Object.freeze([SYSTEM_ROLE.STAFF, SYSTEM_ROLE.MANAGER]);

// The system role a role acts as: its own name for a system role, its base role for a custom one.
export const actorRoleOf = (role) => role?.baseRole || role?.name || null;

export const actorRoleNames = (roles = []) =>
  new Set(roles.map(actorRoleOf).filter(Boolean));

/**
 * Union of the ceilings of the given actor roles. Returns null (no limit) when ADMIN is among them.
 * @param {Iterable<string>} actorRoles
 * @returns {Set<string> | null}
 */
export const allowedPermissionNames = (actorRoles) => {
  const allowed = new Set();
  for (const role of actorRoles) {
    if (role === SYSTEM_ROLE.ADMIN) return null;
    for (const name of ROLE_PERMISSION_SCOPE[role] ?? []) allowed.add(name);
  }
  return allowed;
};

// System roles whose ceiling contains the permission ("scopes" of a permission in the catalog).
export const permissionScopes = (permissionName) =>
  Object.entries(ROLE_PERMISSION_SCOPE)
    .filter(([, names]) => names.includes(permissionName))
    .map(([role]) => role);

/** Names in `permissionNames` that fall outside `allowed` (null = no limit). */
export const outOfScope = (permissionNames, allowed) =>
  allowed ? permissionNames.filter((name) => !allowed.has(name)).sort() : [];
