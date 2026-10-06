import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import bcrypt from "bcrypt";
import "dotenv/config";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.EMAIL_TEST_MODE = "capture";

let baseUrl;
let server;
let Account;
let EmailVerification;
let Role;
let Permission;
let takeTestEmails;

const payload = {
  fullName: "Register Test Customer",
  email: "register.e2e@example.com",
  phone: "0912345678",
  username: "register_e2e_customer",
  password: "Cinema@2026",
  confirmPassword: "Cinema@2026",
};

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  return { response, body };
};

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_register_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  ({ Account } = await import("../src/modules/account/account.model.js"));
  ({ EmailVerification } = await import("../src/modules/auth/email-verification.model.js"));
  ({ Role } = await import("../src/modules/role-permission/role.model.js"));
  ({ Permission } = await import("../src/modules/role-permission/permission.model.js"));
  ({ takeTestEmails } = await import("../src/modules/auth/email.service.js"));
  const { default: app } = await import("../src/app.js");

  const permission = await Permission.create({ name: "profile.view", description: "View profile" });
  await Role.create({
    name: "CUSTOMER",
    description: "Cinema customer",
    permissionIds: [permission._id],
  });
  await Account.syncIndexes();

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

test("REGISTER → OTP → ACTIVE → LOGIN end-to-end", async (t) => {
  await t.test("rejects invalid email", async () => {
    const { response } = await request("/auth/register", {
      method: "POST",
      body: { ...payload, email: "not-an-email" },
    });
    assert.equal(response.status, 400);
  });

  await t.test("rejects weak password", async () => {
    const { response } = await request("/auth/register", {
      method: "POST",
      body: { ...payload, password: "weak", confirmPassword: "weak" },
    });
    assert.equal(response.status, 400);
  });

  await t.test("rejects password mismatch", async () => {
    const { response } = await request("/auth/register", {
      method: "POST",
      body: { ...payload, confirmPassword: "Different@2026" },
    });
    assert.equal(response.status, 400);
  });

  let originalOtp;

  await t.test("registers a pending CUSTOMER account and stores only hashes", async () => {
    const { response, body } = await request("/auth/register", {
      method: "POST",
      body: payload,
    });
    assert.equal(response.status, 201);
    assert.equal(body.data.email, payload.email);

    const account = await Account.findOne({ email: payload.email }).select("+passwordHash").lean();
    const role = await Role.findOne({ name: "CUSTOMER" }).lean();
    assert.equal(account.status, "PENDING_VERIFICATION");
    assert.equal(account.profile.fullName, payload.fullName);
    assert.deepEqual(account.directPermissionIds, []);
    assert.equal(account.roleIds[0].toString(), role._id.toString());
    assert.notEqual(account.passwordHash, payload.password);
    assert.equal(await bcrypt.compare(payload.password, account.passwordHash), true);

    const verification = await EmailVerification.findOne({ accountId: account._id })
      .select("+otpHash")
      .lean();
    assert.equal(verification.purpose, "REGISTER_EMAIL");
    assert.equal(verification.attemptCount, 0);
    assert.ok(verification.expiresAt.getTime() > Date.now());
    assert.ok(verification.expiresAt.getTime() <= Date.now() + 5 * 60 * 1000 + 2000);

    const emails = takeTestEmails();
    assert.equal(emails.length, 1);
    originalOtp = emails[0].otp;
    assert.match(originalOtp, /^\d{6}$/);
    assert.notEqual(verification.otpHash, originalOtp);
    assert.equal(await bcrypt.compare(originalOtp, verification.otpHash), true);
  });

  await t.test("rejects duplicate email", async () => {
    const { response, body } = await request("/auth/register", {
      method: "POST",
      body: { ...payload, username: "another_username" },
    });
    assert.equal(response.status, 409);
    assert.equal(body.errors[0].field, "email");
  });

  await t.test("rejects duplicate username", async () => {
    const { response, body } = await request("/auth/register", {
      method: "POST",
      body: { ...payload, email: "another@example.com" },
    });
    assert.equal(response.status, 409);
    assert.equal(body.errors[0].field, "username");
  });

  await t.test("blocks login while pending verification", async () => {
    const { response } = await request("/auth/login", {
      method: "POST",
      body: { identity: payload.username, password: payload.password },
    });
    assert.equal(response.status, 403);
  });

  await t.test("increments attempts for an incorrect OTP", async () => {
    const account = await Account.findOne({ email: payload.email });
    const { response } = await request("/auth/verify-email", {
      method: "POST",
      body: { email: payload.email, otp: "000000" },
    });
    assert.equal(response.status, 400);
    const verification = await EmailVerification.findOne({ accountId: account._id }).lean();
    assert.equal(verification.attemptCount, 1);
  });

  await t.test("rejects an expired OTP", async () => {
    const account = await Account.findOne({ email: payload.email });
    await EmailVerification.updateOne(
      { accountId: account._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const { response, body } = await request("/auth/verify-email", {
      method: "POST",
      body: { email: payload.email, otp: originalOtp },
    });
    assert.equal(response.status, 400);
    assert.match(body.message, /expired/i);
  });

  let resentOtp;

  await t.test("resends a replacement OTP", async () => {
    const { response } = await request("/auth/resend-verification", {
      method: "POST",
      body: { email: payload.email },
    });
    assert.equal(response.status, 200);
    const emails = takeTestEmails();
    assert.equal(emails.length, 1);
    resentOtp = emails[0].otp;
  });

  await t.test("enforces resend cooldown and keeps one current OTP", async () => {
    const { response } = await request("/auth/resend-verification", {
      method: "POST",
      body: { email: payload.email },
    });
    assert.equal(response.status, 429);
    const account = await Account.findOne({ email: payload.email });
    assert.equal(
      await EmailVerification.countDocuments({
        accountId: account._id,
        purpose: "REGISTER_EMAIL",
      }),
      1,
    );
  });

  await t.test("invalidates the previous OTP after resend", async () => {
    const { response } = await request("/auth/verify-email", {
      method: "POST",
      body: { email: payload.email, otp: originalOtp },
    });
    assert.equal(response.status, 400);
  });

  await t.test("activates the account with the current OTP", async () => {
    const { response } = await request("/auth/verify-email", {
      method: "POST",
      body: { email: payload.email, otp: resentOtp },
    });
    assert.equal(response.status, 200);
    const account = await Account.findOne({ email: payload.email }).lean();
    assert.equal(account.status, "ACTIVE");
    assert.equal(await EmailVerification.countDocuments({ accountId: account._id }), 0);
  });

  let cookie;

  await t.test("logs in by username and keeps /me and logout working", async () => {
    const loginResult = await request("/auth/login", {
      method: "POST",
      body: { identity: payload.username, password: payload.password },
    });
    assert.equal(loginResult.response.status, 200);
    cookie = loginResult.response.headers.get("set-cookie").split(";")[0];

    const meResult = await request("/auth/me", { headers: { Cookie: cookie } });
    assert.equal(meResult.response.status, 200);
    assert.equal(meResult.body.data.email, payload.email);
    assert.equal(meResult.body.data.roles[0].name, "CUSTOMER");
    assert.equal(meResult.body.data.permissions[0].name, "profile.view");

    const logoutResult = await request("/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(logoutResult.response.status, 200);
    assert.match(logoutResult.response.headers.get("set-cookie"), /accessToken=;/);

    const afterLogout = await request("/auth/me", {
      headers: { Cookie: "accessToken=" },
    });
    assert.equal(afterLogout.response.status, 401);
  });

  await t.test("logs in by normalized email", async () => {
    const { response } = await request("/auth/login", {
      method: "POST",
      body: { identity: payload.email.toUpperCase(), password: payload.password },
    });
    assert.equal(response.status, 200);
  });
});
