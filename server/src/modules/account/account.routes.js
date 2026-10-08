import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { changeMyPassword, updateMyProfile } from "./account.controller.js";
import { passwordChangeRateLimiter } from "./account.rate-limiters.js";
import { changePasswordSchema, updateProfileSchema } from "./account.validation.js";

const router = Router();

// Self-service only: the target account always comes from the session, never the request.
router.use(requireAuth);
router.patch("/me", validate(updateProfileSchema), updateMyProfile);
router.post(
  "/me/password",
  passwordChangeRateLimiter,
  validate(changePasswordSchema),
  changeMyPassword,
);

export default router;
