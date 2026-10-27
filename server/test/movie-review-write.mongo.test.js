import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { migrateMovieReviewIndex } from "../src/migrations/20261027-movie-review-unique-index.js";

test("REV-102 Mongo/HTTP eligibility, migration safety and concurrent submissions", { skip: !process.env.MONGODB_URI }, async t => {
  const dbName = `rev102_test_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  let server;
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;
    assert.equal(db.databaseName, dbName);
    const oid = () => new mongoose.Types.ObjectId();
    const customerId = oid(), staffId = oid(), otherId = oid(), movieId = oid(), otherMovieId = oid(), draftId = oid();
    const roleId = oid(), staffRoleId = oid(), showtimeId = oid(), bookingId = oid(), paymentId = oid();
    const now = new Date();
    await db.createCollection("movie_reviews");
    await db.collection("roles").insertMany([{ _id: roleId, name: "CUSTOMER", permissionIds: [] }, { _id: staffRoleId, name: "STAFF", permissionIds: [] }]);
    await db.collection("accounts").insertMany([
      { _id: customerId, username: "review-customer", email: "private@example.test", phone: "private", status: "ACTIVE", roleIds: [roleId], directPermissionIds: [], profile: { fullName: "Review Author" } },
      { _id: otherId, username: "other-customer", status: "ACTIVE", roleIds: [roleId], profile: { fullName: "Other" } },
      { _id: staffId, username: "staff", status: "ACTIVE", roleIds: [staffRoleId] },
    ]);
    const movie = { title: "REV102 test-only", synopsis: "Test", genres: [], cast: [], duration: 120, releaseDate: now,
      language: "English", director: "Test", ageRating: "T13", posterUrl: "test", status: "PUBLISHED" };
    await db.collection("movies").insertMany([{ ...movie, _id: movieId }, { ...movie, _id: otherMovieId }, { ...movie, _id: draftId, status: "DRAFT" }]);
    await db.collection("showtimes").insertOne({ _id: showtimeId, movieId, status: "PUBLISHED", startAt: new Date(now.getTime() - 7200000), endAt: new Date(now.getTime() - 1) });
    await db.collection("bookings").insertOne({ _id: bookingId, customerAccountId: customerId, showtimeId, paymentId, status: "CONFIRMED", updatedAt: now });
    await db.collection("payments").insertOne({ _id: paymentId, bookingId, customerAccountId: customerId, status: "PAID", updatedAt: now });
    const { default: app } = await import("../src/app.js");
    await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api/movies`;
    const secret = process.env.JWT_ACCESS_SECRET || "rev102-test-secret";
    process.env.JWT_ACCESS_SECRET = secret;
    const cookie = accountId => ({ Cookie: `accessToken=${jwt.sign({ sub: accountId.toString() }, secret, { expiresIn: "5m" })}` });
    const get = (id = movieId, actor = customerId, query = "") => fetch(`${base}/${id}/review-eligibility${query}`, { headers: actor ? cookie(actor) : {} });
    const post = (body = { rating: 3, content: "  Test-only tiếng Việt\n<script>text</script>  " }, actor = customerId, id = movieId) => fetch(`${base}/${id}/reviews`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(actor ? cookie(actor) : {}) }, body: JSON.stringify(body),
    });

    await t.test("backend guards enforce Guest/Staff/locked-account boundaries", async () => {
      assert.equal((await get(movieId, null)).status, 401);
      assert.equal((await post({ rating: 3 }, null)).status, 401);
      assert.equal((await get(movieId, staffId)).status, 403);
      assert.equal((await post({ rating: 3 }, staffId)).status, 403);
      await db.collection("accounts").updateOne({ _id: customerId }, { $set: { status: "LOCKED" } });
      assert.equal((await post()).status, 403);
      await db.collection("accounts").updateOne({ _id: customerId }, { $set: { status: "ACTIVE" } });
    });
    await t.test("ready check is read-only; POST fails safely before index rollout", async () => {
      assert.deepEqual((await (await get()).json()).data, { canReview: true, reason: null });
      const response = await post();
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "REVIEW_WRITE_NOT_READY");
      assert.equal(await db.collection("movie_reviews").countDocuments(), 0);
      assert.equal((await db.collection("payments").findOne({ _id: paymentId })).updatedAt.getTime(), now.getTime());
    });
    await t.test("migration dry run, malformed/hidden data and duplicate preflights never mutate records", async () => {
      const valid = { _id: oid(), movieId, customerAccountId: customerId, rating: 3, content: "test only", createdAt: now };
      for (const patch of [{ rating: 0 }, { status: "HIDDEN" }, { customerAccountId: oid() }]) {
        const invalid = { ...valid, ...patch };
        await db.collection("movie_reviews").insertOne(invalid);
        await assert.rejects(migrateMovieReviewIndex(db, { apply: true }));
        assert.equal(await db.collection("movie_reviews").countDocuments(), 1);
        assert.equal((await db.collection("movie_reviews").listIndexes().toArray()).length, 1);
        await db.collection("movie_reviews").deleteMany({});
      }
      await db.collection("movie_reviews").insertMany([valid, { ...valid, _id: oid() }]);
      await assert.rejects(migrateMovieReviewIndex(db, { apply: true }), /Duplicate/);
      assert.equal(await db.collection("movie_reviews").countDocuments(), 2);
      await db.collection("movie_reviews").deleteMany({});
      assert.equal((await migrateMovieReviewIndex(db)).applied, false);
      assert.equal((await db.collection("movie_reviews").listIndexes().toArray()).length, 1);
      assert.equal((await migrateMovieReviewIndex(db, { apply: true })).applied, true);
      assert.equal((await migrateMovieReviewIndex(db, { apply: true })).alreadyReady, true);
    });
    await t.test("eligibility rejects unpaid/future/wrong-owner/wrong-movie/refunded and unsettled refund cases", async () => {
      assert.equal((await (await get(otherMovieId)).json()).data.canReview, false);
      assert.equal((await (await get(movieId, otherId)).json()).data.canReview, false);
      for (const [collection, id, field, invalid, original] of [
        ["payments", paymentId, "status", "PENDING", "PAID"],
        ["payments", paymentId, "status", "REFUNDED", "PAID"],
        ["payments", paymentId, "status", "PARTIALLY_REFUNDED", "PAID"],
        ["payments", paymentId, "customerAccountId", otherId, customerId],
        ["payments", paymentId, "bookingId", oid(), bookingId],
        ["bookings", bookingId, "status", "REFUNDED", "CONFIRMED"],
        ["showtimes", showtimeId, "status", "CANCELLED", "PUBLISHED"],
        ["showtimes", showtimeId, "endAt", new Date(now.getTime() + 86400000), new Date(now.getTime() - 1)],
      ]) {
        await db.collection(collection).updateOne({ _id: id }, { $set: { [field]: invalid } });
        assert.equal((await (await get()).json()).data.canReview, false, `${collection}.${field}`);
        assert.equal((await post()).status, 403);
        await db.collection(collection).updateOne({ _id: id }, { $set: { [field]: original } });
      }
      for (const status of ["REQUESTED", "PROCESSING", "FAILED", "REFUNDED"]) {
        await db.collection("refund_requests").insertOne({ bookingId, status });
        assert.equal((await (await get()).json()).data.canReview, false);
        assert.equal((await post()).status, 403);
        await db.collection("refund_requests").deleteMany({});
      }
      await db.collection("refund_requests").insertOne({ bookingId, status: "REJECTED" });
      assert.equal((await (await get()).json()).data.canReview, true);
    });
    await t.test("validation cannot spoof owner/status; invalid/private movies and missing display name", async () => {
      for (const body of [{ rating: 0 }, { rating: "3" }, { rating: 2.5 }, { rating: 3, content: "x".repeat(2001) }, { rating: 3, accountId: otherId }, { rating: 3, status: "PUBLIC" }]) assert.equal((await post(body)).status, 400);
      assert.equal((await get(movieId, customerId, "?page=1")).status, 400);
      assert.equal((await post({ rating: 3 }, customerId, "invalid")).status, 400);
      assert.equal((await post({ rating: 3 }, customerId, oid())).status, 404);
      assert.equal((await post({ rating: 3 }, customerId, draftId)).status, 404);
      await db.collection("accounts").updateOne({ _id: customerId }, { $unset: { "profile.fullName": 1 } });
      assert.equal((await (await get()).json()).data.reason, "AUTHOR_NAME_REQUIRED");
      assert.equal((await post()).status, 409);
      await db.collection("accounts").updateOne({ _id: customerId }, { $set: { "profile.fullName": "Review Author" } });
    });
    await t.test("stored endAt is inclusive; another refunded booking does not disqualify the valid one", async () => {
      const { isEndedShowtimeForReview } = await import("../src/modules/showtime/review-showtime.service.js");
      const endAt = (await db.collection("showtimes").findOne({ _id: showtimeId })).endAt;
      assert.equal(await isEndedShowtimeForReview({ showtimeId, movieId, now: endAt }), true);
      assert.equal(await isEndedShowtimeForReview({ showtimeId, movieId, now: new Date(endAt.getTime() - 1) }), false);
      await db.collection("bookings").insertOne({ _id: oid(), customerAccountId: customerId, showtimeId, status: "REFUNDED" });
      assert.equal((await (await get()).json()).data.canReview, true);
    });
    await t.test("concurrent submits create once, preserve content, immediately appear in REV-101 and retries conflict", async () => {
      const responses = await Promise.all([post(), post()]);
      assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
      assert.equal(await db.collection("movie_reviews").countDocuments(), 1);
      const published = (await responses.find(response => response.status === 201).json()).data;
      assert.deepEqual(Object.keys(published).sort(), ["id", "authorDisplayName", "rating", "content", "createdAt"].sort());
      assert.equal(published.content, "  Test-only tiếng Việt\n<script>text</script>  ");
      const read = await (await fetch(`${base}/${movieId}/reviews`)).json();
      assert.deepEqual(read.data[0], published);
      assert.equal(JSON.stringify(read).includes("private"), false);
      assert.equal((await (await get()).json()).data.reason, "ALREADY_REVIEWED");
      assert.equal((await post()).status, 409);
    });
    await t.test("a refund settling after the transaction snapshot cannot slip past the paid guard", async () => {
      await db.collection("movie_reviews").deleteMany({});
      const { createMovieReviewWriteService } = await import("../src/modules/movie/movie-review-write.service.js");
      const { createReviewEligibilityService } = await import("../src/modules/booking/review-eligibility.service.js");
      const { hasPaidBookingForReview } = await import("../src/modules/payment/review-payment.service.js");
      let settled = false;
      const eligibility = createReviewEligibilityService({ paidBooking: async command => {
        if (!settled) {
          settled = true;
          await db.collection("payments").updateOne({ _id: paymentId }, { $set: { status: "REFUNDED" } });
        }
        return hasPaidBookingForReview(command);
      } });
      const service = createMovieReviewWriteService({ eligibility });
      await assert.rejects(service.submit(movieId.toString(), customerId.toString(), { rating: 3, content: "" }), e => e.code === "REVIEW_NOT_ELIGIBLE");
      assert.equal(await db.collection("movie_reviews").countDocuments(), 0);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === dbName && /^rev102_test_[a-f0-9]{24}$/.test(dbName)) await mongoose.connection.dropDatabase();
    } finally { await mongoose.disconnect(); }
  }
});
