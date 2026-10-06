import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export const requireAuth = (req, _res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next(new AppError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    req.auth = { accountId: payload.sub };
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired session"));
  }
};
