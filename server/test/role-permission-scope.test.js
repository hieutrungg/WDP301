import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actorRoleNames,
  actorRoleOf,
  allowedPermissionNames,
  outOfScope,
  permissionScopes,
  ROLE_PERMISSION_SCOPE,
} from "../src/modules/role-permission/role-permission-scope.js";

test("each system role's ceiling is its default grant list from the docs seed", () => {
  assert.ok(ROLE_PERMISSION_SCOPE.STAFF.includes("ticket.validate"));
  assert.ok(!ROLE_PERMISSION_SCOPE.STAFF.includes("analytics.view"));
  assert.ok(ROLE_PERMISSION_SCOPE.MANAGER.includes("refund.manage"));
  assert.ok(!ROLE_PERMISSION_SCOPE.MANAGER.includes("account.manage"));
  assert.ok(ROLE_PERMISSION_SCOPE.CUSTOMER.includes("refund.request"));
  for (const names of Object.values(ROLE_PERMISSION_SCOPE)) {
    assert.equal(new Set(names).size, names.length, "no duplicates");
  }
});

test("a custom role acts as its base role; a system role as itself", () => {
  assert.equal(actorRoleOf({ name: "STAFF" }), "STAFF");
  assert.equal(actorRoleOf({ name: "Cashier", baseRole: "STAFF" }), "STAFF");
  assert.deepEqual(
    [...actorRoleNames([{ name: "Cashier", baseRole: "STAFF" }, { name: "MANAGER", baseRole: null }])].sort(),
    ["MANAGER", "STAFF"],
  );
});

test("allowed permissions are the union of ceilings, unlimited for ADMIN", () => {
  const staffOnly = allowedPermissionNames(["STAFF"]);
  assert.ok(staffOnly.has("inventory.stock_in"));
  assert.ok(!staffOnly.has("report.view"));

  const both = allowedPermissionNames(["STAFF", "MANAGER"]);
  assert.ok(both.has("inventory.stock_in") && both.has("report.view"));

  assert.equal(allowedPermissionNames(["MANAGER", "ADMIN"]), null);
  assert.equal(allowedPermissionNames([]).size, 0);
});

test("outOfScope lists only the rejected names, sorted; null ceiling rejects nothing", () => {
  const staff = allowedPermissionNames(["STAFF"]);
  assert.deepEqual(outOfScope(["ticket.validate", "role.manage", "analytics.view"], staff), [
    "analytics.view",
    "role.manage",
  ]);
  assert.deepEqual(outOfScope(["role.manage"], null), []);
});

test("permission scopes name every system role whose ceiling holds the permission", () => {
  assert.deepEqual(permissionScopes("ticket.validate").sort(), ["MANAGER", "STAFF"]);
  assert.deepEqual(permissionScopes("refund.request"), ["CUSTOMER"]);
  assert.deepEqual(permissionScopes("account.manage"), []);
});
