import bcrypt from "bcrypt";
import { AppError } from "../../utils/AppError.js";
import { getCurrentAccount } from "../auth/auth.service.js";
import { googleTokenVerifier } from "../auth/google.service.js";
import {
  findAccountById,
  findAccountWithPasswordById,
  setAccountPasswordHash,
  updateAccountProfile,
} from "./account.repository.js";

const BCRYPT_ROUNDS = 10;

const fieldError = (statusCode, field, message) =>
  new AppError(statusCode, message, [{ field, message }]);

const requireActiveAccount = async (accountId, find) => {
  const account = await find(accountId);

  if (!account) {
    throw new AppError(401, "Authentication required");
  }

  if (account.status !== "ACTIVE") {
    throw new AppError(403, "This account is not allowed to update its profile");
  }

  return account;
};

// Email and username are identifiers and are intentionally not editable here.
export const updateProfile = async (accountId, { fullName, phone }) => {
  const account = await requireActiveAccount(accountId, findAccountById);

  const changes = {};
  if (fullName !== undefined) changes["profile.fullName"] = fullName;
  if (phone !== undefined) changes.phone = phone;

  await updateAccountProfile(account._id, changes);

  return getCurrentAccount(accountId);
};

const confirmCurrentPassword = async (account, { currentPassword, newPassword }) => {
  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) {
    throw fieldError(400, "currentPassword", "Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    throw fieldError(400, "newPassword", "New password must be different from the current one");
  }
};

// Accounts created through Google never knew their password, so Google can vouch for ownership.
const confirmGoogleOwnership = async (account, credential) => {
  const profile = await googleTokenVerifier.verify(credential);

  if (!profile.emailVerified || profile.email !== account.email) {
    throw new AppError(403, "This Google account does not match your F-Cinema account");
  }
};

export const changePassword = async (accountId, input) => {
  const account = await requireActiveAccount(accountId, findAccountWithPasswordById);

  if (input.credential) {
    await confirmGoogleOwnership(account, input.credential);
  } else if (input.currentPassword) {
    await confirmCurrentPassword(account, input);
  } else {
    throw fieldError(400, "currentPassword", "Enter your current password or confirm with Google");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await setAccountPasswordHash(account._id, passwordHash);
};
