import { Router } from "express";
import { listMovieShowtimes, listShowtimes } from "./showtime.controller.js";
import { movieShowtimeParamsValidator, movieShowtimeQueryValidator, showtimeQueryValidator } from "./showtime.validation.js";

const router = Router();

router.get("/showtimes", showtimeQueryValidator, listShowtimes);
router.get(
  "/movies/:movieId/showtimes",
  movieShowtimeParamsValidator,
  movieShowtimeQueryValidator,
  listMovieShowtimes,
);

export default router;
