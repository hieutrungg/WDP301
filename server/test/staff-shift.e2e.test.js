import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.EMAIL_TEST_MODE = "capture";

const password = "Cinema@2026";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY_MS = 24 * HOUR;
// Fixed local day (Asia/Ho_Chi_Minh) far in the past: every shift on it has ended whatever the real
// clock says. Local time is written with its +07:00 offset.
const DAY = "2026-10-01";
const local = (time, day = DAY) => new Date(`${day}T${time}:00.000+07:00`);

let baseUrl;
let server;
let models;
let branchA;
let branchB;
let cookies;
let ids;
let shifts;

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

const list = (query = "", { cookie = cookies.manager, date = DAY } = {}) =>
  request(`/staff-shifts?${date ? `date=${date}&` : ""}${query}`, { cookie });
const names = (result) => result.body.data.map(({ employee }) => employee.fullName);
const post = (path, body = {}, cookie = cookies.manager) => request(path, { method: "POST", body, cookie });
const approve = (shiftId, body = {}, cookie = cookies.manager) => post(`/staff-shifts/${shiftId}/approve`, body, cookie);
const cancel = (shiftId, cookie = cookies.manager) => post(`/staff-shifts/${shiftId}/cancel`, {}, cookie);
const assign = (overrides = {}, cookie = cookies.manager) => {
  const start = Date.now() + 5 * DAY_MS;
  return post(
    "/staff-shifts",
    {
      employeeAccountId: ids.bao.toString(),
      station: "Box Office Station 2",
      startTime: new Date(start).toISOString(),
      endTime: new Date(start + 8 * HOUR).toISOString(),
      ...overrides,
    },
    cookie,
  );
};

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_staff_shift_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  const [{ Account }, { Role }, { Permission }, { Branch }, { StaffShift }, { default: app }] = await Promise.all([
    import("../src/modules/account/account.model.js"),
    import("../src/modules/role-permission/role.model.js"),
    import("../src/modules/role-permission/permission.model.js"),
    import("../src/modules/branch/branch.model.js"),
    import("../src/modules/staff-shift/staff-shift.model.js"),
    import("../src/app.js"),
  ]);
  models = { Account, StaffShift };

  await Promise.all([Account, Branch, StaffShift].map((model) => model.syncIndexes()));

  const [view, manage] = await Permission.create([
    { name: "shift.view", description: "View staff shifts" },
    { name: "shift.manage", description: "Manage staff shifts" },
  ]);
  const [managerRole, staffRole, adminRole, customerRole] = await Role.create([
    { name: "MANAGER", description: "Manager", permissionIds: [view._id, manage._id] },
    { name: "STAFF", description: "Staff", permissionIds: [view._id] },
    // ADMIN holds every permission in the seed; shift monitoring is still not an Admin screen.
    { name: "ADMIN", description: "Admin", permissionIds: [view._id, manage._id] },
    { name: "CUSTOMER", description: "Customer", permissionIds: [] },
  ]);

  const branches = await Branch.create([
    { branchName: "Test Central", address: "1 Test Street", status: "ACTIVE" },
    { branchName: "Test East", address: "2 Test Street", status: "ACTIVE" },
    { branchName: "Test Closed", address: "3 Test Street", status: "INACTIVE" },
  ]);
  const branchInactive = branches[2]._id;
  [branchA, branchB] = branches.map(({ _id }) => _id);
  const branchMissing = new mongoose.Types.ObjectId();

  // The role decides who is staff or manager; the employee profile says which branch they work at.
  const createAccount = (username, roleIds, { fullName = `Full ${username}`, status = "ACTIVE", branchId, position } = {}) =>
    Account.create({
      username,
      email: `${username}@example.com`,
      passwordHash: bcrypt.hashSync(password, 4),
      roleIds,
      status,
      profile: { fullName },
      ...(branchId ? { employeeProfile: { branchId, ...(position ? { position } : {}) } } : {}),
    });

  const [manager, , , , , , , , bao, mai, duc, ngoc, disabled, customerEmployee, noBranchEmployee, otherEmployee] = await Promise.all([
    createAccount("shift_mgr", [managerRole._id], { branchId: branchA, position: "Cinema Manager" }),
    createAccount("shift_mgr_two", [managerRole._id], { branchId: branchB }),
    createAccount("shift_mgr_nobranch", [managerRole._id]),
    createAccount("shift_mgr_closed", [managerRole._id], { branchId: branchInactive }),
    createAccount("shift_mgr_missing", [managerRole._id], { branchId: branchMissing }),
    createAccount("shift_admin", [adminRole._id], { branchId: branchA }),
    createAccount("shift_staff", [staffRole._id], { branchId: branchA }),
    createAccount("shift_customer", [customerRole._id]),
    createAccount("emp_bao", [staffRole._id], { fullName: "Nguyen Quoc Bao", branchId: branchA, position: "Box Office Lead" }),
    createAccount("emp_mai", [staffRole._id], { fullName: "Le Thi Mai Anh", branchId: branchA, position: "Concessions Cashier" }),
    createAccount("emp_duc", [staffRole._id], { fullName: "Pham Hoang Duc", branchId: branchA, position: "Gate Ticket Inspector" }),
    createAccount("emp_ngoc", [staffRole._id], { fullName: "Tran Bao Ngoc", branchId: branchA }),
    createAccount("emp_disabled", [staffRole._id], { fullName: "Disabled Person", status: "DISABLED", branchId: branchA }),
    createAccount("emp_customer", [customerRole._id], { fullName: "Not Staff Person", branchId: branchA }),
    createAccount("emp_nobranch", [staffRole._id], { fullName: "No Branch Person" }),
    createAccount("emp_other", [staffRole._id], { fullName: "Other Branch Person", branchId: branchB, position: "Usher" }),
  ]);
  ids = {
    manager: manager._id,
    bao: bao._id,
    mai: mai._id,
    duc: duc._id,
    ngoc: ngoc._id,
    disabled: disabled._id,
    customer: customerEmployee._id,
    noBranch: noBranchEmployee._id,
    other: otherEmployee._id,
  };

  const fixed = [
    ["completed", mai, branchA, "09:00", "17:00", "Concession Counter A", "SCHEDULED"],
    ["approved", duc, branchA, "10:00", "18:00", "Concierge Scanner Room B", "APPROVED"],
    ["cancelled", ngoc, branchA, "11:00", "19:00", "Popcorn Kitchen", "CANCELLED"],
    ["legacy", bao, branchA, "12:00", "20:00", "Counter POS #04", "PLANNED"],
    ["other", otherEmployee, branchB, "09:00", "17:00", "Other Station", "SCHEDULED"],
  ];
  const created = await StaffShift.create(
    fixed.map(([, employee, branchId, start, end, station, status]) => ({
      employeeAccountId: employee._id,
      branchId,
      startTime: local(start),
      endTime: local(end),
      station,
      status,
      ...(status === "APPROVED"
        ? {
            approvedBy: manager._id,
            approvedAt: local("19:30"),
            approvalNote: "Looks fine",
            createdBy: manager._id,
            createdAt: local("07:00"),
          }
        : {}),
      ...(status === "CANCELLED" ? { cancelledBy: manager._id, cancelledAt: local("08:00") } : {}),
    })),
  );
  shifts = Object.fromEntries(fixed.map(([key], index) => [key, created[index]]));

  // An overnight shift belongs to the day it starts.
  shifts.overnight = await StaffShift.create({
    employeeAccountId: bao._id,
    branchId: branchA,
    startTime: local("22:00"),
    endTime: local("06:00", "2026-10-02"),
    station: "Night Gate",
    status: "SCHEDULED",
  });

  const listener = await new Promise((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  server = listener;
  baseUrl = `http://127.0.0.1:${listener.address().port}/api`;

  cookies = {
    manager: await signIn("shift_mgr"),
    managerB: await signIn("shift_mgr_two"),
    managerNoBranch: await signIn("shift_mgr_nobranch"),
    managerClosed: await signIn("shift_mgr_closed"),
    managerMissing: await signIn("shift_mgr_missing"),
    admin: await signIn("shift_admin"),
    staff: await signIn("shift_staff"),
    customer: await signIn("shift_customer"),
  };
});

