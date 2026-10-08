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
let aliceCookie;

const googleProfiles = {
  "token-alice": { email: "alice_g@example.com", emailVerified: true, name: "Alice Google" },
  "token-bob": { email: "bob_g@example.com", emailVerified: true, name: "Bob Google" },
};

const request = async (path, { method = "GET", body, cookie } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
};

const signInWithGoogle = async (credential) => {
  const { response } = await request("/auth/google", { method: "POST", body: { credential } });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
};

const strongPassword = "Cinema@2026";

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_account_test";
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

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  aliceCookie = await signInWithGoogle("token-alice");
  await signInWithGoogle("token-bob");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test("PATCH /accounts/me", async (t) => {
  await t.test("requires authentication", async () => {
    const { response } = await request("/accounts/me", { method: "PATCH", body: { fullName: "No Session" } });
    assert.equal(response.status, 401);
  });

  await t.test("never exposes the password hash on /auth/me", async () => {
    const { body } = await request("/auth/me", { cookie: aliceCookie });
    assert.equal(body.data.username, "alice_g");
    assert.equal("passwordHash" in body.data, false);
    assert.ok(body.data.createdAt);
  });

  await t.test("rejects an empty update and invalid values", async () => {
    const empty = await request("/accounts/me", { method: "PATCH", cookie: aliceCookie, body: {} });
    assert.equal(empty.response.status, 400);

    const badPhone = await request("/accounts/me", { method: "PATCH", cookie: aliceCookie, body: { phone: "123" } });
    assert.equal(badPhone.response.status, 400);
    assert.equal(badPhone.body.errors[0].field, "phone");
  });

  await t.test("updates full name and phone, normalizing the phone number", async () => {
    const { response, body } = await request("/accounts/me", {
      method: "PATCH",
      cookie: aliceCookie,
      body: { fullName: "  Alice Nguyen ", phone: "0987 654 321" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.profile.fullName, "Alice Nguyen");
    assert.equal(body.data.phone, "0987654321");
  });

  await t.test("ignores email and username, which cannot be edited", async () => {
    const { response, body } = await request("/accounts/me", {
      method: "PATCH",
      cookie: aliceCookie,
      body: { fullName: "Alice Nguyen", email: "hijack@example.com", username: "hijacked" },
    });
    assert.equal(response.status, 200);
    assert.equal(body.data.email, "alice_g@example.com");
    assert.equal(body.data.username, "alice_g");
  });
});

test("POST /accounts/me/password", async (t) => {
  await t.test("requires authentication", async () => {
    const { response } = await request("/accounts/me/password", {
      method: "POST",
      body: { newPassword: strongPassword, confirmPassword: strongPassword },
    });
    assert.equal(response.status, 401);
  });

  await t.test("rejects a weak or mismatched password", async () => {
    const weak = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { credential: "token-alice", newPassword: "weak", confirmPassword: "weak" },
    });
    assert.equal(weak.response.status, 400);

    const mismatch = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { credential: "token-alice", newPassword: strongPassword, confirmPassword: "Other@2026x" },
    });
    assert.equal(mismatch.response.status, 400);
  });

  await t.test("requires proof of ownership", async () => {
    const { response, body } = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { newPassword: strongPassword, confirmPassword: strongPassword },
    });
    assert.equal(response.status, 400);
    assert.equal(body.errors[0].field, "currentPassword");
  });

  await t.test("rejects a Google account with a different email", async () => {
    const { response } = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { credential: "token-bob", newPassword: strongPassword, confirmPassword: strongPassword },
    });
    assert.equal(response.status, 403);

    const login = await request("/auth/login", {
      method: "POST",
      body: { identity: "alice_g", password: strongPassword },
    });
    assert.equal(login.response.status, 401);
  });

  await t.test("sets a password after confirming with Google, then allows password login", async () => {
    const { response } = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { credential: "token-alice", newPassword: strongPassword, confirmPassword: strongPassword },
    });
    assert.equal(response.status, 200);

    const login = await request("/auth/login", {
      method: "POST",
      body: { identity: "alice_g", password: strongPassword },
    });
    assert.equal(login.response.status, 200);
  });

  await t.test("changes the password with the correct current password", async () => {
    const next = "Newer@2026pw";

    const wrong = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { currentPassword: "Wrong@2026pw", newPassword: next, confirmPassword: next },
    });
    assert.equal(wrong.response.status, 400);
    assert.equal(wrong.body.errors[0].field, "currentPassword");

    const same = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { currentPassword: strongPassword, newPassword: strongPassword, confirmPassword: strongPassword },
    });
    assert.equal(same.response.status, 400);
    assert.equal(same.body.errors[0].field, "newPassword");

    const ok = await request("/accounts/me/password", {
      method: "POST",
      cookie: aliceCookie,
      body: { currentPassword: strongPassword, newPassword: next, confirmPassword: next },
    });
    assert.equal(ok.response.status, 200);

    const oldLogin = await request("/auth/login", {
      method: "POST",
      body: { identity: "alice_g", password: strongPassword },
    });
    assert.equal(oldLogin.response.status, 401);

    const newLogin = await request("/auth/login", {
      method: "POST",
      body: { identity: "alice_g", password: next },
    });
    assert.equal(newLogin.response.status, 200);
  });
});
