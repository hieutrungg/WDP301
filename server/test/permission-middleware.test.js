import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { requireAuth } from "../src/middlewares/authMiddleware.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { requirePermission, requireRole } from "../src/middlewares/permissionMiddleware.js";
import { Account } from "../src/modules/account/account.model.js";

const TEST_JWT_SECRET = "plat-002-permission-test-secret";

const makePermission = (name, description = name) => ({
  _id: new mongoose.Types.ObjectId(),
  name,
  description,
});

const makeRole = (name, permissionIds = [], description = name) => ({
  _id: new mongoose.Types.ObjectId(),
  name,
  description,
  permissionIds,
});

const makeAccount = ({
  username = "plat002_user",
  status = "ACTIVE",
  roleIds = [],
  directPermissionIds = [],
} = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  username,
  email: `${username}@example.com`,
  phone: "0901234567",
  status,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  profile: { fullName: `Full ${username}` },
  roleIds,
  directPermissionIds,
});

const PERMISSIONS = {
  MOVIE_VIEW: makePermission("movie.view", "View movies"),
  MOVIE_CREATE: makePermission("movie.create", "Create movies"),
  MOVIE_UPDATE: makePermission("movie.update", "Update movies"),
  SHOWTIME_CREATE: makePermission("showtime.create", "Create showtimes"),
  INVENTORY_VIEW: makePermission("inventory.view", "View inventory"),
  INVENTORY_STOCK_IN: makePermission("inventory.stock_in", "Receive goods into branch concession stock"),
  REPORT_EXPORT: makePermission("report.export", "Export reports"),
  BRANCH_MANAGE: makePermission("branch.manage", "Manage cinema branches"),
};

let previousSecret;
let server;
let baseUrl;
let accountsById;
let lookupCount;
let lookupError;
let originalFindById;

const signToken = (payload, options = {}) =>
  jwt.sign(payload, options.secret ?? TEST_JWT_SECRET, {
    expiresIn: options.expiresIn ?? "1h",
  });

const tokenFor = (account, extraClaims = {}, options = {}) =>
  signToken({ sub: account._id.toString(), ...extraClaims }, options);

const registerAccount = (overrides = {}) => {
  const account = makeAccount(overrides);
  accountsById.set(account._id.toString(), account);
  return account;
};

const request = async (path, { method = "GET", token, cookieHeader, body, headers = {} } = {}) => {
  const cookie =
    cookieHeader !== undefined
      ? cookieHeader
      : token !== undefined
        ? `accessToken=${token}`
        : undefined;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie !== undefined ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
};

