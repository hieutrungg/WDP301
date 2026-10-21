import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export const requireAuth = (req, _res, next) => {
  const token = req.cookies?.accessToken;

  if (typeof token !== "string" || !token) {
    return next(new AppError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string" ||
      !payload.sub.trim()
    ) {
      return next(new AppError(401, "Invalid or expired session"));
    }

    req.auth = { accountId: payload.sub };
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired session"));
  }
};