after(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("every staff shift route is default-deny", async () => {
  const shiftId = shifts.completed._id.toString();

  for (const [method, path] of [
    ["GET", "/staff-shifts/dashboard"],
    ["GET", "/staff-shifts/stations"],
    ["GET", "/staff-shifts/employees"],
    ["GET", "/staff-shifts"],
    ["POST", "/staff-shifts"],
    ["GET", `/staff-shifts/${shiftId}`],
    ["POST", `/staff-shifts/${shiftId}/cancel`],
    ["POST", `/staff-shifts/${shiftId}/approve`],
  ]) {
    assert.equal((await request(path, { method })).response.status, 401, `${method} ${path} anonymous`);

    for (const role of ["customer", "staff", "admin"]) {
      // Staff holds shift.view but is not the Manager; Admin holds every permission but is not an actor of UC38.
      const denied = await request(path, { method, cookie: cookies[role] });
      assert.equal(denied.response.status, 403, `${method} ${path} ${role}`);
    }
  }
});

test("a manager without a branch gets BRANCH_NOT_ASSIGNED on every route", async () => {
  const shiftId = shifts.completed._id.toString();

  for (const [method, path, body] of [
    ["GET", "/staff-shifts/dashboard"],
    ["GET", "/staff-shifts/stations"],
    ["GET", "/staff-shifts/employees"],
    ["GET", `/staff-shifts?date=${DAY}`],
    ["GET", `/staff-shifts/${shiftId}`],
    ["POST", `/staff-shifts/${shiftId}/cancel`, {}],
    ["POST", `/staff-shifts/${shiftId}/approve`, {}],
    [
      "POST",
      "/staff-shifts",
      {
        employeeAccountId: ids.bao.toString(),
        station: "X",
        startTime: new Date(Date.now() + 6 * DAY_MS).toISOString(),
        endTime: new Date(Date.now() + 6 * DAY_MS + HOUR).toISOString(),
      },
    ],
  ]) {
    const result = await request(path, { method, body, cookie: cookies.managerNoBranch });
    assert.equal(result.response.status, 403, `${method} ${path}`);
    assert.equal(result.body.code, "BRANCH_NOT_ASSIGNED", `${method} ${path}`);
  }
});

test("the branch is never a request field", async () => {
  const query = await request(`/staff-shifts?branchId=${branchB}&date=${DAY}`, { cookie: cookies.manager });
  assert.equal(query.response.status, 400);
  assert.equal(query.body.code, "INVALID_QUERY");

  const dashboard = await request(`/staff-shifts/dashboard?branchId=${branchB}`, { cookie: cookies.manager });
  assert.equal(dashboard.response.status, 400);

  const body = await assign({ branchId: branchB.toString() });
  assert.equal(body.response.status, 400);
  assert.equal(body.body.code, "VALIDATION_FAILED");
});

test("a manager whose branch no longer exists gets BRANCH_NOT_FOUND", async () => {
  for (const path of ["/staff-shifts/dashboard", `/staff-shifts?date=${DAY}`, "/staff-shifts/stations"]) {
    const result = await request(path, { cookie: cookies.managerMissing });
    assert.equal(result.response.status, 404, path);
    assert.equal(result.body.code, "BRANCH_NOT_FOUND", path);
  }
});

test("the list shows the manager's own branch, newest start first, with derived statuses and no attendance data", async () => {
  const result = await list("limit=50");

  assert.equal(result.response.status, 200);
  assert.equal(result.body.meta.total, 5, "4 day shifts + the overnight shift that starts on this date");
  assert.ok(!names(result).includes("Other Branch Person"), "another branch is never listed");

  const starts = result.body.data.map(({ startTime }) => Date.parse(startTime));
  assert.deepEqual(starts, [...starts].sort((left, right) => right - left));

  const byStation = Object.fromEntries(result.body.data.map((row) => [row.station, row]));
  assert.equal(byStation["Concession Counter A"].status, "COMPLETED", "a past SCHEDULED shift shows as completed");
  assert.equal(byStation["Concession Counter A"].canApprove, true);
  assert.equal(byStation["Concession Counter A"].employee.position, "Concessions Cashier", "the job title comes from the employee profile");
  assert.equal(byStation["Concierge Scanner Room B"].status, "APPROVED");
  assert.equal(byStation["Concierge Scanner Room B"].approval.approvedBy.fullName, "Full shift_mgr");
  assert.equal(byStation["Popcorn Kitchen"].status, "CANCELLED");
  assert.equal(byStation["Counter POS #04"].status, "COMPLETED", "an unknown legacy status is read as scheduled");

  for (const row of result.body.data) {
    for (const field of ["clockInAt", "clockOutAt", "terminal", "discrepancies"]) {
      assert.equal(field in row, false, `${field} is not part of the response`);
    }
  }

  const other = await list("limit=50", { cookie: cookies.managerB });
  assert.deepEqual(names(other), ["Other Branch Person"]);
  assert.equal(other.body.data[0].station, "Other Station");
});

test("a shift belongs to the local date it starts on", async () => {
  const nextDay = await list("", { date: "2026-10-02" });
  assert.equal(nextDay.body.meta.total, 0, "the overnight shift is not repeated on the next day");

  const range = await request("/staff-shifts?dateFrom=2026-10-01&dateTo=2026-10-02&limit=50", { cookie: cookies.manager });
  assert.equal(range.body.meta.total, 5);
});

test("filters by employee name, status and position, and paginates", async () => {
  assert.deepEqual(names(await list("q=Mai%20Anh")), ["Le Thi Mai Anh"]);
  assert.equal((await list("q=bao&limit=50")).body.meta.total, 3, "Bao matches Nguyen Quoc Bao x2 and Tran Bao Ngoc");
  assert.equal((await list("q=nobody")).body.meta.total, 0);

  assert.deepEqual(names(await list("status=APPROVED")), ["Pham Hoang Duc"]);
  assert.deepEqual(names(await list("status=CANCELLED")), ["Tran Bao Ngoc"]);
  assert.equal((await list("status=COMPLETED")).body.meta.total, 3);
  assert.equal((await list("status=IN_PROGRESS")).body.meta.total, 0);

  assert.deepEqual(names(await list("station=Popcorn%20Kitchen")), ["Tran Bao Ngoc"]);
  assert.deepEqual(names(await list("q=Tran&status=CANCELLED&station=Popcorn%20Kitchen")), ["Tran Bao Ngoc"]);

  const first = await list("limit=2&page=1");
  const last = await list("limit=2&page=3");
  assert.deepEqual(first.body.meta, { page: 1, limit: 2, total: 5, totalPages: 3 });
  assert.equal(last.body.data.length, 1);
});

test("invalid list queries are rejected with INVALID_QUERY", async () => {
  for (const query of [
    "date=2026-13-45",
    "date=20261001",
    `date=${DAY}&dateFrom=${DAY}`,
    "dateFrom=2026-10-05&dateTo=2026-10-01",
    "dateFrom=2026-01-01&dateTo=2026-12-31",
    "dateTo=2026-10-01",
    "status=SLEEPING",
    "status=ABSENT",
    "limit=500",
    "unknown=1",
  ]) {
    const result = await request(`/staff-shifts?${query}`, { cookie: cookies.manager });
    assert.equal(result.response.status, 400, query);
    assert.equal(result.body.code, "INVALID_QUERY", query);
  }
});

test("a shift's detail has a chronological history of what was done to it", async () => {
  const result = await request(`/staff-shifts/${shifts.approved._id}`, { cookie: cookies.manager });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.status, "APPROVED");
  assert.deepEqual(result.body.data.history.map(({ type }) => type), ["CREATED", "APPROVED"]);
  assert.equal(result.body.data.history[1].note, "Looks fine");
  assert.equal(result.body.data.history[1].by.fullName, "Full shift_mgr");

  const unknown = await request(`/staff-shifts/${new mongoose.Types.ObjectId()}`, { cookie: cookies.manager });
  assert.equal(unknown.response.status, 404);
  assert.equal(unknown.body.code, "SHIFT_NOT_FOUND");

  const badId = await request("/staff-shifts/not-an-id", { cookie: cookies.manager });
  assert.equal(badId.response.status, 400);
  assert.equal(badId.body.code, "INVALID_SHIFT_ID");
});

