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
let takeTestEmails;

const email = "reset.e2e@example.com";
const oldPassword = "OldCinema@2026";
const newPassword = "NewCinema@2026";

const post = async (path, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
};

const latestResetOtp = () => {
  const emails = takeTestEmails().filter((item) => item.purpose === "RESET_PASSWORD");
  assert.ok(emails.length > 0, "expected a password reset email");
  return emails.at(-1).otp;
};

const wrongOtp = (otp) => (otp === "000000" ? "111111" : "000000");

const allowNewCode = async () => {
  // Skip the resend cooldown by back-dating the current code (createdAt is immutable in Mongoose).
  await EmailVerification.collection.updateMany(
    { email, purpose: "RESET_PASSWORD" },
    { $set: { createdAt: new Date(Date.now() - 61 * 1000) } },
  );
};

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests");

  const testUrl = new URL(process.env.MONGODB_URI);
  testUrl.pathname = "/cinema_management_reset_test";
  await mongoose.connect(testUrl.toString());
  await mongoose.connection.dropDatabase();

  ({ Account } = await import("../src/modules/account/account.model.js"));
  ({ EmailVerification } = await import("../src/modules/auth/email-verification.model.js"));
  ({ Role } = await import("../src/modules/role-permission/role.model.js"));
  ({ takeTestEmails } = await import("../src/modules/auth/email.service.js"));
  const { default: app } = await import("../src/app.js");

  const role = await Role.create({ name: "CUSTOMER", description: "Cinema customer", permissionIds: [] });
  await Account.syncIndexes();
  await Account.create([
    {
      username: "reset_e2e",
      email,
      passwordHash: await bcrypt.hash(oldPassword, 10),
      roleIds: [role._id],
      status: "ACTIVE",
      profile: { fullName: "Reset Tester" },
    },
    {
      username: "reset_pending",
      email: "reset.pending@example.com",
      passwordHash: "x",
      status: "PENDING_VERIFICATION",
    },
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

test("FORGOT PASSWORD → OTP → RESET → LOGIN", async (t) => {
  let otp;

  await t.test("rejects an invalid email address", async () => {
    const { response } = await post("/auth/forgot-password", { email: "not-an-email" });
    assert.equal(response.status, 400);
  });

  await t.test("reports an email that is not registered (UC04 step 4)", async () => {
    const { response, body } = await post("/auth/forgot-password", { email: "nobody@example.com" });
    assert.equal(response.status, 404);
    assert.equal(body.errors[0].field, "email");
  });

  await t.test("refuses an account that has not verified its email", async () => {
    const { response } = await post("/auth/forgot-password", { email: "reset.pending@example.com" });
    assert.equal(response.status, 400);
  });

  await t.test("sends a reset code to a registered email", async () => {
    const { response } = await post("/auth/forgot-password", { email: "Reset.E2E@example.com" });
    assert.equal(response.status, 200);
    otp = latestResetOtp();
    assert.match(otp, /^\d{6}$/);
  });

  await t.test("enforces the resend cooldown", async () => {
    const { response } = await post("/auth/forgot-password", { email });
    assert.equal(response.status, 429);
  });

  await t.test("does not allow a reset before the code is verified", async () => {
    const { response } = await post("/auth/reset-password", {
      email,
      otp,
      newPassword,
      confirmPassword: newPassword,
    });
    assert.equal(response.status, 400);
  });

  await t.test("rejects a wrong code (UC04 step 6)", async () => {
    const { response } = await post("/auth/forgot-password/verify-otp", { email, otp: wrongOtp(otp) });
    assert.equal(response.status, 400);
  });

  await t.test("rejects an expired code", async () => {
    await EmailVerification.updateOne(
      { email, purpose: "RESET_PASSWORD" },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const { response } = await post("/auth/forgot-password/verify-otp", { email, otp });
    assert.equal(response.status, 400);
  });

  await t.test("locks the code after too many wrong attempts", async () => {
    await post("/auth/forgot-password", { email });
    otp = latestResetOtp();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await post("/auth/forgot-password/verify-otp", { email, otp: wrongOtp(otp) });
    }

    const { response } = await post("/auth/forgot-password/verify-otp", { email, otp });
    assert.equal(response.status, 429);
  });

  await t.test("accepts the current code after requesting a new one", async () => {
    await allowNewCode();
    await post("/auth/forgot-password", { email });
    otp = latestResetOtp();

    const { response } = await post("/auth/forgot-password/verify-otp", { email, otp });
    assert.equal(response.status, 200);
  });

  await t.test("rejects a weak or mismatched new password (UC04 step 9)", async () => {
    const weak = await post("/auth/reset-password", { email, otp, newPassword: "weak", confirmPassword: "weak" });
    assert.equal(weak.response.status, 400);

    const mismatch = await post("/auth/reset-password", {
      email,
      otp,
      newPassword,
      confirmPassword: "Different@2026",
    });
    assert.equal(mismatch.response.status, 400);
  });

  await t.test("resets the password and allows login with the new one", async () => {
    const { response } = await post("/auth/reset-password", {
      email,
      otp,
      newPassword,
      confirmPassword: newPassword,
    });
    assert.equal(response.status, 200);

    const oldLogin = await post("/auth/login", { identity: email, password: oldPassword });
    assert.equal(oldLogin.response.status, 401);

    const newLogin = await post("/auth/login", { identity: email, password: newPassword });
    assert.equal(newLogin.response.status, 200);
  });

  await t.test("the code cannot be used twice", async () => {
    const { response } = await post("/auth/reset-password", {
      email,
      otp,
      newPassword: "Another@2026x",
      confirmPassword: "Another@2026x",
    });
    assert.equal(response.status, 400);
    assert.equal(await EmailVerification.countDocuments({ email, purpose: "RESET_PASSWORD" }), 0);
  });
});
