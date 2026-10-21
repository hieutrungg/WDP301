import { movieService } from "./movie.service.js";
import { parseManagerMovieListQuery, parseMovieCreateBody, parseMovieListQuery, parseMovieUpdateBody } from "./movie.validation.js";

export const createMovie = async (req, res, next) => {
  try {
    const data = await movieService.createMovie(parseMovieCreateBody(req.body));
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

export const getManagerMovie = async (req, res, next) => {
  try {
    const data = await movieService.getManagerMovie(req.params.id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const listManagerMovies = async (req, res, next) => {
  try {
    const result = await movieService.listManagerMovies(parseManagerMovieListQuery(req.query));
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error) { next(error); }
};

export const updateMovie = async (req, res, next) => {
  try {
    const data = await movieService.updateMovie(req.params.id, parseMovieUpdateBody(req.body));
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

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
