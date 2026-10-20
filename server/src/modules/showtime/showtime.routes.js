import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { cancelShowtime, createShowtime, getShowtimeById, listManagerShowtimes, listMovieShowtimes, listShowtimes, rescheduleShowtime } from "./showtime.controller.js";
import { SHOWTIME_ERROR } from "./showtime.constants.js";
import { createShowtimeSchema, managerShowtimeQueryValidator, movieShowtimeParamsValidator, movieShowtimeQueryValidator, rescheduleShowtimeSchema, showtimeIdParamsValidator, showtimeQueryValidator } from "./showtime.validation.js";

const router = Router();

// UC17 names MANAGER as the actor; no separate showtime permission code is defined yet.
router.post(
  "/showtimes",
  requireAuth,
  requireRole("MANAGER"),
  validate(createShowtimeSchema, { code: SHOWTIME_ERROR.INVALID_SHOWTIME }),
  createShowtime,
);
router.get(
  "/showtimes/manage",
  requireAuth,
  requireRole("MANAGER"),
  managerShowtimeQueryValidator,
  listManagerShowtimes,
);
router.patch(
  "/showtimes/:showtimeId",
  requireAuth,
  requireRole("MANAGER"),
  showtimeIdParamsValidator,
  validate(rescheduleShowtimeSchema, { code: SHOWTIME_ERROR.INVALID_SHOWTIME }),
  rescheduleShowtime,
);
router.post(
  "/showtimes/:showtimeId/cancel",
  requireAuth,
  requireRole("MANAGER"),
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
