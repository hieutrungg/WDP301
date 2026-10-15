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
let branch;
let legacyRoom;
let emptyRoom;
let managerCookie;
let staffCookie;
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

const createAccount = (username, roleIds) =>
  Account.create({
    username,
    email: `${username}@example.com`,
    passwordHash: bcrypt.hashSync(password, 4),
    roleIds,
    status: "ACTIVE",
    profile: { fullName: username },
  });

// rows: one char per cell. S=standard V=vip D=double luxury .=aisle a=accessible x=disabled
const CELL = {
  S: { positionType: "SEAT", seatType: "STANDARD" },
  V: { positionType: "SEAT", seatType: "VIP" },
  D: { positionType: "SEAT", seatType: "DOUBLE_LUXURY" },
  a: { positionType: "SEAT", seatType: "STANDARD", isAccessible: true },
  x: { positionType: "SEAT", seatType: "STANDARD", status: "DISABLED" },
  ".": { positionType: "AISLE" },
};

const layoutBody = (rowLabels, rows, extra = {}) => ({
  rowLabels: [...rowLabels],
  columnCount: rows[0].length,
  positions: rows.flatMap((cells, rowIndex) =>
    [...cells].map((cell, index) => ({ rowIndex, columnNumber: index + 1, ...CELL[cell] })),
  ),
  ...extra,
});

const legacySeats = (rows, perRow) =>
  rows.flatMap((row) =>
    Array.from({ length: perRow }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(),
      row,
      number: index + 1,
      type: "STANDARD",
      status: "ENABLED",
    })),
  );

const insertShowtime = (roomId, { startsIn = 24 * HOUR, status = "PUBLISHED", layoutVersion } = {}) =>
  mongoose.connection.db.collection("showtimes").insertOne({
    movieId: new mongoose.Types.ObjectId(),
    roomId,
    startAt: new Date(Date.now() + startsIn),
    endAt: new Date(Date.now() + startsIn + 2 * HOUR),
    status,
    ...(layoutVersion === undefined ? {} : { roomLayoutVersion: layoutVersion }),
  });

const clearShowtimes = () => mongoose.connection.db.collection("showtimes").deleteMany({});

const layoutPath = (roomId) => `/rooms/${roomId}/seat-layout`;

const getLayout = async (roomId) => {
  const result = await request(layoutPath(roomId), { cookie: managerCookie });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  return result.body.data;
};

