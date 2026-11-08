import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { Account } from "../modules/account/account.model.js";
import { Permission } from "../modules/role-permission/permission.model.js";
import { SYSTEM_ROLE_NAMES } from "../modules/role-permission/role.constants.js";
import { Role } from "../modules/role-permission/role.model.js";
import {
  actorRoleOf,
  allowedPermissionNames,
  outOfScope,
} from "../modules/role-permission/role-permission-scope.js";

// Read-only audit for the permission ceilings (role-permission-scope.js). It never writes: an Admin
// fixes any finding on /admin/roles or /admin/staff-accounts (removing a grant is always allowed).
export const auditRolePermissionScope = async () => {
  const [permissions, roles, accounts] = await Promise.all([
    Permission.find({}).select("_id name").lean(),
    Role.find({}).select("_id name baseRole permissionIds").lean(),
    Account.find({ "directPermissionIds.0": { $exists: true } })
      .select("_id username roleIds directPermissionIds")
      .lean(),
  ]);
  const nameOf = new Map(permissions.map(({ _id, name }) => [String(_id), name]));
  const roleById = new Map(roles.map((role) => [String(role._id), role]));
  const names = (ids) => (ids ?? []).map((id) => nameOf.get(String(id))).filter(Boolean);
  const isScoped = (role) => SYSTEM_ROLE_NAMES.includes(role.name) || Boolean(role.baseRole);

  const findings = [];
  for (const role of roles) {
    if (!isScoped(role)) {
      findings.push({ type: "ROLE_WITHOUT_BASE_ROLE", role: role.name });
      continue;
    }
    const rejected = outOfScope(names(role.permissionIds), allowedPermissionNames([actorRoleOf(role)]));
    if (rejected.length) findings.push({ type: "ROLE_OUT_OF_SCOPE", role: role.name, permissions: rejected });
  }
  for (const account of accounts) {
    const actors = (account.roleIds ?? [])
      .map((id) => roleById.get(String(id)))
      .filter((role) => role && isScoped(role))
      .map(actorRoleOf);
    const rejected = outOfScope(names(account.directPermissionIds), allowedPermissionNames(actors));
    if (rejected.length) {
      findings.push({ type: "DIRECT_GRANT_OUT_OF_SCOPE", account: account.username, permissions: rejected });
    }
  }
  return findings;
};

const run = async () => {
  await connectDatabase();
  try {
    const findings = await auditRolePermissionScope();
    if (findings.length === 0) console.log("All roles and direct grants are within their permission ceilings.");
    for (const finding of findings) console.log(JSON.stringify(finding));
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  run().catch((error) => {
    console.error("Role permission scope audit failed:", error.message);
    process.exitCode = 1;
  });
}