test("a manager cannot read, cancel or approve a shift of another branch", async () => {
  const otherShift = shifts.other._id.toString();
  const ownShift = shifts.completed._id.toString();

  for (const [label, result] of [
    ["detail", await request(`/staff-shifts/${otherShift}`, { cookie: cookies.manager })],
    ["cancel", await cancel(otherShift)],
    ["approve", await approve(otherShift)],
    ["detail of mine by the other manager", await request(`/staff-shifts/${ownShift}`, { cookie: cookies.managerB })],
    ["cancel of mine by the other manager", await cancel(ownShift, cookies.managerB)],
    ["approve of mine by the other manager", await approve(ownShift, {}, cookies.managerB)],
  ]) {
    assert.equal(result.response.status, 404, label);
    assert.equal(result.body.code, "SHIFT_NOT_FOUND", label);
  }

  assert.equal((await models.StaffShift.findById(shifts.other._id).lean()).status, "SCHEDULED", "nothing changed");
});

test("the employee picker lists only active staff of the manager's branch, with their job title", async () => {
  const all = await request("/staff-shifts/employees", { cookie: cookies.manager });
  assert.equal(all.response.status, 200);
  const fullNames = all.body.data.map(({ fullName }) => fullName);

  for (const expected of ["Nguyen Quoc Bao", "Le Thi Mai Anh", "Pham Hoang Duc", "Tran Bao Ngoc"]) {
    assert.ok(fullNames.includes(expected), expected);
  }
  assert.ok(!fullNames.includes("Other Branch Person"), "staff of another branch is not offered");
  assert.ok(!fullNames.includes("No Branch Person"), "staff without a branch is not offered");
  assert.ok(!fullNames.includes("Disabled Person"), "a disabled account is not offered");
  assert.ok(!fullNames.includes("Not Staff Person"), "an account without the STAFF role is not offered");
  assert.ok(!fullNames.includes("Full shift_mgr"), "a manager is not offered as an employee");
  assert.equal(all.body.data.find(({ fullName }) => fullName === "Nguyen Quoc Bao").position, "Box Office Lead");

  const searched = await request("/staff-shifts/employees?q=bao", { cookie: cookies.manager });
  assert.deepEqual(searched.body.data.map(({ fullName }) => fullName).sort(), ["Nguyen Quoc Bao", "Tran Bao Ngoc"]);

  const otherManager = await request("/staff-shifts/employees", { cookie: cookies.managerB });
  assert.deepEqual(otherManager.body.data.map(({ fullName }) => fullName), ["Other Branch Person"]);
});

