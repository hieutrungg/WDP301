import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

// ROLE-101..103 (UC45-47) and STAFF-101 (UC35-37) against a throwaway database that is dropped
// before and after the run. Never points at the development database.
process.env.NODE_ENV = "test";
process.env.EMAIL_TEST_MODE = "capture";

const password = "Cinema@2026";

let baseUrl;
let server;
let Account;
let AuditLog;
let takeTestEmails;
let EmailVerification;
let adminCookie;
let managerCookie;
let directGrantCookie;
let adminAccount;
const roles = {};
const permissions = {};

const request = async (path, { method = "GET", body, cookie } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
};

const signIn = async (identity, secret = password) => {
  const result = await request("/auth/login", { method: "POST", body: { identity, password: secret } });
  return { ...result, cookie: result.response.headers.get("set-cookie")?.split(";")[0] };
};

const cookieFor = async (identity) => {
  const result = await signIn(identity);
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  return result.cookie;
};

const seedAccount = (username, { roleIds = [], directPermissionIds = [], phone } = {}) =>
  Account.create({
    username,
    email: `${username}@example.com`,
    phone,
    passwordHash: bcrypt.hashSync(password, 4),
    roleIds,
    directPermissionIds,
    status: "ACTIVE",
    profile: { fullName: username },
  });

const ids = (...names) => names.map((name) => permissions[name]._id.toString());

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_rbac_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  ({ Account } = await import("../src/modules/account/account.model.js"));
  ({ AuditLog } = await import("../src/modules/audit/audit-log.model.js"));
  ({ EmailVerification } = await import("../src/modules/auth/email-verification.model.js"));
  ({ takeTestEmails } = await import("../src/modules/auth/email.service.js"));
  const { Role } = await import("../src/modules/role-permission/role.model.js");
  const { Permission } = await import("../src/modules/role-permission/permission.model.js");
  const { default: app } = await import("../src/app.js");

  await Account.syncIndexes();

  const catalog = [
    "account.manage", "role.view", "role.manage", "permission.view", "permission.assign",
    "staff.manage", "movie.view", "movie.create", "ticket.validate", "report.view",
  ];
  for (const permission of await Permission.create(catalog.map((name) => ({ name, description: name })))) {
    permissions[permission.name] = permission;
  }
  const all = Object.values(permissions).map(({ _id }) => _id);
  const [admin, manager, staff, customer] = await Role.create([
    { name: "ADMIN", description: "System administrator", permissionIds: all },
    { name: "MANAGER", description: "Cinema manager", permissionIds: ids("staff.manage", "movie.view", "movie.create") },
    { name: "STAFF", description: "Cinema staff member", permissionIds: ids("movie.view", "ticket.validate") },
    { name: "CUSTOMER", description: "Cinema customer", permissionIds: ids("movie.view") },
  ]);
  Object.assign(roles, { admin, manager, staff, customer });

  adminAccount = await seedAccount("rbac_admin", { roleIds: [admin._id], phone: "0900000001" });
  await seedAccount("rbac_manager", { roleIds: [manager._id] });
  // Holds every admin grant directly, but not the ADMIN role.
  await seedAccount("rbac_direct", { roleIds: [customer._id], directPermissionIds: all });
  await seedAccount("rbac_customer", { roleIds: [customer._id], phone: "0900000009" });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  adminCookie = await cookieFor("rbac_admin");
  managerCookie = await cookieFor("rbac_manager");
  directGrantCookie = await cookieFor("rbac_direct");
  takeTestEmails();
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) {
    try {
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  }
});

