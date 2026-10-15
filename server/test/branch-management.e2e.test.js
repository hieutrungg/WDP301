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
let Branch;
let adminCookie;
let customerCookie;
let directGrantCookie;
let managerCookie;
let lockedCookie;

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

const createAccount = (username, { roleIds = [], directPermissionIds = [] } = {}) =>
  Account.create({
    username,
    email: `${username}@example.com`,
    passwordHash: bcrypt.hashSync(password, 4),
    roleIds,
    directPermissionIds,
    status: "ACTIVE",
    profile: { fullName: username },
  });

const createBranch = async (body) => {
  const result = await request("/branches", { method: "POST", cookie: adminCookie, body });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  return result.body.data;
};

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_branch_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  ({ Account } = await import("../src/modules/account/account.model.js"));
  ({ Branch } = await import("../src/modules/branch/branch.model.js"));
  const { Role } = await import("../src/modules/role-permission/role.model.js");
  const { Permission } = await import("../src/modules/role-permission/permission.model.js");
  const { default: app } = await import("../src/app.js");

  await Promise.all([Account.syncIndexes(), Branch.syncIndexes()]);

  const [branchView, branchManage] = await Permission.create([
    { name: "branch.view", description: "View cinema branches" },
    { name: "branch.manage", description: "Manage cinema branches" },
  ]);
  const [adminRole, customerRole, managerRole] = await Role.create([
    { name: "ADMIN", description: "System administrator", permissionIds: [branchView._id, branchManage._id] },
    { name: "CUSTOMER", description: "Cinema customer", permissionIds: [branchView._id] },
    // The seed also grants branch.manage to MANAGER; the module is still Admin-only.
    { name: "MANAGER", description: "Cinema manager", permissionIds: [branchView._id, branchManage._id] },
  ]);

  await createAccount("branch_admin", { roleIds: [adminRole._id] });
  await createAccount("branch_customer", { roleIds: [customerRole._id] });
  await createAccount("branch_direct", {
    roleIds: [customerRole._id],
    directPermissionIds: [branchManage._id],
  });
  await createAccount("branch_manager", { roleIds: [managerRole._id] });
  await createAccount("branch_locked", { roleIds: [adminRole._id] });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  adminCookie = await signIn("branch_admin");
  customerCookie = await signIn("branch_customer");
  directGrantCookie = await signIn("branch_direct");
  managerCookie = await signIn("branch_manager");
  lockedCookie = await signIn("branch_locked");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("branch management authorization", async (t) => {
  await t.test("rejects anonymous requests with 401", async () => {
    const { response } = await request("/branches");
    assert.equal(response.status, 401);
  });

  await t.test("rejects accounts without branch.manage with 403", async () => {
    const { response, body } = await request("/branches", { cookie: customerCookie });
    assert.equal(response.status, 403);
    assert.equal(body.code, "FORBIDDEN");
  });

  await t.test("rejects a MANAGER even though it holds branch.manage", async () => {
    const read = await request("/branches", { cookie: managerCookie });
    assert.equal(read.response.status, 403);
    assert.equal(read.body.code, "FORBIDDEN");

    const write = await request("/branches", {
      method: "POST",
      cookie: managerCookie,
      body: { branchName: "Manager Attempt", address: "1 Test Street, HCMC" },
    });
    assert.equal(write.response.status, 403);
  });

  await t.test("a direct grant alone does not replace the ADMIN role", async () => {
    const { response } = await request("/branches", { cookie: directGrantCookie });
    assert.equal(response.status, 403);
  });

  await t.test("applies an account lock on the very next request", async () => {
    await Account.updateOne({ username: "branch_locked" }, { $set: { status: "DISABLED" } });
    const { response } = await request("/branches", { cookie: lockedCookie });
    assert.equal(response.status, 403);
  });
});