test("assigning a shift creates a scheduled shift in the manager's branch with the creator recorded", async () => {
  const result = await assign({ station: "  Box Office Station 2  " });

  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.status, "SCHEDULED");
  assert.equal(result.body.data.station, "Box Office Station 2");
  assert.equal(result.body.data.canCancel, true);
  assert.equal(result.body.data.createdBy.fullName, "Full shift_mgr");
  assert.equal(result.body.data.employee.fullName, "Nguyen Quoc Bao");
  assert.equal(result.body.data.branchId, branchA.toString());

  const stored = await models.StaffShift.findById(result.body.data.id).lean();
  assert.equal(stored.status, "SCHEDULED");
  assert.equal(stored.branchId.toString(), branchA.toString(), "the branch comes from the manager, not the request");
  assert.equal(stored.createdBy.toString(), ids.manager.toString());

  const stations = await request("/staff-shifts/stations", { cookie: cookies.manager });
  assert.ok(stations.body.data.includes("Box Office Station 2"));
  assert.ok(!stations.body.data.includes(null));
  const otherStations = await request("/staff-shifts/stations", { cookie: cookies.managerB });
  assert.ok(!otherStations.body.data.includes("Box Office Station 2"), "stations are per branch");
});

test("assigning validates the input and the business rules", async () => {
  const future = Date.now() + 9 * DAY_MS;
  const slot = (offsetHours, hours = 8) => ({
    startTime: new Date(future + offsetHours * HOUR).toISOString(),
    endTime: new Date(future + (offsetHours + hours) * HOUR).toISOString(),
  });

  for (const [label, overrides] of [
    ["missing position", { station: "   " }],
    ["position too long", { station: "x".repeat(101) }],
    ["bad employee id", { employeeAccountId: "nope" }],
    ["end before start", { startTime: slot(8).endTime, endTime: slot(8).startTime }],
    ["no time zone offset", { startTime: "2030-01-01T08:00:00" }],
    ["unknown field", { clockInAt: new Date().toISOString() }],
  ]) {
    const result = await assign({ ...slot(0), ...overrides });
    assert.equal(result.response.status, 400, label);
    assert.equal(result.body.code, "VALIDATION_FAILED", label);
  }

  const past = await assign({ startTime: new Date(Date.now() - HOUR).toISOString(), endTime: new Date(Date.now() + HOUR).toISOString() });
  assert.equal(past.response.status, 409);
  assert.equal(past.body.code, "SHIFT_IN_THE_PAST");

  const tooLong = await assign(slot(0, 13));
  assert.equal(tooLong.response.status, 409);
  assert.equal(tooLong.body.code, "SHIFT_TOO_LONG");

  for (const [label, employeeAccountId] of [
    ["a customer", ids.customer],
    ["a disabled account", ids.disabled],
    ["an unknown account", new mongoose.Types.ObjectId()],
    ["a manager", ids.manager],
    ["a staff of another branch", ids.other],
    ["a staff without a branch", ids.noBranch],
  ]) {
    const result = await assign({ ...slot(0), employeeAccountId: employeeAccountId.toString() });
    assert.equal(result.response.status, 404, label);
    assert.equal(result.body.code, "EMPLOYEE_NOT_FOUND", label);
  }

  const inactiveBranch = await assign(slot(0), cookies.managerClosed);
  assert.equal(inactiveBranch.response.status, 409);
  assert.equal(inactiveBranch.body.code, "BRANCH_INACTIVE");
});