const putLayout = (roomId, body) =>
  request(layoutPath(roomId), { method: "PUT", cookie: managerCookie, body });

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_room_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  ({ Account } = await import("../src/modules/account/account.model.js"));
  ({ Room } = await import("../src/modules/room/room.model.js"));
  ({ RoomLayoutVersion } = await import("../src/modules/room/room-layout-version.model.js"));
  const { Branch } = await import("../src/modules/branch/branch.model.js");
  const { Role } = await import("../src/modules/role-permission/role.model.js");
  const { Permission } = await import("../src/modules/role-permission/permission.model.js");
  const { default: app } = await import("../src/app.js");

  await Promise.all([Account.syncIndexes(), Room.syncIndexes(), RoomLayoutVersion.syncIndexes()]);

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

  await createAccount("room_manager", [managerRole._id]);
  await createAccount("room_staff", [staffRole._id]);
  await createAccount("room_customer", [customerRole._id]);
  await createAccount("room_admin", [adminRole._id]);

  branch = await Branch.create({ branchName: "F-Cinema Central", address: "123 Nguyen Hue, HCMC" });

  // Shaped like the pre-UC41 development seed (written raw, as the seed does): seats only, no
  // grid metadata and no `column`.
  const seats = legacySeats(["A", "B", "C", "D", "E"], 8);
  legacyRoom = { _id: new mongoose.Types.ObjectId() };
  await mongoose.connection.db.collection("rooms").insertOne({
    _id: legacyRoom._id,
    branchId: branch._id,
    roomName: "Room 01",
    roomType: "STANDARD",
    status: "ACTIVE",
    layoutVersion: 1,
    capacity: seats.length,
    seats,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  emptyRoom = await Room.create({ branchId: branch._id, roomName: "Room 02", status: "ACTIVE" });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  managerCookie = await signIn("room_manager");
  staffCookie = await signIn("room_staff");
  customerCookie = await signIn("room_customer");
  adminCookie = await signIn("room_admin");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("room seat layout authorization", async (t) => {
  await t.test("rejects anonymous requests with 401", async () => {
    const { response } = await request("/rooms");
    assert.equal(response.status, 401);
  });

  await t.test("rejects accounts without room.view with 403", async () => {
    const { response, body } = await request(layoutPath(legacyRoom._id), { cookie: customerCookie });
    assert.equal(response.status, 403);
    assert.equal(body.code, "FORBIDDEN");
  });

  await t.test("lets room.view read but not write", async () => {
    const read = await request(layoutPath(legacyRoom._id), { cookie: staffCookie });
    assert.equal(read.response.status, 200);

    const write = await request(layoutPath(legacyRoom._id), {
      method: "PUT",
      cookie: staffCookie,
      body: layoutBody(["A"], ["SS"], { expectedLayoutVersion: 1 }),
    });
    assert.equal(write.response.status, 403);

    const create = await request(layoutPath(emptyRoom._id), {
      method: "POST",
      cookie: staffCookie,
      body: layoutBody(["A"], ["SS"]),
    });
    assert.equal(create.response.status, 403);
  });
});

test("only the MANAGER role may write seat layouts", async (t) => {
  await t.test("rejects an ADMIN even though it holds room.manage", async () => {
    const update = await request(layoutPath(legacyRoom._id), {
      method: "PUT",
      cookie: adminCookie,
      body: layoutBody(["A"], ["SS"], { expectedLayoutVersion: 1 }),
    });
    assert.equal(update.response.status, 403);
    assert.equal(update.body.code, "FORBIDDEN");

    const create = await request(layoutPath(emptyRoom._id), {
      method: "POST",
      cookie: adminCookie,
      body: layoutBody(["A"], ["SS"]),
    });
    assert.equal(create.response.status, 403);
    assert.equal(await Room.countDocuments({ _id: emptyRoom._id, "seats.0": { $exists: true } }), 0);
  });
});

test("GET /rooms", async (t) => {
  await t.test("lists rooms with their branch and layout summary", async () => {
    const { response, body } = await request("/rooms", { cookie: managerCookie });

    assert.equal(response.status, 200);
    assert.equal(body.meta.total, 2);
    const [first, second] = body.data;
    assert.equal(first.roomName, "Room 01");
    assert.equal(first.branch.branchName, "F-Cinema Central");
    assert.equal(first.hasLayout, true);
    assert.equal(first.capacity, 40);
    assert.equal(second.hasLayout, false);
  });

  await t.test("filters by branch and rejects unknown query keys", async () => {
    const other = await request(`/rooms?branchId=${new mongoose.Types.ObjectId()}`, { cookie: managerCookie });
    assert.equal(other.body.data.length, 0);

    const invalid = await request("/rooms?branchId=nope&sort=x", { cookie: managerCookie });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.code, "INVALID_QUERY");
  });
});

test("GET /rooms/:roomId/seat-layout", async (t) => {
  await t.test("rejects malformed and unknown room ids", async () => {
    const malformed = await request("/rooms/not-an-id/seat-layout", { cookie: managerCookie });
    assert.equal(malformed.response.status, 400);
    assert.equal(malformed.body.code, "INVALID_ROOM_ID");

    const missing = await request(layoutPath(new mongoose.Types.ObjectId()), { cookie: managerCookie });
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.code, "ROOM_NOT_FOUND");
  });

  await t.test("derives the grid of a room seeded before UC41", async () => {
    const { room, layout, editability } = await getLayout(legacyRoom._id);

    assert.equal(room.branch.branchName, "F-Cinema Central");
    assert.deepEqual(layout.rowLabels, ["A", "B", "C", "D", "E"]);
    assert.equal(layout.columnCount, 8);
    assert.equal(layout.positions.length, 40);
    assert.equal(layout.layoutVersion, 1);
    assert.equal(layout.summary.operationalSeatCapacity, 40);
    assert.deepEqual(editability, { locked: false, protectedShowtimeCount: 0 });
  });

  await t.test("distinguishes a room without a layout from a failure", async () => {
    const { room, layout } = await getLayout(emptyRoom._id);
    assert.equal(room.roomName, "Room 02");
    assert.equal(layout, null);
  });
});

