import { AppError } from "../../utils/AppError.js";
import { movieService } from "./movie.service.js";
import { getPublicAuthorNames } from "../account/public-author.service.js";
import { reviewEligibilityService } from "../booking/review-eligibility.service.js";
import { movieReviewWriteRepository } from "./movie-review-write.repository.js";

const fail = (status, message, code) => new AppError(status, message, [], code);
const alreadyReviewed = () => fail(409, "You have already reviewed this movie", "REVIEW_ALREADY_EXISTS");
const notReady = () => fail(503, "Review submission is temporarily unavailable. Please try again later.", "REVIEW_WRITE_NOT_READY");
const notFound = () => fail(404, "You have not reviewed this movie", "REVIEW_NOT_FOUND");
const knownFields = new Set(["_id", "movieId", "customerAccountId", "rating", "content", "createdAt", "updatedAt", "__v"]);
const ownDto = (review, name) => {
  // Never reinterpret legacy moderation fields or repair legacy data through an edit.
  if (Object.keys(review).some(key => !knownFields.has(key)) ||
      !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5 ||
      !(review.createdAt instanceof Date) || !Number.isFinite(review.createdAt.getTime()) ||
      (review.content !== undefined && typeof review.content !== "string")) throw notReady();
  if (typeof name !== "string" || !name.trim()) {
    throw fail(409, "Add a display name to your profile before reviewing", "REVIEW_AUTHOR_NAME_REQUIRED");
  }
  return { id: review._id.toString(), authorDisplayName: name, rating: review.rating,
    content: review.content ?? "", createdAt: review.createdAt.toISOString() };
};

export const createMovieReviewWriteService = ({ repository = movieReviewWriteRepository,
  movies = movieService, eligibility = reviewEligibilityService, authors = getPublicAuthorNames,
  clock = () => new Date(),
} = {}) => ({
  async getOwn(movieId, accountId) {
    await movies.getMovie(movieId);
    const review = await repository.readOwn(movieId, accountId);
    if (!review) return null;
    return ownDto(review, (await authors([accountId])).get(accountId));
  },
  async edit(movieId, accountId, input) {
    await movies.getMovie(movieId);
    if (!await repository.ready()) throw notReady();
    const name = (await authors([accountId])).get(accountId);
    try {
      return await repository.withTransaction(async session => {
        const review = await repository.readOwn(movieId, accountId, session);
        if (!review) throw notFound();
        ownDto(review, name);
        const now = clock();
        if (!await eligibility.canReview({ movieId, accountId, now, session, lock: true })) {
          throw fail(403, "You can review after a paid, non-refunded screening has ended", "REVIEW_NOT_ELIGIBLE");
        }
        const saved = await repository.updateOwn({ movieId, accountId, reviewId: review._id,
          rating: input.rating, content: input.content, now }, session);
        if (!saved) throw notFound();
        return ownDto(saved, name);
      });
    } catch (error) {
      if ([20, 303, 263].includes(error.code)) throw notReady();
      throw error;
    }
  },
  async check(movieId, accountId) {
    await movies.getMovie(movieId);
    if (await repository.findOwn(movieId, accountId)) return { canReview: false, reason: "ALREADY_REVIEWED" };
    const name = (await authors([accountId])).get(accountId);
    if (typeof name !== "string" || !name.trim()) return { canReview: false, reason: "AUTHOR_NAME_REQUIRED" };
    const canReview = await eligibility.canReview({ movieId, accountId, now: clock() });
    return { canReview, reason: canReview ? null : "NO_ELIGIBLE_BOOKING" };
  },
  async submit(movieId, accountId, input) {
    await movies.getMovie(movieId);
    if (await repository.findOwn(movieId, accountId)) throw alreadyReviewed();
    if (!await repository.ready()) throw notReady();
    const name = (await authors([accountId])).get(accountId);
    if (typeof name !== "string" || !name.trim()) {
      throw fail(409, "Add a display name to your profile before reviewing", "REVIEW_AUTHOR_NAME_REQUIRED");
    }
    try {
      return await repository.withTransaction(async session => {
        const now = clock();
        if (await repository.findOwn(movieId, accountId, session)) throw alreadyReviewed();
        if (!await eligibility.canReview({ movieId, accountId, now, session, lock: true })) {
          throw fail(403, "You can review after a paid, non-refunded screening has ended", "REVIEW_NOT_ELIGIBLE");
        }
        const review = await repository.insert({ movieId, accountId, ...input, now }, session);
        return { id: review._id.toString(), authorDisplayName: name, rating: review.rating,
          content: review.content, createdAt: review.createdAt.toISOString() };
      });
    } catch (error) {
      if (error.code === 11000) throw alreadyReviewed();
      if ([20, 303, 263].includes(error.code)) throw notReady();
      throw error;
    }
  },
});

export const movieReviewWriteService = createMovieReviewWriteService();
