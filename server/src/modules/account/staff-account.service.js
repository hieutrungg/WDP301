import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { AUDIT_ACTION, AUDIT_TARGET } from "../audit/audit.constants.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import { sendStaffWelcomeEmail } from "../auth/email.service.js";
import { getBranchSummariesByIds, listBranches } from "../branch/branch.service.js";
import { NON_STAFF_ROLE_NAMES, SYSTEM_ROLE } from "../role-permission/role.constants.js";
import {
  getAllRoles,
  getPermissionsByIds,
  getRolesByIds,
  isSystemRoleName,
  listPermissions,
  requireExistingPermissions,
} from "../role-permission/role.service.js";
import { getAccountSummariesByIds } from "./account.service.js";
import { ACCOUNT_STATUS, STAFF_ERROR, STAFF_MESSAGE, STAFF_STATUSES } from "./account.constants.js";
import {
  countAccounts,
  countAccountsByStatus,
  createAccount,
  findAccountDocumentById,
  findIdentityConflicts,
  findStaffAccounts,
  setAccountStatus,
  updateAccountById,
} from "./account.repository.js";

const BCRYPT_ROUNDS = 10;
const SORT_PATHS = { createdAt: "createdAt", username: "username", fullName: "profile.fullName", email: "email", status: "status" };

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const idsOf = (values) => (values ?? []).map((value) => String(value?._id ?? value));
const sameIdentity = (left, right) =>
  typeof left === "string" && typeof right === "string" &&
  left.localeCompare(right, "en", { sensitivity: "base" }) === 0;

const isStaffRole = (role) => !NON_STAFF_ROLE_NAMES.includes(role.name);

const notFound = () =>
  new AppError(404, "Staff account not found.", [], STAFF_ERROR.STAFF_ACCOUNT_NOT_FOUND);

// A staff account is any account holding at least one role other than CUSTOMER.
const staffRoleIds = async () => (await getAllRoles()).filter(isStaffRole).map(({ _id }) => _id);

const requireStaffAccount = async (accountId) => {
  const account = await findAccountDocumentById(accountId);
  if (!account) throw notFound();

  const roles = await getRolesByIds(account.roleIds ?? []);
  if (!roles.some(isStaffRole)) throw notFound();

  return { account, roles };
};

// UC37 6b / BR-33: every selected role and permission must exist; CUSTOMER is not a staff role.
const resolveAccess = async (roleIds, directPermissionIds) => {
  const roles = await getRolesByIds(roleIds);
  if (roles.length !== roleIds.length) {
    const message = "One or more selected roles no longer exist. Please revise the selection.";
    throw new AppError(400, message, [{ field: "roleIds", message }], STAFF_ERROR.ROLE_INVALID);
  }

  const customerRole = roles.find((role) => !isStaffRole(role));
  if (customerRole) {
    const message = `The ${customerRole.name} role cannot be assigned to a staff account.`;
    throw new AppError(400, message, [{ field: "roleIds", message }], STAFF_ERROR.ROLE_INVALID);
  }

  const permissions = await requireExistingPermissions(directPermissionIds, "directPermissionIds");
  return { roles, permissions };
};

const assertBranchExists = async (branchId) => {
  if (!branchId) return;

  const branches = await getBranchSummariesByIds([branchId]);
  if (!branches.has(String(branchId))) {
    const message = "The selected branch does not exist.";
    throw new AppError(400, message, [{ field: "branchId", message }], STAFF_ERROR.BRANCH_INVALID);
  }
};

// BR-01: email, username and phone are unique across all accounts. Reports every clash at once.
const assertIdentitiesAvailable = async ({ email, username, phone, excludeId }) => {
  const conflicts = await findIdentityConflicts({ email, username, phone, excludeId });
  const errors = [];

  if (email && conflicts.some((account) => sameIdentity(account.email, email))) {
    errors.push({ field: "email", message: STAFF_MESSAGE.EMAIL_TAKEN });
  }
  if (username && conflicts.some((account) => sameIdentity(account.username, username))) {
    errors.push({ field: "username", message: STAFF_MESSAGE.USERNAME_TAKEN });
  }
  if (phone && conflicts.some((account) => account.phone === phone)) {
    errors.push({ field: "phone", message: STAFF_MESSAGE.PHONE_TAKEN });
  }

  if (errors.length > 0) {
    throw new AppError(409, errors[0].message, errors, STAFF_ERROR.DUPLICATE_ACCOUNT);
  }
};

const serializeRoleRef = (role) => ({
  id: role._id.toString(),
  name: role.name,
  isSystem: isSystemRoleName(role.name),
  assignable: isStaffRole(role),
});

const serializeBranch = (branchId, branches) => {
  if (!branchId) return null;
  return branches.get(String(branchId)) ?? { id: String(branchId), branchName: null, status: null };
};