test("POST /rooms/:roomId/seat-layout", async (t) => {
  await t.test("rejects a nonexistent room", async () => {
    const { response, body } = await request(layoutPath(new mongoose.Types.ObjectId()), {
      method: "POST",
      cookie: managerCookie,
      body: layoutBody(["A"], ["SS"]),
    });
    assert.equal(response.status, 404);
    assert.equal(body.code, "ROOM_NOT_FOUND");
  });

  await t.test("rejects an update before a layout exists", async () => {
    const { response, body } = await putLayout(
      emptyRoom._id,
      layoutBody(["A"], ["SS"], { expectedLayoutVersion: 0 }),
    );
    assert.equal(response.status, 404);
    assert.equal(body.code, "SEAT_LAYOUT_NOT_FOUND");
  });

  await t.test("creates the first layout and derives capacity on the server", async () => {
    const { response, body } = await request(layoutPath(emptyRoom._id), {
      method: "POST",
      cookie: managerCookie,
      body: layoutBody(["a", "b"], ["VV.VV", "Da.xS"], { capacity: 999, operationalSeatCapacity: 999 }),
    });

    assert.equal(response.status, 201, JSON.stringify(body));
    const { layout, room } = body.data;
    assert.deepEqual(layout.rowLabels, ["A", "B"]);
    assert.equal(layout.layoutVersion, 1);
    assert.equal(layout.summary.operationalSeatCapacity, 7);
    assert.equal(layout.summary.aisleCount, 2);
    assert.equal(layout.summary.accessibleCount, 1);
    assert.equal(layout.summary.disabledCount, 1);
    assert.equal(room.capacity, 7);
    assert.deepEqual(
      layout.positions.filter(({ rowIndex }) => rowIndex === 0).map(({ seatNumber }) => seatNumber ?? null),
      [1, 2, null, 3, 4],
    );

    const stored = await Room.findById(emptyRoom._id).lean();
    assert.equal(stored.capacity, 7);
    assert.equal(stored.seats.length, 8);
    assert.ok(stored.seats.every((seat) => !("isBooked" in seat)));
    assert.equal(stored.seatLayout.updatedBy.toString().length, 24);
  });

  await t.test("refuses to create a second layout", async () => {
    const { response, body } = await request(layoutPath(emptyRoom._id), {
      method: "POST",
      cookie: managerCookie,
      body: layoutBody(["A"], ["SS"]),
    });
    assert.equal(response.status, 409);
    assert.equal(body.code, "SEAT_LAYOUT_ALREADY_EXISTS");
  });
});

test("PUT /rooms/:roomId/seat-layout", async (t) => {
  const fiveByEight = (overrides = {}) => {
    const rows = ["SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "SSSSSSSS"];
    for (const [index, row] of Object.entries(overrides)) rows[index] = row;
    return rows;
  };
  const labels = ["A", "B", "C", "D", "E"];

  await t.test("rejects an invalid matrix with field errors and leaves the room unchanged", async () => {
    const before = await Room.findById(legacyRoom._id).lean();
    const body = layoutBody(labels, fiveByEight(), { expectedLayoutVersion: 1 });
    body.rowLabels[4] = "A";
    body.positions.pop();
    body.positions[0].positionType = "BALCONY";

    const { response, body: result } = await putLayout(legacyRoom._id, body);
    assert.equal(response.status, 400);
    assert.equal(result.code, "INVALID_SEAT_LAYOUT");
    assert.ok(result.errors.some(({ field }) => field === "positions.0.positionType"));

    const matrixErrors = await putLayout(legacyRoom._id, {
      ...layoutBody(labels, fiveByEight(), { expectedLayoutVersion: 1 }),
      rowLabels: ["A", "B", "C", "D", "A"],
    });
    assert.equal(matrixErrors.response.status, 400);
    assert.ok(matrixErrors.body.errors.some(({ field }) => field === "rowLabels.4"));

    const after = await Room.findById(legacyRoom._id).lean();
    assert.deepEqual(after.seats, before.seats);
    assert.equal(after.layoutVersion, 1);
  });

  await t.test("rejects dimensions beyond the configured limits", async () => {
    const { response, body } = await putLayout(legacyRoom._id, {
      rowLabels: ["A"],
      columnCount: 41,
      positions: [{ rowIndex: 0, columnNumber: 1, positionType: "SEAT", seatType: "VIP" }],
      expectedLayoutVersion: 1,
    });
    assert.equal(response.status, 400);
    assert.ok(body.errors.some(({ field }) => field === "columnCount"));
  });

  await t.test("treats an unchanged save as a no-op", async () => {
    const { response, body } = await putLayout(
      legacyRoom._id,
      layoutBody(labels, fiveByEight(), { expectedLayoutVersion: 1 }),
    );
    assert.equal(response.status, 200);
    assert.equal(body.data.changed, false);
    assert.equal(body.data.layout.layoutVersion, 1);
    assert.equal(await RoomLayoutVersion.countDocuments({ roomId: legacyRoom._id }), 0);
  });

  await t.test("creates a new version and keeps the superseded one", async () => {
    const original = await Room.findById(legacyRoom._id).lean();
    const { response, body } = await putLayout(
      legacyRoom._id,
      layoutBody(labels, fiveByEight({ 0: "SSS..SSS", 4: "VVVaaVVV" }), { expectedLayoutVersion: 1 }),
    );

    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.data.changed, true);
    const { layout } = body.data;
    assert.equal(layout.layoutVersion, 2);
    // Aisles drop capacity by one each; accessible markers do not add any.
    assert.equal(layout.summary.operationalSeatCapacity, 38);
    assert.equal(layout.summary.vipCount, 6);
    assert.equal(layout.summary.accessibleCount, 2);

    const snapshot = await RoomLayoutVersion.findOne({ roomId: legacyRoom._id, layoutVersion: 1 }).lean();
    assert.equal(snapshot.seats.length, 40);
    assert.equal(snapshot.capacity, 40);
    assert.deepEqual(snapshot.rowLabels, labels);

    const stored = await Room.findById(legacyRoom._id).lean();
    const idOf = (seats, row, number) =>
      seats.find((seat) => seat.row === row && seat.number === number)._id.toString();
    assert.equal(idOf(stored.seats, "B", 3), idOf(original.seats, "B", 3));
    assert.equal(stored.capacity, 38);
  });

  await t.test("rejects a save based on a stale version", async () => {
    const { response, body } = await putLayout(
      legacyRoom._id,
      layoutBody(labels, fiveByEight(), { expectedLayoutVersion: 1 }),
    );
    assert.equal(response.status, 409);
    assert.equal(body.code, "SEAT_LAYOUT_VERSION_CONFLICT");
  });
});

