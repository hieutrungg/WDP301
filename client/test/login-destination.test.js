import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getLoginDestination,
  getRoleHomePath,
} from "../src/features/auth/utils/loginDestination.js";
const account = (...names) => ({ roles: names.map((name) => ({ name })) });
test("INT-FE-001 preserves role priority and never resumes a different role workspace", () => {
  assert.equal(
    getRoleHomePath(account("STAFF", "CUSTOMER", "MANAGER", "ADMIN")),
    "/admin",
  );
  for (const [role, home] of [
    ["ADMIN", "/admin"],
    ["MANAGER", "/manager"],
    ["STAFF", "/staff/dashboard"],
    ["CUSTOMER", "/"],
  ]) {
    assert.equal(getLoginDestination(account(role)), home);
    const workspacePrefix = {
      ADMIN: "/admin",
      MANAGER: "/manager",
      STAFF: "/staff",
    }[role];
    for (const other of [
      "/admin/rooms",
      "/manager/rooms",
      "/staff/inventory",
    ]) {
      if (!workspacePrefix || !other.startsWith(`${workspacePrefix}/`))
        assert.equal(getLoginDestination(account(role), other), home);
    }
  }
});
test("INT-FE-001 resumes path, filters and fragment from ProtectedRoute location", () => {
  assert.equal(
    getLoginDestination(account("CUSTOMER"), {
      pathname: "/booking/abc/checkout",
      search: "?retry=1",
      hash: "#payment",
    }),
    "/booking/abc/checkout?retry=1#payment",
  );
  assert.equal(
    getLoginDestination(account("MANAGER"), {
      pathname: "/manager/movies",
      search: "?q=Dune&page=2",
    }),
    "/manager/movies?q=Dune&page=2",
  );
  assert.equal(
    getLoginDestination(account("STAFF"), "/staff/concessions?kind=combos"),
    "/staff/concessions?kind=combos",
  );
  assert.equal(
    getLoginDestination(account("MANAGER"), "/movies?q=Dune"),
    "/manager",
  );
});
test("INT-FE-001 rejects external destinations and authentication redirect loops", () => {
  for (const input of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\n/evil",
    "/login?next=/movies",
    "/register#x",
    "/403/",
    "/manager/../login?x=1",
    "/safe/..//evil.example",
  ]) {
    assert.equal(getLoginDestination(account("CUSTOMER"), input), "/", input);
  }
  assert.equal(
    getLoginDestination(account("CUSTOMER"), "/manager/../movies?q=test"),
    "/movies?q=test",
  );
  assert.equal(
    getLoginDestination(account("CUSTOMER"), "/managerial"),
    "/managerial",
  );
});