const serializeStaffSummary = (account, roles, branches) => ({
  id: account._id.toString(),
  username: account.username,
  email: account.email,
  phone: account.phone ?? null,
  fullName: account.profile?.fullName ?? null,
  status: account.status,
  roles: roles.map(serializeRoleRef),
  directPermissionCount: (account.directPermissionIds ?? []).length,
  branch: serializeBranch(account.employeeProfile?.branchId, branches),
  position: account.employeeProfile?.position ?? null,
  createdAt: account.createdAt ?? null,
  updatedAt: account.updatedAt ?? null,
});

// UC37 step 1 + 4a: effective permissions = role grants ∪ direct grants (A-08). A direct grant
// that a role already provides is kept and flagged, never removed.
const buildAccessView = async (account, roles) => {
  const directIds = idsOf(account.directPermissionIds);
  const roleIdsByPermission = new Map();
  for (const role of roles) {
    for (const permissionId of idsOf(role.permissionIds)) {
      if (!roleIdsByPermission.has(permissionId)) roleIdsByPermission.set(permissionId, []);
      roleIdsByPermission.get(permissionId).push(role.name);
    }
  }

  const permissions = await getPermissionsByIds([...new Set([...directIds, ...roleIdsByPermission.keys()])]);
  const byId = new Map(permissions.map((permission) => [permission._id.toString(), permission]));
  const describe = (permission) => ({
    id: permission._id.toString(),
    name: permission.name,
    description: permission.description ?? null,
  });

  const directPermissions = directIds
    .filter((id) => byId.has(id))
    .map((id) => ({ ...describe(byId.get(id)), grantedByRoles: roleIdsByPermission.get(id) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const effectivePermissions = [...byId.values()]
    .map((permission) => {
      const id = permission._id.toString();
      return { ...describe(permission), roles: roleIdsByPermission.get(id) ?? [], direct: directIds.includes(id) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { directPermissions, effectivePermissions };
};

const getStaffDetail = async (accountId) => {
  const { account, roles } = await requireStaffAccount(accountId);
  const [branches, access, people] = await Promise.all([
    getBranchSummariesByIds([account.employeeProfile?.branchId].filter(Boolean)),
    buildAccessView(account, roles),
    getAccountSummariesByIds([account.createdBy, account.updatedBy].filter(Boolean)),
  ]);

  return {
    ...serializeStaffSummary(account, roles, branches),
    roleIds: roles.filter(isStaffRole).map(({ _id }) => _id.toString()),
    directPermissionIds: access.directPermissions.map(({ id }) => id),
    ...access,
    createdBy: people.get(String(account.createdBy)) ?? null,
    updatedBy: people.get(String(account.updatedBy)) ?? null,
  };
};

export const getStaffAccount = (accountId) => getStaffDetail(accountId);

export const listStaffAccounts = async ({ q, status, roleId, page, limit, sort, order }) => {
  const staffIds = await staffRoleIds();
  const baseFilter = { roleIds: { $in: staffIds } };
  const filter = { ...baseFilter };

  if (roleId) {
    // Filtering by CUSTOMER or an unknown role matches no staff account.
    filter.roleIds = staffIds.some((id) => id.toString() === roleId) ? roleId : { $in: [] };
  }
  if (status) filter.status = status;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ username: pattern }, { email: pattern }, { "profile.fullName": pattern }, { phone: pattern }];
  }

  const direction = order === "asc" ? 1 : -1;
  const [accounts, total, byStatus] = await Promise.all([
    findStaffAccounts({ filter, sort: { [SORT_PATHS[sort]]: direction, _id: direction }, skip: (page - 1) * limit, limit }),
    countAccounts(filter),
    countAccountsByStatus(baseFilter),
  ]);
  const branches = await getBranchSummariesByIds(
    accounts.map((account) => account.employeeProfile?.branchId).filter(Boolean),
  );

  return {
    items: accounts.map((account) =>
      // roleIds were populated with { name } for the list.
      serializeStaffSummary(account, (account.roleIds ?? []).filter(Boolean), branches),
    ),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      counts: {
        total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
        active: byStatus[ACCOUNT_STATUS.ACTIVE] ?? 0,
        disabled: byStatus[ACCOUNT_STATUS.DISABLED] ?? 0,
      },
    },
  };
};

// Form data for UC35/UC37: assignable roles with their grants (for the redundancy hint), the
// predefined permission list and the branches an employee can be attached to.
export const getStaffFormOptions = async () => {
  const [roles, permissions, branches] = await Promise.all([
    getAllRoles(),
    listPermissions(),
    listBranches({ status: "ACTIVE", page: 1, limit: 200, sort: "branchName", order: "asc" }),
  ]);

  return {
    roles: roles.filter(isStaffRole).map((role) => ({
      id: role._id.toString(),
      name: role.name,
      description: role.description || null,
      isSystem: isSystemRoleName(role.name),
      permissionIds: idsOf(role.permissionIds),
    })),
    permissions,
    branches: branches.items.map(({ id, branchName }) => ({ id, branchName })),
  };
};

const sendWelcome = async (account) => {
  try {
    await sendStaffWelcomeEmail({
      email: account.email,
      fullName: account.profile?.fullName || account.username,
      username: account.username,
      setPasswordUrl: `${env.clientUrl}/forgot-password`,
    });
    return true;
  } catch (error) {
    console.error(`[staff] welcome email for account ${account._id} was not sent`, error?.message);
    return false;
  }
};

// UC35 Create Staff Account.
export const createStaffAccount = async (actorAccountId, input) => {
  const { roles, permissions } = await resolveAccess(input.roleIds, input.directPermissionIds);
  await assertBranchExists(input.branchId);
  await assertIdentitiesAvailable(input);

  // The Admin never sees or sets a password; this hash is random and unusable until the staff
  // member chooses a password through Forgot Password (UC35 business rule, owner decision).
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
  const employeeProfile = {
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.position ? { position: input.position } : {}),
  };

  let account;
  try {
    account = await createAccount({
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleIds: input.roleIds,
      directPermissionIds: input.directPermissionIds,
      status: ACCOUNT_STATUS.ACTIVE,
      profile: { fullName: input.fullName },
      ...(Object.keys(employeeProfile).length ? { employeeProfile } : {}),
      createdBy: actorAccountId,
      updatedBy: actorAccountId,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    // A concurrent request took the identity between the check and the insert (unique index).
    await assertIdentitiesAvailable(input);
    throw error;
  }

  await recordAuditEvent({
    actorAccountId,
    action: AUDIT_ACTION.STAFF_ACCOUNT_CREATED,
    targetType: AUDIT_TARGET.ACCOUNT,
    targetId: account._id,
    summary: `Created staff account ${account.username}`,
    changes: {
      username: account.username,
      email: account.email,
      roles: roles.map(({ name }) => name).sort(),
      directPermissions: permissions.map(({ name }) => name).sort(),
    },
  });

  const emailSent = await sendWelcome(account);

  return {
    account: await getStaffDetail(account._id),
    credentialSetup: { method: "PASSWORD_RESET", emailSent },
  };
};

// UC36 Update Staff Account (personal/contact information).
export const updateStaffAccount = async (actorAccountId, accountId, input) => {
  const { account } = await requireStaffAccount(accountId);
  const set = {};
  const unset = {};
  const audit = {};
  const track = (field, from, to) => {
    audit[field] = { from: from ?? null, to: to ?? null };
  };

  if (input.fullName !== undefined && input.fullName !== account.profile?.fullName) {
    set["profile.fullName"] = input.fullName;
    track("fullName", account.profile?.fullName, input.fullName);
  }
  if (input.email !== undefined && input.email !== account.email) {
    set.email = input.email;
    track("email", account.email, input.email);
  }
  if (input.phone !== undefined && input.phone !== account.phone) {
    set.phone = input.phone;
    track("phone", account.phone, input.phone);
  }

  const currentBranchId = account.employeeProfile?.branchId ? String(account.employeeProfile.branchId) : null;
  if (input.branchId !== undefined && (input.branchId ?? null) !== currentBranchId) {
    if (input.branchId) set["employeeProfile.branchId"] = input.branchId;
    else unset["employeeProfile.branchId"] = "";
    track("branchId", currentBranchId, input.branchId);
  }

  const currentPosition = account.employeeProfile?.position ?? null;
  if (input.position !== undefined && (input.position ?? null) !== currentPosition) {
    if (input.position) set["employeeProfile.position"] = input.position;
    else unset["employeeProfile.position"] = "";
    track("position", currentPosition, input.position);
  }

  if (Object.keys(audit).length === 0) return getStaffDetail(account._id);

  await assertBranchExists(set["employeeProfile.branchId"]);
  await assertIdentitiesAvailable({ email: set.email, phone: set.phone, excludeId: account._id });

  try {
    await updateAccountById(account._id, { set: { ...set, updatedBy: actorAccountId }, unset });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    await assertIdentitiesAvailable({ email: set.email, phone: set.phone, excludeId: account._id });
    throw error;
  }

  await recordAuditEvent({
    actorAccountId,
    action: AUDIT_ACTION.STAFF_ACCOUNT_UPDATED,
    targetType: AUDIT_TARGET.ACCOUNT,
    targetId: account._id,
    summary: `Updated staff account ${account.username}`,
    changes: audit,
  });

  return getStaffDetail(account._id);
};

// UC36 alternative (step 5): enable / disable. BR-28: a DISABLED account cannot sign in, and every
// permission-guarded request reloads the status, so its open session is refused on the next call.
export const changeStaffStatus = async (actorAccountId, accountId, { status }) => {
  const { account } = await requireStaffAccount(accountId);
  if (account.status === status) return getStaffDetail(account._id);

  if (!STAFF_STATUSES.includes(account.status)) {
    throw new AppError(
      409,
      "This account has not finished registration, so its status cannot be changed here.",
      [],
      STAFF_ERROR.STATUS_NOT_CHANGEABLE,
    );
  }

  if (status === ACCOUNT_STATUS.DISABLED && String(account._id) === String(actorAccountId)) {
    throw new AppError(409, "You cannot disable your own account.", [], STAFF_ERROR.CANNOT_DISABLE_SELF);
  }

  const result = await setAccountStatus(account._id, account.status, status, actorAccountId);
  if (result.modifiedCount !== 1) {
    throw new AppError(
      409,
      "This account was changed by someone else. Refresh and try again.",
      [],
      STAFF_ERROR.STATUS_NOT_CHANGEABLE,
    );
  }

  const disabled = status === ACCOUNT_STATUS.DISABLED;
  await recordAuditEvent({
    actorAccountId,
    action: disabled ? AUDIT_ACTION.STAFF_ACCOUNT_DISABLED : AUDIT_ACTION.STAFF_ACCOUNT_ENABLED,
    targetType: AUDIT_TARGET.ACCOUNT,
    targetId: account._id,
    summary: `${disabled ? "Disabled" : "Enabled"} staff account ${account.username}`,
    changes: { status: { from: account.status, to: status } },
  });

  return getStaffDetail(account._id);
};

const namesFor = (ids, byId) => ids.map((id) => byId.get(id)?.name ?? id).sort();

// UC37 Assign Staff Roles & Permissions. BR-29: effective permissions are recomputed from the new
// roles on every request, so the change applies on the account's next request.
export const assignStaffAccess = async (actorAccountId, accountId, input) => {
  const { account, roles: currentRoles } = await requireStaffAccount(accountId);
  const currentDirectIds = idsOf(account.directPermissionIds);
  const directPermissionIds = input.directPermissionIds ?? currentDirectIds;
  const { roles: selectedRoles } = await resolveAccess(input.roleIds, directPermissionIds);

  const isSelf = String(account._id) === String(actorAccountId);
  if (
    isSelf &&
    currentRoles.some(({ name }) => name === SYSTEM_ROLE.ADMIN) &&
    !selectedRoles.some(({ name }) => name === SYSTEM_ROLE.ADMIN)
  ) {
    throw new AppError(
      409,
      "You cannot remove the ADMIN role from your own account.",
      [{ field: "roleIds", message: "You cannot remove the ADMIN role from your own account." }],
      STAFF_ERROR.CANNOT_REMOVE_OWN_ADMIN_ROLE,
    );
  }

  // Non-staff roles the account already holds (CUSTOMER) are not managed here and are kept.
  const keptRoleIds = currentRoles.filter((role) => !isStaffRole(role)).map(({ _id }) => _id.toString());
  const nextRoleIds = [...new Set([...input.roleIds, ...keptRoleIds])];
  const currentRoleIds = idsOf(account.roleIds);

  const rolesAdded = nextRoleIds.filter((id) => !currentRoleIds.includes(id));
  const rolesRemoved = currentRoleIds.filter((id) => !nextRoleIds.includes(id));
  const permissionsAdded = directPermissionIds.filter((id) => !currentDirectIds.includes(id));
  const permissionsRemoved = currentDirectIds.filter((id) => !directPermissionIds.includes(id));

  if (!rolesAdded.length && !rolesRemoved.length && !permissionsAdded.length && !permissionsRemoved.length) {
    return getStaffDetail(account._id);
  }

  await updateAccountById(account._id, {
    set: { roleIds: nextRoleIds, directPermissionIds, updatedBy: actorAccountId },
  });

  const roleById = new Map([...currentRoles, ...selectedRoles].map((role) => [role._id.toString(), role]));
  const permissionById = new Map(
    (await getPermissionsByIds([...permissionsAdded, ...permissionsRemoved])).map((permission) => [
      permission._id.toString(),
      permission,
    ]),
  );

  await recordAuditEvent({
    actorAccountId,
    action: AUDIT_ACTION.STAFF_ACCESS_ASSIGNED,
    targetType: AUDIT_TARGET.ACCOUNT,
    targetId: account._id,
    summary: `Assigned roles and permissions to ${account.username}`,
    changes: {
      rolesAdded: namesFor(rolesAdded, roleById),
      rolesRemoved: namesFor(rolesRemoved, roleById),
      directPermissionsAdded: namesFor(permissionsAdded, permissionById),
      directPermissionsRemoved: namesFor(permissionsRemoved, permissionById),
    },
  });

  return getStaffDetail(account._id);
};
