import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { createMovieService } from "../src/modules/movie/movie.service.js";
import { parseMovieArchiveRequest } from "../src/modules/movie/movie.validation.js";
import { movieArchiveDependency } from "../src/modules/showtime/showtime-reference.service.js";

test("approved archive matrix covers statuses, stored end boundary and legacy intervals", () => {
  const now = new Date("2026-10-22T07:00:00Z");
  for (const status of ["DRAFT", "PUBLISHED"]) {
    for (const [start, end, blocked] of [[-2, -1, false], [-1, 0, false], [-1, 1, true], [0, 1, true], [1, 2, true]]) {
      const startAt = new Date(+now + start * 60000), endAt = new Date(+now + end * 60000);
      for (const dates of [{ startAt, endAt }, { startTime: startAt, endTime: endAt }]) {
        assert.equal(Boolean(movieArchiveDependency({ _id: "test", status, ...dates }, now)), blocked);
      }
    }
    for (const dates of [{}, { startAt: new Date(NaN), endAt: now }, { startAt: now, endAt: now },
      { startAt: new Date(+now + 1), endAt: now }, { startAt: "2026-01-01", endAt: "2026-01-02" }]) {
      assert.ok(movieArchiveDependency({ _id: "test", status, ...dates }, now));
    }
  }
  for (const dates of [{}, { startAt: new Date(+now + 60000), endAt: new Date(+now + 120000) }]) {
    assert.equal(movieArchiveDependency({ _id: "test", status: "CANCELLED", ...dates }, now), null);
  }
  for (const status of [undefined, "ACTIVE", "ENDED"]) {
    assert.ok(movieArchiveDependency({ _id: "test", status, startAt: new Date(+now - 120000), endAt: new Date(+now - 60000) }, now));
  }
});

const movie = { _id: new mongoose.Types.ObjectId(), title: "Archive me", duration: 120,
  releaseDate: new Date("2026-01-01"), status: "PUBLISHED", updatedAt: new Date("2026-01-01") };

test("archive accepts only an absent or empty body and no query fields", () => {
  parseMovieArchiveRequest(undefined, {});
  parseMovieArchiveRequest({}, {});
  for (const body of [null, [], "", { status: "ARCHIVED" }, { _id: movie.id }, { releaseYear: 2027 }]) {
    assert.throws(() => parseMovieArchiveRequest(body, {}), (error) => error.statusCode === 400);
  }
  assert.throws(() => parseMovieArchiveRequest({}, { force: "true" }));
});

test("archive validates IDs, reloads under guard and checks dependencies in that transaction", async () => {
  let writes = 0;
  const session = {};
  const service = createMovieService({
    findById: async () => movie,
    withSchedulingLock: async (id, work) => { assert.equal(id, String(movie._id)); return work(movie, session); },
    archive: async (id, activeSession) => { assert.equal(activeSession, session); writes++; return { ...movie, status: "ARCHIVED" }; },
  }, { getMovieArchiveBlockers: async (id, now, activeSession) => {
    assert.equal(id, String(movie._id)); assert.ok(now instanceof Date); assert.equal(activeSession, session); return [];
  } });
  await assert.rejects(service.archiveMovie("invalid"), (error) => error.code === "INVALID_MOVIE_ID");
  const result = await service.archiveMovie(String(movie._id));
  assert.equal(result.status, "ARCHIVED"); assert.equal(result.id, String(movie._id)); assert.equal(writes, 1);
});

test("archive reports missing movie and rejects new dependencies without writing", async () => {
  const missing = createMovieService({ findById: async () => null });
  await assert.rejects(missing.archiveMovie(String(movie._id)), (error) => error.code === "MOVIE_NOT_FOUND");
  const blockers = [{ id: "showtime-id", message: "Upcoming showtime" }];
  const service = createMovieService({ findById: async () => movie,
    withSchedulingLock: async (id, work) => work(movie, {}), archive: async () => assert.fail("must not write"),
  }, { getMovieArchiveBlockers: async () => blockers });
  await assert.rejects(service.archiveMovie(String(movie._id)), (error) => error.statusCode === 409 && error.errors[0].id === "showtime-id");
});

test("repeat archive is read-only and reference failures fail closed", async () => {
  const repeated = createMovieService({ findById: async () => ({ ...movie, status: "ARCHIVED" }) });
  assert.equal((await repeated.archiveMovie(String(movie._id))).updatedAt, movie.updatedAt.toISOString());
  const failure = new Error("reference query failed");
  const service = createMovieService({ findById: async () => movie,
    withSchedulingLock: async (id, work) => work(movie, {}), archive: async () => assert.fail("must not write"),
  }, { getMovieArchiveBlockers: async () => { throw failure; } });
  await assert.rejects(service.archiveMovie(String(movie._id)), (error) => error === failure);
});
