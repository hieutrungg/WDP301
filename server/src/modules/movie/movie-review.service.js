import { movieService } from "./movie.service.js";
import { getPublicAuthorNames } from "../account/public-author.service.js";
import { movieReviewRepository, REVIEW_PAGE_SIZE } from "./movie-review.repository.js";
import { readReviewRating } from "./movie-review.rating.js";

const knownFields = new Set([
  "_id", "movieId", "customerAccountId", "rating", "content", "createdAt", "updatedAt", "__v",
]);

const dataIssue = () => new Error("Movie review data requires owner review; no records were changed");

export const createMovieReviewService = (
  repository = movieReviewRepository,
  movies = movieService,
  readAuthors = getPublicAuthorNames,
) => ({
  async list(movieId, { page }) {
    // Reuse the Movie owner's ID validation and PUBLISHED-only visibility contract.
    await movies.getMovie(movieId);
    const { items, total } = await repository.list(movieId, page);
    const ratings = items.map((item) => {
      // Unknown fields may express legacy hidden/rejected/deleted state. Never infer publicity.
      if (!Array.isArray(item.storedFields) || item.storedFields.some((field) => !knownFields.has(field)) ||
          item._id?._bsontype !== "ObjectId" || item.customerAccountId?._bsontype !== "ObjectId" ||
          !(item.createdAt instanceof Date) || !Number.isFinite(item.createdAt.getTime()) ||
          (item.content !== undefined && typeof item.content !== "string")) throw dataIssue();
      return readReviewRating(item.rating);
    });
    const authors = await readAuthors([...new Set(items.map((item) => item.customerAccountId.toString()))]);
    const data = items.map((item, index) => {
      const authorDisplayName = authors.get(item.customerAccountId.toString());
      if (typeof authorDisplayName !== "string" || !authorDisplayName.trim()) throw dataIssue();
      return {
        id: item._id.toString(), authorDisplayName, rating: ratings[index],
        content: item.content ?? "", createdAt: item.createdAt.toISOString(),
      };
    });
    return { data, meta: { page, limit: REVIEW_PAGE_SIZE, total, totalPages: Math.ceil(total / REVIEW_PAGE_SIZE) } };
  },
});

export const movieReviewService = createMovieReviewService();
