import { z } from "zod";
import { AppError } from "../../utils/AppError.js";
import {
  DEFAULT_MOVIE_PAGE_SIZE,
  MAX_MOVIE_PAGE_SIZE,
  PUBLIC_MOVIE_STATUS,
} from "./movie.constants.js";

const optionalTrimmedString = (maxLength) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed || undefined;
    },
    z.string().max(maxLength).optional(),
  );

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .refine((value) => {
    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
  }, "Invalid date");

const movieListQuerySchema = z
  .object({
    q: optionalTrimmedString(100),
    genre: optionalTrimmedString(60),
    language: optionalTrimmedString(60),
    releaseFrom: dateString.optional(),
    releaseTo: dateString.optional(),
    status: z.literal(PUBLIC_MOVIE_STATUS).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_MOVIE_PAGE_SIZE)
      .default(DEFAULT_MOVIE_PAGE_SIZE),
    sort: z.enum(["releaseDate", "title", "duration"]).default("releaseDate"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine(
    ({ releaseFrom, releaseTo }) =>
      !releaseFrom || !releaseTo || releaseFrom <= releaseTo,
    { message: "releaseFrom must be on or before releaseTo", path: ["releaseFrom"] },
  );

const toFieldErrors = (issues) =>
  issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

export const parseMovieListQuery = (query) => {
  const result = movieListQuerySchema.safeParse(query);

  if (!result.success) {
    throw new AppError(
      400,
      "Invalid movie query",
      toFieldErrors(result.error.issues),
      "INVALID_QUERY",
    );
  }

  return result.data;
};
