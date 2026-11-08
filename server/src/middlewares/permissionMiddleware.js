import { getCurrentAccount } from "../modules/auth/auth.service.js";
import { AppError } from "../utils/AppError.js";
import { routeNotFoundError } from "./notFoundMiddleware.js";
import { actorRoleNames } from "../modules/role-permission/role-permission-scope.js";

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

// Must run after requireAuth. Status and effective permissions (role grants + direct grants)
// are reloaded on every request, so a locked account or revoked grant applies immediately.
export const requirePermission =
  (...permissionNames) =>
  async (req, _res, next) => {
    try {
      if (!req.auth?.accountId) {
        throw new AppError(401, "Authentication required");
      }

      const account = await getCurrentAccount(req.auth.accountId);
      const granted = new Set(account.permissions.map(({ name }) => name));

      if (
        permissionNames.length === 0 ||
        !permissionNames.every((name) => isNonEmptyString(name) && granted.has(name))
      ) {
        // 404, not 403: a denied caller must not learn that this protected route exists.
        throw routeNotFoundError();
      }

      req.auth.account = account;
      return next();
    } catch (error) {
      return next(error);
    }
  };

// Must run after requireAuth. For use cases whose actor is a specific role rather than a grant:
// account requirePermission already loaded for this request.
export const requireRole =
  (...roleNames) =>
  async (req, _res, next) => {
    try {
      if (!req.auth?.accountId) {
        throw new AppError(401, "Authentication required");
      }

      const account = req.auth.account ?? (await getCurrentAccount(req.auth.accountId));
      // A custom role counts as its base role (role-permission-scope.js).
      const roles = actorRoleNames(account.roles);

      if (
        roleNames.length === 0 ||
        !roleNames.every(isNonEmptyString) ||
        !roleNames.some((name) => roles.has(name))
      ) {
        // 404, not 403: a denied caller must not learn that this protected route exists.
        throw routeNotFoundError();
      }

      req.auth.account = account;
      return next();
    } catch (error) {
      return next(error);
    }
  };
