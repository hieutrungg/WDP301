import { z } from "zod";
import { AppError } from "../../utils/AppError.js";
import { SHOWTIME_ERROR, SHOWTIME_PAGE_LIMIT_DEFAULT, SHOWTIME_PAGE_LIMIT_MAX } from "./showtime.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

const listQuerySchema = z.strictObject({
  movieId: objectId.optional(),
  cinemaId: objectId.optional(),
  roomId: objectId.optional(),
  date: dateString.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(SHOWTIME_PAGE_LIMIT_MAX).default(SHOWTIME_PAGE_LIMIT_DEFAULT),
});

const movieListQuerySchema = listQuerySchema.omit({ movieId: true });

const validateShowtimeQuery = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const hasInvalidDate = result.error.issues.some((issue) => issue.path[0] === "date");
    return next(new AppError(
      400,
      hasInvalidDate ? "Invalid showtime date range" : "Invalid showtime query",
      result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
      hasInvalidDate ? SHOWTIME_ERROR.INVALID_DATE_RANGE : SHOWTIME_ERROR.INVALID_QUERY,
    ));
  }
  req.validated = { ...req.validated, query: result.data };
  return next();
};

export const showtimeQueryValidator = validateShowtimeQuery(listQuerySchema);

export const movieShowtimeParamsValidator = (req, _res, next) => {
  const result = objectId.safeParse(req.params.movieId);
  if (!result.success) {
    return next(new AppError(400, "Invalid movie ID", [], SHOWTIME_ERROR.INVALID_MOVIE_ID));
  }
  req.validated = { ...req.validated, params: { movieId: result.data } };
  return next();
};

export const movieShowtimeQueryValidator = validateShowtimeQuery(movieListQuerySchema);