before(async () => {
  previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

  accountsById = new Map();
  lookupCount = 0;
  lookupError = null;
  originalFindById = Account.findById;

  Account.findById = (accountId) => {
    lookupCount += 1;
    const populatePaths = [];
    const query = {
      populate(arg) {
        populatePaths.push(arg);
        return query;
      },
      async exec() {
        assert.equal(populatePaths.length, 2, "expected roleIds and directPermissionIds populate calls");
        if (lookupError) {
          throw lookupError;
        }
        return accountsById.get(String(accountId)) ?? null;
      },
    };
    return query;
  };

  const app = express();
  app.use(express.json(), cookieParser());

  const okHandler = (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        accountId: req.auth.accountId,
        roles: req.auth.account?.roles?.map(({ name }) => name) ?? [],
        permissions: req.auth.account?.permissions?.map(({ name }) => name) ?? [],
      },
    });
  };

  // Protected routes covering single permission, multi-permission, role guards, and misconfigurations.
  app.get("/api/test/movie-create", requireAuth, requirePermission("movie.create"), okHandler);
  app.post("/api/test/branch-manage", requireAuth, requirePermission("branch.manage"), okHandler);
  app.get("/api/test/report-export", requireAuth, requirePermission("report.export"), okHandler);
  app.get(
    "/api/test/multi-permission",
    requireAuth,
    requirePermission("movie.create", "movie.update", "report.export"),
    okHandler,
  );
  app.get(
    "/api/test/permission-and-role",
    requireAuth,
    requirePermission("inventory.view"),
    requireRole("STAFF", "MANAGER"),
    okHandler,
  );
  app.get("/api/test/role-only", requireAuth, requireRole("STAFF", "MANAGER"), okHandler);

  // Guard without preceding requireAuth to verify defense-in-depth 401 behavior.
  app.get("/api/test/permission-without-auth", requirePermission("movie.view"), okHandler);
  app.get("/api/test/role-without-auth", requireRole("STAFF"), okHandler);

  // Edge-case misconfigured middleware routes (must fail closed with 403 FORBIDDEN).
  app.get("/api/test/empty-permission", requireAuth, requirePermission(), okHandler);
  app.get("/api/test/blank-permission", requireAuth, requirePermission("   "), okHandler);
  app.get(
    "/api/test/mixed-blank-permission",
    requireAuth,
    requirePermission("movie.create", ""),
    okHandler,
  );
  app.get(
    "/api/test/non-string-permission",
    requireAuth,
    requirePermission(null),
    okHandler,
  );
  app.get(
    "/api/test/array-permission",
    requireAuth,
    requirePermission(["movie.create"]),
    okHandler,
  );
  app.get("/api/test/empty-role", requireAuth, requireRole(), okHandler);
  app.get("/api/test/blank-role", requireAuth, requireRole("   "), okHandler);
  app.get("/api/test/mixed-blank-role", requireAuth, requireRole("STAFF", ""), okHandler);
  app.get("/api/test/non-string-role", requireAuth, requireRole(undefined), okHandler);

  app.use(errorHandler);

  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  accountsById.clear();
  lookupCount = 0;
  lookupError = null;
});

after(async () => {
  Account.findById = originalFindById;
  if (previousSecret === undefined) {
    delete process.env.JWT_ACCESS_SECRET;
  } else {
    process.env.JWT_ACCESS_SECRET = previousSecret;
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("A. Authentication boundary and error contract (HTTP 401 / 403 / 500)", async (t) => {
  await t.test("rejects unauthenticated requests with 401 before querying the database", async () => {
    const noCookie = await request("/api/test/movie-create");
    assert.equal(noCookie.status, 401);
    assert.deepEqual(noCookie.body, {
      success: false,
      message: "Authentication required",
      errors: [],
    });

    const emptyCookie = await request("/api/test/movie-create", {
      cookieHeader: "accessToken=",
    });
    assert.equal(emptyCookie.status, 401);
    assert.equal(emptyCookie.body.message, "Authentication required");
    assert.equal(lookupCount, 0);
  });

  await t.test("rejects invalid, wrong-secret, or expired JWTs with 401", async () => {
    const account = registerAccount({
      roleIds: [makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE])],
    });

    const malformed = await request("/api/test/movie-create", { token: "not.a.jwt" });
    assert.equal(malformed.status, 401);
    assert.equal(malformed.body.message, "Invalid or expired session");

    const wrongSecret = await request("/api/test/movie-create", {
      token: tokenFor(account, {}, { secret: "wrong-secret" }),
    });
    assert.equal(wrongSecret.status, 401);
    assert.equal(wrongSecret.body.message, "Invalid or expired session");

    const expired = await request("/api/test/movie-create", {
      token: tokenFor(account, {}, { expiresIn: -10 }),
    });
    assert.equal(expired.status, 401);
    assert.equal(expired.body.message, "Invalid or expired session");
    assert.equal(lookupCount, 0);
  });

  await t.test("rejects requirePermission and requireRole with 401 if requireAuth did not set req.auth", async () => {
    const permRes = await request("/api/test/permission-without-auth");
    assert.equal(permRes.status, 401);
    assert.equal(permRes.body.message, "Authentication required");

    const roleRes = await request("/api/test/role-without-auth");
    assert.equal(roleRes.status, 401);
    assert.equal(roleRes.body.message, "Authentication required");
    assert.equal(lookupCount, 0);
  });

  await t.test("rejects a valid JWT when the account no longer exists in the database with 401", async () => {
    const deletedAccount = makeAccount({
      roleIds: [makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE])],
    });
    const token = tokenFor(deletedAccount);

    const result = await request("/api/test/movie-create", { token });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, {
      success: false,
      message: "Authentication required",
      errors: [],
    });
    assert.equal(lookupCount, 1);
  });

  await t.test("returns 403 FORBIDDEN when authenticated account lacks the required permission", async () => {
    const customer = registerAccount({
      roleIds: [makeRole("CUSTOMER", [PERMISSIONS.MOVIE_VIEW])],
    });

    const result = await request("/api/test/movie-create", { token: tokenFor(customer) });
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, {
      success: false,
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action",
      errors: [],
    });
  });

  await t.test("fails closed on internal database lookup error without leaking stack or token", async (subTest) => {
    subTest.mock.method(console, "error", () => {});
    const manager = registerAccount({
      roleIds: [makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE])],
    });
    const token = tokenFor(manager);
    lookupError = new Error("Simulated Mongo network failure");

    const result = await request("/api/test/movie-create", { token });
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, {
      success: false,
      message: "Internal server error",
      errors: [],
    });
    assert.equal("stack" in result.body, false);
    assert.equal(JSON.stringify(result.body).includes(token), false);
  });
});

