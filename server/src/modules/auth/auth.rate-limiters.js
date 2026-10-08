import { rateLimit } from "express-rate-limit";

const createLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message, errors: [] });
    },
  });

export const registerRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many registration attempts. Please try again later.",
});

export const verifyEmailRateLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  message: "Too many verification attempts. Please try again later.",
});

export const resendVerificationRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many resend requests. Please try again later.",
});

export const googleLoginRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many Google sign-in attempts. Please try again later.",
});