test("an employee cannot get two overlapping shifts, but back-to-back and cancelled ones are fine", async () => {
  const base = Date.now() + 20 * DAY_MS;
  const window = (startHours, endHours) => ({
    startTime: new Date(base + startHours * HOUR).toISOString(),
    endTime: new Date(base + endHours * HOUR).toISOString(),
    employeeAccountId: ids.duc.toString(),
  });

  const first = await assign(window(0, 8));
  assert.equal(first.response.status, 201);

  const overlap = await assign(window(4, 12));
  assert.equal(overlap.response.status, 409);
  assert.equal(overlap.body.code, "SHIFT_OVERLAP");

  assert.equal((await assign(window(8, 16))).response.status, 201, "starting exactly when the previous one ends is allowed");

  assert.equal((await cancel(first.body.data.id)).response.status, 200);
  assert.equal((await assign(window(0, 8))).response.status, 201, "a cancelled shift no longer blocks the slot");
});

test("cancelling keeps the shift, records who cancelled, and works once, before it starts", async () => {
  const created = await assign({ employeeAccountId: ids.mai.toString() });
  const result = await cancel(created.body.data.id);

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.status, "CANCELLED");
  assert.equal(result.body.data.cancellation.cancelledBy.fullName, "Full shift_mgr");
  assert.equal(result.body.data.canCancel, false);
  assert.ok(await models.StaffShift.findById(created.body.data.id), "the shift is not deleted");

  const again = await cancel(created.body.data.id);
  assert.equal(again.response.status, 409);
  assert.equal(again.body.code, "SHIFT_ALREADY_CANCELLED");

  for (const key of ["completed", "approved"]) {
    const refused = await cancel(shifts[key]._id.toString());
    assert.equal(refused.response.status, 409, key);
    assert.equal(refused.body.code, "SHIFT_NOT_CANCELLABLE", key);
  }

  const missing = await cancel(new mongoose.Types.ObjectId().toString());
  assert.equal(missing.response.status, 404);
});

