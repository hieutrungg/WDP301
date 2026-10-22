import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { migrateMovieCreateIndex } from "../src/migrations/20261020-movie-create-index.js";

test("MOV-103 isolated Mongo/HTTP archive and scheduling concurrency", { skip: !process.env.MONGODB_URI }, async (t) => {
  const dbName = `cinema_mov103_test_${process.pid}_${Date.now()}`;
  let server;
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { dbName, autoIndex: false, monitorCommands: true, serverSelectionTimeoutMS: 10000 });
    const { Movie } = await import("../src/modules/movie/movie.model.js");
    const { Account } = await import("../src/modules/account/account.model.js");
    const { Role } = await import("../src/modules/role-permission/role.model.js");
    const { Permission } = await import("../src/modules/role-permission/permission.model.js");
    const { movieService, createMovieService } = await import("../src/modules/movie/movie.service.js");
    const { movieRepository } = await import("../src/modules/movie/movie.repository.js");
    const { showtimeReferenceService } = await import("../src/modules/showtime/showtime-reference.service.js");
    const { createShowtimePublisher } = await import("../src/modules/showtime/showtime.service.js");
    const { default: app } = await import("../src/app.js");
    await migrateMovieCreateIndex(mongoose.connection.db, { apply: true });
    const [archivePermission, updatePermission] = await Permission.create([
      { name: "movie.archive", description: "Archive" }, { name: "movie.update", description: "Read/edit management" },
    ]);
    const [managerRole, adminRole, emptyRole] = await Role.create([
      { name: "MANAGER", permissionIds: [archivePermission._id, updatePermission._id] },
      { name: "ADMIN", permissionIds: [archivePermission._id] }, { name: "MANAGER", permissionIds: [] },
    ]);
    const makeAccount = (username, role, directPermissionIds = []) => Account.create({
      username, email: `${username}@example.com`, status: "ACTIVE", roleIds: [role._id], directPermissionIds,
      profile: { fullName: username }, passwordHash: "unused-test-hash",
    });
    const manager = await makeAccount("archive_manager", managerRole);
    const wrongActor = await makeAccount("archive_admin", adminRole);
    const ungranted = await makeAccount("archive_ungranted", emptyRole);
    const direct = await makeAccount("archive_direct", emptyRole, [archivePermission._id]);
    process.env.JWT_ACCESS_SECRET ||= "mov103-test-only-secret";
    const cookie = (account) => `accessToken=${jwt.sign({ sub: account.id }, process.env.JWT_ACCESS_SECRET, { expiresIn: "10m" })}`;
    const input = { title: "Archive", synopsis: "Original", genres: ["Drama"], cast: ["Actor"], duration: 120,
      releaseDate: new Date("2026-01-01"), language: "Vietnamese", director: "Director", ageRating: "T13",
      posterUrl: "https://example.com/poster.jpg", status: "PUBLISHED" };
    let sequence = 0;
    const makeMovie = (fields = {}) => Movie.create({ ...input, title: `MOV103 ${++sequence}`, ...fields });
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const root = `http://127.0.0.1:${server.address().port}/api/movies`;
    const archive = (id, account = manager, body = {}, query = "") => fetch(`${root}/${id}/archive${query}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(account ? { Cookie: cookie(account) } : {}) }, body: JSON.stringify(body),
    });
    const get = (path, account) => fetch(`${root}${path}`, { headers: account ? { Cookie: cookie(account) } : {} });
    const collection = (name) => mongoose.connection.db.collection(name);

    await t.test("401/403, current direct grants/revocation/account lock, and no expanded read permission", async () => {
      const movie = await makeMovie();
      for (const [account, expected] of [[null, 401], [wrongActor, 403], [ungranted, 403]]) {
        assert.equal((await archive(movie.id, account)).status, expected);
      }
      assert.equal((await get("/manage", direct)).status, 403, "archive grant must not grant catalog read");
      assert.equal((await archive(movie.id, direct)).status, 200);
      await Account.updateOne({ _id: direct._id }, { $set: { directPermissionIds: [] } });
      assert.equal((await archive(movie.id, direct)).status, 403);
      await Account.updateOne({ _id: direct._id }, { $set: { directPermissionIds: [archivePermission._id], status: "LOCKED" } });
      assert.equal((await archive(movie.id, direct)).status, 403);
      await Role.updateOne({ _id: managerRole._id }, { $pull: { permissionIds: archivePermission._id } });
      assert.equal((await archive(movie.id)).status, 403);
      await Role.updateOne({ _id: managerRole._id }, { $addToSet: { permissionIds: archivePermission._id } });
    });

    await t.test("invalid/missing ID and strict body/query cannot mutate fields", async () => {
      for (const [id, status, code] of [["bad", 400, "INVALID_MOVIE_ID"], [new mongoose.Types.ObjectId(), 404, "MOVIE_NOT_FOUND"]]) {
        const response = await archive(id); assert.equal(response.status, status); assert.equal((await response.json()).code, code);
      }
      const movie = await makeMovie();
      for (const body of [{ status: "ARCHIVED" }, { releaseYear: 2099 }, { force: true }, { updatedAt: new Date() }, null, []]) {
        assert.equal((await archive(movie.id, manager, body)).status, 400);
      }
      assert.equal((await archive(movie.id, manager, {}, "?force=true")).status, 400);
      assert.equal((await Movie.findById(movie.id)).status, "PUBLISHED");
    });

    await t.test("eligible draft/published archive preserves all metadata; repeated HTTP request is read-only", async () => {
      for (const status of ["DRAFT", "PUBLISHED"]) {
        const movie = await makeMovie({ status });
        const before = await Movie.findById(movie.id).lean();
        const first = await archive(movie.id); assert.equal(first.status, 200);
        const data = (await first.json()).data; assert.equal(data.status, "ARCHIVED"); assert.equal(data.id, movie.id);
        const after = await Movie.findById(movie.id).lean();
        assert.deepEqual({ ...after, status: before.status, updatedAt: before.updatedAt, __v: before.__v }, before);
        assert.ok(after.updatedAt >= before.updatedAt);
        assert.equal((await archive(movie.id)).status, 200);
        assert.deepEqual(await Movie.findById(movie.id).lean(), after);
        const manage = await (await get(`/${movie.id}/manage`, manager)).json(); assert.equal(manage.data.status, "ARCHIVED");
        assert.equal((await get(`/${movie.id}`)).status, 404);
        const publicList = await (await get(`?q=${encodeURIComponent(movie.title)}`)).json(); assert.equal(publicList.data.length, 0);
      }
    });

    await t.test("approved status/time matrix and legacy cases use real reference query; rejection rolls back guard", async () => {
      const now = Date.now();
      const cases = [];
      for (const status of ["DRAFT", "PUBLISHED", "CANCELLED"]) {
        for (const [start, end, label] of [[-120000, -60000, "ended"], [-60000, 60000, "running"], [60000, 120000, "future"]]) {
          for (const legacy of [false, true]) cases.push({ status, start, end, label, legacy, allowed: status === "CANCELLED" || end < 0 });
        }
      }
      for (const scenario of cases) {
        const movie = await makeMovie();
        const dates = scenario.legacy ? { startTime: new Date(now + scenario.start), endTime: new Date(now + scenario.end) }
          : { startAt: new Date(now + scenario.start), endAt: new Date(now + scenario.end) };
        const showtime = { _id: new mongoose.Types.ObjectId(), movieId: movie._id, status: scenario.status, ...dates };
        await collection("showtimes").insertOne(showtime);
        const before = await Movie.findById(movie.id).lean();
        const response = await archive(movie.id); assert.equal(response.status, scenario.allowed ? 200 : 409, JSON.stringify(scenario));
        if (!scenario.allowed) {
          const body = await response.json(); assert.equal(body.code, "INVALID_MOVIE_INPUT"); assert.equal(body.errors[0].id, String(showtime._id));
          assert.deepEqual(await Movie.findById(movie.id).lean(), before);
        }
        assert.deepEqual(await collection("showtimes").findOne({ _id: showtime._id }), showtime);
      }
      for (const fields of [{ status: "DRAFT" }, { status: "PUBLISHED", startAt: new Date(), endAt: new Date(0) },
        { status: "ACTIVE", startAt: new Date(0), endAt: new Date(1) }, {}]) {
        const movie = await makeMovie(); await collection("showtimes").insertOne({ movieId: movie._id, ...fields });
        assert.equal((await archive(movie.id)).status, 409);
      }
      const cancelled = await makeMovie(); await collection("showtimes").insertOne({ movieId: cancelled._id, status: "CANCELLED" });
      assert.equal((await archive(cancelled.id)).status, 200);
    });

    await t.test("ended history and snapshots/booking/payment/ticket documents remain byte-for-byte equivalent", async () => {
      const movie = await makeMovie();
      const showtimeId = new mongoose.Types.ObjectId();
      const showtime = { _id: showtimeId, movieId: movie._id, status: "PUBLISHED", startAt: new Date("2020-01-01"), endAt: new Date("2020-01-02"), roomLayoutVersion: 3, movieSnapshot: { title: movie.title, duration: 120 } };
      await collection("showtimes").insertOne(showtime);
      const originals = {};
      for (const name of ["bookings", "payments", "tickets", "showtime_seats"]) {
        const record = { _id: new mongoose.Types.ObjectId(), showtimeId, snapshot: { title: movie.title, price: 100000, layout: ["A1"] }, status: "HISTORY_FIXTURE" };
        await collection(name).insertOne(record); originals[name] = record;
      }
      assert.equal((await archive(movie.id)).status, 200);
      assert.deepEqual(await collection("showtimes").findOne({ _id: showtimeId }), showtime);
      for (const [name, record] of Object.entries(originals)) assert.deepEqual(await collection(name).findOne({ _id: record._id }), record);
      const duplicate = new Movie({ ...input, title: movie.title });
      await assert.rejects(duplicate.save(), (error) => error.code === 11000);
    });

    await t.test("concurrent archive requests converge and keep one business transition", async () => {
      const movie = await makeMovie();
      const responses = await Promise.all([archive(movie.id), archive(movie.id)]);
      assert.deepEqual(responses.map(({ status }) => status), [200, 200]);
      const bodies = await Promise.all(responses.map((response) => response.json()));
      assert.equal(bodies[0].data.updatedAt, bodies[1].data.updatedAt);
      assert.equal((await Movie.findById(movie.id)).status, "ARCHIVED");
    });

    await t.test("archive and actual Showtime insertion serialize in both transaction orderings", async () => {
      const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
      const observeGuard = (id) => new Promise((resolve, reject) => {
        const client = mongoose.connection.getClient();
        const timer = setTimeout(() => { client.off("commandStarted", handler); reject(new Error("Competing Movie guard was not attempted")); }, 10000);
        function handler(event) {
          if (event.commandName === "findAndModify" && String(event.command.query?._id) === id && event.command.update?.$inc?.__v === 1) {
            clearTimeout(timer); client.off("commandStarted", handler); resolve();
          }
        }
        client.on("commandStarted", handler);
      });
      const roomId = new mongoose.Types.ObjectId();
      const publisher = (guard = movieService.withMovieForScheduling) => createShowtimePublisher({
        withMovieForScheduling: guard,
        getRoomLayout: async () => ({ room: { id: String(roomId), roomName: "Test", roomType: "STANDARD", status: "ACTIVE", branch: { id: String(roomId), status: "ACTIVE" } }, layout: { layoutVersion: 1, summary: { operationalSeatCapacity: 1 } } }),
        findConflict: async () => null,
        resolvePricePlan: async () => ({ ticketPricePlanId: new mongoose.Types.ObjectId(), seatTypePrices: { STANDARD: 100000 } }),
        initializeSeats: async () => {},
      });
      const first = await makeMovie();
      const acquired = deferred(), release = deferred();
      const scheduleFirst = publisher((id, work) => movieService.withMovieForScheduling(id, async (movie, session) => {
        acquired.resolve(); await release.promise; return work(movie, session);
      }))({ movieId: first.id, roomId: String(roomId), startAt: "2035-01-01T10:00:00Z" });
      await acquired.promise;
      const attempted = observeGuard(first.id);
      const archiveSecond = archive(first.id);
      try { await attempted; } finally { release.resolve(); }
      const [created, denied] = await Promise.all([scheduleFirst, archiveSecond]);
      assert.equal(denied.status, 409); assert.equal(created.status, "PUBLISHED");
      assert.equal((await Movie.findById(first.id)).status, "PUBLISHED");

      const second = await makeMovie();
      const locked = deferred(), allowArchive = deferred();
      const service = createMovieService(movieRepository, { async getMovieArchiveBlockers(id, now, session) {
        locked.resolve(); await allowArchive.promise; return showtimeReferenceService.getMovieArchiveBlockers(id, now, session);
      } });
      const archiveFirst = service.archiveMovie(second.id);
      await locked.promise;
      const scheduleAttempted = observeGuard(second.id);
      const scheduleSecond = publisher()({ movieId: second.id, roomId: String(roomId), startAt: "2035-01-02T10:00:00Z" });
      const rejected = assert.rejects(scheduleSecond, (error) => error.code === "MOVIE_NOT_FOUND");
      try { await scheduleAttempted; } finally { allowArchive.resolve(); }
      assert.equal((await archiveFirst).status, "ARCHIVED"); await rejected;
      assert.equal(await collection("showtimes").countDocuments({ movieId: second._id }), 0);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
