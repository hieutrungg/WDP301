import { movieService } from "./movie.service.js";
import { parseMovieListQuery } from "./movie.validation.js";

export const listMovies = async (req, res, next) => {
  try {
    const query = parseMovieListQuery(req.query);
    const result = await movieService.listMovies(query);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getMovie = async (req, res, next) => {
  try {
    const movie = await movieService.getMovie(req.params.id);
    res.json({ success: true, data: movie });
  } catch (error) {
    next(error);
  }
};
