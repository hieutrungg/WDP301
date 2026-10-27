import { AppError } from "../../utils/AppError.js";
import { movieService } from "./movie.service.js";
import { getPublicAuthorNames } from "../account/public-author.service.js";
import { reviewEligibilityService } from "../booking/review-eligibility.service.js";
import { movieReviewWriteRepository } from "./movie-review-write.repository.js";

const fail = (status, message, code) => new AppError(status, message, [], code);
const alreadyReviewed = () => fail(409, "You have already reviewed this movie", "REVIEW_ALREADY_EXISTS");
const notReady = () => fail(503, "Review submission is temporarily unavailable. Please try again later.", "REVIEW_WRITE_NOT_READY");

export const createMovieReviewWriteService = ({ repository = movieReviewWriteRepository,
  movies = movieService, eligibility = reviewEligibilityService, authors = getPublicAuthorNames,
  clock = () => new Date(),
} = {}) => ({
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