test("B. Role-based permission grants — BR-06 & UC37", async (t) => {
  await t.test("grants access when the assigned role contains the required permission", async () => {
    const manager = registerAccount({
      roleIds: [makeRole("MANAGER", [PERMISSIONS.MOVIE_VIEW, PERMISSIONS.MOVIE_CREATE])],
    });

    const result = await request("/api/test/movie-create", { token: tokenFor(manager) });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.accountId, manager._id.toString());
    assert.deepEqual(result.body.data.roles, ["MANAGER"]);
    assert.deepEqual(result.body.data.permissions, ["movie.view", "movie.create"]);
  });

  await t.test("combines permissions across multiple assigned roles (union of role grants)", async () => {
    const staffRole = makeRole("STAFF", [PERMISSIONS.MOVIE_CREATE]);
    const managerRole = makeRole("MANAGER", [PERMISSIONS.MOVIE_UPDATE, PERMISSIONS.REPORT_EXPORT]);
    const multiRoleUser = registerAccount({
      roleIds: [staffRole, managerRole],
    });

    const result = await request("/api/test/multi-permission", { token: tokenFor(multiRoleUser) });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.roles, ["STAFF", "MANAGER"]);
    assert.deepEqual(result.body.data.permissions, [
      "movie.create",
      "movie.update",
      "report.export",
    ]);
  });

  await t.test("denies an account with roles that do not grant the required permission", async () => {
    const staffUser = registerAccount({
      roleIds: [makeRole("STAFF", [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_STOCK_IN])],
    });

    const result = await request("/api/test/movie-create", { token: tokenFor(staffUser) });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "FORBIDDEN");
  });

  await t.test("denies an account with no roles and no direct grants", async () => {
    const emptyUser = registerAccount({ roleIds: [], directPermissionIds: [] });

    const result = await request("/api/test/movie-create", { token: tokenFor(emptyUser) });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "FORBIDDEN");
  });

  await t.test("ignores client-supplied or JWT-embedded fake role/permission claims", async () => {
    const customer = registerAccount({
      roleIds: [makeRole("CUSTOMER", [PERMISSIONS.MOVIE_VIEW])],
      directPermissionIds: [],
    });
    const forgedClaimToken = tokenFor(customer, {
      roles: ["ADMIN", "MANAGER"],
      permissions: ["branch.manage", "movie.create"],
      isAdmin: true,
    });

    const result = await request("/api/test/branch-manage", {
      method: "POST",
      token: forgedClaimToken,
      headers: {
        "X-Roles": "ADMIN",
        "X-Permissions": "branch.manage",
      },
      body: {
        roles: ["ADMIN"],
        permissions: ["branch.manage"],
      },
    });

    assert.equal(result.status, 403);
    assert.equal(result.body.code, "FORBIDDEN");
  });
});

