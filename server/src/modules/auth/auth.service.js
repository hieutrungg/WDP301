import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import {
  findAccountForLogin,
  findAccountByEmail,
  findAccountWithAccessById,
  findDuplicateAccount,
  createAccount,
  activateAccount,
  deletePendingAccount,
} from "../account/account.repository.js";
import { findRoleByName } from "../role-permission/role.repository.js";
import {
  createVerification,
  deleteVerificationById,
  deleteVerifications,
  findVerification,
  incrementAttemptCount,
} from "./email-verification.repository.js";
import { sendRegistrationOtpEmail } from "./email.service.js";
import { AppError } from "../../utils/AppError.js";

const REGISTER_PURPOSE = "REGISTER_EMAIL";
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

const createOtpVerification = async (account, previousOtpHash = null) => {
  let otp;
  do {
    otp = crypto.randomInt(100000, 1000000).toString();
  } while (previousOtpHash && (await bcrypt.compare(otp, previousOtpHash)));
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await deleteVerifications(account._id, REGISTER_PURPOSE);
  const verification = await createVerification({
    accountId: account._id,
    email: account.email,
    purpose: REGISTER_PURPOSE,
    otpHash,
    expiresAt,
    attemptCount: 0,
  });

  try {
    await sendRegistrationOtpEmail({
      email: account.email,
      fullName: account.profile.fullName,
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

export const login = async ({ identity, password, rememberMe }) => {
  const account = await findAccountForLogin(identity);

  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    throw new AppError(401, "Invalid email/username or password");
  }

  if (account.status !== "ACTIVE") {
    throw new AppError(403, "This account is not allowed to sign in");
  }

  const expiresIn = rememberMe ? "7d" : "8h";
  const token = jwt.sign({ sub: account._id.toString() }, env.jwtAccessSecret, {
    expiresIn,
  });

  return { token, rememberMe };
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

export const verifyEmail = async ({ email, otp }) => {
  const account = await findAccountByEmail(email);

  if (!account || account.status !== "PENDING_VERIFICATION") {
    throw new AppError(400, "Unable to verify this account");
  }

  const verification = await findVerification(account._id, REGISTER_PURPOSE);

  if (!verification) {
    throw new AppError(400, "Verification code is invalid or expired");
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    await deleteVerificationById(verification._id);
    throw new AppError(400, "Verification code has expired");
  }

  if (verification.attemptCount >= OTP_MAX_ATTEMPTS) {
    throw new AppError(429, "Too many incorrect attempts. Request a new code.");
  }

  const matches = await bcrypt.compare(otp, verification.otpHash);
  if (!matches) {
    await incrementAttemptCount(verification._id);
    throw new AppError(400, "Invalid verification code");
  }

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
  if (
    currentVerification &&
    Date.now() - currentVerification.createdAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    const retryAfter = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - currentVerification.createdAt.getTime())) / 1000,
    );
    throw new AppError(429, `Please wait ${retryAfter} seconds before requesting another code`);
  }

  await createOtpVerification(account, currentVerification?.otpHash);
};
