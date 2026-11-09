import assert from "node:assert/strict";
import test from "node:test";
import {
  internalStaffGoogleLoginSchema,
  internalStaffLoginSchema,
} from "../src/modules/auth/auth.validation.js";

test("internal password login permits the system Admin option without a branch", () => {
  const result = internalStaffLoginSchema.safeParse({
    identity: "admin",
    password: "Admin@123",
    rememberMe: false,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.branchId, undefined);
});

test("internal Google login permits the system Admin option without a branch", () => {
  const result = internalStaffGoogleLoginSchema.safeParse({
    credential: "verified-google-credential",
    rememberMe: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.data.branchId, undefined);
});

test("internal login still rejects an invalid selected branch", () => {
  const result = internalStaffLoginSchema.safeParse({
    identity: "staff",
    password: "Staff@123",
    branchId: "not-an-object-id",
  });

  assert.equal(result.success, false);
});