test("POST /branches", async (t) => {
  await t.test("creates a branch with normalized fields", async () => {
    const branch = await createBranch({
      branchName: "  F-Cinema   Central  ",
      address: "123 Nguyen Hue, Ho Chi Minh City",
      email: " Central@F-Cinema.Example ",
      hotline: "1900 1001",
    });

    assert.equal(branch.branchName, "F-Cinema Central");
    assert.equal(branch.email, "central@f-cinema.example");
    assert.equal(branch.hotline, "19001001");
    assert.equal(branch.status, "ACTIVE");
    assert.equal(branch.roomCount, 0);
    assert.equal(branch.upcomingShowtimeCount, 0);
  });

  await t.test("treats blank optional contacts as absent", async () => {
    const branch = await createBranch({
      branchName: "F-Cinema East",
      address: "456 Vo Nguyen Giap, Ho Chi Minh City",
      email: "",
      hotline: "   ",
      status: "INACTIVE",
    });

    assert.equal(branch.email, null);
    assert.equal(branch.hotline, null);
    assert.equal(branch.status, "INACTIVE");
  });

  await t.test("rejects a name that differs only by case or spacing", async () => {
    const { response, body } = await request("/branches", {
      method: "POST",
      cookie: adminCookie,
      body: { branchName: "f-cinema  CENTRAL", address: "Another address 1" },
    });

    assert.equal(response.status, 409);
    assert.equal(body.code, "BRANCH_NAME_TAKEN");
    assert.equal(body.errors[0].field, "branchName");
  });

  await t.test("returns field errors for invalid input", async () => {
    const { response, body } = await request("/branches", {
      method: "POST",
      cookie: adminCookie,
      body: { branchName: "X", email: "not-an-email", hotline: "12", status: "CLOSED" },
    });

    assert.equal(response.status, 400);
    assert.equal(body.code, "VALIDATION_FAILED");
    const fields = new Set(body.errors.map(({ field }) => field));
    for (const field of ["branchName", "address", "email", "hotline", "status"]) {
      assert.ok(fields.has(field), `expected an error for ${field}`);
    }
  });
});

test("GET /branches", async (t) => {
  await createBranch({ branchName: "F-Cinema Da Nang Riverside", address: "910A Ngo Quyen, Da Nang" });

  await t.test("paginates with meta", async () => {
    const { response, body } = await request("/branches?limit=2&page=1", { cookie: adminCookie });

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 2);
    assert.deepEqual(body.meta, { page: 1, limit: 2, total: 3, totalPages: 2 });
    assert.deepEqual(
      body.data.map(({ branchName }) => branchName),
      ["F-Cinema Central", "F-Cinema Da Nang Riverside"],
    );
  });

  await t.test("searches name, address and contacts", async () => {
    const byAddress = await request("/branches?q=ngo%20quyen", { cookie: adminCookie });
    assert.deepEqual(byAddress.body.data.map(({ branchName }) => branchName), ["F-Cinema Da Nang Riverside"]);

    const byHotline = await request("/branches?q=19001001", { cookie: adminCookie });
    assert.equal(byHotline.body.meta.total, 1);

    const regexSafe = await request("/branches?q=(.*", { cookie: adminCookie });
    assert.equal(regexSafe.response.status, 200);
    assert.equal(regexSafe.body.meta.total, 0);
  });

  await t.test("filters by status", async () => {
    const { body } = await request("/branches?status=INACTIVE", { cookie: adminCookie });
    assert.deepEqual(body.data.map(({ branchName }) => branchName), ["F-Cinema East"]);
  });

  await t.test("rejects unknown or out-of-range query parameters", async () => {
    for (const query of ["limit=500", "status=CLOSED", "sort=password", "region=north"]) {
      const { response, body } = await request(`/branches?${query}`, { cookie: adminCookie });
      assert.equal(response.status, 400, query);
      assert.equal(body.code, "INVALID_QUERY", query);
    }
  });

  await t.test("summarizes status and room counts", async () => {
    const { body } = await request("/branches/summary", { cookie: adminCookie });
    assert.deepEqual(body.data, { total: 3, active: 2, inactive: 1, roomCount: 0 });
  });
});

