import {
  requirePermission,
  requireRole,
} from "../../middlewares/permissionMiddleware.js";
import { actorRoleNames } from "../role-permission/role-permission-scope.js";

export const requireBookingActor = (req, res, next) =>
  requireRole("CUSTOMER", "STAFF")(req, res, (roleError) => {
    if (roleError) return next(roleError);
    const roles = actorRoleNames(req.auth.account.roles);
    const permission = roles.has("STAFF")
      ? "ticket.sell_counter"
      : "booking.create";
    return requirePermission(permission)(req, res, next);
  });

export const requireCounterTicketActor = (req, res, next) =>
  requireRole("STAFF")(req, res, (roleError) => {
    if (roleError) return next(roleError);
    return requirePermission("ticket.sell_counter")(req, res, next);
  });
