import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { createMovieService as baseCreateMovieService } from "../src/modules/movie/movie.service.js";
import { createMovieRepository } from "../src/modules/movie/movie.repository.js";
import { parseManagerMovieListQuery, parseMovieUpdateBody } from "../src/modules/movie/movie.validation.js";
const createMovieService = (repository) => baseCreateMovieService(repository, { hasMovieReferences: async () => false });

const movieId = new mongoose.Types.ObjectId().toString();
const movie = {
  _id: new mongoose.Types.ObjectId(movieId), title: "A Film", synopsis: "Original synopsis",
  genres: ["Drama"], cast: ["Actor"], duration: 120, releaseDate: new Date("2026-12-04T00:00:00.000Z"),
  releaseYear: 2026, language: "Vietnamese", director: "Director", ageRating: "T13",
  posterUrl: "https://example.com/poster.jpg", trailerUrl: "", status: "DRAFT",
  updatedAt: new Date("2026-10-21T01:00:00.000Z"),
};

test("update metadata parser is sparse, trims text and accepts explicit optional clears", () => {
  assert.deepEqual(parseMovieUpdateBody({ title: " Updated Film " }), { title: "Updated Film" });
  assert.deepEqual(parseMovieUpdateBody({ genres: [" Drama ", "Action"], cast: [], trailerUrl: "" }),
    { genres: ["Drama", "Action"], cast: [], trailerUrl: "" });
  assert.deepEqual(parseMovieUpdateBody({ duration: 135 }), { duration: 135 });
  for (const duration of [0, -1, 1.5, "120", null]) assert.throws(() => parseMovieUpdateBody({ duration }));
});

test("runtime check fails closed before writes and scheduling rejects non-published movies", async () => {
  const failure = new Error("reference query unavailable");
  const repository = {
    async withSchedulingLock(_id, work) { return work(movie, { id: "transaction" }); },
    async updateInfo() { assert.fail("must not write when dependency check fails"); },
  };
  const service = baseCreateMovieService(repository, { async hasMovieReferences() { throw failure; } });
  await assert.rejects(service.updateMovie(movieId, { duration: 130 }), (error) => error === failure);
  await assert.rejects(service.withMovieForScheduling(movieId, () => assert.fail("DRAFT cannot be scheduled")),
    (error) => error.code === "MOVIE_NOT_FOUND");
});

test("update rejects invalid values, empty bodies, invalid duration, lifecycle and internal fields", () => {
  for (const body of [undefined, null, [], {}, { title: undefined }, { title: " " }, { synopsis: "" },
    { genres: [] }, { genres: [""] }, { cast: "Actor" }, { releaseDate: "2026-02-30" },
    { releaseDate: "2026-01-01T00:00:00Z" }, { language: "" }, { director: "" }, { ageRating: "" },
    { posterUrl: "javascript:alert(1)" }, { trailerUrl: "ftp://example.com/video" }, { title: "Valid", duration: 0 },
    { title: "Valid", status: "ARCHIVED" }, { releaseYear: 2027 }, { _id: movieId }, { updatedAt: "2026-01-01" },
    { $set: { title: "Injected" } }, { "title.x": "Injected" }]) {
    assert.throws(() => parseMovieUpdateBody(body),
      (error) => error.statusCode === 400 && error.code === "INVALID_MOVIE_INPUT" && error.errors.length > 0);
  }
});

test("management list validates bounded filters and rejects status overrides", () => {
  const parsed = parseManagerMovieListQuery({ q: " A Film ", page: "2", limit: "12" });
  assert.equal(parsed.q, "A Film");
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 12);
  for (const query of [{ status: "PUBLISHED" }, { page: 0 }, { limit: 25 },
    { releaseFrom: "2027-01-01", releaseTo: "2026-01-01" }, { $where: "injected" }]) {
    assert.throws(() => parseManagerMovieListQuery(query), (error) => error.code === "INVALID_QUERY");
  }
});

test("management detail reads each lifecycle and exposes only the management timestamp addition", async () => {
  for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"]) {
    const service = createMovieService({ async findById(id) { assert.equal(id, movieId); return { ...movie, status }; } });
    const result = await service.getManagerMovie(movieId);
    assert.equal(result.status, status);
    assert.equal(result.id, movieId);
    assert.equal(result.updatedAt, "2026-10-21T01:00:00.000Z");
    assert.equal(result.releaseYear, undefined);
    assert.equal(result._id, undefined);
  }
});

test("management service checks IDs before any repository call and reports missing records", async () => {
  const invalid = createMovieService({});
  for (const operation of [invalid.getManagerMovie("bad"), invalid.updateMovie("bad", { title: "New" })]) {
    await assert.rejects(operation, (error) => error.statusCode === 400 && error.code === "INVALID_MOVIE_ID");
  }
  const missing = createMovieService({ async findById() { return null; } });
  for (const operation of [missing.getManagerMovie(movieId), missing.updateMovie(movieId, { title: "New" })]) {
    await assert.rejects(operation, (error) => error.statusCode === 404 && error.code === "MOVIE_NOT_FOUND");
  }
});

