import { rateLimit } from "express-rate-limit";

export const passwordChangeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many password attempts. Please try again later.",
      errors: [],
    });
  },
});
