import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.EMAIL_TEST_MODE = "capture";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

let baseUrl;
let server;
let Account;
let Role;
let googleTokenVerifier;

const googleProfiles = {
  "token-new": { email: "new.google@example.com", emailVerified: true, name: "New Google User" },
  "token-unverified": { email: "unverified.google@example.com", emailVerified: false, name: "Nope" },
  "token-existing": { email: "existing.google@example.com", emailVerified: true, name: "Existing" },
  "token-pending": { email: "pending.google@example.com", emailVerified: true, name: "Pending" },
};

const postGoogle = async (credential, extra = {}) => {
  const response = await fetch(`${baseUrl}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, ...extra }),
  });
  return { response, body: await response.json() };
};

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_google_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  ({ Account } = await import("../src/modules/account/account.model.js"));
  ({ Role } = await import("../src/modules/role-permission/role.model.js"));
  ({ googleTokenVerifier } = await import("../src/modules/auth/google.service.js"));
  const { default: app } = await import("../src/app.js");

  googleTokenVerifier.verify = async (credential) => {
    const profile = googleProfiles[credential];
    if (!profile) throw Object.assign(new Error("Google sign-in failed. Please try again."), { statusCode: 401 });
    return profile;
  };

  await Role.create({ name: "CUSTOMER", description: "Cinema customer", permissionIds: [] });
  await Account.syncIndexes();
  await Account.create([
    { username: "existing_google", email: "existing.google@example.com", passwordHash: "x", status: "ACTIVE" },
    { username: "pending_google", email: "pending.google@example.com", passwordHash: "x", status: "PENDING_VERIFICATION" },
    { username: "new_google", email: "taken.username@example.com", passwordHash: "x", status: "ACTIVE" },
  ]);

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("POST /auth/google", async (t) => {
  await t.test("rejects a missing credential", async () => {
    const { response } = await postGoogle("");
    assert.equal(response.status, 400);
  });

  await t.test("rejects an invalid token", async () => {
    const { response } = await postGoogle("token-bogus");
    assert.equal(response.status, 401);
  });

  await t.test("rejects an unverified Google email", async () => {
    const { response } = await postGoogle("token-unverified");
    assert.equal(response.status, 401);
    assert.equal(await Account.countDocuments({ email: "unverified.google@example.com" }), 0);
  });

  await t.test("creates an ACTIVE CUSTOMER account on first sign-in and sets the cookie", async () => {
    const { response } = await postGoogle("token-new");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /accessToken=.+HttpOnly/i);

    const account = await Account.findOne({ email: "new.google@example.com" }).select("+passwordHash");
    assert.equal(account.status, "ACTIVE");
    assert.equal(account.profile.fullName, "New Google User");
    // "new_google" is already taken by a seeded account, so a numeric suffix is appended.
    assert.match(account.username, /^new_google_\d{4}$/);
    assert.ok(account.passwordHash);
    assert.equal(account.roleIds.length, 1);
  });

  await t.test("signs in again without creating a duplicate account", async () => {
    const { response } = await postGoogle("token-new");
    assert.equal(response.status, 200);
    assert.equal(await Account.countDocuments({ email: "new.google@example.com" }), 1);
  });

  await t.test("signs in to an existing ACTIVE account with the same email", async () => {
    const { response } = await postGoogle("token-existing");
    assert.equal(response.status, 200);
    assert.equal(await Account.countDocuments({ email: "existing.google@example.com" }), 1);
  });

  await t.test("does not activate an account still pending email verification", async () => {
    const { response } = await postGoogle("token-pending");
    assert.equal(response.status, 409);
    const account = await Account.findOne({ email: "pending.google@example.com" });
    assert.equal(account.status, "PENDING_VERIFICATION");
  });

  await t.test("rejects password login for a Google-created account", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: "new.google@example.com", password: "Anything@2026" }),
    });
    assert.equal(response.status, 401);
  });
});
