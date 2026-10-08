import { Router } from "express";
import {
  googleLogin,
  login,
  logout,
  me,
  register,
  resendVerification,
  verifyEmail,
} from "./auth.controller.js";
import {
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "./auth.validation.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  googleLoginRateLimiter,
  registerRateLimiter,
  resendVerificationRateLimiter,
  verifyEmailRateLimiter,
} from "./auth.rate-limiters.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/google", googleLoginRateLimiter, validate(googleLoginSchema), googleLogin);
router.post("/register", registerRateLimiter, validate(registerSchema), register);
router.post(
  "/verify-email",
  verifyEmailRateLimiter,
  validate(verifyEmailSchema),
  verifyEmail,
);
router.post(
  "/resend-verification",
  resendVerificationRateLimiter,
  validate(resendVerificationSchema),
  resendVerification,
);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

export default router;
