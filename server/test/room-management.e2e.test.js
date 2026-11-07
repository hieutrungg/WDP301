import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.EMAIL_TEST_MODE = "capture";

const password = "Cinema@2026";
const HOUR = 60 * 60 * 1000;

let baseUrl;
let server;
let Account;
let Room;
let RoomLayoutVersion;
let central;
let east;
let closedBranch;
let managerCookie;
let eastManagerCookie;
let noBranchManagerCookie;
let staffCookie;
let eastStaffCookie;
let closedManagerCookie;
let customerCookie;
let adminCookie;

const request = async (path, { method = "GET", body, cookie } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
};

const signIn = async (identity) => {
  const { response } = await request("/auth/login", { method: "POST", body: { identity, password } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
};

const createAccount = (username, roleIds, branch) =>
  Account.create({
    username,
    email: `${username}@example.com`,
    passwordHash: bcrypt.hashSync(password, 4),
    roleIds,
    status: "ACTIVE",
    profile: { fullName: username },
    ...(branch ? { employeeProfile: { branchId: branch._id, position: username } } : {}),
  });

// Managers and staff are bound to one branch: `asManager` works for Central, `asEastManager` for East.
const asManager = (path, options = {}) => request(path, { cookie: managerCookie, ...options });
const asEastManager = (path, options = {}) => request(path, { cookie: eastManagerCookie, ...options });

const newRoom = async (body, act = asManager) => {
  const result = await act("/rooms", { method: "POST", body });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  return result.body.data;
};

const insertShowtime = (roomId, { startsIn = 24 * HOUR, status = "PUBLISHED" } = {}) =>
  mongoose.connection.db.collection("showtimes").insertOne({
    movieId: new mongoose.Types.ObjectId(),
    roomId: new mongoose.Types.ObjectId(roomId),
    startAt: new Date(Date.now() + startsIn),
    endAt: new Date(Date.now() + startsIn + 2 * HOUR),
    status,
  });

const clearShowtimes = () => mongoose.connection.db.collection("showtimes").deleteMany({});

const seats = (rows, perRow, overrides = {}) =>
  rows.flatMap((row) =>
    Array.from({ length: perRow }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(),
      row,
      number: index + 1,
      column: index + 1,
      type: "STANDARD",
      status: "ENABLED",
      isAccessible: false,
      ...overrides,
    })),
  );

