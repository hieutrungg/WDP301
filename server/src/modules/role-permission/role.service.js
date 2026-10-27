import { AppError } from "../../utils/AppError.js";
import { AUDIT_ACTION, AUDIT_TARGET } from "../audit/audit.constants.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import {
  countActiveAccountsByRoleIds,
  getAccountSummariesByIds,
} from "../account/account.service.js";
import {
  LOCKED_ROLE_NAMES,
  ROLE_ERROR,
  ROLE_MESSAGE,
  SYSTEM_ROLE_NAMES,
} from "./role.constants.js";
import {
  countRoles,
  createRole as insertRole,
  findAllPermissions,
  findAllRoles,
  findPermissionsByIds,
  findRoleById,
  findRoleByNameInsensitive,
  findRoles,
  findRolesByIds,
  updateRoleById,
} from "./role.repository.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sameName = (left, right) => left.localeCompare(right, "en", { sensitivity: "base" }) === 0;

export const isSystemRoleName = (name) => SYSTEM_ROLE_NAMES.includes(name);
export const isLockedRoleName = (name) => LOCKED_ROLE_NAMES.includes(name);

// "movie.create" -> "movie": permissions are shown grouped by module.
export const permissionGroup = (name) => String(name ?? "").split(".")[0] || "other";

export const serializePermission = (permission) => ({
  id: permission._id.toString(),
  name: permission.name,
  description: permission.description ?? null,
  group: permissionGroup(permission.name),
});

const serializeRole = (role, { activeAccountCount = 0 } = {}) => ({
  id: role._id.toString(),
  name: role.name,
  description: role.description || null,
  isSystem: isSystemRoleName(role.name),
  isLocked: isLockedRoleName(role.name),
  permissionIds: (role.permissionIds ?? []).map(String),
  permissionCount: (role.permissionIds ?? []).length,
  activeAccountCount,
  createdAt: role.createdAt ?? null,
  updatedAt: role.updatedAt ?? null,
});

const notFound = () => new AppError(404, "Role not found.", [], ROLE_ERROR.ROLE_NOT_FOUND);

const nameTaken = () =>
  new AppError(409, "This role name already exists.", [
    { field: "name", message: "This role name already exists." },
  ], ROLE_ERROR.ROLE_NAME_TAKEN);

const assertNameAvailable = async (name, { excludeId } = {}) => {
  // System names stay reserved even if a database has not been seeded with that role yet.
  if (SYSTEM_ROLE_NAMES.some((systemName) => sameName(systemName, name))) throw nameTaken();
  if (await findRoleByNameInsensitive(name, { excludeId })) throw nameTaken();
};

// BR-33: only permissions from the predefined list can be granted.
export const requireExistingPermissions = async (permissionIds, field = "permissionIds") => {
  if (permissionIds.length === 0) return [];

  const permissions = await findPermissionsByIds(permissionIds);
  if (permissions.length !== permissionIds.length) {
    const message = "One or more selected permissions no longer exist. Please revise the selection.";
    throw new AppError(400, message, [{ field, message }], ROLE_ERROR.PERMISSION_INVALID);
  }

  return permissions;
};

const permissionNames = async (ids) =>
  (await findPermissionsByIds(ids)).map(({ name }) => name).sort();

const assertConfirmed = ({ permissionIds, activeAccountCount, confirmNoPermissions, confirmAffectedAccounts }) => {
  if (permissionIds?.length === 0 && !confirmNoPermissions) {
    throw new AppError(409, ROLE_MESSAGE.NO_PERMISSIONS_WARNING, [
      { field: "permissionIds", message: ROLE_MESSAGE.NO_PERMISSIONS_WARNING },
    ], ROLE_ERROR.EMPTY_PERMISSIONS_CONFIRMATION_REQUIRED);
  }

  if (activeAccountCount > 0 && !confirmAffectedAccounts) {
    const accounts = activeAccountCount === 1 ? "1 active account" : `${activeAccountCount} active accounts`;
    const message = `This role is assigned to ${accounts}. The change will immediately affect ${activeAccountCount === 1 ? "it" : "them"}. Confirm to continue.`;
    throw new AppError(409, message, [{ field: "confirmAffectedAccounts", message }],
      ROLE_ERROR.AFFECTED_ACCOUNTS_CONFIRMATION_REQUIRED);
  }
};

const activeCountFor = async (roleId) =>
  (await countActiveAccountsByRoleIds([roleId])).get(String(roleId)) ?? 0;

export const listPermissions = async () => (await findAllPermissions()).map(serializePermission);