test("published future showtime protection", async (t) => {
  const roomId = () => legacyRoom._id;
  const current = async () => (await Room.findById(roomId()).lean()).layoutVersion;
  const changeBody = async (rows) =>
    layoutBody(["A", "B", "C", "D", "E"], rows, { expectedLayoutVersion: await current() });
  const variantA = ["SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "DDDDDDDD"];
  const variantB = ["SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "VVVVVVVV"];

  t.afterEach(clearShowtimes);

  await t.test("locks the layout and rejects structural changes", async () => {
    await insertShowtime(roomId(), { layoutVersion: await current() });
    const versionBefore = await current();

    const { editability } = await getLayout(roomId());
    assert.deepEqual(editability, { locked: true, protectedShowtimeCount: 1 });

    const { response, body } = await putLayout(roomId(), await changeBody(variantA));
    assert.equal(response.status, 409);
    assert.equal(body.code, "SEAT_LAYOUT_IN_USE");
    assert.equal(await current(), versionBefore);
  });

  await t.test("fails closed for a published showtime without a layout version", async () => {
    await insertShowtime(roomId());
    const { response, body } = await putLayout(roomId(), await changeBody(variantA));
    assert.equal(response.status, 409);
    assert.equal(body.code, "SEAT_LAYOUT_IN_USE");
  });

  await t.test("ignores past, draft and older-version showtimes", async () => {
    const version = await current();
    await insertShowtime(roomId(), { layoutVersion: version, startsIn: -3 * HOUR });
    await insertShowtime(roomId(), { layoutVersion: version, status: "DRAFT" });
    await insertShowtime(roomId(), { layoutVersion: version - 1 });

    const { editability } = await getLayout(roomId());
    assert.equal(editability.locked, false);

    const { response, body } = await putLayout(roomId(), await changeBody(variantA));
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.data.layout.layoutVersion, version + 1);
    // The version those showtimes reference is still resolvable.
    assert.ok(await RoomLayoutVersion.exists({ roomId: roomId(), layoutVersion: version }));
  });

  await t.test("re-checks the lock at save time, not only on load", async () => {
    const { editability, layout } = await getLayout(roomId());
    assert.equal(editability.locked, false);

    // A showtime is published after the editor loaded but before the Manager saves.
    await insertShowtime(roomId(), { layoutVersion: layout.layoutVersion });

    const { response, body } = await putLayout(roomId(), await changeBody(variantB));
    assert.equal(response.status, 409);
    assert.equal(body.code, "SEAT_LAYOUT_IN_USE");
    assert.equal(await current(), layout.layoutVersion);
  });
});