test("update checks merged title/year excluding self and writes a sparse metadata patch", async () => {
  const service = createMovieService({
    async findById() { return movie; },
    async findByTitleAndYear(title, year, excludedId) {
      assert.equal(title, "Updated"); assert.equal(year, 2026); assert.equal(excludedId, movieId); return null;
    },
    async updateInfo(id, fields) {
      assert.equal(id, movieId);
      assert.deepEqual(fields, { title: "Updated", genres: ["Action"] });
      return { ...movie, ...fields };
    },
  });
  const result = await service.updateMovie(movieId, { title: "Updated", genres: ["Action"] });
  assert.equal(result.title, "Updated");
  assert.equal(result.duration, 120);
  assert.equal(result.status, "DRAFT");
  assert.equal(result.releaseDate, movie.releaseDate.toISOString());
});

test("release date update derives the UTC year and keeps a movie's lifecycle", async () => {
  const service = createMovieService({
    async findById() { return { ...movie, status: "ARCHIVED" }; },
    async findByTitleAndYear(title, year, excludedId) {
      assert.equal(title, movie.title); assert.equal(year, 2027); assert.equal(excludedId, movieId); return null;
    },
    async updateInfo(_id, fields) {
      assert.equal(fields.releaseYear, 2027);
      assert.equal(fields.releaseDate.toISOString(), "2027-01-01T00:00:00.000Z");
      assert.equal(fields.status, undefined);
      return { ...movie, status: "ARCHIVED", ...fields };
    },
  });
  assert.equal((await service.updateMovie(movieId, { releaseDate: "2027-01-01" })).status, "ARCHIVED");
});

test("update maps existing and concurrent title-year duplicates to the same error", async () => {
  for (const concurrency of [false, true]) {
    const service = createMovieService({
      async findById() { return movie; },
      async findByTitleAndYear() { return concurrency ? null : { ...movie, status: "ARCHIVED" }; },
      async updateInfo() {
        assert.ok(concurrency, "precheck must reject before persistence");
        throw { code: 11000, keyPattern: { title: 1, releaseYear: 1 } };
      },
    });
    await assert.rejects(service.updateMovie(movieId, { title: "Duplicate" }),
      (error) => error.statusCode === 409 && error.code === "MOVIE_DUPLICATE" && error.errors[0].field === "title");
  }
});

test("update reports deletion between read and write without returning success", async () => {
  const service = createMovieService({
    async findById() { return movie; }, async findByTitleAndYear() { return null; }, async updateInfo() { return null; },
  });
  await assert.rejects(service.updateMovie(movieId, { title: "New" }),
    (error) => error.statusCode === 404 && error.code === "MOVIE_NOT_FOUND");
});

test("update does not disguise unrelated database errors as duplicate movies", async () => {
  const driverError = Object.assign(new Error("Another unique index"), { code: 11000, keyPattern: { other: 1 } });
  const service = createMovieService({
    async findById() { return movie; }, async findByTitleAndYear() { return null; }, async updateInfo() { throw driverError; },
  });
  await assert.rejects(service.updateMovie(movieId, { title: "New" }), (error) => error === driverError);
});

test("repository excludes the current movie while retaining the exact title/UTC-year rule", async () => {
  const repository = createMovieRepository({
    findOne(filter) {
      assert.deepEqual(filter, { _id: { $ne: movieId }, title: "A Film", releaseDate: {
        $gte: new Date("2026-01-01T00:00:00.000Z"), $lt: new Date("2027-01-01T00:00:00.000Z"),
      } });
      return { async lean() { return null; } };
    },
  });
  await repository.findByTitleAndYear("A Film", 2026, movieId);
});

test("repository applies a validator-enabled atomic field whitelist and strips protected fields", async () => {
  const repository = createMovieRepository({
    findOneAndUpdate(filter, mutation, options) {
      assert.deepEqual(filter, { _id: movieId });
      assert.deepEqual(mutation, { $set: { title: "Safe", releaseDate: movie.releaseDate, releaseYear: 2026 } });
      assert.deepEqual(options, { returnDocument: "after", runValidators: true });
      return { async lean() { return movie; } };
    },
  });
  await repository.updateInfo(movieId, { title: "Safe", releaseDate: movie.releaseDate, releaseYear: 2026,
    status: "ARCHIVED", _id: "changed", createdAt: new Date(), $set: { title: "Injected" } });
});

test("management repository removes public status filtering and preserves query safety", async () => {
  const repository = createMovieRepository({
    find(filter) {
      assert.deepEqual(filter, { title: { $regex: "A\\.\\*", $options: "i" } });
      return { sort() { return this; }, skip() { return this; }, limit() { return this; }, async lean() { return [movie]; } };
    },
    async countDocuments(filter) { assert.equal(filter.status, undefined); return 1; },
  });
  const result = await repository.listForManagement(parseManagerMovieListQuery({ q: "A.*" }));
  assert.equal(result.total, 1);
});

test("management list maps the existing envelope and pagination for all statuses", async () => {
  const service = createMovieService({ async listForManagement() { return { movies: [movie], total: 13 }; } });
  const result = await service.listManagerMovies({ page: 2, limit: 12 });
  assert.equal(result.data[0].status, "DRAFT");
  assert.equal(result.data[0].updatedAt, movie.updatedAt.toISOString());
  assert.deepEqual(result.meta, { page: 2, limit: 12, total: 13, totalPages: 2 });
});