// Rooms written raw, the way the development seed does, so they can carry a layout and a legacy status.
const seedRoom = async (branch, roomName, { status = "ACTIVE", roomType = "STANDARD", layout } = {}) => {
  const roomSeats = layout ?? [];
  const _id = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection("rooms").insertOne({
    _id,
    branchId: branch._id,
    roomName,
    roomType,
    status,
    layoutVersion: roomSeats.length ? 1 : 0,
    capacity: roomSeats.filter((seat) => seat.status !== "DISABLED").length,
    seats: roomSeats,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return _id.toString();
};

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_room_mgmt_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  ({ Account } = await import("../src/modules/account/account.model.js"));
  ({ Room } = await import("../src/modules/room/room.model.js"));
  ({ RoomLayoutVersion } = await import("../src/modules/room/room-layout-version.model.js"));
  const { Branch } = await import("../src/modules/branch/branch.model.js");
  const { Role } = await import("../src/modules/role-permission/role.model.js");
  const { Permission } = await import("../src/modules/role-permission/permission.model.js");
  const { default: app } = await import("../src/app.js");

  await Promise.all([Account.syncIndexes(), Room.syncIndexes(), RoomLayoutVersion.syncIndexes(), Branch.syncIndexes()]);

  const [roomView, roomManage] = await Permission.create([
    { name: "room.view", description: "View cinema rooms" },
    { name: "room.manage", description: "Manage rooms and seat maps" },
  ]);
  const [managerRole, staffRole, customerRole, adminRole] = await Role.create([
    { name: "MANAGER", description: "Cinema manager", permissionIds: [roomView._id, roomManage._id] },
    { name: "STAFF", description: "Cinema staff", permissionIds: [roomView._id] },
    { name: "CUSTOMER", description: "Cinema customer", permissionIds: [] },
    // Mirrors the bootstrap: ADMIN is granted every permission.
    { name: "ADMIN", description: "System administrator", permissionIds: [roomView._id, roomManage._id] },
  ]);

  central = await Branch.create({ branchName: "F-Cinema Central", address: "123 Nguyen Hue, HCMC" });
  east = await Branch.create({ branchName: "F-Cinema East", address: "45 Thu Duc, HCMC" });
  closedBranch = await Branch.create({
    branchName: "F-Cinema Closed",
    address: "9 Closed Street, HCMC",
    status: "INACTIVE",
  });

  await createAccount("rm_manager", [managerRole._id], central);
  await createAccount("rm_manager_east", [managerRole._id], east);
  await createAccount("rm_manager_nobranch", [managerRole._id]);
  await createAccount("rm_manager_closed", [managerRole._id], closedBranch);
  await createAccount("rm_staff", [staffRole._id], central);
  await createAccount("rm_staff_east", [staffRole._id], east);
  await createAccount("rm_customer", [customerRole._id]);
  await createAccount("rm_admin", [adminRole._id]);

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  managerCookie = await signIn("rm_manager");
  eastManagerCookie = await signIn("rm_manager_east");
  noBranchManagerCookie = await signIn("rm_manager_nobranch");
  staffCookie = await signIn("rm_staff");
  eastStaffCookie = await signIn("rm_staff_east");
  closedManagerCookie = await signIn("rm_manager_closed");
  customerCookie = await signIn("rm_customer");
  adminCookie = await signIn("rm_admin");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("room management authorization", async (t) => {
  const payload = { branchId: "", roomName: "Auth Room", roomType: "2D" };
  const roomId = await seedRoom(central, "Auth Probe");

  await t.test("rejects anonymous requests with 401", async () => {
    for (const path of ["/rooms/summary", `/rooms/${roomId}`]) {
      assert.equal((await request(path)).response.status, 401, path);
    }
    assert.equal((await request("/rooms", { method: "POST", body: payload })).response.status, 401);
    assert.equal((await request(`/rooms/${roomId}`, { method: "DELETE" })).response.status, 401);
  });

  await t.test("rejects accounts without room.view with 403", async () => {
    const read = await request(`/rooms/${roomId}`, { cookie: customerCookie });
    assert.equal(read.response.status, 403);
    assert.equal(read.body.code, "FORBIDDEN");
    assert.equal((await request("/rooms/summary", { cookie: customerCookie })).response.status, 403);
  });

  await t.test("lets STAFF and ADMIN read but never write", async () => {
    for (const cookie of [staffCookie, adminCookie]) {
      assert.equal((await request(`/rooms/${roomId}`, { cookie })).response.status, 200);
      assert.equal((await request("/rooms/summary", { cookie })).response.status, 200);

      const writes = [
        ["/rooms", "POST", { branchId: central.id, roomName: "Blocked", roomType: "2D" }],
        [`/rooms/${roomId}`, "PATCH", { roomName: "Blocked" }],
        [`/rooms/${roomId}/status`, "PATCH", { status: "INACTIVE" }],
        [`/rooms/${roomId}`, "DELETE"],
      ];
      for (const [path, method, body] of writes) {
        const result = await request(path, { method, body, cookie });
        assert.equal(result.response.status, 403, `${method} ${path}`);
        assert.equal(result.body.code, "FORBIDDEN");
      }
    }

    const untouched = await Room.findById(roomId).lean();
    assert.equal(untouched.roomName, "Auth Probe");
    assert.equal(untouched.status, "ACTIVE");
  });
});

test("POST /rooms", async (t) => {
  await t.test("creates a room without a seat map and ignores client-supplied capacity", async () => {
    const result = await asManager("/rooms", {
      method: "POST",
      body: {
        branchId: central.id,
        roomName: "  Hall   One ",
        roomType: " imax  laser ",
        capacity: 999,
        seats: [{ row: "A" }],
        layoutVersion: 7,
      },
    });

    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    const room = result.body.data;
    assert.equal(room.roomName, "Hall One");
    assert.equal(room.roomType, "IMAX LASER");
    assert.equal(room.status, "ACTIVE");
    assert.equal(room.branch.branchName, "F-Cinema Central");
    assert.equal(room.capacity, 0);
    assert.equal(room.layoutVersion, 0);
    assert.equal(room.hasLayout, false);
    assert.equal(room.canDelete, true);

    const stored = await Room.findById(room.id).lean();
    assert.deepEqual(stored.seats, []);
    assert.equal(stored.capacity, 0);
  });

  await t.test("returns field errors for invalid input", async () => {
    const result = await asManager("/rooms", {
      method: "POST",
      body: { branchId: "nope", roomName: "   ", roomType: "?!", status: "OPEN" },
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.body.code, "VALIDATION_FAILED");
    const fields = result.body.errors.map(({ field }) => field).sort();
    assert.deepEqual(fields, ["branchId", "roomName", "roomType", "status"]);
  });

  await t.test("rejects an unknown branch and a branch the manager does not work at", async () => {
    // A manager can only name their own branch, so an unknown id is refused before it is looked up.
    const unknown = await asManager("/rooms", {
      method: "POST",
      body: { branchId: new mongoose.Types.ObjectId().toString(), roomName: "Ghost", roomType: "2D" },
    });
    assert.equal(unknown.response.status, 403);
    assert.equal(unknown.body.code, "ROOM_WRONG_BRANCH");
  });

  await t.test("rejects a room for an inactive branch", async () => {
    const inactive = await request("/rooms", {
      cookie: closedManagerCookie,
      method: "POST",
      body: { branchId: closedBranch.id, roomName: "Closed Hall", roomType: "2D" },
    });
    assert.equal(inactive.response.status, 409);
    assert.equal(inactive.body.code, "ROOM_BRANCH_INACTIVE");
    assert.equal(await Room.countDocuments({ roomName: "Closed Hall" }), 0);
  });

  await t.test("keeps room names unique per branch, ignoring case and extra spaces", async () => {
    await newRoom({ branchId: central.id, roomName: "Dolby Hall", roomType: "2D" });

    const duplicate = await asManager("/rooms", {
      method: "POST",
      body: { branchId: central.id, roomName: " dolby   HALL ", roomType: "2D" },
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.code, "ROOM_NAME_TAKEN");
    assert.equal(duplicate.body.errors[0].field, "roomName");

    // Another branch may reuse the name.
    await newRoom({ branchId: east.id, roomName: "Dolby Hall", roomType: "2D" }, asEastManager);
    assert.equal(await Room.countDocuments({ roomName: "Dolby Hall" }), 2);
  });

  await t.test("lets the seat map editor create the first layout afterwards", async () => {
    const room = await newRoom({ branchId: east.id, roomName: "Layout Hall", roomType: "STANDARD" }, asEastManager);

    const layout = await asEastManager(`/rooms/${room.id}/seat-layout`, {
      method: "POST",
      body: {
        rowLabels: ["A"],
        columnCount: 3,
        positions: [1, 2, 3].map((columnNumber) => ({
          rowIndex: 0,
          columnNumber,
          positionType: "SEAT",
          seatType: columnNumber === 3 ? "VIP" : "STANDARD",
        })),
      },
    });
    assert.equal(layout.response.status, 201, JSON.stringify(layout.body));

    const detail = await asEastManager(`/rooms/${room.id}`);
    assert.equal(detail.body.data.capacity, 3);
    assert.equal(detail.body.data.hasLayout, true);
    assert.deepEqual(detail.body.data.seatCounts, {
      standardCount: 2,
      vipCount: 1,
      doubleLuxuryCount: 0,
      accessibleCount: 0,
      disabledCount: 0,
    });
  });
});

test("GET /rooms and /rooms/summary", async (t) => {
  // Everything in this block reads the East branch, so it runs as the East manager.
  const asManager = asEastManager;
  const layout = seats(["A", "B"], 4);
  layout[0].type = "VIP";
  layout[1].type = "DOUBLE_LUXURY";
  layout[2].isAccessible = true;
  layout[3].status = "DISABLED";
  const stocked = await seedRoom(east, "List Stocked", { roomType: "3D", layout });
  const maintenance = await seedRoom(east, "List Maintenance", { status: "MAINTENANCE" });
  const legacy = await seedRoom(east, "List Legacy", { status: "AVAILABLE" });
  await insertShowtime(stocked);
  await insertShowtime(stocked, { startsIn: 48 * HOUR });
  await insertShowtime(stocked, { startsIn: -48 * HOUR });
  await insertShowtime(maintenance, { status: "DRAFT" });

  await t.test("returns seat counts and upcoming published showtimes per room", async () => {
    const { response, body } = await asManager(`/rooms?branchId=${east.id}&q=list stocked`);

    assert.equal(response.status, 200);
    assert.equal(body.meta.total, 1);
    const [room] = body.data;
    assert.equal(room.id, stocked);
    assert.equal(room.capacity, 7);
    assert.deepEqual(room.seatCounts, {
      standardCount: 5,
      vipCount: 1,
      doubleLuxuryCount: 1,
      accessibleCount: 1,
      disabledCount: 1,
    });
    // The past and DRAFT sessions do not count.
    assert.equal(room.upcomingShowtimeCount, 2);
  });

  await t.test("filters by status, reading the legacy AVAILABLE spelling as ACTIVE", async () => {
    const active = await asManager(`/rooms?branchId=${east.id}&status=ACTIVE&limit=100`);
    const names = active.body.data.map(({ roomName }) => roomName);
    assert.ok(names.includes("List Legacy"));
    assert.ok(!names.includes("List Maintenance"));
    assert.equal(active.body.data.find(({ id }) => id === legacy).status, "ACTIVE");

    const maint = await asManager(`/rooms?branchId=${east.id}&status=MAINTENANCE`);
    assert.deepEqual(maint.body.data.map(({ id }) => id), [maintenance]);
  });

  await t.test("filters by room type case-insensitively", async () => {
    const { body } = await asManager(`/rooms?branchId=${east.id}&roomType=3d`);
    assert.deepEqual(body.data.map(({ id }) => id), [stocked]);
  });

  await t.test("sorts and paginates", async () => {
    const asc = await asManager(`/rooms?branchId=${east.id}&q=list&sort=roomName&order=asc&limit=2`);
    assert.deepEqual(asc.body.data.map(({ roomName }) => roomName), ["List Legacy", "List Maintenance"]);
    assert.equal(asc.body.meta.totalPages, 2);

    const desc = await asManager(`/rooms?branchId=${east.id}&q=list&sort=roomName&order=desc&limit=2&page=1`);
    assert.deepEqual(desc.body.data.map(({ roomName }) => roomName), ["List Stocked", "List Maintenance"]);
  });

  await t.test("rejects unknown query keys and values", async () => {
    for (const query of ["sort=password", "status=OPEN", "foo=bar", "limit=0"]) {
      const result = await asManager(`/rooms?${query}`);
      assert.equal(result.response.status, 400, query);
      assert.equal(result.body.code, "INVALID_QUERY");
    }
  });

  await t.test("summarizes a branch", async () => {
    const { response, body } = await asManager(`/rooms/summary?branchId=${east.id}`);
    assert.equal(response.status, 200);

    const summary = body.data;
    assert.ok(summary.totalRooms >= 4);
    assert.equal(summary.maintenance, 1);
    assert.ok(summary.active >= 2);
    assert.equal(summary.roomsWithUpcomingShowtimes, 1);
    assert.equal(summary.upcomingShowtimes, 2);
    assert.ok(summary.totalSeats >= 7);
    assert.ok(summary.roomTypes.some(({ roomType, count }) => roomType === "3D" && count === 1));
    assert.equal(summary.totalRooms, summary.active + summary.maintenance + summary.inactive + summary.unspecified);

    const invalid = await asManager("/rooms/summary?branchId=nope");
    assert.equal(invalid.response.status, 400);
  });
});

test("GET /rooms/:roomId", async (t) => {
  await t.test("rejects malformed and unknown ids", async () => {
    const malformed = await asManager("/rooms/not-an-id");
    assert.equal(malformed.response.status, 400);
    assert.equal(malformed.body.code, "INVALID_ROOM_ID");

    const missing = await asManager(`/rooms/${new mongoose.Types.ObjectId()}`);
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.code, "ROOM_NOT_FOUND");
  });

  await t.test("reports showtime dependencies and whether the room can be deleted", async () => {
    const roomId = await seedRoom(central, "Detail Room");
    assert.equal((await asManager(`/rooms/${roomId}`)).body.data.canDelete, true);

    await insertShowtime(roomId, { startsIn: -24 * HOUR, status: "CANCELLED" });
    const { body } = await asManager(`/rooms/${roomId}`);
    assert.equal(body.data.showtimeCount, 1);
    assert.equal(body.data.upcomingShowtimeCount, 0);
    assert.equal(body.data.canDelete, false);
  });
});

test("PATCH /rooms/:roomId", async (t) => {
  await t.test("renames and retypes a room", async () => {
    const room = await newRoom({ branchId: central.id, roomName: "Patch Me", roomType: "2D" });

    const result = await asManager(`/rooms/${room.id}`, {
      method: "PATCH",
      body: { roomName: " Patched  Room ", roomType: "3d" },
    });

    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.roomName, "Patched Room");
    assert.equal(result.body.data.roomType, "3D");
    assert.equal(result.body.data.branch.id, central.id);
  });

  await t.test("rejects fields it does not own", async () => {
    const room = await newRoom({ branchId: central.id, roomName: "Strict Room", roomType: "2D" });

    for (const body of [{ branchId: east.id }, { capacity: 10 }, { status: "INACTIVE" }, {}]) {      const result = await asManager(`/rooms/${room.id}`, { method: "PATCH", body });
      assert.equal(result.response.status, 400, JSON.stringify(body));
      assert.equal(result.body.code, "VALIDATION_FAILED");
    }

    const stored = await Room.findById(room.id).lean();
    assert.equal(String(stored.branchId), central.id);
  });

  await t.test("rejects a name another room in the branch already uses, but allows a case change", async () => {
    const first = await newRoom({ branchId: central.id, roomName: "Name Taken", roomType: "2D" });
    const second = await newRoom({ branchId: central.id, roomName: "Name Free", roomType: "2D" });

    const taken = await asManager(`/rooms/${second.id}`, { method: "PATCH", body: { roomName: "name taken" } });
    assert.equal(taken.response.status, 409);
    assert.equal(taken.body.code, "ROOM_NAME_TAKEN");

    const recase = await asManager(`/rooms/${first.id}`, { method: "PATCH", body: { roomName: "NAME TAKEN" } });
    assert.equal(recase.response.status, 200);
    assert.equal(recase.body.data.roomName, "NAME TAKEN");
  });

  await t.test("blocks a type change while upcoming published showtimes exist", async () => {
    const room = await newRoom({ branchId: central.id, roomName: "Typed Room", roomType: "2D" });
    await insertShowtime(room.id);

    const blocked = await asManager(`/rooms/${room.id}`, { method: "PATCH", body: { roomType: "IMAX" } });
    assert.equal(blocked.response.status, 409);
    assert.equal(blocked.body.code, "ROOM_HAS_FUTURE_SHOWTIMES");
    assert.equal((await Room.findById(room.id).lean()).roomType, "2D");

    // A rename does not affect pricing, so it stays allowed.
    const rename = await asManager(`/rooms/${room.id}`, { method: "PATCH", body: { roomName: "Typed Room 2" } });
    assert.equal(rename.response.status, 200);

    await clearShowtimes();
    const allowed = await asManager(`/rooms/${room.id}`, { method: "PATCH", body: { roomType: "IMAX" } });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.body.data.roomType, "IMAX");
  });

  await t.test("returns 404 for an unknown room", async () => {
    const result = await asManager(`/rooms/${new mongoose.Types.ObjectId()}`, {
      method: "PATCH",
      body: { roomName: "Nobody" },
    });
    assert.equal(result.response.status, 404);
  });
});

test("PATCH /rooms/:roomId/status", async (t) => {
  await t.test("moves a room through its lifecycle", async () => {
    const room = await newRoom({ branchId: central.id, roomName: "Lifecycle", roomType: "2D" });

    for (const status of ["MAINTENANCE", "INACTIVE", "ACTIVE"]) {
      const result = await asManager(`/rooms/${room.id}/status`, { method: "PATCH", body: { status } });
      assert.equal(result.response.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.data.status, status);
    }

    const same = await asManager(`/rooms/${room.id}/status`, { method: "PATCH", body: { status: "ACTIVE" } });
    assert.equal(same.response.status, 200);

    const invalid = await asManager(`/rooms/${room.id}/status`, { method: "PATCH", body: { status: "AVAILABLE" } });
    assert.equal(invalid.response.status, 400);
  });

  await t.test("blocks leaving service while upcoming published showtimes exist", async () => {
    const room = await newRoom({ branchId: central.id, roomName: "Busy Room", roomType: "2D" });
    await insertShowtime(room.id);

    for (const status of ["MAINTENANCE", "INACTIVE"]) {
      const result = await asManager(`/rooms/${room.id}/status`, { method: "PATCH", body: { status } });
      assert.equal(result.response.status, 409);
      assert.equal(result.body.code, "ROOM_HAS_FUTURE_SHOWTIMES");
    }
    assert.equal((await Room.findById(room.id).lean()).status, "ACTIVE");

    await clearShowtimes();
    const allowed = await asManager(`/rooms/${room.id}/status`, { method: "PATCH", body: { status: "INACTIVE" } });
    assert.equal(allowed.response.status, 200);
  });

  await t.test("ignores past, draft and cancelled showtimes", async () => {
    const room = await newRoom({ branchId: central.id, roomName: "Quiet Room", roomType: "2D" });
    await insertShowtime(room.id, { startsIn: -48 * HOUR });
    await insertShowtime(room.id, { status: "DRAFT" });
    await insertShowtime(room.id, { status: "CANCELLED" });

    const result = await asManager(`/rooms/${room.id}/status`, { method: "PATCH", body: { status: "MAINTENANCE" } });
    assert.equal(result.response.status, 200);
  });

  await t.test("rewrites the legacy AVAILABLE spelling when set to ACTIVE", async () => {
    const roomId = await seedRoom(central, "Old Status", { status: "AVAILABLE" });

    const result = await asManager(`/rooms/${roomId}/status`, { method: "PATCH", body: { status: "ACTIVE" } });
    assert.equal(result.response.status, 200);
    assert.equal((await Room.findById(roomId).lean()).status, "ACTIVE");
  });
});

test("DELETE /rooms/:roomId", async (t) => {
  await t.test("deletes a room that never hosted a showtime, with its layout snapshots", async () => {
    const roomId = await seedRoom(central, "Disposable", { layout: seats(["A"], 3) });
    await RoomLayoutVersion.create({
      roomId,
      layoutVersion: 0,
      supersededAt: new Date(),
    });

    const result = await asManager(`/rooms/${roomId}`, { method: "DELETE" });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.body.data, { id: roomId });
    assert.equal(await Room.countDocuments({ _id: roomId }), 0);
    assert.equal(await RoomLayoutVersion.countDocuments({ roomId }), 0);

    const again = await asManager(`/rooms/${roomId}`, { method: "DELETE" });
    assert.equal(again.response.status, 404);
    assert.equal(again.body.code, "ROOM_NOT_FOUND");
  });

  await t.test("keeps a room that has showtime history, whatever its status or date", async () => {
    for (const [name, options] of [
      ["Has Upcoming", {}],
      ["Has Past", { startsIn: -72 * HOUR }],
      ["Has Cancelled", { status: "CANCELLED" }],
    ]) {
      const roomId = await seedRoom(central, name);
      await insertShowtime(roomId, options);

      const result = await asManager(`/rooms/${roomId}`, { method: "DELETE" });
      assert.equal(result.response.status, 409, name);
      assert.equal(result.body.code, "ROOM_HAS_SHOWTIME_HISTORY");
      assert.equal(await Room.countDocuments({ _id: roomId }), 1);
    }
  });

  await t.test("rejects a malformed id", async () => {
    const result = await asManager("/rooms/not-an-id", { method: "DELETE" });
    assert.equal(result.response.status, 400);
    assert.equal(result.body.code, "INVALID_ROOM_ID");
  });
});