test("C. Direct permission grants (Role Grants ∪ Direct Grants) — BR-06 & UC37", async (t) => {
  await t.test("allows access via directPermissionIds even when the account has no role grant for it", async () => {
    const customerWithDirectGrant = registerAccount({
      roleIds: [makeRole("CUSTOMER", [PERMISSIONS.MOVIE_VIEW])],
      directPermissionIds: [PERMISSIONS.REPORT_EXPORT],
    });

    const result = await request("/api/test/report-export", {
      token: tokenFor(customerWithDirectGrant),
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.permissions, ["movie.view", "report.export"]);
  });

  await t.test("merges multiple roles and direct permissions to satisfy multi-permission checks", async () => {
    const roleA = makeRole("STAFF", [PERMISSIONS.MOVIE_CREATE]);
    const roleB = makeRole("MANAGER", [PERMISSIONS.MOVIE_UPDATE]);
    const user = registerAccount({
      roleIds: [roleA, roleB],
      directPermissionIds: [PERMISSIONS.REPORT_EXPORT],
    });

    const result = await request("/api/test/multi-permission", { token: tokenFor(user) });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.permissions, [
      "movie.create",
      "movie.update",
      "report.export",
    ]);
  });

  await t.test("deduplicates overlapping permissions across roles and directPermissionIds cleanly", async () => {
    const roleA = makeRole("STAFF", [PERMISSIONS.MOVIE_CREATE, PERMISSIONS.MOVIE_VIEW]);
    const roleB = makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE]);
    const user = registerAccount({
      roleIds: [roleA, roleB],
      directPermissionIds: [PERMISSIONS.MOVIE_CREATE, PERMISSIONS.MOVIE_VIEW],
    });

    const result = await request("/api/test/movie-create", { token: tokenFor(user) });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.permissions, ["movie.create", "movie.view"]);
  });

  await t.test("revoking a direct permission denies access unless a remaining role still grants it", async () => {
    const role = makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE]);
    const user = registerAccount({
      roleIds: [role],
      directPermissionIds: [PERMISSIONS.MOVIE_CREATE, PERMISSIONS.REPORT_EXPORT],
    });
    const token = tokenFor(user);

    assert.equal((await request("/api/test/report-export", { token })).status, 200);
    assert.equal((await request("/api/test/movie-create", { token })).status, 200);

    // Remove direct permissions: report.export is lost, but movie.create remains via MANAGER role.
    user.directPermissionIds = [];

    const reportAfterRevoke = await request("/api/test/report-export", { token });
    assert.equal(reportAfterRevoke.status, 403);
    assert.equal(reportAfterRevoke.body.code, "FORBIDDEN");

    const movieAfterRevoke = await request("/api/test/movie-create", { token });
    assert.equal(movieAfterRevoke.status, 200);
  });
});

