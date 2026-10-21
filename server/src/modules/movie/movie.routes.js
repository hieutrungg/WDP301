import { Router } from "express";
import { createMovie, getMovie, listMovies } from "./movie.controller.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";

const router = Router();

router.post("/", requireAuth, requirePermission("movie.create"), requireRole("MANAGER"), createMovie);

router.get("/", listMovies);
router.get("/:id", getMovie);

export default router;
