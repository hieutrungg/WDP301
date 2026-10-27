import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { configureMongoDns } from "../src/config/mongo-dns.js";

test("REV-101 real MongoDB and public HTTP read contract", { skip: !process.env.MONGODB_URI }, async t => {
  const dbName = `rev101_test_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  let server;
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;
    assert.equal(db.databaseName, dbName);
    const oid = () => new mongoose.Types.ObjectId();
    const movieId = oid(), otherMovieId = oid(), privateMovieId = oid(), accountId = oid();
    const movie = { title: "REV101 test only", synopsis: "Test", genres: [], cast: [], duration: 120,
      releaseDate: new Date(), language: "English", director: "Test", ageRating: "T13", posterUrl: "test", status: "PUBLISHED" };
    await db.collection("movies").insertMany([{ ...movie, _id: movieId }, { ...movie, _id: otherMovieId }, { ...movie, _id: privateMovieId, status: "DRAFT" }]);
    await db.collection("accounts").insertOne({ _id: accountId, profile: { fullName: "Public Name", address: "private" },
      email: "secret@example.test", phone: "private", passwordHash: "secret", username: "internal", directPermissionIds: [oid()] });
    const reviews = Array.from({ length: 12 }, (_, index) => ({ _id: oid(), movieId, customerAccountId: accountId,
      rating: index % 5 + 1, ...(index === 0 ? {} : { content: `test-only-${index} <b>text</b>` }),
      createdAt: new Date(index < 6 ? "2026-10-25T00:00:00Z" : "2026-10-26T00:00:00Z") }));
    await db.collection("movie_reviews").insertMany([...reviews, { _id: oid(), movieId: otherMovieId, customerAccountId: accountId, rating: 1, content: "other movie", createdAt: new Date() }]);
    const { default: app } = await import("../src/app.js");
    await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
    const root = `http://127.0.0.1:${server.address().port}/api/movies`;
    const get = (path, headers = {}) => fetch(`${root}/${path}`, { headers });
    await t.test("guest and cookie-bearing reader see only the chosen movie, stable tie order, fixed pages and allowlist", async () => {
      const expected = [...reviews].sort((a, b) => b.createdAt - a.createdAt || b._id.toString().localeCompare(a._id.toString()));
      const firstResponse = await get(`${movieId}/reviews`);
      assert.equal(firstResponse.status, 200);
      const first = await firstResponse.json();
      const accessToken = jwt.sign({ sub: accountId.toString() }, process.env.JWT_ACCESS_SECRET || "rev101-test-secret", { expiresIn: "5m" });
      const second = await (await get(`${movieId}/reviews?page=2`, { Cookie: `accessToken=${accessToken}` })).json();
      assert.deepEqual(first.data.map(r => r.id), expected.slice(0, 10).map(r => r._id.toString()));
      assert.deepEqual(second.data.map(r => r.id), expected.slice(10).map(r => r._id.toString()));
      assert.deepEqual(first.meta, { page: 1, limit: 10, total: 12, totalPages: 2 });
      assert.equal(second.data.find(r => r.id === reviews[0]._id.toString()).content, "");
      assert.deepEqual(Object.keys(first.data[0]).sort(), ["id", "authorDisplayName", "rating", "content", "createdAt"].sort());
      assert.ok(first.data.every(r => r.authorDisplayName === "Public Name"));
      assert.ok(!JSON.stringify(first).includes("secret"));
      assert.deepEqual((await (await get(`${movieId}/reviews?page=3`)).json()).data, []);
      assert.equal((await (await get(`${otherMovieId}/reviews`)).json()).data[0].content, "other movie");
    });
    await t.test("invalid syntax, nonexistent and private movies, unsupported query", async () => {
      for (const [path, status, code] of [
        ["invalid/reviews", 400, "INVALID_MOVIE_ID"], [`${oid()}/reviews`, 404, "MOVIE_NOT_FOUND"],
        [`${privateMovieId}/reviews`, 404, "MOVIE_NOT_FOUND"], [`${movieId}/reviews?page=0`, 400, "INVALID_QUERY"],
        [`${movieId}/reviews?limit=10`, 400, "INVALID_QUERY"],
      ]) { const res = await get(path); assert.equal(res.status, status); assert.equal((await res.json()).code, code); }
    });
    await t.test("legacy visibility and malformed rating are never published or repaired", async () => {
      const target = reviews[11]._id;
      for (const patch of [{ rating: 0 }, { rating: 2.5 }, { status: "REJECTED" }, { hidden: true }]) {
        await db.collection("movie_reviews").updateOne({ _id: target }, { $set: patch });
        const response = await get(`${movieId}/reviews`);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { success: false, message: "Internal server error", errors: [] });
        await db.collection("movie_reviews").replaceOne({ _id: target }, reviews[11]);
      }
    });
    await t.test("empty movie and unchanged development-index strategy", async () => {
      await db.collection("movie_reviews").deleteMany({ movieId: otherMovieId });
      const empty = await (await get(`${otherMovieId}/reviews`)).json();
      assert.deepEqual(empty, { success: true, data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      assert.deepEqual((await db.collection("movie_reviews").listIndexes().toArray()).map(i => i.name), ["_id_"]);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === dbName && /^rev101_test_[a-f0-9]{24}$/.test(dbName)) {
        await mongoose.connection.dropDatabase();
      }
    } finally { await mongoose.disconnect(); }
  }
});
