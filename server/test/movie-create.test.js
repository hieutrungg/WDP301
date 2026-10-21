import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { parseMovieCreateBody } from "../src/modules/movie/movie.validation.js";
import { createMovieService } from "../src/modules/movie/movie.service.js";

export const movieInput = {
  title: "A New Film", synopsis: "A story", genres: ["Drama"], cast: [], duration: 120,
  releaseDate: "2026-12-04", language: "Vietnamese", director: "A Director", ageRating: "T13",
  posterUrl: "https://example.com/poster.jpg", trailerUrl: "",
};

test("movie creation validates metadata, dates, URLs and rejects protected fields", () => {
  const input = parseMovieCreateBody({ ...movieInput, title: " A New Film " });
  assert.equal(input.title, "A New Film");
  assert.equal(input.status, "DRAFT");
  for (const bad of [{ duration: -1 }, { duration: 1.2 }, { duration: "120" }, { title: " " },
    { genres: [] }, { releaseDate: "2026-02-30" }, { releaseDate: "bad" },
    { posterUrl: "javascript:alert(1)" }, { trailerUrl: "ftp://example.com/file" },
    { status: "ARCHIVED" }, { releaseYear: 2026 }, { _id: new mongoose.Types.ObjectId().toString() }]) {
    assert.throws(() => parseMovieCreateBody({ ...movieInput, ...bad }),
      (error) => error.statusCode === 400 && error.code === "INVALID_MOVIE_INPUT" && error.errors.length > 0);
  }
});

test("creation derives the release year and returns the existing Movie DTO", async () => {
  const service = createMovieService({
    async findByTitleAndYear(title, year) { assert.equal(title, movieInput.title); assert.equal(year, 2026); return null; },
    async create(data) {
      assert.equal(data.releaseYear, 2026);
      assert.equal(data.releaseDate.toISOString(), "2026-12-04T00:00:00.000Z");
      return { ...data, _id: new mongoose.Types.ObjectId() };
    },
  });
  const result = await service.createMovie(parseMovieCreateBody(movieInput));
  assert.equal(result.title, movieInput.title);
  assert.equal(result.status, "DRAFT");
  assert.equal(result.releaseYear, undefined);
});

test("creation blocks existing movies including archived records", async () => {
  const service = createMovieService({ async findByTitleAndYear() { return { status: "ARCHIVED" }; } });
  await assert.rejects(service.createMovie(parseMovieCreateBody(movieInput)),
    (error) => error.statusCode === 409 && error.code === "MOVIE_DUPLICATE");
});

test("concurrent DB uniqueness conflicts become the same duplicate response", async () => {
  const service = createMovieService({
    async findByTitleAndYear() { return null; },
    async create() { throw { code: 11000, keyPattern: { title: 1, releaseYear: 1 } }; },
  });
  await assert.rejects(service.createMovie(parseMovieCreateBody(movieInput)),
    (error) => error.statusCode === 409 && error.code === "MOVIE_DUPLICATE");
});
