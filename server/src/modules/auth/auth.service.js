import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import {
  findAccountForLogin,
  findAccountWithAccessById,
} from "../account/account.repository.js";
import { AppError } from "../../utils/AppError.js";

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
