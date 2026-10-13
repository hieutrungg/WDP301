import { Movie } from "./movie.model.js";
import { PUBLIC_MOVIE_STATUS } from "./movie.constants.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

export const createMovieRepository = (movieModel = Movie) => ({
  async listPublished(query) {
    const filter = buildPublishedMovieFilter(query);
    const direction = query.order === "asc" ? 1 : -1;
    const sort = { [query.sort]: direction, _id: direction };
    const skip = (query.page - 1) * query.limit;

    const [movies, total] = await Promise.all([
      movieModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
      movieModel.countDocuments(filter),
    ]);

    return { movies, total };
  },

  findPublishedById(movieId) {
    return movieModel.findOne({ _id: movieId, status: PUBLIC_MOVIE_STATUS }).lean();
  },
});

export const movieRepository = createMovieRepository();
