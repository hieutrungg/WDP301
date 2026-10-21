import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { migrateMovieCreateIndex } from "../src/migrations/20261020-movie-create-index.js";

test("MOV-101 Mongo/HTTP authorization, persistence and duplicate concurrency", { skip: !process.env.MONGODB_URI }, async (t) => {
  // A fresh, task-specific DB; never delete or mutate the configured development database.
  const dbName = `cinema_mov101_test_${process.pid}_${Date.now()}`;
  let server;
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { dbName, autoIndex: false, serverSelectionTimeoutMS: 10000 });
    const { Movie } = await import("../src/modules/movie/movie.model.js");
    const { Account } = await import("../src/modules/account/account.model.js");
    const { Role } = await import("../src/modules/role-permission/role.model.js");
    const { Permission } = await import("../src/modules/role-permission/permission.model.js");
    const { default: app } = await import("../src/app.js");
    const permission = await Permission.create({ name: "movie.create", description: "Create movies" });
    const [manager, admin] = await Role.create([
      { name: "MANAGER", permissionIds: [permission._id] },
      { name: "ADMIN", permissionIds: [permission._id] },
    ]);
    const createAccount = (username, roleIds, directPermissionIds = []) => Account.create({
      username, email: `${username}@example.com`, status: "ACTIVE", roleIds, directPermissionIds,
      profile: { fullName: username }, passwordHash: "test-only-unused-hash",
    });
    const allowed = await createAccount("mov101_manager", [manager._id]);
    const otherRole = await createAccount("mov101_admin", [admin._id]);
    const noPermission = await createAccount("mov101_ungranted", []);
    const secret = process.env.JWT_ACCESS_SECRET || "mov101-test-only-secret";
    process.env.JWT_ACCESS_SECRET = secret;
    const cookie = (account) => `accessToken=${jwt.sign({ sub: account._id.toString() }, secret, { expiresIn: "5m" })}`;
    const input = { title: "MOV101 Test Film", synopsis: "A test film", genres: ["Drama"], duration: 120,
      releaseDate: "2026-12-04", language: "Vietnamese", director: "Test Director", ageRating: "T13",
      posterUrl: "https://example.com/poster.jpg", status: "PUBLISHED" };
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const root = `http://127.0.0.1:${server.address().port}/api/movies`;
    const post = (body, account) => fetch(root, { method: "POST", headers: {
      "Content-Type": "application/json", ...(account ? { Cookie: cookie(account) } : {}),
    }, body: JSON.stringify(body) });

    await t.test("401 anonymous, 403 missing permission and wrong actor", async () => {
      assert.equal((await post(input)).status, 401);
      assert.equal((await post(input, noPermission)).status, 403);
      assert.equal((await post(input, otherRole)).status, 403);
    });
    await t.test("server returns field errors before persistence", async () => {
      const response = await post({ ...input, duration: -1 }, allowed);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).errors[0].field, "duration");
      assert.equal(await Movie.countDocuments(), 0);
    });
    await t.test("migration backfills legacy entries and is idempotent", async () => {
      await Movie.collection.insertOne({ ...input, title: "Legacy film", releaseDate: new Date("2025-01-01") });
      await migrateMovieCreateIndex(mongoose.connection.db);
      assert.equal((await Movie.collection.findOne({ title: "Legacy film" })).releaseYear, undefined);
      await migrateMovieCreateIndex(mongoose.connection.db, { apply: true });
      await migrateMovieCreateIndex(mongoose.connection.db, { apply: true });
      assert.equal((await Movie.collection.findOne({ title: "Legacy film" })).releaseYear, 2025);
    });
    await t.test("concurrent same-title/year submissions yield exactly one record", async () => {
      const responses = await Promise.all([post(input, allowed), post({ ...input, releaseDate: "2026-10-01" }, allowed)]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(await Movie.countDocuments({ title: input.title }), 1);
      const body = await responses.find((r) => r.status === 201).json();
      assert.equal((await fetch(`${root}/${body.data.id}`)).status, 200);
    });
    await t.test("the same title in another release year is allowed", async () => {
      assert.equal((await post({ ...input, releaseDate: "2027-01-01" }, allowed)).status, 201);
      assert.equal(await Movie.countDocuments({ title: input.title }), 2);
    });
    await t.test("archived movies still reserve their title and release year", async () => {
      await Movie.updateOne({ title: input.title, releaseYear: 2027 }, { $set: { status: "ARCHIVED" } });
      const response = await post({ ...input, releaseDate: "2027-08-01" }, allowed);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "MOVIE_DUPLICATE");
    });
    await t.test("draft stays private and direct grants are respected", async () => {
      noPermission.roleIds = [manager._id];
      // Remove role grant; the same permission is supplied via directPermissionIds.
      manager.permissionIds = [];
      await manager.save();
      noPermission.directPermissionIds = [permission._id];
      await noPermission.save();
      const response = await post({ ...input, title: "Draft film", status: "DRAFT" }, noPermission);
      assert.equal(response.status, 201);
      const { data } = await response.json();
      assert.equal((await fetch(`${root}/${data.id}`)).status, 404);
      noPermission.directPermissionIds = [];
      await noPermission.save();
      assert.equal((await post({ ...input, title: "Revoked film" }, noPermission)).status, 403);
    });
    await t.test("locked account cannot create", async () => {
      noPermission.status = "LOCKED";
      await noPermission.save();
      assert.equal((await post(input, noPermission)).status, 403);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
});