test("D. Locked, disabled, and non-active account statuses — BR-06 & BR-28", async (t) => {
  await t.test("denies LOCKED, DISABLED, and PENDING_VERIFICATION accounts with 403 despite valid JWT and grants", async () => {
    for (const nonActiveStatus of ["LOCKED", "DISABLED", "PENDING_VERIFICATION"]) {
      const account = registerAccount({
        username: `user_${nonActiveStatus.toLowerCase()}`,
        status: nonActiveStatus,
        roleIds: [makeRole("ADMIN", [PERMISSIONS.MOVIE_CREATE, PERMISSIONS.BRANCH_MANAGE])],
        directPermissionIds: [PERMISSIONS.REPORT_EXPORT],
      });

      const result = await request("/api/test/movie-create", { token: tokenFor(account) });
      assert.equal(result.status, 403, `expected 403 for status ${nonActiveStatus}`);
      assert.deepEqual(result.body, {
        success: false,
        message: "This account is not allowed to sign in",
        errors: [],
      });
    }
  });

  await t.test("enforces status transitions on the next request with the same JWT", async () => {
    const account = registerAccount({
      status: "ACTIVE",
      roleIds: [makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE])],
    });
    const token = tokenFor(account);

    assert.equal((await request("/api/test/movie-create", { token })).status, 200);

    account.status = "LOCKED";
    assert.equal((await request("/api/test/movie-create", { token })).status, 403);

    account.status = "DISABLED";
    assert.equal((await request("/api/test/movie-create", { token })).status, 403);

    account.status = "ACTIVE";
    assert.equal((await request("/api/test/movie-create", { token })).status, 200);
  });
});

test("E. Immediate permission revocation and grant updates — UC46, UC47 & BR-34", async (t) => {
  await t.test("removing a permission from a role denies the next request with the same JWT", async () => {
    const managerRole = makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE]);
    const manager = registerAccount({ roleIds: [managerRole] });
    const token = tokenFor(manager);

    assert.equal((await request("/api/test/movie-create", { token })).status, 200);

    managerRole.permissionIds = [];
    const afterRevoke = await request("/api/test/movie-create", { token });
    assert.equal(afterRevoke.status, 403);
    assert.equal(afterRevoke.body.code, "FORBIDDEN");
  });

  await t.test("removing a role from an account revokes only that role's permissions on the next request", async () => {
    const staffRole = makeRole("STAFF", [PERMISSIONS.REPORT_EXPORT]);
    const managerRole = makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE]);
    const account = registerAccount({ roleIds: [staffRole, managerRole] });
    const token = tokenFor(account);

    assert.equal((await request("/api/test/movie-create", { token })).status, 200);
    assert.equal((await request("/api/test/report-export", { token })).status, 200);

    // Unassign MANAGER role; STAFF role remains.
    account.roleIds = [staffRole];

    assert.equal((await request("/api/test/movie-create", { token })).status, 403);
    assert.equal((await request("/api/test/report-export", { token })).status, 200);
  });

  await t.test("updating permissions on a shared role immediately affects all assigned accounts (BR-34)", async () => {
    const sharedRole = makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE]);
    const managerOne = registerAccount({ username: "mgr_one", roleIds: [sharedRole] });
    const managerTwo = registerAccount({ username: "mgr_two", roleIds: [sharedRole] });
    const tokenOne = tokenFor(managerOne);
    const tokenTwo = tokenFor(managerTwo);

    assert.equal((await request("/api/test/movie-create", { token: tokenOne })).status, 200);
    assert.equal((await request("/api/test/movie-create", { token: tokenTwo })).status, 200);
    assert.equal((await request("/api/test/report-export", { token: tokenOne })).status, 403);
    assert.equal((await request("/api/test/report-export", { token: tokenTwo })).status, 403);

    // Replace role permissions: revoke movie.create and grant report.export.
    sharedRole.permissionIds = [PERMISSIONS.REPORT_EXPORT];

    assert.equal((await request("/api/test/movie-create", { token: tokenOne })).status, 403);
    assert.equal((await request("/api/test/movie-create", { token: tokenTwo })).status, 403);
    assert.equal((await request("/api/test/report-export", { token: tokenOne })).status, 200);
    assert.equal((await request("/api/test/report-export", { token: tokenTwo })).status, 200);
  });

  await t.test("adding a direct permission or assigning a new role takes effect on the next request", async () => {
    const account = registerAccount({ roleIds: [], directPermissionIds: [] });
    const token = tokenFor(account);

    assert.equal((await request("/api/test/movie-create", { token })).status, 403);

    account.directPermissionIds = [PERMISSIONS.MOVIE_CREATE];
    assert.equal((await request("/api/test/movie-create", { token })).status, 200);

    account.directPermissionIds = [];
    account.roleIds = [makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE])];
    assert.equal((await request("/api/test/movie-create", { token })).status, 200);
  });
});

