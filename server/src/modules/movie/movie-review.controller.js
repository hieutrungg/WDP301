import { movieReviewService } from "./movie-review.service.js";
import { parseMovieReviewQuery, parseMovieReviewBody } from "./movie-review.validation.js";
import { movieReviewWriteService } from "./movie-review-write.service.js";
import { AppError } from "../../utils/AppError.js";

export const listMovieReviews = async (req, res, next) => {
  try {
    const result = await movieReviewService.list(req.params.movieId, parseMovieReviewQuery(req.query));
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
};

export const getMovieReviewEligibility = async (req, res, next) => {
  try {
    if (Object.keys(req.query).length) throw new AppError(400, "Invalid review query", [], "INVALID_QUERY");
    const data = await movieReviewWriteService.check(req.params.movieId, req.auth.accountId);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const submitMovieReview = async (req, res, next) => {
  try {
    const input = parseMovieReviewBody(req.body, req.query);
    const data = await movieReviewWriteService.submit(req.params.movieId, req.auth.accountId, input);
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};
