import { AppError } from "../utils/AppError.js";

// Must run after requirePermission/requireRole, which load the current account from the server.
// Never accept a branch scope from request params, query, or body.
export const requireAssignedBranch = (req, _res, next) => {
  const branchId = req.auth?.account?.employeeProfile?.branchId;
  if (!branchId) {
    return next(new AppError(403, "Your account is not assigned to a cinema branch", [], "BRANCH_NOT_ASSIGNED"));
  }

  req.auth.branchId = branchId.toString();
  return next();
};
