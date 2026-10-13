import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { movieRepository } from "./movie.repository.js";

const toMovieDto = (movie) => ({
  id: movie._id.toString(),
  title: movie.title,
  synopsis: movie.synopsis,
  genres: movie.genres ?? [],
  cast: movie.cast ?? [],
  duration: movie.duration,
  releaseDate: movie.releaseDate.toISOString(),
  language: movie.language,
  director: movie.director,
  ageRating: movie.ageRating,
  posterUrl: movie.posterUrl,
  trailerUrl: movie.trailerUrl ?? "",
  status: movie.status,
});

export const createMovieService = (repository = movieRepository) => ({
  async listMovies(query) {
    const { movies, total } = await repository.listPublished(query);
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      data: movies.map(toMovieDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  },

  async getMovie(movieId) {
    if (!mongoose.isObjectIdOrHexString(movieId)) {
      throw new AppError(400, "Invalid movie ID", [], "INVALID_MOVIE_ID");
    }

    const movie = await repository.findPublishedById(movieId);
    if (!movie) {
      throw new AppError(404, "Movie not found", [], "MOVIE_NOT_FOUND");
    }

    return toMovieDto(movie);
  },
});

export const movieService = createMovieService();
