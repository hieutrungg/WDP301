import assert from "node:assert/strict";
import { test } from "node:test";
import { createMovieReviewWriteService } from "../src/modules/movie/movie-review-write.service.js";
import { parseMovieReviewBody } from "../src/modules/movie/movie-review.validation.js";
import { isReviewUniqueIndex } from "../src/modules/movie/movie-review.indexes.js";
import { createReviewEligibilityService } from "../src/modules/booking/review-eligibility.service.js";

test("REV-102 body validates integer JSON ratings, optional unchanged content and 2000-character bound", () => {
  assert.deepEqual(parseMovieReviewBody({ rating: 1 }, {}), { rating: 1, content: "" });
  const content = "  Tiếng Việt\n<script>text</script>  ";
  assert.equal(parseMovieReviewBody({ rating: 5, content }, {}).content, content);
  assert.equal(parseMovieReviewBody({ rating: 2, content: "a".repeat(2000) }, {}).content.length, 2000);
  for (const body of [{}, { rating: "3" }, { rating: 0 }, { rating: 6 }, { rating: 2.5 },
    { rating: 1, content: null }, { rating: 1, content: "a".repeat(2001) },
    { rating: 1, accountId: "forged" }, { rating: 1, bookingId: "forged" }, { rating: 1, status: "PUBLIC" }]) {
    assert.throws(() => parseMovieReviewBody(body, {}), error => error.code === "INVALID_REVIEW_INPUT");
  }
  assert.throws(() => parseMovieReviewBody({ rating: 3 }, { spoof: "1" }), error => error.code === "INVALID_REVIEW_INPUT");
});

test("readiness requires a full non-sparse, unfiltered unique customer/movie index", () => {
  const base = { key: { movieId: 1, customerAccountId: 1 }, unique: true };
  assert.equal(isReviewUniqueIndex(base), true);
  for (const patch of [{ unique: false }, { sparse: true }, { partialFilterExpression: { rating: { $gt: 0 } } },
    { key: { movieId: 1 } }, { collation: { locale: "en", strength: 2 } }]) {
    assert.equal(isReviewUniqueIndex({ ...base, ...patch }), false);
  }
});

const repo = (patch = {}) => ({
  async ready() { return true; }, async findOwn() { return null; },
  async withTransaction(work) { return work("transaction"); },
  async insert(input, session) { assert.equal(session, "transaction"); return { ...input, _id: "review-id", createdAt: input.now }; },
  ...patch,
});
const make = (options = {}) => createMovieReviewWriteService({ repository: repo(), movies: { async getMovie() {} },
  eligibility: { async canReview() { return true; } }, authors: async () => new Map([["account", "Name"]]),
  clock: () => new Date("2026-10-27T00:00:00Z"), ...options });

test("write fails closed before insert when index, identity name or eligibility is missing", async () => {
  for (const [options, code] of [
    [{ repository: repo({ async ready() { return false; } }) }, "REVIEW_WRITE_NOT_READY"],
    [{ authors: async () => new Map() }, "REVIEW_AUTHOR_NAME_REQUIRED"],
    [{ eligibility: { async canReview() { return false; } } }, "REVIEW_NOT_ELIGIBLE"],
    [{ repository: repo({ async findOwn() { return { _id: "already" }; } }) }, "REVIEW_ALREADY_EXISTS"],
  ]) await assert.rejects(make(options).submit("movie", "account", { rating: 3, content: "" }), e => e.code === code);
});

test("POST rechecks locked eligibility and returns only the public DTO after confirmed insert", async () => {
  let checked = false;
  const service = make({ eligibility: { async canReview(command) {
    assert.equal(command.lock, true); assert.equal(command.session, "transaction"); checked = true; return true;
  } } });
  const result = await service.submit("movie", "account", { rating: 5, content: "unchanged" });
  assert.equal(checked, true);
  assert.deepEqual(result, { id: "review-id", authorDisplayName: "Name", rating: 5, content: "unchanged", createdAt: "2026-10-27T00:00:00.000Z" });
});

