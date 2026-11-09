import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { getCurrentAccount } from "../auth/auth.service.js";
import { routeNotFoundError } from "../../middlewares/notFoundMiddleware.js";
import { GUEST_ACTOR, actorFromAccount } from "./ai-actor.js";

// The assistant also serves guests, so a missing or invalid session is not an error here: it makes
// the request a guest request. A valid session is reloaded on every request (same as
// requirePermission), so a locked account or a revoked grant applies at once. Shared middleware is
// not changed.

const tokenSubject = (token) => {
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    return typeof payload?.sub === "string" && payload.sub.trim() ? payload.sub : null;
  } catch {
    return null;
  }
};

export const createAiActorMiddleware = ({ loadAccount = getCurrentAccount } = {}) =>
  async (req, _res, next) => {
    req.ai = { actor: GUEST_ACTOR, accessToken: null };
    const token = req.cookies?.accessToken;
    const accountId = typeof token === "string" && token ? tokenSubject(token) : null;
    if (!accountId) return next();
    try {
      const account = await loadAccount(accountId);
      req.ai = { actor: actorFromAccount(account), accessToken: token };
      return next();
    } catch (error) {
      // Unknown or locked account: continue as a guest without the session.
      if (error?.statusCode === 401 || error?.statusCode === 403) return next();
      return next(error);
    }
  };

export const requireAiAccount = (req, _res, next) =>
  req.ai?.actor.kind === "account" ? next() : next(routeNotFoundError());

// Trace viewer and knowledge sync. 404 for everyone else, like the other protected routes.
export const requireAiAdmin = (req, _res, next) =>
  req.ai?.actor.roles.has("ADMIN") ? next() : next(routeNotFoundError());
