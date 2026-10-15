import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import {
  findAccountForLogin,
  findAccountByEmail,
  findAccountByUsername,
  findAccountWithAccessById,
  findDuplicateAccount,
  createAccount,
  activateAccount,
  deletePendingAccount,
  setAccountPasswordHash,
} from "../account/account.repository.js";
import { findRoleByName } from "../role-permission/role.repository.js";
import {
  createVerification,
  deleteVerificationById,
  deleteVerifications,
  findVerification,
  incrementAttemptCount,
  markVerificationVerified,
} from "./email-verification.repository.js";
import { sendPasswordResetOtpEmail, sendRegistrationOtpEmail } from "./email.service.js";
import { googleTokenVerifier } from "./google.service.js";
import { AppError } from "../../utils/AppError.js";

const REGISTER_PURPOSE = "REGISTER_EMAIL";
const RESET_PASSWORD_PURPOSE = "RESET_PASSWORD";
// Time allowed to choose a new password once the reset code has been verified.
const RESET_WINDOW_MINUTES = 10;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const BCRYPT_ROUNDS = 10;

const duplicateError = (field) =>
  new AppError(409, `${field === "email" ? "Email" : "Username"} is already registered`, [
    { field, message: `${field === "email" ? "Email" : "Username"} is already registered` },
  ]);

const handleDuplicateKeyError = (error) => {
  if (error?.code !== 11000) throw error;
  const field = Object.hasOwn(error.keyPattern ?? {}, "email") ? "email" : "username";
  throw duplicateError(field);
};

const otpEmailSenders = {
  [REGISTER_PURPOSE]: sendRegistrationOtpEmail,
  [RESET_PASSWORD_PURPOSE]: sendPasswordResetOtpEmail,
};

