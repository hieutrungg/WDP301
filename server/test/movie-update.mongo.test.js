import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { configureMongoDns } from "../src/config/mongo-dns.js";
import { migrateMovieCreateIndex } from "../src/migrations/20261020-movie-create-index.js";

test("MOV-102 Mongo/HTTP management reads, authorization, sparse updates and concurrency", { skip: !process.env.MONGODB_URI }, async (t) => {
  const dbName = `cinema_mov102_test_${process.pid}_${Date.now()}`;
  let server;
  try {
    configureMongoDns();
    await mongoose.connect(process.env.MONGODB_URI, { dbName, autoIndex: false, monitorCommands: true, serverSelectionTimeoutMS: 10000 });
    const { Movie } = await import("../src/modules/movie/movie.model.js");
    const { Account } = await import("../src/modules/account/account.model.js");
    const { Role } = await import("../src/modules/role-permission/role.model.js");
    const { Permission } = await import("../src/modules/role-permission/permission.model.js");
    const { default: app } = await import("../src/app.js");
    await migrateMovieCreateIndex(mongoose.connection.db, { apply: true });
    const permission = await Permission.create({ name: "movie.update", description: "Update movies" });
    const [managerRole, adminRole, ungrantedManagerRole] = await Role.create([
      { name: "MANAGER", permissionIds: [permission._id] },
      { name: "ADMIN", permissionIds: [permission._id] },
      { name: "MANAGER", permissionIds: [] },
    ]);
    const createAccount = (username, roleIds, directPermissionIds = []) => Account.create({
      username, email: `${username}@example.com`, status: "ACTIVE", roleIds, directPermissionIds,
      profile: { fullName: username }, passwordHash: "test-only-unused-hash",
    });
    const allowed = await createAccount("mov102_manager", [managerRole._id]);
    const otherRole = await createAccount("mov102_admin", [adminRole._id]);
    const noPermission = await createAccount("mov102_ungranted", [ungrantedManagerRole._id]);
    const directGrant = await createAccount("mov102_direct", [ungrantedManagerRole._id], [permission._id]);
    const secret = process.env.JWT_ACCESS_SECRET || "mov102-test-only-secret";
    process.env.JWT_ACCESS_SECRET = secret;
    const cookie = (account) => `accessToken=${jwt.sign({ sub: account._id.toString() }, secret, { expiresIn: "5m" })}`;
    const input = { title: "MOV102 Draft", synopsis: "Original story", genres: ["Drama"], cast: ["Actor"], duration: 120,
      releaseDate: new Date("2026-12-04T00:00:00.000Z"), language: "Vietnamese", director: "Director", ageRating: "T13",
      posterUrl: "https://example.com/poster.jpg", trailerUrl: "", status: "DRAFT" };
    const [draft, published, archived] = await Movie.create([
      input, { ...input, title: "MOV102 Published", status: "PUBLISHED" },
      { ...input, title: "MOV102 Archived", status: "ARCHIVED" },
    ]);
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const root = `http://127.0.0.1:${server.address().port}/api/movies`;
    const get = (path, account) => fetch(`${root}${path}`, { headers: account ? { Cookie: cookie(account) } : {} });
    const patch = (movieId, body, account) => fetch(`${root}/${movieId}`, { method: "PATCH", headers: {
      "Content-Type": "application/json", ...(account ? { Cookie: cookie(account) } : {}),
    }, body: JSON.stringify(body) });

    await t.test("all management reads and mutations require current Manager role and update permission", async () => {
      for (const account of [undefined, noPermission, otherRole]) {
        const expected = account ? 403 : 401;
        assert.equal((await get("/manage", account)).status, expected);
        assert.equal((await get(`/${draft._id}/manage`, account)).status, expected);
        assert.equal((await patch(draft._id, { title: "Unauthorized" }, account)).status, expected);
      }
      assert.equal((await Movie.findById(draft._id)).title, draft.title);
    });

    await t.test("management list returns every lifecycle while public reads stay published-only", async () => {
      const response = await get("/manage?q=MOV102&limit=2&page=1&sort=title&order=asc", allowed);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 2);
      assert.deepEqual(body.meta, { page: 1, limit: 2, total: 3, totalPages: 2 });
      assert.deepEqual(body.data.map(({ status }) => status), ["ARCHIVED", "DRAFT"]);
      assert.ok(body.data.every(({ updatedAt }) => !Number.isNaN(Date.parse(updatedAt))));
      const publicBody = await (await get("?q=MOV102")).json();
      assert.deepEqual(publicBody.data.map(({ status }) => status), ["PUBLISHED"]);
      assert.equal((await get(`/${draft._id}`)).status, 404);
      assert.equal((await get(`/${archived._id}`)).status, 404);
      assert.equal((await get(`/${published._id}`)).status, 200);
      assert.equal((await get("/manage?status=PUBLISHED", allowed)).status, 400);
      assert.equal((await get("/manage?page=0", allowed)).status, 400);
    });

    await t.test("management detail preloads draft, published and archived records using the existing DTO", async () => {
      for (const movie of [draft, published, archived]) {
        const response = await get(`/${movie._id}/manage`, allowed);
        assert.equal(response.status, 200);
        const { data } = await response.json();
        assert.equal(data.id, movie.id);
        assert.equal(data.status, movie.status);
        assert.deepEqual(data.genres, ["Drama"]);
        assert.equal(data.ageRating, "T13");
        assert.equal(data.updatedAt, movie.updatedAt.toISOString());
        assert.equal(data.releaseYear, undefined);
        assert.equal(data._id, undefined);
      }
    });

    await t.test("validates IDs and missing records before writes", async () => {
      const missingId = new mongoose.Types.ObjectId();
      for (const [id, status, code] of [["invalid-id", 400, "INVALID_MOVIE_ID"], [missingId, 404, "MOVIE_NOT_FOUND"]]) {
        for (const response of [await get(`/${id}/manage`, allowed), await patch(id, { title: "New" }, allowed)]) {
          assert.equal(response.status, status);
          assert.equal((await response.json()).code, code);
        }
      }
    });

    await t.test("rejects unknown/internal/scheduling fields and invalid metadata without mutation", async () => {
      for (const fields of [{}, { duration: 0 }, { status: "PUBLISHED" }, { releaseYear: 2027 },
        { title: "New", _id: new mongoose.Types.ObjectId() }, { title: "New", updatedAt: new Date() },
        { releaseDate: "2026-02-30" }, { genres: [] }, { ageRating: "" }, { posterUrl: "javascript:alert(1)" }]) {
        const response = await patch(draft._id, fields, allowed);
        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.code, "INVALID_MOVIE_INPUT");
        assert.ok(body.errors.length > 0);
      }
      assert.equal((await Movie.findById(draft._id)).title, draft.title);
    });

    await t.test("updates metadata despite a showtime reference without changing lifecycle, duration or showtime history", async () => {
      const showtime = { _id: new mongoose.Types.ObjectId(), movieId: draft._id,
        startAt: new Date("2026-12-05T03:00:00.000Z"), endAt: new Date("2026-12-05T05:00:00.000Z"),
        movieSnapshot: { title: draft.title, duration: 120 }, status: "PUBLISHED" };
      await mongoose.connection.db.collection("showtimes").insertOne(showtime);
      const response = await patch(draft._id, { synopsis: "Updated story", genres: ["Action", "Drama"],
        ageRating: "T16", cast: [], trailerUrl: "" }, allowed);
      assert.equal(response.status, 200);
      const { data } = await response.json();
      assert.equal(data.synopsis, "Updated story");
      assert.deepEqual(data.genres, ["Action", "Drama"]);
      assert.equal(data.ageRating, "T16");
      assert.equal(data.status, "DRAFT");
      assert.equal(data.duration, 120);
      assert.ok(Date.parse(data.updatedAt) >= draft.updatedAt.getTime());
      const persisted = await Movie.findById(draft._id).lean();
      assert.equal(persisted.releaseYear, 2026);
      assert.equal(persisted.createdAt.getTime(), draft.createdAt.getTime());
      assert.deepEqual(await mongoose.connection.db.collection("showtimes").findOne({ _id: showtime._id }), showtime);
    });

    await t.test("unchanged own title/year is allowed, and date updates maintain releaseYear", async () => {
      const response = await patch(draft._id, { title: draft.title, releaseDate: "2026-11-01" }, allowed);
      assert.equal(response.status, 200);
      const moved = await patch(draft._id, { releaseDate: "2027-01-01" }, allowed);
      assert.equal(moved.status, 200);
      const record = await Movie.findById(draft._id);
      assert.equal(record.releaseYear, 2027);
      assert.equal(record.releaseDate.toISOString(), "2027-01-01T00:00:00.000Z");
    });

    await t.test("duplicate checks include archived movies and release-date-only changes", async () => {
      const titleConflict = await patch(draft._id, { title: archived.title, releaseDate: "2026-01-01" }, allowed);
      assert.equal(titleConflict.status, 409);
      assert.equal((await titleConflict.json()).code, "MOVIE_DUPLICATE");
      const laterRelease = await Movie.create({ ...input, title: archived.title, releaseDate: new Date("2027-01-01") });
      const dateConflict = await patch(laterRelease._id, { releaseDate: "2026-06-01" }, allowed);
      assert.equal(dateConflict.status, 409);
      assert.equal((await dateConflict.json()).code, "MOVIE_DUPLICATE");
      assert.equal((await Movie.findById(laterRelease._id)).releaseYear, 2027);
    });

    await t.test("concurrent updates to the same title/year produce one winner", async () => {
      const movies = await Movie.create([{ ...input, title: "Race A" }, { ...input, title: "Race B" }]);
      const responses = await Promise.all(movies.map((movie) => patch(movie._id,
        { title: "MOV102 Concurrent Target", releaseDate: "2028-01-01" }, allowed)));
      assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
      assert.equal((await responses.find(({ status }) => status === 409).json()).code, "MOVIE_DUPLICATE");
      assert.equal(await Movie.countDocuments({ title: "MOV102 Concurrent Target", releaseYear: 2028 }), 1);
    });

    await t.test("concurrent sparse title and date changes preserve both and the derived year", async () => {
      const record = await Movie.create({ ...input, title: "MOV102 Sparse" });
      const responses = await Promise.all([
        patch(record._id, { title: "MOV102 Sparse Updated" }, allowed),
        patch(record._id, { releaseDate: "2029-01-01" }, allowed),
      ]);
      assert.deepEqual(responses.map(({ status }) => status), [200, 200]);
      const updated = await Movie.findById(record._id);
      assert.equal(updated.title, "MOV102 Sparse Updated");
      assert.equal(updated.releaseDate.toISOString(), "2029-01-01T00:00:00.000Z");
      assert.equal(updated.releaseYear, 2029);
    });

    await t.test("unreferenced DRAFT runtime is editable before publication; every reference locks runtime only", async () => {
      const record = await Movie.create({ ...input, title: "Runtime draft" });
      assert.equal((await (await get(`/${record.id}/manage`, allowed)).json()).data.canEditDuration, true);
      const changed = await patch(record.id, { duration: 135, synopsis: "Draft revision" }, allowed);
      assert.equal(changed.status, 200);
      assert.equal((await changed.json()).data.duration, 135);
      assert.equal((await Movie.findById(record.id)).status, "DRAFT");
      for (const [status, time] of [["DRAFT", "2030-01-01"], ["PUBLISHED", "2020-01-01"], ["CANCELLED", "2020-01-01"]]) {
        const reference = { _id: new mongoose.Types.ObjectId(), movieId: record._id, status, startAt: new Date(time), endAt: new Date(time) };
        await mongoose.connection.db.collection("showtimes").insertOne(reference);
        assert.equal((await (await get(`/${record.id}/manage`, allowed)).json()).data.canEditDuration, false);
        const denied = await patch(record.id, { duration: 150, synopsis: "Must not partially save" }, allowed);
        assert.equal(denied.status, 409);
        const error = await denied.json();
        assert.equal(error.code, "INVALID_MOVIE_INPUT");
        assert.equal(error.errors[0].field, "duration");
        assert.equal((await Movie.findById(record.id)).synopsis, "Draft revision");
        assert.equal((await patch(record.id, { synopsis: "Allowed metadata", duration: 135 }, allowed)).status, 200);
        assert.deepEqual(await mongoose.connection.db.collection("showtimes").findOne({ _id: reference._id }), reference);
        await mongoose.connection.db.collection("showtimes").deleteOne({ _id: reference._id });
        await patch(record.id, { synopsis: "Draft revision" }, allowed);
      }
    });

    await t.test("runtime update and real Showtime draft insertion serialize on the same Movie", async () => {
      const { createShowtimePublisher } = await import("../src/modules/showtime/showtime.service.js");
      const { createMovieService, movieService } = await import("../src/modules/movie/movie.service.js");
      const { movieRepository } = await import("../src/modules/movie/movie.repository.js");
      const { showtimeReferenceService } = await import("../src/modules/showtime/showtime-reference.service.js");
      const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
      // Observe the competing guard command while the first transaction still holds its write.
      // This proves overlap instead of depending on HTTP timing or arbitrary sleeps.
      const observeGuardWrite = (id) => new Promise((resolve, reject) => {
        const client = mongoose.connection.getClient();
        const timer = setTimeout(() => { client.off("commandStarted", handler); reject(new Error("Competing guard was not attempted")); }, 10000);
        function handler(event) {
          if (event.commandName === "findAndModify" && String(event.command.query?._id) === String(id) && event.command.update?.$inc?.__v === 1) {
            clearTimeout(timer); client.off("commandStarted", handler); resolve();
          }
        }
        client.on("commandStarted", handler);
      });
      const roomId = new mongoose.Types.ObjectId();
      const makePublisher = (guard = movieService.withMovieForScheduling) => createShowtimePublisher({
        withMovieForScheduling: guard,
        getRoomLayout: async () => ({ room: { id: String(roomId), roomName: "Test", roomType: "STANDARD", status: "ACTIVE", branch: { id: String(roomId), status: "ACTIVE" } }, layout: { layoutVersion: 1, summary: { operationalSeatCapacity: 1 } } }),
        findConflict: async () => null,
        resolvePricePlan: async () => ({ ticketPricePlanId: new mongoose.Types.ObjectId(), seatTypePrices: { STANDARD: 100000 } }),
        initializeSeats: async () => {},
      });
      const first = await Movie.create({ ...input, title: "Schedule wins", status: "PUBLISHED" });
      const acquired = deferred(), release = deferred();
      const publisher = makePublisher((id, work) => movieService.withMovieForScheduling(id, async (movie, session) => {
        acquired.resolve(); await release.promise; return work(movie, session);
      }));
      const schedule = publisher({ movieId: first.id, roomId: String(roomId), startAt: "2035-01-01T10:00:00Z" });
      await acquired.promise;
      const editAttempted = observeGuardWrite(first.id);
      const edit = patch(first.id, { duration: 150 }, allowed);
      await editAttempted;
      release.resolve();
      const [showtime, denied] = await Promise.all([schedule, edit]);
      assert.equal(denied.status, 409);
      assert.equal(Date.parse(showtime.endAt) - Date.parse(showtime.startAt), 135 * 60000);
      assert.equal((await Movie.findById(first.id)).duration, 120);

      const second = await Movie.create({ ...input, title: "Runtime wins", status: "PUBLISHED" });
      const editing = deferred(), allowEdit = deferred();
      const service = createMovieService(movieRepository, { async hasMovieReferences(id, session) {
        editing.resolve(); await allowEdit.promise; return showtimeReferenceService.hasMovieReferences(id, session);
      } });
      const durationWrite = service.updateMovie(second.id, { duration: 150 });
      await editing.promise;
      const scheduleAttempted = observeGuardWrite(second.id);
      const newSchedule = makePublisher()({ movieId: second.id, roomId: String(roomId), startAt: "2035-01-02T10:00:00Z" });
      await scheduleAttempted;
      allowEdit.resolve();
      const [updated, created] = await Promise.all([durationWrite, newSchedule]);
      assert.equal(updated.duration, 150);
      assert.equal(Date.parse(created.endAt) - Date.parse(created.startAt), 165 * 60000);
      assert.equal((await Movie.findById(second.id)).updatedAt.toISOString(), updated.updatedAt);
      assert.equal((await (await get(`/${second.id}/manage`, allowed)).json()).data.canEditDuration, false);
    });

    await t.test("direct grants work and permission revocation or account locking applies next request", async () => {
      assert.equal((await get("/manage", directGrant)).status, 200);
      assert.equal((await patch(archived._id, { synopsis: "Archived metadata update" }, directGrant)).status, 200);
      directGrant.directPermissionIds = [];
      await directGrant.save();
      assert.equal((await get(`/${archived._id}/manage`, directGrant)).status, 403);
      assert.equal((await patch(archived._id, { synopsis: "Must reject" }, directGrant)).status, 403);
      allowed.status = "LOCKED";
      await allowed.save();
      assert.equal((await get("/manage", allowed)).status, 403);
      assert.equal((await patch(draft._id, { synopsis: "Must reject" }, allowed)).status, 403);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    // Cleanup is limited to the fresh MOV-102 test DB; never the configured development DB.
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
});
