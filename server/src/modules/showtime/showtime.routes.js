import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { requireAssignedBranch } from "../../middlewares/assignedBranchMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { cancelShowtime, createShowtime, getShowtimeById, listManagerShowtimes, listMovieShowtimes, listShowtimes, rescheduleShowtime } from "./showtime.controller.js";
import { SHOWTIME_ERROR } from "./showtime.constants.js";
import { createShowtimeSchema, managerShowtimeQueryValidator, movieShowtimeParamsValidator, movieShowtimeQueryValidator, rescheduleShowtimeSchema, showtimeIdParamsValidator, showtimeQueryValidator } from "./showtime.validation.js";

const router = Router();

// UC17 names MANAGER as the actor; each action also needs its showtime.* permission, so an Admin
// can withdraw it from the MANAGER role (or a custom role built on MANAGER).
router.post(
  "/showtimes",
  requireAuth,
  requirePermission("showtime.create"),
  requireRole("MANAGER"),
  requireAssignedBranch,
  validate(createShowtimeSchema, { code: SHOWTIME_ERROR.INVALID_SHOWTIME }),
  createShowtime,
);
router.get(
  "/showtimes/manage",
  requireAuth,
  requirePermission("showtime.view"),
  requireRole("MANAGER"),
  requireAssignedBranch,
  managerShowtimeQueryValidator,
  listManagerShowtimes,
);
router.patch(
  "/showtimes/:showtimeId",
  requireAuth,
  requirePermission("showtime.update"),
  requireRole("MANAGER"),
  requireAssignedBranch,
  showtimeIdParamsValidator,
  validate(rescheduleShowtimeSchema, { code: SHOWTIME_ERROR.INVALID_SHOWTIME }),
  rescheduleShowtime,
);
router.post(
  "/showtimes/:showtimeId/cancel",
  requireAuth,
  requirePermission("showtime.cancel"),
  requireRole("MANAGER"),
  requireAssignedBranch,
  showtimeIdParamsValidator,
  cancelShowtime,
);
router.get("/showtimes", showtimeQueryValidator, listShowtimes);
router.get("/showtimes/:showtimeId", showtimeIdParamsValidator, getShowtimeById);
router.get(
  "/movies/:movieId/showtimes",
  movieShowtimeParamsValidator,
  movieShowtimeQueryValidator,
  listMovieShowtimes,
);

export default router;