test("BR-26 / BR-32: only the ADMIN role reaches staff and role management", async (t) => {
  await t.test("anonymous requests get 401", async () => {
    for (const path of ["/staff-accounts", "/roles", "/permissions"]) {
      const { response } = await request(path);
      assert.equal(response.status, 401, path);
    }
  });

  await t.test("a MANAGER (holds staff.manage) and a direct-grant account get 403 MSG37", async () => {
    for (const cookie of [managerCookie, directGrantCookie]) {
      for (const path of ["/staff-accounts", "/roles", "/permissions"]) {
        const { response, body } = await request(path, { cookie });
        assert.equal(response.status, 403, path);
        assert.equal(body.code, "FORBIDDEN");
        assert.equal(body.message, "You do not have permission to perform this action");
      }
    }
  });

  await t.test("Admin reads the predefined permission catalog grouped by module", async () => {
    const { response, body } = await request("/permissions", { cookie: adminCookie });
    assert.equal(response.status, 200);
    assert.equal(body.data.length, 10);
    assert.deepEqual(body.data.find(({ name }) => name === "movie.create").group, "movie");
  });
});

test("UC45-47 role management", async (t) => {
  let customRole;

  await t.test("UC45 7: empty, malformed, duplicate and reserved names are rejected", async () => {
    const empty = await request("/roles", { method: "POST", cookie: adminCookie, body: { name: "  " } });
    assert.equal(empty.response.status, 400);
    assert.deepEqual(empty.body.errors, [{ field: "name", message: "The Role name field is required." }]);

    const malformed = await request("/roles", { method: "POST", cookie: adminCookie, body: { name: "Box@Office" } });
    assert.equal(malformed.body.errors[0].message, "The Role name format is invalid.");

    for (const name of ["staff", "Admin"]) {
      const reserved = await request("/roles", { method: "POST", cookie: adminCookie, body: { name, permissionIds: ids("movie.view") } });
      assert.equal(reserved.response.status, 409, name);
      assert.equal(reserved.body.code, "ROLE_NAME_TAKEN");
      assert.equal(reserved.body.message, "This role name already exists.");
    }
  });

  await t.test("BR-33: a permission outside the predefined list is rejected", async () => {
    const { response, body } = await request("/roles", {
      method: "POST",
      cookie: adminCookie,
      body: { name: "Ghost", permissionIds: [new mongoose.Types.ObjectId().toString()] },
    });
    assert.equal(response.status, 400);
    assert.equal(body.code, "PERMISSION_INVALID");
  });

  await t.test("UC45 5: a role without permissions needs explicit confirmation", async () => {
    const unconfirmed = await request("/roles", { method: "POST", cookie: adminCookie, body: { name: "Usher" } });
    assert.equal(unconfirmed.response.status, 409);
    assert.equal(unconfirmed.body.code, "ROLE_EMPTY_PERMISSIONS_CONFIRMATION_REQUIRED");

    const confirmed = await request("/roles", {
      method: "POST",
      cookie: adminCookie,
      body: { name: "Usher", confirmNoPermissions: true },
    });
    assert.equal(confirmed.response.status, 201);
    assert.equal(confirmed.body.message, "Role created successfully.");
    assert.equal(confirmed.body.data.permissionCount, 0);
  });

  await t.test("UC45 creates a custom role, case-insensitively unique (MSG35)", async () => {
    const created = await request("/roles", {
      method: "POST",
      cookie: adminCookie,
      body: { name: "Ticket   Checker", description: "Door staff", permissionIds: ids("ticket.validate", "movie.view") },
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    customRole = created.body.data;
    assert.equal(customRole.name, "Ticket Checker");
    assert.equal(customRole.isSystem, false);
    assert.equal(customRole.permissionCount, 2);
    assert.equal(customRole.createdBy.username, "rbac_admin");

    const duplicate = await request("/roles", {
      method: "POST",
      cookie: adminCookie,
      body: { name: "ticket checker", permissionIds: ids("movie.view") },
    });
    assert.equal(duplicate.response.status, 409);
  });

  await t.test("lists roles with search, kind filter and active-account counts", async () => {
    const all = await request("/roles?limit=50", { cookie: adminCookie });
    assert.equal(all.response.status, 200);
    assert.equal(all.body.meta.total, 6);
    const admin = all.body.data.find(({ name }) => name === "ADMIN");
    assert.equal(admin.isLocked, true);
    assert.equal(admin.activeAccountCount, 1);

    const custom = await request("/roles?kind=custom", { cookie: adminCookie });
    assert.deepEqual(custom.body.data.map(({ name }) => name).sort(), ["Ticket Checker", "Usher"]);

    const search = await request("/roles?q=door", { cookie: adminCookie });
    assert.deepEqual(search.body.data.map(({ name }) => name), ["Ticket Checker"]);
  });

  await t.test("system roles: ADMIN is locked, other system names cannot change", async () => {
    const admin = await request(`/roles/${roles.admin._id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { description: "Changed", confirmAffectedAccounts: true },
    });
    assert.equal(admin.response.status, 409);
    assert.equal(admin.body.code, "SYSTEM_ROLE_LOCKED");

    const adminPermissions = await request(`/roles/${roles.admin._id}/permissions`, {
      method: "PUT",
      cookie: adminCookie,
      body: { permissionIds: [], confirmNoPermissions: true, confirmAffectedAccounts: true },
    });
    assert.equal(adminPermissions.body.code, "SYSTEM_ROLE_LOCKED");

    const rename = await request(`/roles/${roles.staff._id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { name: "CREW" },
    });
    assert.equal(rename.response.status, 409);
    assert.equal(rename.body.code, "SYSTEM_ROLE_NAME_LOCKED");
  });

  await t.test("UC46 updates a custom role and records the change (MSG28)", async () => {
    const updated = await request(`/roles/${customRole.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { name: "Gate Checker", description: "", permissionIds: ids("ticket.validate") },
    });
    assert.equal(updated.response.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.message, "Saved successfully.");
    assert.equal(updated.body.data.name, "Gate Checker");
    assert.equal(updated.body.data.description, null);
    assert.deepEqual(updated.body.data.permissions.map(({ name }) => name), ["ticket.validate"]);

    const record = await AuditLog.findOne({ targetId: customRole.id, action: "ROLE_UPDATED" }).lean();
    assert.equal(String(record.actorAccountId), String(adminAccount._id));
    assert.deepEqual(record.changes.name, { from: "Ticket Checker", to: "Gate Checker" });
    assert.deepEqual(record.changes.permissionsRemoved, ["movie.view"]);
  });

  await t.test("UC46 5 / UC47 3: removing every permission needs confirmation", async () => {
    const { response, body } = await request(`/roles/${customRole.id}/permissions`, {
      method: "PUT",
      cookie: adminCookie,
      body: { permissionIds: [] },
    });
    assert.equal(response.status, 409);
    assert.equal(body.code, "ROLE_EMPTY_PERMISSIONS_CONFIRMATION_REQUIRED");
  });
});

test("UC35-37 staff accounts, with BR-29/BR-34 propagation and BR-28", async (t) => {
  let staff;
  let staffCookie;

  await t.test("UC35 7a/7c: required fields and at least one role", async () => {
    const { response, body } = await request("/staff-accounts", {
      method: "POST",
      cookie: adminCookie,
      body: { fullName: "", email: "bad", username: "ab", phone: "123", roleIds: [] },
    });
    assert.equal(response.status, 400);
    const byField = Object.fromEntries(body.errors.map(({ field, message }) => [field, message]));
    assert.deepEqual(byField, {
      fullName: "The Full name field is required.",
      email: "The Email format is invalid.",
      username: "The Username must be at least 3 characters.",
      phone: "The Phone number format is invalid.",
      roleIds: "At least one role is required.",
    });

    const withPassword = await request("/staff-accounts", {
      method: "POST",
      cookie: adminCookie,
      body: { fullName: "Linh Tran", email: "linh@example.com", username: "linh", phone: "0901111111", roleIds: [roles.staff._id.toString()], password },
    });
    assert.equal(withPassword.response.status, 400, "the Admin never sends a password");
  });

  await t.test("UC35: CUSTOMER is not a staff role; unknown roles are rejected", async () => {
    for (const roleId of [roles.customer._id.toString(), new mongoose.Types.ObjectId().toString()]) {
      const { response, body } = await request("/staff-accounts", {
        method: "POST",
        cookie: adminCookie,
        body: { fullName: "Linh Tran", email: "linh@example.com", username: "linh", phone: "0901111111", roleIds: [roleId] },
      });
      assert.equal(response.status, 400);
      assert.equal(body.code, "STAFF_ROLE_INVALID");
    }
  });

  await t.test("UC35 7b / BR-01: duplicate email, username and phone are all reported", async () => {
    const { response, body } = await request("/staff-accounts", {
      method: "POST",
      cookie: adminCookie,
      body: { fullName: "Copy Cat", email: "RBAC_customer@example.com", username: "RBAC_ADMIN", phone: "0900000009", roleIds: [roles.staff._id.toString()] },
    });
    assert.equal(response.status, 409);
    assert.equal(body.code, "DUPLICATE_ACCOUNT");
    assert.deepEqual(body.errors, [
      { field: "email", message: "This email is already registered." },
      { field: "username", message: "This username is already registered." },
      { field: "phone", message: "This phone number is already registered." },
    ]);
  });

  await t.test("UC35 creates an ACTIVE staff account without an Admin-set password (MSG35)", async () => {
    const { response, body } = await request("/staff-accounts", {
      method: "POST",
      cookie: adminCookie,
      body: {
        fullName: "Linh  Tran",
        email: "Linh@Example.com",
        username: "linh_tran",
        phone: "090 222 3333",
        roleIds: [roles.staff._id.toString()],
        // ticket.validate is already granted by STAFF: kept as an explicit direct grant (UC37 4a).
        directPermissionIds: ids("ticket.validate", "report.view"),
        position: "Ticket checker",
      },
    });
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.message, "Staff account created successfully.");
    assert.deepEqual(body.meta.credentialSetup, { method: "PASSWORD_RESET", emailSent: true });
    staff = body.data;
    assert.equal(staff.status, "ACTIVE");
    assert.equal(staff.email, "linh@example.com");
    assert.equal(staff.phone, "0902223333");
    assert.equal(staff.fullName, "Linh Tran");
    assert.equal(staff.createdBy.username, "rbac_admin");

    const redundant = staff.directPermissions.find(({ name }) => name === "ticket.validate");
    assert.deepEqual(redundant.grantedByRoles, ["STAFF"]);
    assert.deepEqual(staff.directPermissions.find(({ name }) => name === "report.view").grantedByRoles, []);

    const [welcome] = takeTestEmails().filter(({ purpose }) => purpose === "STAFF_WELCOME");
    assert.equal(welcome.email, "linh@example.com");
    assert.match(welcome.setPasswordUrl, /\/forgot-password$/);

    const stored = await Account.findById(staff.id).lean();
    assert.equal(String(stored.createdBy), String(adminAccount._id));
    assert.ok(await AuditLog.exists({ targetId: staff.id, action: "STAFF_ACCOUNT_CREATED" }));
  });

  await t.test("the new staff member sets their own password through UC04", async () => {
    const forgot = await request("/auth/forgot-password", { method: "POST", body: { email: "linh@example.com" } });
    assert.equal(forgot.response.status, 200);
    assert.equal(forgot.body.message, "A password reset code has been sent to linh@example.com.");
    const otp = takeTestEmails().filter(({ purpose }) => purpose === "RESET_PASSWORD").at(-1).otp;

    const verified = await request("/auth/forgot-password/verify-otp", { method: "POST", body: { email: "linh@example.com", otp } });
    assert.equal(verified.response.status, 200);
    const reset = await request("/auth/reset-password", {
      method: "POST",
      body: { email: "linh@example.com", otp, newPassword: "Staff@2026x", confirmPassword: "Staff@2026x" },
    });
    assert.equal(reset.response.status, 200);
    assert.match(reset.body.message, /^Your information has been updated successfully\./);
    await EmailVerification.deleteMany({});

    const login = await signIn("linh_tran", "Staff@2026x");
    assert.equal(login.response.status, 200);
    staffCookie = login.cookie;
  });

  await t.test("lists staff only, with search, filters and status counts", async () => {
    const list = await request("/staff-accounts", { cookie: adminCookie });
    assert.equal(list.response.status, 200);
    // Customers and the direct-grant customer are not staff accounts.
    assert.deepEqual(list.body.data.map(({ username }) => username).sort(), ["linh_tran", "rbac_admin", "rbac_manager"]);
    assert.deepEqual(list.body.meta.counts, { total: 3, active: 3, disabled: 0 });

    const search = await request("/staff-accounts?q=LINH", { cookie: adminCookie });
    assert.deepEqual(search.body.data.map(({ username }) => username), ["linh_tran"]);

    const byRole = await request(`/staff-accounts?roleId=${roles.manager._id}`, { cookie: adminCookie });
    assert.deepEqual(byRole.body.data.map(({ username }) => username), ["rbac_manager"]);

    const customerRole = await request(`/staff-accounts?roleId=${roles.customer._id}`, { cookie: adminCookie });
    assert.equal(customerRole.body.meta.total, 0);

    const sorted = await request("/staff-accounts?sort=username&order=asc&limit=2", { cookie: adminCookie });
    assert.deepEqual(sorted.body.data.map(({ username }) => username), ["linh_tran", "rbac_admin"]);
    assert.equal(sorted.body.meta.totalPages, 2);

    const customer = await Account.findOne({ username: "rbac_customer" });
    const hidden = await request(`/staff-accounts/${customer._id}`, { cookie: adminCookie });
    assert.equal(hidden.response.status, 404);
  });

  await t.test("UC36 updates contact details; duplicates and the username are rejected", async () => {
    const duplicate = await request(`/staff-accounts/${staff.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { email: "rbac_admin@example.com" },
    });
    assert.equal(duplicate.response.status, 409);
    assert.deepEqual(duplicate.body.errors, [{ field: "email", message: "This email is already registered." }]);

    const username = await request(`/staff-accounts/${staff.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { username: "renamed" },
    });
    assert.equal(username.response.status, 400);

    const updated = await request(`/staff-accounts/${staff.id}`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { fullName: "Linh Tran Thi", phone: "0903334444", position: "" },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.message, "Saved successfully.");
    assert.equal(updated.body.data.fullName, "Linh Tran Thi");
    assert.equal(updated.body.data.position, null);
    assert.equal(updated.body.data.updatedBy.username, "rbac_admin");
  });

  await t.test("UC37 6a / 6b: at least one existing role", async () => {
    const none = await request(`/staff-accounts/${staff.id}/access`, {
      method: "PUT",
      cookie: adminCookie,
      body: { roleIds: [] },
    });
    assert.equal(none.response.status, 400);
    assert.deepEqual(none.body.errors, [{ field: "roleIds", message: "At least one role is required." }]);

    const missing = await request(`/staff-accounts/${staff.id}/access`, {
      method: "PUT",
      cookie: adminCookie,
      body: { roleIds: [new mongoose.Types.ObjectId().toString()] },
    });
    assert.equal(missing.body.code, "STAFF_ROLE_INVALID");
  });

  await t.test("UC37 + BR-29: new roles apply on the next request; direct grants are kept", async () => {
    const before = await request("/auth/me", { cookie: staffCookie });
    assert.ok(!before.body.data.permissions.some(({ name }) => name === "movie.create"));

    const assigned = await request(`/staff-accounts/${staff.id}/access`, {
      method: "PUT",
      cookie: adminCookie,
      body: { roleIds: [roles.staff._id.toString(), roles.manager._id.toString()] },
    });
    assert.equal(assigned.response.status, 200, JSON.stringify(assigned.body));
    assert.equal(assigned.body.message, "Permissions assigned successfully.");
    assert.deepEqual(assigned.body.data.directPermissions.map(({ name }) => name), ["report.view", "ticket.validate"]);

    const after = await request("/auth/me", { cookie: staffCookie });
    assert.ok(after.body.data.permissions.some(({ name }) => name === "movie.create"));

    const revoked = await request(`/staff-accounts/${staff.id}/access`, {
      method: "PUT",
      cookie: adminCookie,
      body: { roleIds: [roles.staff._id.toString()], directPermissionIds: ids("report.view") },
    });
    assert.deepEqual(revoked.body.data.directPermissions.map(({ name }) => name), ["report.view"]);
    const record = await AuditLog.findOne({ targetId: staff.id, action: "STAFF_ACCESS_ASSIGNED" })
      .sort({ createdAt: -1 })
      .lean();
    assert.deepEqual(record.changes.rolesRemoved, ["MANAGER"]);
    assert.deepEqual(record.changes.directPermissionsRemoved, ["ticket.validate"]);
  });

  await t.test("UC46 8 / BR-34: changing a role in use needs confirmation, then applies at once", async () => {
    const unconfirmed = await request(`/roles/${roles.staff._id}/permissions`, {
      method: "PUT",
      cookie: adminCookie,
      body: { permissionIds: ids("movie.view", "ticket.validate", "report.view", "movie.create") },
    });
    assert.equal(unconfirmed.response.status, 409);
    assert.equal(unconfirmed.body.code, "ROLE_AFFECTED_ACCOUNTS_CONFIRMATION_REQUIRED");
    assert.match(unconfirmed.body.message, /assigned to 1 active account/);

    const confirmed = await request(`/roles/${roles.staff._id}/permissions`, {
      method: "PUT",
      cookie: adminCookie,
      body: { permissionIds: ids("movie.view", "ticket.validate", "report.view", "movie.create"), confirmAffectedAccounts: true },
    });
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.body.message, "Permissions assigned successfully.");

    const me = await request("/auth/me", { cookie: staffCookie });
    assert.ok(me.body.data.permissions.some(({ name }) => name === "movie.create"));
  });

  await t.test("self-protection: an Admin cannot disable or demote their own account", async () => {
    const disable = await request(`/staff-accounts/${adminAccount._id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "DISABLED" },
    });
    assert.equal(disable.response.status, 409);
    assert.equal(disable.body.code, "CANNOT_DISABLE_SELF");

    const demote = await request(`/staff-accounts/${adminAccount._id}/access`, {
      method: "PUT",
      cookie: adminCookie,
      body: { roleIds: [roles.staff._id.toString()] },
    });
    assert.equal(demote.response.status, 409);
    assert.equal(demote.body.code, "CANNOT_REMOVE_OWN_ADMIN_ROLE");
  });

  await t.test("UC36 / BR-28: a disabled account is refused at sign-in and on its open session", async () => {
    const disabled = await request(`/staff-accounts/${staff.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "DISABLED" },
    });
    assert.equal(disabled.response.status, 200);
    assert.equal(disabled.body.data.status, "DISABLED");

    const session = await request("/auth/me", { cookie: staffCookie });
    assert.equal(session.response.status, 403);

    const login = await signIn("linh_tran", "Staff@2026x");
    assert.equal(login.response.status, 403);
    assert.equal(login.body.message, "This account has been disabled. Please contact an administrator.");

    const counts = await request("/staff-accounts?status=DISABLED", { cookie: adminCookie });
    assert.deepEqual(counts.body.data.map(({ username }) => username), ["linh_tran"]);
    assert.deepEqual(counts.body.meta.counts, { total: 3, active: 2, disabled: 1 });

    const enabled = await request(`/staff-accounts/${staff.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "ACTIVE" },
    });
    assert.equal(enabled.body.data.status, "ACTIVE");
    assert.equal((await signIn("linh_tran", "Staff@2026x")).response.status, 200);
    assert.equal(await AuditLog.countDocuments({ targetId: staff.id, action: { $in: ["STAFF_ACCOUNT_DISABLED", "STAFF_ACCOUNT_ENABLED"] } }), 2);
  });

  await t.test("form options list staff roles (no CUSTOMER) with their grants", async () => {
    const { response, body } = await request("/staff-accounts/options", { cookie: adminCookie });
    assert.equal(response.status, 200);
    assert.ok(!body.data.roles.some(({ name }) => name === "CUSTOMER"));
    assert.ok(body.data.roles.find(({ name }) => name === "STAFF").permissionIds.length > 0);
    assert.equal(body.data.permissions.length, 10);
    assert.deepEqual(body.data.branches, []);
  });
});
