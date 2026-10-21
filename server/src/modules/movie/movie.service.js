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
  async createMovie(input) {
    const releaseDate = new Date(`${input.releaseDate}T00:00:00.000Z`);
    const releaseYear = releaseDate.getUTCFullYear();
    const duplicate = () => new AppError(409,
      "A movie with this title and release year already exists",
      [{ field: "title", message: "This title already exists for the selected release year" }],
      "MOVIE_DUPLICATE",
    );
    if (await repository.findByTitleAndYear(input.title, releaseYear)) throw duplicate();
    try {
      return toMovieDto(await repository.create({ ...input, releaseDate, releaseYear }));
    } catch (error) {
      if (error.code === 11000 && (error.keyPattern?.releaseYear || error.message?.includes("movie_title_release_year_unique"))) throw duplicate();
      throw error;
    }
  },

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
