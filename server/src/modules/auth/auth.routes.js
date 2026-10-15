import { Router } from "express";
import {
  forgotPassword,
  googleLogin,
  login,
  logout,
  me,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
  verifyResetOtp,
} from "./auth.controller.js";
import {
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyResetOtpSchema,
} from "./auth.validation.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import {
  forgotPasswordRateLimiter,
  googleLoginRateLimiter,
  registerRateLimiter,
  resendVerificationRateLimiter,
  resetPasswordRateLimiter,
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
router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  "/forgot-password/verify-otp",
  resetPasswordRateLimiter,
  validate(verifyResetOtpSchema),
  verifyResetOtp,
);
router.post(
  "/reset-password",
  resetPasswordRateLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

export default router;