test("a shift that is in progress can be neither cancelled nor approved", async () => {
  const now = Date.now();
  const running = await models.StaffShift.create({
    employeeAccountId: ids.ngoc,
    branchId: branchA,
    startTime: new Date(now - 60 * MINUTE),
    endTime: new Date(now + 7 * HOUR),
    station: "Live Station",
    status: "SCHEDULED",
  });

  const cancelled = await cancel(running._id.toString());
  assert.equal(cancelled.response.status, 409);
  assert.equal(cancelled.body.code, "SHIFT_NOT_CANCELLABLE");

  const approved = await approve(running._id.toString());
  assert.equal(approved.response.status, 409);
  assert.equal(approved.body.code, "SHIFT_NOT_APPROVABLE");

  assert.equal((await models.StaffShift.findById(running._id).lean()).status, "SCHEDULED", "nothing changed");
  // Live shifts depend on the real clock; remove it so later tests start from the fixed dataset.
  await models.StaffShift.deleteOne({ _id: running._id });
});

test("approving a finished shift stores the approver and time, and works once", async () => {
  const result = await approve(shifts.completed._id.toString(), { note: "  Checked against the roster  " });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.status, "APPROVED");
  assert.equal(result.body.data.approval.note, "Checked against the roster");
  assert.equal(result.body.data.approval.approvedBy.fullName, "Full shift_mgr");
  assert.equal(result.body.data.canApprove, false);

  const stored = await models.StaffShift.findById(shifts.completed._id).lean();
  assert.equal(stored.status, "APPROVED");
  assert.equal(stored.approvedBy.toString(), ids.manager.toString());
  assert.ok(stored.approvedAt instanceof Date);
  assert.equal(stored.startTime.toISOString(), local("09:00").toISOString(), "the planned window is untouched");

  const again = await approve(shifts.completed._id.toString());
  assert.equal(again.response.status, 409);
  assert.equal(again.body.code, "SHIFT_ALREADY_APPROVED");

  assert.equal((await list("status=APPROVED&limit=50")).body.meta.total, 2);
});

