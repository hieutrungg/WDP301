import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { createMovieReviewService } from "../src/modules/movie/movie-review.service.js";
import { parseMovieReviewQuery } from "../src/modules/movie/movie-review.validation.js";

const oid = () => new mongoose.Types.ObjectId();
const record = () => ({ _id: oid(), customerAccountId: oid(), rating: 3,
  content: "Keep user text <script> & tiếng Việt\nunchanged", createdAt: new Date("2026-10-27T00:00:00Z"),
  storedFields: ["_id", "movieId", "customerAccountId", "rating", "content", "createdAt"],
});
const movies = { async getMovie() {} };

test("review query has fixed page size, strict query keys and safe page arithmetic", () => {
  assert.deepEqual(parseMovieReviewQuery({}), { page: 1 });
  assert.deepEqual(parseMovieReviewQuery({ page: "2" }), { page: 2 });
  for (const query of [{ page: "0" }, { page: "-1" }, { page: "1.5" }, { page: "" },
    { page: "1e3" }, { page: "9007199254740991" }, { page: ["1", "2"] },
    { limit: "10" }, { sort: "rating" }, { status: "HIDDEN" }]) {
    assert.throws(() => parseMovieReviewQuery(query), error => error.code === "INVALID_QUERY");
  }
});

test("review service returns exact DTO and numeric ratings 1–5 without private fields", async () => {
  for (let rating = 1; rating <= 5; rating++) {
    const item = { ...record(), rating, email: "private@example.test", phone: "private", passwordHash: "secret" };
    const service = createMovieReviewService({ async list() { return { items: [item], total: 11 }; } }, movies,
      async ids => new Map(ids.map(id => [id, "Display Name"])));
    const result = await service.list(oid().toString(), { page: 1 });
    assert.deepEqual(result.data[0], { id: item._id.toString(), authorDisplayName: "Display Name",
      rating, content: item.content, createdAt: item.createdAt.toISOString() });
    assert.deepEqual(result.meta, { page: 1, limit: 10, total: 11, totalPages: 2 });
  }
});

test("malformed legacy data fails closed without a fabricated rating or author", async () => {
  const cases = [
    ...[undefined, null, 0, 6, 1.5, NaN, "3"].map(rating => ({ rating })),
    { createdAt: undefined }, { createdAt: new Date("invalid") }, { content: null },
    { customerAccountId: undefined }, { storedFields: ["status"] }, { storedFields: ["isPublic"] },
    { storedFields: ["deletedAt"] },
  ];
  for (const patch of cases) {
    const service = createMovieReviewService({ async list() { return { items: [{ ...record(), ...patch }], total: 1 }; } }, movies,
      async ids => new Map(ids.map(id => [id, "Name"])));
    await assert.rejects(service.list(oid().toString(), { page: 1 }), /requires owner review/);
  }
  for (const name of [undefined, "", "  "]) {
    const service = createMovieReviewService({ async list() { return { items: [record()], total: 1 }; } }, movies,
      async ids => new Map(ids.map(id => [id, name])));
    await assert.rejects(service.list(oid().toString(), { page: 1 }), /requires owner review/);
  }
});

test("movie visibility is checked before any review or account read", async () => {
  const service = createMovieReviewService({ async list() { assert.fail("review read must not run"); } }, {
    async getMovie() { throw new Error("Movie not found"); },
  }, async () => assert.fail("account read must not run"));
  await assert.rejects(service.list(oid().toString(), { page: 1 }), /Movie not found/);
});

test("Decimal128 ratings must be exact integers before conversion to a JS number", async () => {
  for (const [text, accepted] of [["3.000", true], ["3E+0", true], ["3.000000000000000000000000001", false]]) {
    const item = { ...record(), rating: mongoose.mongo.Decimal128.fromString(text) };
    const service = createMovieReviewService({ async list() { return { items: [item], total: 1 }; } }, movies,
      async ids => new Map(ids.map(id => [id, "Name"])));
    if (accepted) assert.equal((await service.list(oid().toString(), { page: 1 })).data[0].rating, 3);
    else await assert.rejects(service.list(oid().toString(), { page: 1 }), /requires owner review/);
  }
});

test("empty and beyond-last pages preserve pagination with no author lookup", async () => {
  const service = createMovieReviewService({ async list() { return { items: [], total: 0 }; } }, movies,
    async ids => { assert.deepEqual(ids, []); return new Map(); });
  assert.deepEqual(await service.list(oid().toString(), { page: 3 }), {
    data: [], meta: { page: 3, limit: 10, total: 0, totalPages: 0 },
  });
});
