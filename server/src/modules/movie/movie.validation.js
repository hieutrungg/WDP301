import { z } from "zod";
import { AppError } from "../../utils/AppError.js";
import {
  DEFAULT_MOVIE_PAGE_SIZE,
  MOVIE_STATUSES,
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

const requiredText = z.string().trim().min(1, "This field is required");
const httpUrl = z.string().trim().url("Enter a valid URL").refine(
  (value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS URL",
);
const movieCreateSchema = z.object({
  title: requiredText,
  synopsis: requiredText,
  genres: z.array(requiredText).min(1, "Add at least one genre"),
  cast: z.array(requiredText).default([]),
  duration: z.number().int().positive(),
  releaseDate: dateString,
  language: requiredText,
  director: requiredText,
  ageRating: requiredText,
  posterUrl: httpUrl,
  trailerUrl: z.union([httpUrl, z.literal("")]).default(""),
  status: z.enum([MOVIE_STATUSES.DRAFT, MOVIE_STATUSES.PUBLISHED]).default(MOVIE_STATUSES.DRAFT),
}).strict();

export const parseMovieCreateBody = (body) => {
  const result = movieCreateSchema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, "Invalid movie information", toFieldErrors(result.error.issues), "INVALID_MOVIE_INPUT");
  }
  return result.data;
};