test("duplicate insert conflicts and unavailable transaction infrastructure have stable errors", async () => {
  for (const [dbCode, code] of [[11000, "REVIEW_ALREADY_EXISTS"], [20, "REVIEW_WRITE_NOT_READY"]]) {
    await assert.rejects(make({ repository: repo({ async withTransaction() { throw Object.assign(new Error("db"), { code: dbCode }); } }) })
      .submit("movie", "account", { rating: 3, content: "" }), e => e.code === code);
  }
});

test("eligibility does not cap at fifty historical bookings and skips refunded/unpaid candidates", async () => {
  const rows = Array.from({ length: 52 }, (_, i) => ({ _id: `${i}`, showtimeId: `s${i}`, paymentId: `p${i}` }));
  let closed = false;
  const query = { select() { return this; }, sort() { return this; }, session() { return this; }, lean() { return this; },
    cursor() { return { async *[Symbol.asyncIterator]() { yield* rows; }, async close() { closed = true; } }; } };
  const eligibility = createReviewEligibilityService({ bookings: { find(filter) { assert.equal(filter.status, "CONFIRMED"); return query; } },
    endedShowtime: async () => true, unsettledRefund: async ({ bookingId }) => bookingId === "50",
    paidBooking: async ({ bookingId }) => bookingId === "51" });
  assert.equal(await eligibility.canReview({ accountId: "account", movieId: "movie", now: new Date() }), true);
  assert.equal(closed, true);
});

const existingReview = () => ({ _id: "review-id", movieId: "movie", customerAccountId: "account",
  rating: 2, content: "Original", createdAt: new Date("2026-10-26T00:00:00Z") });
test("editing locks eligibility, scopes the update to the authenticated owner and preserves createdAt", async () => {
  let checked = false;
  const service = make({ repository: repo({
    async readOwn(movieId, accountId, session) {
      assert.equal(movieId, "movie"); assert.equal(accountId, "account");
      assert.equal(session, "transaction"); return existingReview();
    },
    async updateOwn(command, session) {
      assert.ok(checked); assert.equal(session, "transaction");
      assert.equal(command.accountId, "account"); assert.equal(command.reviewId, "review-id");
      assert.equal(command.movieId, "movie");
      return { ...existingReview(), rating: command.rating, content: command.content, updatedAt: command.now };
    },
  }), eligibility: { async canReview(command) {
    assert.equal(command.lock, true); assert.equal(command.session, "transaction"); checked = true; return true;
  } } });
  assert.deepEqual(await service.edit("movie", "account", { rating: 5, content: "Updated" }), {
    id: "review-id", authorDisplayName: "Name", rating: 5, content: "Updated", createdAt: "2026-10-26T00:00:00.000Z",
  });
});

test("edit fails without writing for missing own review, legacy state, lost eligibility or infrastructure", async () => {
  for (const [options, code] of [
    [{ repository: repo({ async ready() { return false; } }) }, "REVIEW_WRITE_NOT_READY"],
    [{ review: null }, "REVIEW_NOT_FOUND"],
    [{ review: { ...existingReview(), status: "HIDDEN" } }, "REVIEW_WRITE_NOT_READY"],
    [{ eligibility: { async canReview() { return false; } } }, "REVIEW_NOT_ELIGIBLE"],
    [{ authors: async () => new Map() }, "REVIEW_AUTHOR_NAME_REQUIRED"],
  ]) {
    const { review = existingReview(), ...dependencies } = options;
    const repository = dependencies.repository ?? repo({ async readOwn() { return review; },
      async updateOwn() { assert.fail("must not update"); } });
    await assert.rejects(make({ ...dependencies, repository }).edit("movie", "account", { rating: 4, content: "" }), e => e.code === code);
  }
});
