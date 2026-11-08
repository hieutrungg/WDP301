import { AppError } from "../../utils/AppError.js";
import { actorRoleNames } from "../role-permission/role-permission-scope.js";
import { ROOM_ERROR } from "./room.constants.js";

// Rooms and seat maps are branch-scoped like stock and check-in: a Manager or Staff only works on
// the branch stored on their own account, never on a branch named in the request. Only an
// Administrator (read-only here, writes also need the MANAGER role) sees every branch.
const hasRole = (account, name) => actorRoleNames(account?.roles ?? []).has(name);

export const resolveBranchScope = (account) => {
  const adminOnly = hasRole(account, "ADMIN") && !hasRole(account, "MANAGER") && !hasRole(account, "STAFF");
  if (adminOnly) return null;

  const branchId = account?.employeeProfile?.branchId;
  if (!branchId) {
    throw new AppError(403, "Your account is not assigned to a branch", [], ROOM_ERROR.BRANCH_NOT_ASSIGNED);
  }

  return branchId.toString();
};

const wrongBranchError = () =>
  new AppError(403, "This room belongs to another branch", [], ROOM_ERROR.WRONG_BRANCH);

// `scope` is a branch id, or null for an unrestricted actor.
export const assertRoomInScope = (room, scope) => {
  if (scope && room.branchId?.toString() !== scope) throw wrongBranchError();
};

// A scoped actor can only name their own branch; leaving it out means "my branch".
export const resolveBranchFilter = (requestedBranchId, scope) => {
  if (!scope) return requestedBranchId;
  if (requestedBranchId && requestedBranchId.toLowerCase() !== scope) throw wrongBranchError();
  return scope;
};