export const listRoles = async ({ q, kind, page, limit, sort, order }) => {
  const filter = {};
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: pattern }, { description: pattern }];
  }
  if (kind === "system") filter.name = { $in: SYSTEM_ROLE_NAMES };
  if (kind === "custom") filter.name = { $nin: SYSTEM_ROLE_NAMES };

  const direction = order === "desc" ? -1 : 1;
  const [roles, total] = await Promise.all([
    findRoles({ filter, sort: { [sort]: direction, _id: direction }, skip: (page - 1) * limit, limit }),
    countRoles(filter),
  ]);
  const counts = await countActiveAccountsByRoleIds(roles.map(({ _id }) => _id));

  return {
    items: roles.map((role) =>
      serializeRole(role, { activeAccountCount: counts.get(role._id.toString()) ?? 0 }),
    ),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getRole = async (roleId) => {
  const role = await findRoleById(roleId);
  if (!role) throw notFound();

  const [permissions, activeAccountCount, people] = await Promise.all([
    findPermissionsByIds(role.permissionIds ?? []),
    activeCountFor(role._id),
    getAccountSummariesByIds([role.createdBy, role.updatedBy].filter(Boolean)),
  ]);

  return {
    ...serializeRole(role, { activeAccountCount }),
    // Dangling ids (a permission removed from the catalog) are not reported as granted.
    permissionIds: permissions.map(({ _id }) => _id.toString()),
    permissionCount: permissions.length,
    permissions: permissions.map(serializePermission).sort((a, b) => a.name.localeCompare(b.name)),
    createdBy: people.get(String(role.createdBy)) ?? null,
    updatedBy: people.get(String(role.updatedBy)) ?? null,
  };
};

// Read contract for Account (staff management): id -> role document, plus the full list.
export const getRolesByIds = (roleIds) => findRolesByIds(roleIds);
export const getAllRoles = () => findAllRoles();
export const getPermissionsByIds = (permissionIds) => findPermissionsByIds(permissionIds);

// UC45 Create Role.
export const createRole = async (actorAccountId, { name, description, permissionIds, confirmNoPermissions }) => {
  await assertNameAvailable(name);
  const permissions = await requireExistingPermissions(permissionIds);
  assertConfirmed({ permissionIds, activeAccountCount: 0, confirmNoPermissions });

  let role;
  try {
    role = await insertRole({
      name,
      description: description ?? undefined,
      permissionIds,
      createdBy: actorAccountId,
      updatedBy: actorAccountId,
    });
  } catch (error) {
    if (error?.code === 11000) throw nameTaken();
    throw error;
  }

  await recordAuditEvent({
    actorAccountId,
    action: AUDIT_ACTION.ROLE_CREATED,
    targetType: AUDIT_TARGET.ROLE,
    targetId: role._id,
    summary: `Created role ${name}`,
    changes: { name, description: description ?? null, permissions: permissions.map((p) => p.name).sort() },
  });

  return getRole(role._id);
};

const diffIds = (before, after) => ({
  added: after.filter((id) => !before.includes(id)),
  removed: before.filter((id) => !after.includes(id)),
});

// Shared by UC46 (info and/or permissions) and UC47 (permissions only).
const changeRole = async (actorAccountId, roleId, input, action) => {
  const role = await findRoleById(roleId);
  if (!role) throw notFound();

  if (isLockedRoleName(role.name)) {
    throw new AppError(
      409,
      `The ${role.name} role is managed by the system and cannot be changed.`,
      [],
      ROLE_ERROR.SYSTEM_ROLE_LOCKED,
    );
  }

  const changes = {};
  const audit = {};

  if (input.name !== undefined && input.name !== role.name) {
    if (isSystemRoleName(role.name)) {
      const message = `The ${role.name} role is a system role and cannot be renamed.`;
      throw new AppError(409, message, [{ field: "name", message }], ROLE_ERROR.SYSTEM_ROLE_NAME_LOCKED);
    }
    await assertNameAvailable(input.name, { excludeId: role._id });
    changes.name = input.name;
    audit.name = { from: role.name, to: input.name };
  }

  const currentDescription = role.description || null;
  if (input.description !== undefined && (input.description ?? null) !== currentDescription) {
    changes.description = input.description ?? "";
    audit.description = { from: currentDescription, to: input.description ?? null };
  }

  const currentIds = (role.permissionIds ?? []).map(String);
  let nextIds;
  if (input.permissionIds !== undefined) {
    await requireExistingPermissions(input.permissionIds);
    const { added, removed } = diffIds(currentIds, input.permissionIds);
    if (added.length || removed.length) {
      nextIds = input.permissionIds;
      changes.permissionIds = nextIds;
      [audit.permissionsAdded, audit.permissionsRemoved] = await Promise.all([
        permissionNames(added),
        permissionNames(removed),
      ]);
    }
  }

  // Nothing changed: no write, no audit record.
  if (Object.keys(changes).length === 0) return getRole(role._id);

  assertConfirmed({
    permissionIds: nextIds,
    activeAccountCount: await activeCountFor(role._id),
    confirmNoPermissions: input.confirmNoPermissions,
    confirmAffectedAccounts: input.confirmAffectedAccounts,
  });

  try {
    await updateRoleById(role._id, { ...changes, updatedBy: actorAccountId });
  } catch (error) {
    if (error?.code === 11000) throw nameTaken();
    throw error;
  }

  await recordAuditEvent({
    actorAccountId,
    action,
    targetType: AUDIT_TARGET.ROLE,
    targetId: role._id,
    summary: `${action === AUDIT_ACTION.ROLE_UPDATED ? "Updated" : "Assigned permissions to"} role ${changes.name ?? role.name}`,
    changes: audit,
  });

  return getRole(role._id);
};

// UC46 Update Role.
export const updateRole = (actorAccountId, roleId, input) =>
  changeRole(actorAccountId, roleId, input, AUDIT_ACTION.ROLE_UPDATED);

// UC47 Assign Permission To Role.
export const assignRolePermissions = (actorAccountId, roleId, input) =>
  changeRole(actorAccountId, roleId, input, AUDIT_ACTION.ROLE_PERMISSIONS_ASSIGNED);
