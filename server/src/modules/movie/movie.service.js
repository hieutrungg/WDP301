import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { movieRepository } from "./movie.repository.js";
import { showtimeReferenceService } from "../showtime/showtime-reference.service.js";

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

const toManagerMovieDto = (movie) => ({
  ...toMovieDto(movie),
  updatedAt: movie.updatedAt?.toISOString() ?? null,
});

const duplicateMovieError = () => new AppError(409,
  "A movie with this title and release year already exists",
  [{ field: "title", message: "This title already exists for the selected release year" }],
  "MOVIE_DUPLICATE",
);

const isMovieUniqueConflict = (error) => error.code === 11000 &&
  (error.keyPattern?.releaseYear || error.message?.includes("movie_title_release_year_unique"));

const validateMovieId = (movieId) => {
  if (!mongoose.isObjectIdOrHexString(movieId)) {
    throw new AppError(400, "Invalid movie ID", [], "INVALID_MOVIE_ID");
  }
};

const movieNotFoundError = () => new AppError(404, "Movie not found", [], "MOVIE_NOT_FOUND");

export const createMovieService = (repository = movieRepository, references = showtimeReferenceService) => ({
  async createMovie(input) {
    const releaseDate = new Date(`${input.releaseDate}T00:00:00.000Z`);
    const releaseYear = releaseDate.getUTCFullYear();
    if (await repository.findByTitleAndYear(input.title, releaseYear)) throw duplicateMovieError();
    try {
      return toMovieDto(await repository.create({ ...input, releaseDate, releaseYear }));
    } catch (error) {
      if (isMovieUniqueConflict(error)) throw duplicateMovieError();
      throw error;
    }
  },

  async getManagerMovie(movieId) {
    validateMovieId(movieId);
    const movie = await repository.findById(movieId);
    if (!movie) throw movieNotFoundError();
    return { ...toManagerMovieDto(movie), canEditDuration: !await references.hasMovieReferences(movieId) };
  },

  // Showtime must insert its draft inside this callback/session before releasing the guard.
  async withMovieForScheduling(movieId, work) {
    validateMovieId(movieId);
    return repository.withSchedulingLock(movieId, async (movie, session) => {
      if (!movie || movie.status !== "PUBLISHED") throw movieNotFoundError();
      return work(toMovieDto(movie), session);
    });
  },

  async listManagerMovies(query) {
    const { movies, total } = await repository.listForManagement(query);
    return {
      data: movies.map(toManagerMovieDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  },

  async updateMovie(movieId, input) {
    validateMovieId(movieId);
    if (input.duration !== undefined) {
      return repository.withSchedulingLock(movieId, async (currentMovie, session) => {
        if (!currentMovie) throw movieNotFoundError();
        const referenced = await references.hasMovieReferences(movieId, session);
        if (input.duration !== currentMovie.duration && referenced) {
          throw new AppError(409, "Runtime cannot be changed because this movie has showtime references",
            [{ field: "duration", message: "Runtime is locked because a showtime references this movie" }], "INVALID_MOVIE_INPUT");
        }
        const releaseDate = input.releaseDate === undefined ? currentMovie.releaseDate
          : new Date(`${input.releaseDate}T00:00:00.000Z`);
        const fields = { ...input };
        if (input.releaseDate !== undefined) Object.assign(fields, { releaseDate, releaseYear: releaseDate.getUTCFullYear() });
        if (await repository.findByTitleAndYear(input.title ?? currentMovie.title, releaseDate.getUTCFullYear(), movieId)) throw duplicateMovieError();
        try {
          const updated = await repository.updateInfo(movieId, fields, session);
          if (!updated) throw movieNotFoundError();
          return { ...toManagerMovieDto(updated), canEditDuration: !referenced };
        } catch (error) {
          if (isMovieUniqueConflict(error)) throw duplicateMovieError();
          throw error;
        }
      });
    }
    const currentMovie = await repository.findById(movieId);
    if (!currentMovie) throw movieNotFoundError();
    const canEditDuration = !await references.hasMovieReferences(movieId);

    const releaseDate = input.releaseDate === undefined
      ? currentMovie.releaseDate
      : new Date(`${input.releaseDate}T00:00:00.000Z`);
    const releaseYear = releaseDate.getUTCFullYear();
    const title = input.title ?? currentMovie.title;
    if (await repository.findByTitleAndYear(title, releaseYear, movieId)) throw duplicateMovieError();

    const fields = { ...input };
    // Sparse patches must not overwrite a release date/year changed by another request.
    // MOV-101's explicit migration backfills legacy releaseYear values before rollout.
    if (input.releaseDate !== undefined) Object.assign(fields, { releaseDate, releaseYear });

    try {
      const updatedMovie = await repository.updateInfo(movieId, fields);
      if (!updatedMovie) throw movieNotFoundError();
      return { ...toManagerMovieDto(updatedMovie), canEditDuration };
    } catch (error) {
      if (isMovieUniqueConflict(error)) throw duplicateMovieError();
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
    validateMovieId(movieId);

    const movie = await repository.findPublishedById(movieId);
    if (!movie) {
      throw movieNotFoundError();
    }

    return toMovieDto(movie);
  },
});

export const movieService = createMovieService();
