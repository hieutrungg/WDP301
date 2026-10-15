import { getCurrentAccount } from "../modules/auth/auth.service.js";
import { AppError } from "../utils/AppError.js";

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

      if (!permissionNames.every((name) => granted.has(name))) {
        throw new AppError(403, "You do not have permission to perform this action", [], "FORBIDDEN");
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
      const roles = new Set(account.roles.map(({ name }) => name));

      if (!roleNames.some((name) => roles.has(name))) {
        throw new AppError(403, "You do not have permission to perform this action", [], "FORBIDDEN");
      }

      req.auth.account = account;
      return next();
    } catch (error) {
      return next(error);
    }
  };