test("F. Middleware edge cases and default-deny semantics", async (t) => {
  await t.test("fails closed (403 FORBIDDEN) when requirePermission or requireRole is misconfigured", async () => {
    const admin = registerAccount({
      roleIds: [
        makeRole("ADMIN", Object.values(PERMISSIONS)),
        makeRole("STAFF", Object.values(PERMISSIONS)),
      ],
    });
    const token = tokenFor(admin);

    for (const path of [
      "/api/test/empty-permission",
      "/api/test/blank-permission",
      "/api/test/mixed-blank-permission",
      "/api/test/non-string-permission",
      "/api/test/array-permission",
      "/api/test/empty-role",
      "/api/test/blank-role",
      "/api/test/mixed-blank-role",
      "/api/test/non-string-role",
    ]) {
      const result = await request(path, { token });
      assert.equal(result.status, 403, `expected 403 fail-closed on ${path}`);
      assert.equal(result.body.code, "FORBIDDEN", `expected FORBIDDEN code on ${path}`);
    }
  });

  await t.test("enforces ALL permissions for multi-arg requirePermission and ANY role for multi-arg requireRole", async () => {
    const partialUser = registerAccount({
      username: "partial_user",
      roleIds: [makeRole("MANAGER", [PERMISSIONS.MOVIE_CREATE, PERMISSIONS.MOVIE_UPDATE])],
    });
    const partialResult = await request("/api/test/multi-permission", {
      token: tokenFor(partialUser),
    });
    assert.equal(partialResult.status, 403);
    assert.equal(partialResult.body.code, "FORBIDDEN");

    const staffInventory = registerAccount({
      username: "staff_inv",
      roleIds: [makeRole("STAFF", [PERMISSIONS.INVENTORY_VIEW])],
    });
    const adminInventory = registerAccount({
      username: "admin_inv",
      roleIds: [makeRole("ADMIN", [PERMISSIONS.INVENTORY_VIEW])],
    });

    // Chained requirePermission("inventory.view") + requireRole("STAFF", "MANAGER")
    // reuses req.auth.account (only 1 DB lookup per request).
    lookupCount = 0;
    const staffResult = await request("/api/test/permission-and-role", {
      token: tokenFor(staffInventory),
    });
    assert.equal(staffResult.status, 200);
    assert.equal(lookupCount, 1);

    // ADMIN holds inventory.view but neither STAFF nor MANAGER role -> 403.
    const adminResult = await request("/api/test/permission-and-role", {
      token: tokenFor(adminInventory),
    });
    assert.equal(adminResult.status, 403);
    assert.equal(adminResult.body.code, "FORBIDDEN");

    // requireRole used directly after requireAuth loads the account itself.
    lookupCount = 0;
    const roleOnlyResult = await request("/api/test/role-only", {
      token: tokenFor(staffInventory),
    });
    assert.equal(roleOnlyResult.status, 200);
    assert.equal(lookupCount, 1);
  });

  await t.test("rejects JWT payloads with missing, empty, whitespace, or non-string sub with 401", async () => {
    for (const invalidPayload of [
      {},
      { sub: "" },
      { sub: "   " },
      { sub: null },
      { sub: 12345 },
      { sub: ["id"] },
    ]) {
      const token = signToken(invalidPayload);
      const result = await request("/api/test/movie-create", { token });
      assert.equal(result.status, 401, `expected 401 for payload ${JSON.stringify(invalidPayload)}`);
      assert.equal(result.body.message, "Invalid or expired session");
    }
    assert.equal(lookupCount, 0);
  });
});
