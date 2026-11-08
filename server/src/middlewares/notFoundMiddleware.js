import { AppError } from "../utils/AppError.js";

// One response for "no such route" and "route exists but you may not use it" (see
// permissionMiddleware), so callers cannot probe which protected APIs exist. The path is not echoed
// back for the same reason: both bodies must be identical.
export const routeNotFoundError = () => new AppError(404, "Route not found", [], "NOT_FOUND");

export const notFound = (_req, _res, next) => {
  next(routeNotFoundError());
};
