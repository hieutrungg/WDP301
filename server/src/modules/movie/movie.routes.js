import { Router } from "express";
import { archiveMovie, createMovie, getManagerMovie, getMovie, listManagerMovies, listMovies, updateMovie } from "./movie.controller.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";

const router = Router();

router.post("/", requireAuth, requirePermission("movie.create"), requireRole("MANAGER"), createMovie);
router.post("/:id/archive", requireAuth, requirePermission("movie.archive"), requireRole("MANAGER"), archiveMovie);
router.get("/manage", requireAuth, requirePermission("movie.update"), requireRole("MANAGER"), listManagerMovies);
router.get("/:id/manage", requireAuth, requirePermission("movie.update"), requireRole("MANAGER"), getManagerMovie);
router.patch("/:id", requireAuth, requirePermission("movie.update"), requireRole("MANAGER"), updateMovie);

router.get("/", listMovies);
router.get("/:id", getMovie);

export default router;
