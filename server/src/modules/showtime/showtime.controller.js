import * as showtimeService from "./showtime.service.js";

export const listShowtimes = async (req, res, next) => {
  try {
    const result = await showtimeService.listShowtimes(req.validated.query);
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const listMovieShowtimes = async (req, res, next) => {
  try {
    const result = await showtimeService.listShowtimes({
      ...req.validated.query,
      movieId: req.validated.params.movieId,
    });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
};