test("rooms and seat maps are limited to the actor's branch", async (t) => {
  const layoutBody = {
    rowLabels: ["A"],
    columnCount: 2,
    positions: [1, 2].map((columnNumber) => ({ rowIndex: 0, columnNumber, positionType: "SEAT", seatType: "STANDARD" })),
  };
  const centralRoom = await seedRoom(central, "Scope Central", { layout: seats(["A"], 2) });
  const eastRoom = await seedRoom(east, "Scope East", { layout: seats(["A"], 2) });

  await t.test("lists and summarizes only the manager's own branch", async () => {
    const list = await asManager("/rooms?limit=200");
    assert.equal(list.response.status, 200);
    assert.ok(list.body.data.length > 0);
    assert.ok(list.body.data.every(({ branch }) => branch.id === central.id));
    assert.ok(list.body.data.some(({ id }) => id === centralRoom));
    assert.ok(!list.body.data.some(({ id }) => id === eastRoom));

    const eastList = await asEastManager("/rooms?limit=200");
    assert.ok(eastList.body.data.every(({ branch }) => branch.id === east.id));

    const centralTotal = await Room.countDocuments({ branchId: central._id });
    assert.equal((await asManager("/rooms/summary")).body.data.totalRooms, centralTotal);
  });

  await t.test("refuses to filter by another branch", async () => {
    for (const path of [`/rooms?branchId=${east.id}`, `/rooms/summary?branchId=${east.id}`]) {
      const result = await asManager(path);
      assert.equal(result.response.status, 403, path);
      assert.equal(result.body.code, "ROOM_WRONG_BRANCH");
    }

    assert.equal((await asManager(`/rooms?branchId=${central.id}`)).response.status, 200);
  });

  await t.test("limits staff to their own branch too", async () => {
    const own = await request("/rooms?limit=200", { cookie: staffCookie });
    assert.equal(own.response.status, 200);
    assert.ok(own.body.data.every(({ branch }) => branch.id === central.id));

    for (const path of [`/rooms/${eastRoom}`, `/rooms/${eastRoom}/seat-layout`, `/rooms?branchId=${east.id}`]) {
      const result = await request(path, { cookie: staffCookie });
      assert.equal(result.response.status, 403, path);
      assert.equal(result.body.code, "ROOM_WRONG_BRANCH");
    }

    assert.equal((await request(`/rooms/${eastRoom}`, { cookie: eastStaffCookie })).response.status, 200);
  });

  await t.test("blocks reading another branch's room and seat map", async () => {
    for (const path of [`/rooms/${eastRoom}`, `/rooms/${eastRoom}/seat-layout`]) {
      const result = await asManager(path);
      assert.equal(result.response.status, 403, path);
      assert.equal(result.body.code, "ROOM_WRONG_BRANCH");
    }
  });

  await t.test("blocks writing another branch's room and seat map, changing nothing", async () => {
    const before = await Room.findById(eastRoom).lean();
    const attempts = [
      ["POST", "/rooms", { branchId: east.id, roomName: "Intruder", roomType: "2D" }],
      ["PATCH", `/rooms/${eastRoom}`, { roomName: "Hijacked" }],
      ["PATCH", `/rooms/${eastRoom}/status`, { status: "INACTIVE" }],
      ["DELETE", `/rooms/${eastRoom}`],
      ["POST", `/rooms/${eastRoom}/seat-layout`, layoutBody],
      ["PUT", `/rooms/${eastRoom}/seat-layout`, { ...layoutBody, expectedLayoutVersion: 1 }],
    ];

    for (const [method, path, body] of attempts) {
      const result = await asManager(path, { method, body });
      assert.equal(result.response.status, 403, `${method} ${path}`);
      assert.equal(result.body.code, "ROOM_WRONG_BRANCH", `${method} ${path}`);
    }

    const after = await Room.findById(eastRoom).lean();
    assert.equal(after.roomName, "Scope East");
    assert.equal(after.status, "ACTIVE");
    assert.equal(after.layoutVersion, before.layoutVersion);
    assert.equal(after.seats.length, before.seats.length);
    assert.equal(await Room.countDocuments({ roomName: "Intruder" }), 0);
  });

  await t.test("still lets a manager manage a room in their own branch", async () => {
    const detail = await asManager(`/rooms/${centralRoom}`);
    assert.equal(detail.response.status, 200);
    assert.equal((await asManager(`/rooms/${centralRoom}/seat-layout`)).response.status, 200);
    assert.equal((await asManager(`/rooms/${centralRoom}`, { method: "PATCH", body: { roomName: "Scope Central 2" } })).response.status, 200);
  });

  await t.test("lets an administrator read every branch but never write", async () => {
    const list = await request("/rooms?limit=200", { cookie: adminCookie });
    const branches = new Set(list.body.data.map(({ branch }) => branch.id));
    assert.ok(branches.has(central.id) && branches.has(east.id));

    assert.equal((await request(`/rooms?branchId=${east.id}`, { cookie: adminCookie })).response.status, 200);
    assert.equal((await request(`/rooms/${eastRoom}/seat-layout`, { cookie: adminCookie })).response.status, 200);

    const write = await request(`/rooms/${eastRoom}`, { method: "PATCH", cookie: adminCookie, body: { roomName: "Admin Edit" } });
    assert.equal(write.response.status, 403);
    assert.equal(write.body.code, "FORBIDDEN");
  });

  await t.test("refuses a manager who has no branch assigned", async () => {
    for (const path of ["/rooms", "/rooms/summary", `/rooms/${centralRoom}`, `/rooms/${centralRoom}/seat-layout`]) {
      const result = await request(path, { cookie: noBranchManagerCookie });
      assert.equal(result.response.status, 403, path);
      assert.equal(result.body.code, "BRANCH_NOT_ASSIGNED");
    }
  });
});
