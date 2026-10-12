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