test("a cancelled or unfinished shift cannot be approved, and the input is validated", async () => {
  const cancelled = await approve(shifts.cancelled._id.toString());
  assert.equal(cancelled.response.status, 409);
  assert.equal(cancelled.body.code, "SHIFT_NOT_APPROVABLE");

  const upcoming = await assign({ employeeAccountId: ids.ngoc.toString() });
  const early = await approve(upcoming.body.data.id);
  assert.equal(early.response.status, 409);
  assert.equal(early.body.code, "SHIFT_NOT_APPROVABLE");

  const tooLong = await approve(shifts.legacy._id.toString(), { note: "x".repeat(501) });
  assert.equal(tooLong.response.status, 400);
  assert.equal(tooLong.body.code, "VALIDATION_FAILED");

  const unknownField = await approve(shifts.legacy._id.toString(), { approvedBy: "someone" });
  assert.equal(unknownField.response.status, 400);

  assert.notEqual((await models.StaffShift.findById(shifts.legacy._id).lean()).status, "APPROVED");
});

test("concurrent approvals of the same shift succeed exactly once", async () => {
  const results = await Promise.all([approve(shifts.legacy._id.toString()), approve(shifts.legacy._id.toString())]);

  assert.deepEqual(results.map(({ response }) => response.status).sort(), [200, 409]);
  const losing = results.find(({ response }) => response.status === 409);
  assert.equal(losing.body.code, "SHIFT_ALREADY_APPROVED");
  assert.equal((await models.StaffShift.findById(shifts.legacy._id).lean()).status, "APPROVED");
});

test("the dashboard summarizes today's shifts and what is in progress for the manager's branch", async () => {
  const now = Date.now();
  const [running] = await models.StaffShift.create([
    {
      employeeAccountId: ids.bao,
      branchId: branchA,
      startTime: new Date(now - 60 * MINUTE),
      endTime: new Date(now + 7 * HOUR),
      station: "Dashboard Station",
      status: "SCHEDULED",
    },
  ]);

  const result = await request("/staff-shifts/dashboard", { cookie: cookies.manager });
  assert.equal(result.response.status, 200);

  const { totals, stations, inProgress, upcoming, branch } = result.body.data;
  assert.equal(branch.branchName, "Test Central");
  assert.equal(totals.inProgress, 1);
  assert.deepEqual(stations, [{ station: "Dashboard Station", inProgress: 1 }]);
  assert.equal(inProgress[0].id, running._id.toString());
  assert.equal(inProgress[0].employee.fullName, "Nguyen Quoc Bao");
  assert.equal(inProgress[0].employee.position, "Box Office Lead");
  assert.ok(Array.isArray(upcoming));

  const otherBranch = await request("/staff-shifts/dashboard", { cookie: cookies.managerB });
  assert.equal(otherBranch.body.data.branch.branchName, "Test East");
  assert.equal(otherBranch.body.data.totals.inProgress, 0, "another branch does not see these shifts");

  await models.StaffShift.deleteOne({ _id: running._id });
});