const createOtpVerification = async (
  account,
  { purpose = REGISTER_PURPOSE, previousOtpHash = null } = {},
) => {
  let otp;
  do {
    otp = crypto.randomInt(100000, 1000000).toString();
  } while (previousOtpHash && (await bcrypt.compare(otp, previousOtpHash)));
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await deleteVerifications(account._id, purpose);
  const verification = await createVerification({
    accountId: account._id,
    email: account.email,
    purpose,
    otpHash,
    expiresAt,
    attemptCount: 0,
  });

  try {
    await otpEmailSenders[purpose]({
      email: account.email,
      fullName: account.profile?.fullName || account.username,
      otp,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    await deleteVerificationById(verification._id);
    throw error;
  }
};

const normalizePermission = (permission) => ({
  id: permission._id.toString(),
  name: permission.name,
  description: permission.description,
});

const serializeAccount = (account) => {
  const permissionMap = new Map();

  for (const role of account.roleIds ?? []) {
    for (const permission of role.permissionIds ?? []) {
      permissionMap.set(permission._id.toString(), normalizePermission(permission));
    }
  }

  for (const permission of account.directPermissionIds ?? []) {
    permissionMap.set(permission._id.toString(), normalizePermission(permission));
  }

  return {
    id: account._id.toString(),
    username: account.username,
    email: account.email,
    phone: account.phone,
    status: account.status,
    createdAt: account.createdAt,
    profile: account.profile,
    employeeProfile: account.employeeProfile,
    roles: (account.roleIds ?? []).map((role) => ({
      id: role._id.toString(),
      name: role.name,
      description: role.description,
    })),
    permissions: [...permissionMap.values()],
  };
};

const issueAccessToken = (accountId, rememberMe) =>
  jwt.sign({ sub: accountId.toString() }, env.jwtAccessSecret, {
    expiresIn: rememberMe ? "7d" : "8h",
  });

export const login = async ({ identity, password, rememberMe }) => {
  const account = await findAccountForLogin(identity);

  if (!account?.passwordHash || !(await bcrypt.compare(password, account.passwordHash))) {
    throw new AppError(401, "Invalid email/username or password");
  }

  if (account.status !== "ACTIVE") {
    throw new AppError(403, "This account is not allowed to sign in");
  }

  return { token: issueAccessToken(account._id, rememberMe), rememberMe };
};

const buildUsernameBase = (email) => {
  const base = email
    .split("@")[0]
    .replace(/[^A-Za-z0-9_]/g, "_")
    .slice(0, 22);

  return base.length >= 3 ? base : `user_${base}`;
};

const generateUniqueUsername = async (email) => {
  const base = buildUsernameBase(email);
  let candidate = base;

  while (await findAccountByUsername(candidate)) {
    candidate = `${base}_${crypto.randomInt(1000, 10000)}`;
  }

  return candidate;
};

const createGoogleAccount = async ({ email, name }) => {
  const customerRole = await findRoleByName("CUSTOMER");
  if (!customerRole) {
    throw new AppError(500, "CUSTOMER role is not configured");
  }

  // Google accounts have no usable password until the owner sets one from their profile.
  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString("hex"),
    BCRYPT_ROUNDS,
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createAccount({
        username: await generateUniqueUsername(email),
        email,
        passwordHash,
        roleIds: [customerRole._id],
        directPermissionIds: [],
        status: "ACTIVE",
        profile: { fullName: name || email.split("@")[0] },
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;

      // A concurrent first sign-in already created this email.
      const existing = await findAccountByEmail(email);
      if (existing) return existing;
    }
  }

  throw new AppError(409, "Unable to create account. Please try again.");
};

export const loginWithGoogle = async ({ credential, rememberMe }) => {
  const profile = await googleTokenVerifier.verify(credential);

  if (!profile.email || !profile.emailVerified) {
    throw new AppError(401, "Your Google email address is not verified");
  }

  const account =
    (await findAccountByEmail(profile.email)) ?? (await createGoogleAccount(profile));

  if (account.status === "PENDING_VERIFICATION") {
    throw new AppError(
      409,
      "This email is awaiting verification. Please verify it with the code we emailed you.",
    );
  }

  if (account.status !== "ACTIVE") {
    throw new AppError(403, "This account is not allowed to sign in");
  }

  return { token: issueAccessToken(account._id, rememberMe), rememberMe };
};

export const getCurrentAccount = async (accountId) => {
  const account = await findAccountWithAccessById(accountId);

  if (!account) {
    throw new AppError(401, "Authentication required");
  }

  if (account.status !== "ACTIVE") {
    throw new AppError(403, "This account is not allowed to sign in");
  }

  return serializeAccount(account);
};

export const register = async (registration) => {
  const input = { ...registration };
  delete input.confirmPassword;
  const duplicate = await findDuplicateAccount(input.email, input.username);

  if (duplicate) {
    throw duplicateError(
      duplicate.email.toLowerCase() === input.email ? "email" : "username",
    );
  }

  const customerRole = await findRoleByName("CUSTOMER");
  if (!customerRole) {
    throw new AppError(500, "CUSTOMER role is not configured");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  let account;

  try {
    account = await createAccount({
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleIds: [customerRole._id],
      directPermissionIds: [],
      status: "PENDING_VERIFICATION",
      profile: { fullName: input.fullName },
    });
  } catch (error) {
    handleDuplicateKeyError(error);
  }

  try {
    await createOtpVerification(account);
  } catch (error) {
    await Promise.allSettled([
      deleteVerifications(account._id, REGISTER_PURPOSE),
      deletePendingAccount(account._id),
    ]);
    throw error;
  }

  return { email: account.email };
};

const assertValidOtp = async (verification, otp) => {
  if (verification.expiresAt.getTime() <= Date.now()) {
    await deleteVerificationById(verification._id);
    throw new AppError(400, "Verification code has expired");
  }

  if (verification.attemptCount >= OTP_MAX_ATTEMPTS) {
    throw new AppError(429, "Too many incorrect attempts. Request a new code.");
  }

  if (!(await bcrypt.compare(otp, verification.otpHash))) {
    await incrementAttemptCount(verification._id);
    throw new AppError(400, "Invalid verification code");
  }
};

const assertResendCooldown = (verification) => {
  if (!verification) return;

  const elapsed = Date.now() - verification.createdAt.getTime();
  if (elapsed < RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    throw new AppError(429, `Please wait ${retryAfter} seconds before requesting another code`);
  }
};

export const verifyEmail = async ({ email, otp }) => {
  const account = await findAccountByEmail(email);

  if (!account || account.status !== "PENDING_VERIFICATION") {
    throw new AppError(400, "Unable to verify this account");
  }

  const verification = await findVerification(account._id, REGISTER_PURPOSE);

  if (!verification) {
    throw new AppError(400, "Verification code is invalid or expired");
  }

  await assertValidOtp(verification, otp);

  const result = await activateAccount(account._id);
  if (result.modifiedCount !== 1) {
    throw new AppError(409, "Account verification state changed. Please try again.");
  }

  await deleteVerificationById(verification._id);
};

export const resendVerification = async ({ email }) => {
  const account = await findAccountByEmail(email);

  if (!account || account.status !== "PENDING_VERIFICATION") {
    return;
  }

  const currentVerification = await findVerification(account._id, REGISTER_PURPOSE);
  assertResendCooldown(currentVerification);

  await createOtpVerification(account, { previousOtpHash: currentVerification?.otpHash });
};

const notRegisteredError = () =>
  new AppError(404, "No account is registered with this email address", [
    { field: "email", message: "No account is registered with this email address" },
  ]);

const findResetVerification = async (email) => {
  const account = await findAccountByEmail(email);
  const verification = account
    ? await findVerification(account._id, RESET_PASSWORD_PURPOSE)
    : null;

  if (!verification) {
    throw new AppError(400, "Verification code is invalid or expired");
  }

  return { account, verification };
};

// UC04 steps 3-5. The SRS asks for an explicit error when the email is not registered.
export const requestPasswordReset = async ({ email }) => {
  const account = await findAccountByEmail(email);

  if (!account) {
    throw notRegisteredError();
  }

  if (account.status === "PENDING_VERIFICATION") {
    throw new AppError(400, "Please verify your email address before resetting your password");
  }

  if (account.status !== "ACTIVE") {
    throw new AppError(403, "This account is not allowed to reset its password");
  }

  const currentVerification = await findVerification(account._id, RESET_PASSWORD_PURPOSE);
  assertResendCooldown(currentVerification);

  await createOtpVerification(account, {
    purpose: RESET_PASSWORD_PURPOSE,
    previousOtpHash: currentVerification?.otpHash,
  });
};

// UC04 step 6: check the code before the new password form is shown.
export const verifyPasswordResetOtp = async ({ email, otp }) => {
  const { verification } = await findResetVerification(email);

  await assertValidOtp(verification, otp);
  await markVerificationVerified(
    verification._id,
    new Date(Date.now() + RESET_WINDOW_MINUTES * 60 * 1000),
  );
};

// UC04 steps 8-10: a verified code can be used exactly once.
export const resetPassword = async ({ email, otp, newPassword }) => {
  const { account, verification } = await findResetVerification(email);

  if (!verification.verifiedAt) {
    throw new AppError(400, "Please verify your code before choosing a new password");
  }

  await assertValidOtp(verification, otp);

  const consumed = await deleteVerificationById(verification._id);
  if (consumed.deletedCount !== 1) {
    throw new AppError(400, "Verification code is invalid or expired");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await setAccountPasswordHash(account._id, passwordHash);
};
