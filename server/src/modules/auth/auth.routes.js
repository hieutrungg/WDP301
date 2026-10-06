import { Router } from "express";
import { login, logout, me } from "./auth.controller.js";
import { loginSchema } from "./auth.validation.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

export default router;
