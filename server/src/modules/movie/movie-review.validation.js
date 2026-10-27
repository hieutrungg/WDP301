import { z } from "zod";
import { AppError } from "../../utils/AppError.js";

// Bound offset arithmetic without changing the approved fixed page size.
const querySchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .refine((page) => Number.isSafeInteger(page * 10)).optional().default(1),
}).strict();

export const parseMovieReviewQuery = (query) => {
  const result = querySchema.safeParse(query);
  if (!result.success) {
    throw new AppError(400, "Invalid review query", result.error.issues.map((issue) => ({
      field: issue.path.join("."), message: issue.message,
    })), "INVALID_QUERY");
  }
  return result.data;
};

const reviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().max(2000).optional().default(""),
}).strict();

export const parseMovieReviewBody = (body, query) => {
  const result = reviewBodySchema.safeParse(body);
  if (!result.success || Object.keys(query).length) {
    throw new AppError(400, "Invalid review input", result.success ? [] : result.error.issues.map(issue => ({
      field: issue.path.join("."), message: issue.message,
    })), "INVALID_REVIEW_INPUT");
  }
  return result.data;
};
