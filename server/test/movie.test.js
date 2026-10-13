import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MOVIE_STATUSES } from "../src/modules/movie/movie.constants.js";
import { Movie } from "../src/modules/movie/movie.model.js";
import {
  buildPublishedMovieFilter,
  createMovieRepository,
} from "../src/modules/movie/movie.repository.js";
import { createMovieService } from "../src/modules/movie/movie.service.js";
import { parseMovieListQuery } from "../src/modules/movie/movie.validation.js";

test("Movie model uses the approved lifecycle without colliding with Account", () => {
  assert.equal(Movie.modelName, "Movie");
  assert.deepEqual(Movie.schema.path("status").enumValues, Object.values(MOVIE_STATUSES));
  assert.equal(Movie.schema.path("status").defaultValue, MOVIE_STATUSES.DRAFT);
});

test("movie query trims blank search and applies bounded pagination", () => {
  const query = parseMovieListQuery({ q: "   ", genre: " Drama ", page: "2", limit: "12" });
  assert.equal(query.q, undefined);
  assert.equal(query.genre, "Drama");
  assert.equal(query.page, 2);
  assert.equal(query.limit, 12);
  assert.throws(() => parseMovieListQuery({ limit: "25" }), /Invalid movie query/);
  assert.throws(
    () => parseMovieListQuery({ releaseFrom: "2026-02-31" }),
    /Invalid movie query/,
  );
});

test("public movie filter always scopes results to PUBLISHED", () => {
  const filter = buildPublishedMovieFilter({ q: "Aurora", genre: "Adventure" });
  assert.equal(filter.status, MOVIE_STATUSES.PUBLISHED);
  assert.equal(filter.title.$options, "i");
  assert.equal(filter.genres.$regex, "^Adventure$");
});

test("movie repository applies the approved filter, sort and pagination", async () => {
  const calls = {};
  const query = {
    sort(value) {
      calls.sort = value;
      return this;
    },
    skip(value) {
      calls.skip = value;
      return this;
    },
    limit(value) {
      calls.limit = value;
      return this;
    },
    async lean() {
      return [{ _id: new mongoose.Types.ObjectId() }];
    },
  };
  const repository = createMovieRepository({
    find(filter) {
      calls.findFilter = filter;
      return query;
    },
    async countDocuments(filter) {
      calls.countFilter = filter;
      return 13;
    },
  });

  const result = await repository.listPublished({
    q: "Aurora.*",
    genre: "Science Fiction",
    language: "English",
    releaseFrom: "2026-01-01",
    releaseTo: "2026-12-31",
    page: 2,
    limit: 12,
    sort: "title",
    order: "asc",
  });

  assert.equal(result.total, 13);
  assert.equal(result.movies.length, 1);
  assert.equal(calls.findFilter.status, MOVIE_STATUSES.PUBLISHED);
  assert.equal(calls.findFilter.title.$regex, "Aurora\\.\\*");
  assert.equal(calls.findFilter.genres.$regex, "^Science Fiction$");
  assert.equal(calls.findFilter.language.$regex, "^English$");
  assert.equal(calls.findFilter.releaseDate.$gte.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(calls.findFilter.releaseDate.$lte.toISOString(), "2026-12-31T23:59:59.999Z");
  assert.deepEqual(calls.findFilter, calls.countFilter);
  assert.deepEqual(calls.sort, { title: 1, _id: 1 });
  assert.equal(calls.skip, 12);
  assert.equal(calls.limit, 12);
});

test("movie service maps list data and pagination metadata", async () => {
  const _id = new mongoose.Types.ObjectId();
  const service = createMovieService({
    async listPublished() {
      return {
        total: 1,
        movies: [
          {
            _id,
            title: "Aurora Station",
            synopsis: "Synopsis",
            genres: ["Science Fiction"],
            cast: [],
            duration: 118,
            releaseDate: new Date("2026-09-18T00:00:00.000Z"),
            language: "English",
            director: "An Le",
            ageRating: "T13",
            posterUrl: "https://example.com/poster.jpg",
            trailerUrl: "",
            status: MOVIE_STATUSES.PUBLISHED,
          },
        ],
      };
    },
  });

  const result = await service.listMovies({ page: 1, limit: 12 });
  assert.equal(result.data[0].id, _id.toString());
  assert.deepEqual(result.data[0].cast, []);
  assert.equal(result.meta.totalPages, 1);
});

test("movie service returns published detail and stable not-found errors", async (t) => {
  const _id = new mongoose.Types.ObjectId();
  const movie = {
    _id,
    title: "Aurora Station",
    synopsis: "Synopsis",
    genres: ["Science Fiction"],
    cast: ["Linh Nguyen"],
    duration: 118,
    releaseDate: new Date("2026-09-18T00:00:00.000Z"),
    language: "English",
    director: "An Le",
    ageRating: "T13",
    posterUrl: "https://example.com/poster.jpg",
    trailerUrl: "https://example.com/trailer",
    status: MOVIE_STATUSES.PUBLISHED,
  };

  await t.test("maps the complete public movie contract", async () => {
    const service = createMovieService({
      async findPublishedById(movieId) {
        assert.equal(movieId, _id.toString());
        return movie;
      },
    });

    const result = await service.getMovie(_id.toString());
    assert.equal(result.id, _id.toString());
    assert.deepEqual(result.cast, ["Linh Nguyen"]);
    assert.equal(result.releaseDate, "2026-09-18T00:00:00.000Z");
  });

  await t.test("does not expose missing, draft or archived movies", async () => {
    const service = createMovieService({
      async findPublishedById() {
        return null;
      },
    });

    await assert.rejects(
      service.getMovie(_id.toString()),
      (error) => error.statusCode === 404 && error.code === "MOVIE_NOT_FOUND",
    );
  });
});

let server;
let baseUrl;

before(async () => {
  const { default: app } = await import("../src/app.js");
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("movie routes reject invalid query and IDs with stable codes", async (t) => {
  await t.test("invalid query", async () => {
    const response = await fetch(`${baseUrl}/api/movies?page=0`);
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_QUERY");
  });

  await t.test("invalid ID", async () => {
    const response = await fetch(`${baseUrl}/api/movies/not-an-object-id`);
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_MOVIE_ID");
  });
});