test("GET and PATCH /branches/:branchId", async (t) => {
  const branch = await createBranch({
    branchName: "F-Cinema Saigon Centre",
    address: "65 Le Loi Boulevard, District 1",
    email: "saigon@f-cinema.example",
    hotline: "19001007",
  });

  await t.test("validates the id and reports a missing branch", async () => {
    const invalid = await request("/branches/not-an-id", { cookie: adminCookie });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.code, "INVALID_BRANCH_ID");

    const missing = await request(`/branches/${new mongoose.Types.ObjectId()}`, { cookie: adminCookie });
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.code, "BRANCH_NOT_FOUND");
  });

  await t.test("updates contacts and clears an optional field", async () => {
    const { response, body } = await request(`/branches/${branch.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { hotline: "028 3822 0000", email: "" },
    });

    assert.equal(response.status, 200);
    assert.equal(body.data.hotline, "02838220000");
    assert.equal(body.data.email, null);
    const stored = await Branch.findById(branch.id).lean();
    assert.equal("email" in stored, false);
  });

  await t.test("allows re-casing its own name but not taking another one", async () => {
    const recase = await request(`/branches/${branch.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { branchName: "F-CINEMA Saigon Centre" },
    });
    assert.equal(recase.response.status, 200);

    const clash = await request(`/branches/${branch.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { branchName: "F-Cinema Central" },
    });
    assert.equal(clash.response.status, 409);
    assert.equal(clash.body.code, "BRANCH_NAME_TAKEN");
  });

  await t.test("never changes status through the general update", async () => {
    const { response, body } = await request(`/branches/${branch.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { address: "65 Le Loi Boulevard, Ben Nghe Ward, District 1", status: "INACTIVE" },
    });

    assert.equal(response.status, 200);
    assert.equal(body.data.status, "ACTIVE");
  });

  await t.test("rejects an empty update", async () => {
    const { response } = await request(`/branches/${branch.id}`, { method: "PATCH", cookie: adminCookie, body: {} });
    assert.equal(response.status, 400);
  });
});

test("PATCH /branches/:branchId/status", async (t) => {
  const branch = await createBranch({ branchName: "F-Cinema Landmark 81", address: "720A Dien Bien Phu, Binh Thanh" });
  const branchId = new mongoose.Types.ObjectId(branch.id);
  const roomId = new mongoose.Types.ObjectId();
  const db = mongoose.connection.db;
  const now = Date.now();

  await db.collection("rooms").insertOne({ _id: roomId, branchId, roomName: "Room 01", status: "ACTIVE" });
  const { insertedIds } = await db.collection("showtimes").insertMany([
    { roomId, status: "PUBLISHED", startAt: new Date(now + 24 * HOUR) },
    { roomId, status: "PUBLISHED", startAt: new Date(now - 24 * HOUR) },
    { roomId, status: "DRAFT", startAt: new Date(now + 48 * HOUR) },
  ]);

  const setStatus = (status) =>
    request(`/branches/${branch.id}/status`, { method: "PATCH", cookie: adminCookie, body: { status } });

  await t.test("reports dependencies on the detail view", async () => {
    const { body } = await request(`/branches/${branch.id}`, { cookie: adminCookie });
    assert.equal(body.data.roomCount, 1);
    assert.equal(body.data.upcomingShowtimeCount, 1);
  });

  await t.test("blocks INACTIVE while a future published showtime exists", async () => {
    const { response, body } = await setStatus("INACTIVE");
    assert.equal(response.status, 409);
    assert.equal(body.code, "BRANCH_HAS_FUTURE_SHOWTIMES");
    assert.equal((await Branch.findById(branch.id).lean()).status, "ACTIVE");
  });

  await t.test("also blocks on the legacy startTime field", async () => {
    await db.collection("showtimes").deleteOne({ _id: insertedIds[0] });
    await db.collection("showtimes").insertOne({ roomId, status: "PUBLISHED", startTime: new Date(now + HOUR) });

    const { response } = await setStatus("INACTIVE");
    assert.equal(response.status, 409);
    await db.collection("showtimes").deleteMany({ startTime: { $exists: true } });
  });

  await t.test("allows INACTIVE once only past or draft showtimes remain", async () => {
    const { response, body } = await setStatus("INACTIVE");
    assert.equal(response.status, 200);
    assert.equal(body.data.status, "INACTIVE");
  });

  await t.test("is idempotent and can re-activate", async () => {
    assert.equal((await setStatus("INACTIVE")).response.status, 200);

    const { body } = await setStatus("ACTIVE");
    assert.equal(body.data.status, "ACTIVE");
  });

  await t.test("rejects an unknown status", async () => {
    const { response, body } = await setStatus("DELETED");
    assert.equal(response.status, 400);
    assert.equal(body.code, "VALIDATION_FAILED");
  });
});
