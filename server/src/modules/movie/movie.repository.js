import { Movie } from "./movie.model.js";
import { PUBLIC_MOVIE_STATUS } from "./movie.constants.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const movieUpdateFields = [
  "title", "synopsis", "genres", "cast", "releaseDate", "releaseYear", "language",
  "director", "ageRating", "posterUrl", "landscapePosterUrl", "trailerUrl", "duration",
];

export const buildPublishedMovieFilter = ({
  q,
  genre,
  language,
  releaseFrom,
  releaseTo,
}) => {
  const filter = { status: PUBLIC_MOVIE_STATUS };

  if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };
  if (genre) filter.genres = { $regex: `^${escapeRegex(genre)}$`, $options: "i" };
  if (language) filter.language = { $regex: `^${escapeRegex(language)}$`, $options: "i" };

  if (releaseFrom || releaseTo) {
    filter.releaseDate = {};
    if (releaseFrom) filter.releaseDate.$gte = new Date(`${releaseFrom}T00:00:00.000Z`);
    if (releaseTo) filter.releaseDate.$lte = new Date(`${releaseTo}T23:59:59.999Z`);
  }

  return filter;
};

const listMoviesByFilter = async (movieModel, filter, query) => {
  const direction = query.order === "asc" ? 1 : -1;
  const sort = { [query.sort]: direction, _id: direction };
  const skip = (query.page - 1) * query.limit;
  const [movies, total] = await Promise.all([
    movieModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
    movieModel.countDocuments(filter),
  ]);
  return { movies, total };
};

export const createMovieRepository = (movieModel = Movie) => ({
  archive(movieId, session) {
    return movieModel.findOneAndUpdate(
      { _id: movieId, status: { $ne: "ARCHIVED" } },
      { $set: { status: "ARCHIVED" } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
  },
  async withSchedulingLock(movieId, work) {
    const session = await movieModel.db.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        // Real write dependency shared by runtime edits and Showtime insertion.
        // Reuse Mongoose's existing version key; do not alter Last Modified for scheduling.
        const movie = await movieModel.findOneAndUpdate({ _id: movieId }, { $inc: { __v: 1 } },
          { session, returnDocument: "after", timestamps: false }).lean();
        result = await work(movie, session);
      });
      return result;
    } finally { await session.endSession(); }
  },
  findByTitleAndYear(title, year, excludedMovieId) {
    return movieModel.findOne({ ...(excludedMovieId ? { _id: { $ne: excludedMovieId } } : {}), title, releaseDate: {
      $gte: new Date(Date.UTC(year, 0, 1)),
      $lt: new Date(Date.UTC(year + 1, 0, 1)),
    } }).lean();
  },

  async create(data) {
    const movie = await movieModel.create(data);
    return movie.toObject();
  },

  findById(movieId) {
    return movieModel.findById(movieId).lean();
  },

  updateInfo(movieId, data, session) {
    const fields = Object.fromEntries(movieUpdateFields
      .filter((field) => data[field] !== undefined)
      .map((field) => [field, data[field]]));
    return movieModel.findOneAndUpdate(
      { _id: movieId },
      { $set: fields },
      { returnDocument: "after", runValidators: true, ...(session ? { session } : {}) },
    ).lean();
  },

  async listPublished(query) {
    const filter = buildPublishedMovieFilter(query);
    return listMoviesByFilter(movieModel, filter, query);
  },

  async listForManagement(query) {
    const filter = buildPublishedMovieFilter(query);
    delete filter.status;
    return listMoviesByFilter(movieModel, filter, query);
  },

  findPublishedById(movieId) {
    return movieModel.findOne({ _id: movieId, status: PUBLIC_MOVIE_STATUS }).lean();
  },
});

export const movieRepository = createMovieRepository();
